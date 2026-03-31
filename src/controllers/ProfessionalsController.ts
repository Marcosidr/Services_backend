import type { Request, Response } from "express";
import { Op, Transaction } from "sequelize";
import {
  Category,
  Professional,
  ProfessionalReview,
  User,
  UserCategory,
  UserProfile
} from "../models";
import { createNotification } from "../services/notificationService";
import { buildProfessionalProfileUpdatePayload } from "../services/professionalProfileService";
import { isValidCep, normalizeCep } from "../utils/cep";
import { isValidCpf, normalizeCpf } from "../utils/cpf";
import { getEmailValidationError, normalizeEmail } from "../utils/email";
import {
  calculateDistanceKm,
  parseLatitude,
  parseLongitude,
  validateCoordinatePair
} from "../utils/geo";
import type { GeoPoint } from "../utils/geo";
import { paginateItems, parsePagination } from "../utils/pagination";
import { getPasswordValidationError, hashPassword, verifyPassword } from "../utils/password";
import { getPhoneValidationError, normalizePhone } from "../utils/phone";

type RegisterProfessionalBody = {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  password?: string;
  description?: string;
  experience?: string;
  price?: string | number;
  priceUnit?: string;
  area?: string | number;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  city?: string;
  uf?: string;
  estado?: string;
  online?: boolean | string;
  photoUrl?: string;
  latitude?: string | number;
  longitude?: string | number;
  categoryIds?: unknown;
  categoryId?: unknown;
  "categoryIds[]"?: unknown;
};

type UpgradeProfessionalBody = {
  userId?: unknown;
  cpf?: string;
  password?: string;
  description?: string;
  experience?: string;
  price?: string | number;
  priceUnit?: string;
  area?: string | number;
  cep?: string;
  city?: string;
  online?: boolean | string;
  photoUrl?: string;
  latitude?: string | number;
  longitude?: string | number;
  categoryIds?: unknown;
  categoryId?: unknown;
  "categoryIds[]"?: unknown;
};

type UpdateProfessionalProfileBody = {
  description?: string;
  experience?: string;
  price?: string | number;
  priceUnit?: string;
  area?: string | number;
  cep?: string;
  city?: string;
  online?: boolean | string;
  photoUrl?: string;
  latitude?: string | number;
  longitude?: string | number;
};

type SanitizedReview = {
  id: string;
  user: string;
  userPhoto: string;
  rating: number;
  date: string;
  text: string;
};

type ReviewSnapshot = {
  rating: number;
  reviews: number;
  reviewList: SanitizedReview[];
};

function parseCategoryFilter(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function parseTextFilter(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function parseUserId(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function parseProfessionalId(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  return id;
}

function parseCategoryIds(input: unknown): number[] | null {
  if (typeof input === "undefined" || input === null) return [];

  let rawList: unknown[] = [];

  if (Array.isArray(input)) {
    rawList = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();

    if (!trimmed) return [];

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        rawList = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return null;
      }
    } else if (trimmed.includes(",")) {
      rawList = trimmed.split(",").map((item) => item.trim());
    } else {
      rawList = [trimmed];
    }
  } else {
    rawList = [input];
  }

  const parsedIds: number[] = [];

  for (const rawItem of rawList) {
    const normalized =
      typeof rawItem === "number"
        ? rawItem
        : typeof rawItem === "string" && /^\d+$/.test(rawItem.trim())
        ? Number(rawItem.trim())
        : NaN;

    if (!Number.isSafeInteger(normalized) || normalized <= 0) {
      return null;
    }

    parsedIds.push(normalized);
  }

  return Array.from(new Set(parsedIds));
}

function parseOptionalNumber(value: unknown) {
  if (typeof value === "undefined" || value === null || value === "") return null;

  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function parseOnlineFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "sim";
  }

  return false;
}

function normalizeOptionalText(value: string | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePhotoUrl(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function formatReviewDate(value: Date) {
  return value.toLocaleDateString("pt-BR");
}

function categoriesInclude() {
  return [
    {
      association: "categories",
      attributes: ["id", "slug", "label", "icon", "is_active"],
      through: { attributes: [] }
    },
    {
      association: "professional",
      attributes: [
        "id",
        "cpf",
        "description",
        "experience",
        "price",
        "priceUnit",
        "areaKm",
        "cep",
        "city",
        "latitude",
        "longitude",
        "online",
        "verified",
        "approvalStatus",
        "photoUrl"
      ]
    },
    {
      association: "profile",
      attributes: ["photoUrl"]
    }
  ];
}

function sanitizeProfessional(
  user: User,
  reviewSnapshot?: ReviewSnapshot,
  requesterLocation?: GeoPoint | null
) {
  const categories = (user.get("categories") as Category[] | undefined) ?? [];
  const professional = user.get("professional") as Professional | undefined;
  const profile = user.get("profile") as UserProfile | undefined;

  const categoryLabels = categories.map((category) => category.label);
  const categoryIds = categories.map((category) => String(category.id));
  const photo =
    normalizePhotoUrl(professional?.photoUrl) ||
    normalizePhotoUrl(profile?.photoUrl);
  const rating = reviewSnapshot?.rating ?? 0;
  const reviews = reviewSnapshot?.reviews ?? 0;
  const professionalLatitude =
    typeof professional?.latitude === "number" ? professional.latitude : null;
  const professionalLongitude =
    typeof professional?.longitude === "number" ? professional.longitude : null;
  const distance =
    requesterLocation &&
    professionalLatitude !== null &&
    professionalLongitude !== null
      ? calculateDistanceKm(requesterLocation, {
          latitude: professionalLatitude,
          longitude: professionalLongitude
        })
      : null;

  return {
    id: String(user.id),
    name: user.name,
    photo,
    online: Boolean(professional?.online),
    verified: Boolean(professional?.verified),
    categoryLabel: categoryLabels.join(" / "),
    categoryIds,
    rating,
    reviews,
    city: professional?.city ?? "",
    distance,
    completedJobs: reviews,
    area: professional?.areaKm ?? 10,
    description: professional?.description ?? "",
    tags: categoryLabels,
    price: Number(professional?.price ?? 0),
    priceUnit: professional?.priceUnit ?? "servico",
    phone: user.phone ?? "",
    reviewList: reviewSnapshot?.reviewList ?? []
  };
}

async function buildReviewSnapshots(professionalUserIds: number[]) {
  const snapshotMap = new Map<number, ReviewSnapshot>();
  if (professionalUserIds.length === 0) return snapshotMap;

  const reviews = await ProfessionalReview.findAll({
    where: {
      professionalUserId: {
        [Op.in]: professionalUserIds
      }
    },
    include: [
      {
        association: "reviewer",
        attributes: ["id", "name"],
        include: [
          {
            association: "profile",
            attributes: ["photoUrl"]
          }
        ]
      }
    ],
    order: [["createdAt", "DESC"]]
  });

  const totals = new Map<number, { sum: number; count: number }>();

  for (const review of reviews) {
    const currentTotals = totals.get(review.professionalUserId) ?? {
      sum: 0,
      count: 0
    };

    currentTotals.sum += review.rating;
    currentTotals.count += 1;
    totals.set(review.professionalUserId, currentTotals);

    const currentSnapshot = snapshotMap.get(review.professionalUserId) ?? {
      rating: 0,
      reviews: 0,
      reviewList: []
    };

    if (currentSnapshot.reviewList.length < 15) {
      const reviewer = review.get("reviewer") as User | undefined;
      const reviewerProfile = reviewer?.get("profile") as UserProfile | undefined;

      currentSnapshot.reviewList.push({
        id: String(review.id),
        user: reviewer?.name ?? "Usuario",
        userPhoto: normalizePhotoUrl(reviewerProfile?.photoUrl),
        rating: review.rating,
        date: formatReviewDate(review.createdAt),
        text: review.comment ?? ""
      });
    }

    snapshotMap.set(review.professionalUserId, currentSnapshot);
  }

  totals.forEach((item, professionalUserId) => {
    const currentSnapshot = snapshotMap.get(professionalUserId) ?? {
      rating: 0,
      reviews: 0,
      reviewList: []
    };

    const averageRating = item.count > 0 ? item.sum / item.count : 0;
    currentSnapshot.rating = Number(averageRating.toFixed(1));
    currentSnapshot.reviews = item.count;

    snapshotMap.set(professionalUserId, currentSnapshot);
  });

  return snapshotMap;
}

async function categoriesAreValid(categoryIds: number[]) {
  const categoriesCount = await Category.count({
    where: {
      id: {
        [Op.in]: categoryIds
      },
      is_active: true
    }
  });

  return categoriesCount === categoryIds.length;
}

async function saveProfessionalData(
  user: User,
  professionalBody: {
    cpf: string;
    description: string;
    experience?: string;
    price?: string | number;
    priceUnit?: string;
    area?: string | number;
    cep?: string;
    city?: string;
    online?: boolean | string;
    photoUrl?: string;
    latitude?: number | null;
    longitude?: number | null;
  },
  categoryIds: number[],
  transaction: Transaction
) {
  const parsedPrice = parseOptionalNumber(professionalBody.price);
  const parsedArea = parseOptionalNumber(professionalBody.area);

  await Professional.create(
    {
      userId: user.id,
      cpf: professionalBody.cpf,
      description: professionalBody.description.trim(),
      experience: professionalBody.experience?.trim() || null,
      price: parsedPrice,
      priceUnit: professionalBody.priceUnit?.trim() || "servico",
      areaKm: parsedArea && parsedArea > 0 ? Math.round(parsedArea) : 10,
      cep: professionalBody.cep?.trim() || null,
      city: professionalBody.city?.trim() || null,
      latitude:
        typeof professionalBody.latitude === "number"
          ? professionalBody.latitude
          : null,
      longitude:
        typeof professionalBody.longitude === "number"
          ? professionalBody.longitude
          : null,
      online: parseOnlineFlag(professionalBody.online),
      verified: false,
      approvalStatus: "pending",
      photoUrl: normalizePhotoUrl(professionalBody.photoUrl) || null
    },
    { transaction }
  );

  await UserCategory.bulkCreate(
    categoryIds.map((currentCategoryId) => ({
      userId: user.id,
      categoryId: currentCategoryId
    })),
    { transaction, ignoreDuplicates: true }
  );
}

export class ProfessionalsController {
  static async index(req: Request, res: Response) {
    const categoryFilter = parseCategoryFilter(req.query.categoryId ?? req.query.cat);
    const textFilter = parseTextFilter(req.query.q);
    const queryLatitude = parseLatitude(req.query.lat ?? req.query.latitude);
    const queryLongitude = parseLongitude(req.query.lng ?? req.query.longitude);
    const queryCoordinateError = validateCoordinatePair(queryLatitude, queryLongitude);

    if (queryCoordinateError) {
      return res.status(400).json({ message: queryCoordinateError });
    }

    const requesterLocation =
      queryLatitude.provided &&
      queryLongitude.provided &&
      queryLatitude.value !== null &&
      queryLongitude.value !== null
        ? {
            latitude: queryLatitude.value,
            longitude: queryLongitude.value
          }
        : null;

    const users = await User.findAll({
      where: { role: "professional" },
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    const professionalUserIds = users
      .filter((user) => {
        const professional = user.get("professional") as Professional | undefined;
        // Apenas professionais aprovados
        return professional && professional.approvalStatus === "approved";
      })
      .map((user) => user.id);
    const reviewSnapshots = await buildReviewSnapshots(professionalUserIds);

    let professionals = users
      .filter((user) => {
        const professional = user.get("professional") as Professional | undefined;
        // Apenas professionais aprovados
        return professional && professional.approvalStatus === "approved";
      })
      .map((user) =>
        sanitizeProfessional(user, reviewSnapshots.get(user.id), requesterLocation)
      );

    if (categoryFilter) {
      professionals = professionals.filter((professional) =>
        professional.categoryIds.includes(String(categoryFilter))
      );
    }

    if (textFilter) {
      professionals = professionals.filter((professional) => {
        const searchableText = [
          professional.name,
          professional.categoryLabel,
          professional.city,
          professional.description,
          professional.tags.join(" ")
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(textFilter);
      });
    }

    if (requesterLocation) {
      professionals = professionals.sort((first, second) => {
        const firstDistance =
          typeof first.distance === "number" ? first.distance : Number.POSITIVE_INFINITY;
        const secondDistance =
          typeof second.distance === "number" ? second.distance : Number.POSITIVE_INFINITY;

        if (firstDistance !== secondDistance) {
          return firstDistance - secondDistance;
        }

        return second.rating - first.rating;
      });
    }

    const pagination = parsePagination({
      page: req.query.page,
      limit: req.query.limit
    });

    if (pagination) {
      return res.json(paginateItems(professionals, pagination));
    }

    return res.json(professionals);
  }

  static async register(req: Request, res: Response) {
    const {
      name,
      email,
      phone,
      cpf,
      password,
      description,
      experience,
      price,
      priceUnit,
      area,
      cep,
      endereco,
      numero,
      complemento,
      bairro,
      city,
      uf,
      estado,
      online,
      photoUrl,
      latitude,
      longitude,
      categoryIds,
      categoryId
    } = req.body as RegisterProfessionalBody;

    const parsedLatitude = parseLatitude(latitude);
    const parsedLongitude = parseLongitude(longitude);
    const coordinateError = validateCoordinatePair(parsedLatitude, parsedLongitude);
    if (coordinateError) {
      return res.status(400).json({ message: coordinateError });
    }

    const parsedCategoryIds =
      parseCategoryIds(
        typeof categoryIds !== "undefined"
          ? categoryIds
          : typeof req.body["categoryIds[]"] !== "undefined"
          ? req.body["categoryIds[]"]
          : categoryId
      ) ?? null;

    if (!email || !cpf || !password) {
      return res.status(400).json({
        message: "email, cpf e password sao obrigatorios"
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({ message: "description e obrigatorio" });
    }

    const emailValidationError = getEmailValidationError(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    const passwordValidationError = getPasswordValidationError(password);
    if (passwordValidationError) {
      return res.status(400).json({ message: passwordValidationError });
    }

    if (parsedCategoryIds === null || parsedCategoryIds.length === 0) {
      return res.status(400).json({ message: "categoryIds invalido" });
    }

    if (!(await categoriesAreValid(parsedCategoryIds))) {
      return res.status(400).json({ message: "Uma ou mais categorias nao existem" });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedCpf = normalizeCpf(cpf);

    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({ message: "CPF invalido" });
    }

    if (!phone) {
      return res.status(400).json({ message: "phone e obrigatorio" });
    }

    const phoneValidationError = getPhoneValidationError(phone);
    if (phoneValidationError) {
      return res.status(400).json({ message: phoneValidationError });
    }

    if (!cep || !isValidCep(cep)) {
      return res.status(400).json({ message: "CEP invalido" });
    }

    if (!endereco || !endereco.trim()) {
      return res.status(400).json({ message: "endereco e obrigatorio" });
    }

    if (!numero || !numero.trim()) {
      return res.status(400).json({ message: "numero e obrigatorio" });
    }

    if (!bairro || !bairro.trim()) {
      return res.status(400).json({ message: "bairro e obrigatorio" });
    }

    if (!city || !city.trim()) {
      return res.status(400).json({ message: "city e obrigatorio" });
    }

    if (!uf || !/^[a-zA-Z]{2}$/.test(uf.trim())) {
      return res.status(400).json({ message: "UF invalida" });
    }

    const normalizedCep = normalizeCep(cep);
    const normalizedPhone = normalizePhone(phone);
    const normalizedUf = uf.trim().toUpperCase();

    const existingUserByEmail = await User.findOne({ where: { email: normalizedEmail } });
    const existingUserByCpf = await User.findOne({ where: { cpf: normalizedCpf } });
    let existingUser: User | null = null;

    if (existingUserByEmail && existingUserByCpf) {
      if (existingUserByEmail.id !== existingUserByCpf.id) {
        return res.status(409).json({ message: "Email e CPF pertencem a usuarios diferentes" });
      }

      existingUser = existingUserByEmail;
    } else {
      existingUser = existingUserByEmail ?? existingUserByCpf;
    }

    const existingProfessionalByCpf = await Professional.findOne({ where: { cpf: normalizedCpf } });

    if (existingProfessionalByCpf && existingProfessionalByCpf.userId !== existingUser?.id) {
      return res.status(409).json({ message: "CPF ja cadastrado por outro profissional" });
    }

    if (existingUser?.role === "admin") {
      return res.status(403).json({ message: "Nao e permitido promover usuario admin para profissional" });
    }

    if (existingUser?.cpf && existingUser.cpf !== normalizedCpf) {
      return res.status(409).json({ message: "CPF informado nao confere com o usuario existente" });
    }

    if (existingUser && existingUser.email !== normalizedEmail) {
      return res.status(409).json({ message: "Email informado nao confere com o usuario existente" });
    }

    if (!existingUser && !name) {
      return res.status(400).json({
        message: "name e obrigatorio ao cadastrar profissional sem usuario previo"
      });
    }

    if (existingUser) {
      const existingProfessional = await Professional.findOne({ where: { userId: existingUser.id } });
      if (existingProfessional) {
        return res.status(409).json({ message: "Usuario ja possui cadastro profissional" });
      }

      if (existingUser.password && !verifyPassword(password, existingUser.password)) {
        return res.status(401).json({ message: "Senha invalida para o usuario informado" });
      }
    }

    const createdUserId = await User.sequelize!.transaction(async (transaction: Transaction) => {
      let user = existingUser;

      if (!user) {
        user = await User.create(
          {
            name: name!.trim(),
            email: normalizedEmail,
            cpf: normalizedCpf,
            phone: normalizedPhone,
            cep: normalizedCep,
            endereco: endereco.trim(),
            numero: numero.trim(),
            complemento: normalizeOptionalText(complemento),
            bairro: bairro.trim(),
            cidade: city.trim(),
            uf: normalizedUf,
            estado: normalizeOptionalText(estado),
            password: hashPassword(password),
            role: "user"
          },
          { transaction }
        );
      } else {
        await user.update(
          {
            ...(name ? { name: name.trim() } : {}),
            ...(email ? { email: normalizedEmail } : {}),
            ...(!user.cpf ? { cpf: normalizedCpf } : {}),
            ...(phone ? { phone: normalizedPhone } : {}),
            ...(cep ? { cep: normalizedCep } : {}),
            ...(endereco ? { endereco: endereco.trim() } : {}),
            ...(numero ? { numero: numero.trim() } : {}),
            ...(typeof complemento !== "undefined" ? { complemento: normalizeOptionalText(complemento) } : {}),
            ...(bairro ? { bairro: bairro.trim() } : {}),
            ...(city ? { cidade: city.trim() } : {}),
            ...(uf ? { uf: normalizedUf } : {}),
            ...(typeof estado !== "undefined" ? { estado: normalizeOptionalText(estado) } : {}),
            ...(!user.password ? { password: hashPassword(password) } : {})
          },
          { transaction }
        );
      }

      await saveProfessionalData(
        user,
        {
          cpf: normalizedCpf,
          description,
          experience,
          price,
          priceUnit,
          area,
          cep: normalizedCep,
          city: city.trim(),
          online,
          photoUrl,
          latitude: parsedLatitude.value,
          longitude: parsedLongitude.value
        },
        parsedCategoryIds,
        transaction
      );

      return user.id;
    });

    const savedUser = await User.findByPk(createdUserId, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    if (!savedUser) {
      return res.status(500).json({ message: "Falha ao carregar profissional criado" });
    }

    const adminUsers = await User.findAll({
      where: { role: "admin" },
      attributes: ["id"]
    });

    await Promise.all(
      adminUsers.map((adminUser) =>
        createNotification({
          userId: adminUser.id,
          type: "professional_pending",
          title: "Novo cadastro profissional pendente",
          message: `${savedUser.name} solicitou aprovacao de cadastro profissional.`,
          metadata: {
            applicantUserId: savedUser.id
          }
        })
      )
    );

    return res.status(201).json({
      message: "Cadastro de profissional enviado para aprovacao",
      professional: sanitizeProfessional(savedUser)
    });
  }

  static async upgradeFromUser(req: Request, res: Response) {
    const {
      userId,
      cpf,
      password,
      description,
      experience,
      price,
      priceUnit,
      area,
      cep,
      city,
      online,
      photoUrl,
      latitude,
      longitude,
      categoryIds,
      categoryId
    } = req.body as UpgradeProfessionalBody;

    const parsedLatitude = parseLatitude(latitude);
    const parsedLongitude = parseLongitude(longitude);
    const coordinateError = validateCoordinatePair(parsedLatitude, parsedLongitude);
    if (coordinateError) {
      return res.status(400).json({ message: coordinateError });
    }

    const parsedUserId = parseUserId(userId);
    if (!parsedUserId) {
      return res.status(400).json({ message: "userId invalido" });
    }

    if (!cpf || !description || !description.trim()) {
      return res.status(400).json({ message: "cpf e description sao obrigatorios" });
    }

    const parsedCategoryIds =
      parseCategoryIds(
        typeof categoryIds !== "undefined"
          ? categoryIds
          : typeof req.body["categoryIds[]"] !== "undefined"
          ? req.body["categoryIds[]"]
          : categoryId
      ) ?? null;

    if (parsedCategoryIds === null || parsedCategoryIds.length === 0) {
      return res.status(400).json({ message: "categoryIds invalido" });
    }

    if (!(await categoriesAreValid(parsedCategoryIds))) {
      return res.status(400).json({ message: "Uma ou mais categorias nao existem" });
    }

    const normalizedCpf = normalizeCpf(cpf);
    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({ message: "CPF invalido" });
    }

    const user = await User.findByPk(parsedUserId);
    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    if (user.role === "admin") {
      return res.status(403).json({ message: "Nao e permitido promover usuario admin para profissional" });
    }

    const existingProfessional = await Professional.findOne({ where: { userId: parsedUserId } });
    if (existingProfessional) {
      return res.status(409).json({ message: "Usuario ja possui cadastro profissional" });
    }

    const existingProfessionalByCpf = await Professional.findOne({ where: { cpf: normalizedCpf } });
    if (existingProfessionalByCpf) {
      return res.status(409).json({ message: "CPF ja cadastrado por outro profissional" });
    }

    if (!user.password) {
      if (!password) {
        return res.status(400).json({ message: "password e obrigatorio para concluir o cadastro profissional" });
      }

      const passwordValidationError = getPasswordValidationError(password);
      if (passwordValidationError) {
        return res.status(400).json({ message: passwordValidationError });
      }
    }

    await User.sequelize!.transaction(async (transaction: Transaction) => {
      await user.update(
        {
          ...(!user.password && password ? { password: hashPassword(password) } : {})
        },
        { transaction }
      );

      await saveProfessionalData(
        user,
        {
          cpf: normalizedCpf,
          description,
          experience,
          price,
          priceUnit,
          area,
          cep,
          city,
          online,
          photoUrl,
          latitude: parsedLatitude.value,
          longitude: parsedLongitude.value
        },
        parsedCategoryIds,
        transaction
      );
    });

    const savedUser = await User.findByPk(parsedUserId, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    if (!savedUser) {
      return res.status(500).json({ message: "Falha ao carregar profissional criado" });
    }

    const adminUsers = await User.findAll({
      where: { role: "admin" },
      attributes: ["id"]
    });

    await Promise.all(
      adminUsers.map((adminUser) =>
        createNotification({
          userId: adminUser.id,
          type: "professional_pending",
          title: "Novo cadastro profissional pendente",
          message: `${savedUser.name} solicitou aprovacao de cadastro profissional.`,
          metadata: {
            applicantUserId: savedUser.id
          }
        })
      )
    );

    return res.status(201).json({
      message: "Solicitacao enviada para aprovacao do admin",
      professional: sanitizeProfessional(savedUser)
    });
  }

  static async me(req: Request, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const professionalUser = await User.findByPk(authenticatedUserId, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    if (!professionalUser || !professionalUser.get("professional")) {
      return res.status(404).json({ message: "Perfil profissional nao encontrado" });
    }

    const reviewSnapshots = await buildReviewSnapshots([professionalUser.id]);
    const professionalProfile = professionalUser.get("professional") as Professional;

    return res.json({
      ...sanitizeProfessional(professionalUser, reviewSnapshots.get(professionalUser.id)),
      latitude:
        typeof professionalProfile.latitude === "number"
          ? professionalProfile.latitude
          : null,
      longitude:
        typeof professionalProfile.longitude === "number"
          ? professionalProfile.longitude
          : null
    });
  }

  static async updateMyProfile(req: Request<unknown, unknown, UpdateProfessionalProfileBody>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const professional = await Professional.findOne({
      where: { userId: authenticatedUserId }
    });
    if (!professional) {
      return res.status(404).json({ message: "Perfil profissional nao encontrado" });
    }

    const profileUpdate = buildProfessionalProfileUpdatePayload(req.body, professional.areaKm);
    if (!profileUpdate.ok) {
      return res.status(profileUpdate.status).json({ message: profileUpdate.message });
    }

    await professional.update(profileUpdate.payload);

    const professionalUser = await User.findByPk(authenticatedUserId, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    if (!professionalUser) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    const reviewSnapshots = await buildReviewSnapshots([professionalUser.id]);
    const savedProfessional = professionalUser.get("professional") as Professional | undefined;

    return res.json({
      message: "Perfil profissional atualizado com sucesso",
      professional: {
        ...sanitizeProfessional(professionalUser, reviewSnapshots.get(professionalUser.id)),
        latitude:
          typeof savedProfessional?.latitude === "number"
            ? savedProfessional.latitude
            : null,
        longitude:
          typeof savedProfessional?.longitude === "number"
            ? savedProfessional.longitude
            : null
      }
    });
  }

  static async show(req: Request, res: Response) {
    const professionalId = parseProfessionalId(req.params.id);
    if (!professionalId) {
      return res.status(400).json({ message: "id invalido" });
    }

    const professional = await User.findByPk(professionalId, {
      attributes: ["id", "name", "email", "phone", "role", "createdAt", "updatedAt"],
      include: categoriesInclude()
    });

    if (!professional || !professional.get("professional")) {
      return res.status(404).json({ message: "Profissional nao encontrado" });
    }

    const professionalProfile = professional.get("professional") as Professional | undefined;
    if (!professionalProfile || professionalProfile.approvalStatus !== "approved" || professional.role !== "professional") {
      return res.status(404).json({ message: "Profissional nao encontrado" });
    }

    const reviewSnapshots = await buildReviewSnapshots([professional.id]);
    return res.json(sanitizeProfessional(professional, reviewSnapshots.get(professional.id)));
  }
}
