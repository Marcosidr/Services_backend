import { Category, User, UserProfile } from "../models";
import { isValidCep, normalizeCep } from "../utils/cep";
import { isValidCpf, normalizeCpf } from "../utils/cpf";
import { getEmailValidationError, normalizeEmail } from "../utils/email";
import { getPasswordValidationError, hashPassword } from "../utils/password";
import { getPhoneValidationError, normalizePhone } from "../utils/phone";
import { fetchAddressByCep, validateCepWithApi } from "../utils/viacep";

type UserRole = "user" | "professional" | "admin";

export type UserPayload = {
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  password?: string;
  role?: UserRole;
  categoryId?: number | string;
  categoryIds?: Array<number | string>;
};

export class UsersServiceError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "UsersServiceError";
  }
}

const userAttributes: string[] = [
  "id",
  "name",
  "email",
  "cpf",
  "phone",
  "cep",
  "endereco",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
  "estado",
  "role",
  "createdAt",
  "updatedAt"
];

function categoriesInclude() {
  return [
    {
      association: "categories",
      attributes: ["id", "slug", "label", "icon", "is_active"],
      through: { attributes: [] }
    },
    {
      association: "profile",
      attributes: ["photoUrl", "bio"]
    }
  ];
}

function sanitizeUser(user: User) {
  const userCategories = (user.get("categories") as Category[] | undefined) ?? [];
  const profile = user.get("profile") as UserProfile | undefined;

  return {
    id: user.id,
    name: user.name,
    photo: typeof profile?.photoUrl === "string" ? profile.photoUrl : "",
    bio: typeof profile?.bio === "string" ? profile.bio : null,
    email: user.email,
    cpf: user.cpf,
    phone: user.phone,
    cep: user.cep,
    endereco: user.endereco,
    numero: user.numero,
    complemento: user.complemento,
    bairro: user.bairro,
    cidade: user.cidade,
    uf: user.uf,
    estado: user.estado,
    role: user.role,
    categories: userCategories.map((category) => ({
      id: category.id,
      slug: category.slug,
      label: category.label,
      icon: category.icon,
      is_active: category.is_active
    })),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function hasCategoryPayload(payload: UserPayload) {
  return typeof payload.categoryId !== "undefined" || typeof payload.categoryIds !== "undefined";
}

function normalizeOptionalText(value: string | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function findUserOrThrow(id: number) {
  const user = await User.findByPk(id);
  if (!user) {
    throw new UsersServiceError(404, "Usuario nao encontrado");
  }

  return user;
}

function assertNoCategoryPayload(payload: UserPayload) {
  if (hasCategoryPayload(payload)) {
    throw new UsersServiceError(400, "Categorias so podem ser definidas no cadastro de profissional");
  }
}

function assertValidRole(role: UserRole | undefined) {
  if (role && role !== "user" && role !== "professional" && role !== "admin") {
    throw new UsersServiceError(400, "role invalida");
  }
}

function assertValidUf(uf: string | undefined) {
  if (typeof uf === "string" && uf.trim() && !/^[a-zA-Z]{2}$/.test(uf.trim())) {
    throw new UsersServiceError(400, "UF invalida");
  }
}

function assertValidCep(cep: string | undefined) {
  if (typeof cep === "string" && cep.trim()) {
    const normalizedCep = normalizeCep(cep);
    if (!isValidCep(normalizedCep)) {
      throw new UsersServiceError(400, "CEP invalido");
    }
  }
}

function assertValidPhone(phone: string | undefined) {
  if (typeof phone === "string" && phone.trim()) {
    const phoneValidationError = getPhoneValidationError(phone);
    if (phoneValidationError) {
      throw new UsersServiceError(400, phoneValidationError);
    }
  }
}

function assertPhoneIsRequired(phone: string | undefined) {
  if (!phone || !phone.trim()) {
    throw new UsersServiceError(400, "Telefone e obrigatorio");
  }

  assertValidPhone(phone);
}

function assertValidPassword(password: string | undefined) {
  if (!password) return;

  const passwordValidationError = getPasswordValidationError(password);
  if (passwordValidationError) {
    throw new UsersServiceError(400, passwordValidationError);
  }
}

async function assertValidCepWithAddress(
  cep: string | undefined,
  endereco: string | undefined,
  numero: string | undefined,
  bairro: string | undefined,
  cidade: string | undefined,
  uf: string | undefined
) {
  if (!cep || !cep.trim()) {
    return; // CEP opciona, se nao informado, nao valida
  }

  // Validar formato do CEP
  assertValidCep(cep);

  // Se CEP foi informado, buscar dados na API
  const cepValidationError = await validateCepWithApi(cep);
  if (cepValidationError) {
    throw new UsersServiceError(400, cepValidationError);
  }

  // Se CEP é válido, campos de endereço se tornam obrigatórios
  if (!endereco || !endereco.trim()) {
    throw new UsersServiceError(400, "Endereco e obrigatorio quando CEP e informado");
  }

  if (!numero || !numero.trim()) {
    throw new UsersServiceError(400, "Numero e obrigatorio quando CEP e informado");
  }

  if (!bairro || !bairro.trim()) {
    throw new UsersServiceError(400, "Bairro e obrigatorio quando CEP e informado");
  }

  if (!cidade || !cidade.trim()) {
    throw new UsersServiceError(400, "Cidade e obrigatoria quando CEP e informado");
  }

  if (!uf || !uf.trim()) {
    throw new UsersServiceError(400, "UF e obrigatoria quando CEP e informado");
  }

  // Validar UF
  assertValidUf(uf);
}

async function fetchUserWithRelations(userId: number) {
  return User.findByPk(userId, {
    attributes: userAttributes,
    include: categoriesInclude()
  });
}

export async function listUsers() {
  const users = await User.findAll({
    order: [["createdAt", "DESC"]],
    attributes: userAttributes,
    include: categoriesInclude()
  });

  return users.map(sanitizeUser);
}

export async function getUserById(userId: number) {
  const user = await fetchUserWithRelations(userId);
  if (!user) {
    throw new UsersServiceError(404, "Usuario nao encontrado");
  }

  return sanitizeUser(user);
}

export async function createUser(payload: UserPayload) {
  const {
    name,
    email,
    cpf,
    phone,
    cep,
    endereco,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    estado,
    password,
    role
  } = payload;

  assertNoCategoryPayload(payload);

  if (!name || !email || !cpf || !password) {
    throw new UsersServiceError(400, "name, email, cpf e password sao obrigatorios");
  }

  // Telefone é OBRIGATÓRIO
  if (!phone || !phone.trim()) {
    throw new UsersServiceError(400, "Telefone e obrigatorio");
  }

  const emailValidationError = getEmailValidationError(email);
  if (emailValidationError) {
    throw new UsersServiceError(400, emailValidationError);
  }

  assertValidPassword(password);

  const normalizedCpf = normalizeCpf(cpf);
  if (!isValidCpf(normalizedCpf)) {
    throw new UsersServiceError(400, "CPF invalido");
  }

  // Validação de CEP com integração de API e endereço
  await assertValidCepWithAddress(cep, endereco, numero, bairro, cidade, uf);

  assertValidUf(uf);
  assertPhoneIsRequired(phone);
  assertValidRole(role);
  if (role === "professional") {
    throw new UsersServiceError(
      400,
      "Cadastro profissional deve usar o fluxo de profissionais com validacoes completas"
    );
  }

  const normalizedEmail = normalizeEmail(email);
  const [existingEmail, existingCpf] = await Promise.all([
    User.findOne({ where: { email: normalizedEmail } }),
    User.findOne({ where: { cpf: normalizedCpf } })
  ]);

  if (existingEmail) {
    throw new UsersServiceError(409, "Email ja cadastrado");
  }

  if (existingCpf) {
    throw new UsersServiceError(409, "CPF ja cadastrado");
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    cpf: normalizedCpf,
    phone: normalizePhone(phone),
    cep: typeof cep === "string" && cep.trim() ? normalizeCep(cep) : null,
    endereco: normalizeOptionalText(endereco),
    numero: normalizeOptionalText(numero),
    complemento: normalizeOptionalText(complemento),
    bairro: normalizeOptionalText(bairro),
    cidade: normalizeOptionalText(cidade),
    uf: typeof uf === "string" && uf.trim() ? uf.trim().toUpperCase() : null,
    estado: normalizeOptionalText(estado),
    password: hashPassword(password),
    role: role ?? "user"
  });

  const savedUser = await fetchUserWithRelations(user.id);
  return sanitizeUser(savedUser ?? user);
}

export async function updateUserById(userId: number, payload: UserPayload) {
  const { name, email, cpf, phone, cep, endereco, numero, complemento, bairro, cidade, uf, estado, password, role } =
    payload;

  assertNoCategoryPayload(payload);

  if (typeof email !== "undefined" || typeof cpf !== "undefined") {
    throw new UsersServiceError(400, "Nao e permitido alterar email ou cpf");
  }

  if (
    !name &&
    typeof phone === "undefined" &&
    typeof cep === "undefined" &&
    typeof endereco === "undefined" &&
    typeof numero === "undefined" &&
    typeof complemento === "undefined" &&
    typeof bairro === "undefined" &&
    typeof cidade === "undefined" &&
    typeof uf === "undefined" &&
    typeof estado === "undefined" &&
    !password &&
    !role
  ) {
    throw new UsersServiceError(400, "Informe ao menos um campo para atualizar");
  }

  const user = await findUserOrThrow(userId);

  assertValidPassword(password);
  // Validação de telefone: se informado, a validação de obrigatoriedade só se aplica em createUser
  assertValidPhone(phone);
  // Validação de CEP com endereço
  await assertValidCepWithAddress(cep, endereco, numero, bairro, cidade, uf);
  assertValidUf(uf);
  assertValidRole(role);
  if (role === "professional" && user.role !== "professional") {
    throw new UsersServiceError(
      400,
      "Promocao para profissional deve usar o fluxo de profissionais com validacoes completas"
    );
  }

  await user.update({
    ...(name ? { name: name.trim() } : {}),
    ...(typeof phone !== "undefined"
      ? {
          phone:
            typeof phone === "string" && phone.trim()
              ? normalizePhone(phone)
              : null
        }
      : {}),
    ...(typeof cep !== "undefined"
      ? {
          cep: typeof cep === "string" && cep.trim() ? normalizeCep(cep) : null
        }
      : {}),
    ...(typeof endereco !== "undefined" ? { endereco: normalizeOptionalText(endereco) } : {}),
    ...(typeof numero !== "undefined" ? { numero: normalizeOptionalText(numero) } : {}),
    ...(typeof complemento !== "undefined" ? { complemento: normalizeOptionalText(complemento) } : {}),
    ...(typeof bairro !== "undefined" ? { bairro: normalizeOptionalText(bairro) } : {}),
    ...(typeof cidade !== "undefined" ? { cidade: normalizeOptionalText(cidade) } : {}),
    ...(typeof uf !== "undefined"
      ? {
          uf: typeof uf === "string" && uf.trim() ? uf.trim().toUpperCase() : null
        }
      : {}),
    ...(typeof estado !== "undefined" ? { estado: normalizeOptionalText(estado) } : {}),
    ...(password ? { password: hashPassword(password) } : {}),
    ...(role ? { role } : {})
  });

  const savedUser = await fetchUserWithRelations(userId);
  return sanitizeUser(savedUser ?? user);
}

export async function deleteUserById(userId: number) {
  const user = await findUserOrThrow(userId);
  await user.destroy();
}
