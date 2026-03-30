import type { Request, Response } from "express";
import { Professional, User, UserProfile } from "../models";
import { isValidCep, normalizeCep } from "../utils/cep";
import { isValidCpf, normalizeCpf } from "../utils/cpf";
import { getEmailValidationError, normalizeEmail } from "../utils/email";
import { getPasswordValidationError, hashPassword, verifyPassword } from "../utils/password";
import { getPhoneValidationError, normalizePhone } from "../utils/phone";
import { generateToken } from "../utils/token";

type RegisterBody = {
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
  photoUrl?: string;
  bio?: string;
  password?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

type CpfLookupParams = {
  cpf?: string;
};

type UpdatePhotoBody = {
  photoUrl?: string;
};

type UpdateProfileBody = {
  name?: string;
  phone?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  photoUrl?: string;
  bio?: string;
};

function normalizeOptionalText(value: string | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePhotoUrl(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeBio(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getUserPhoto(user: User) {
  const professional = user.get("professional") as Professional | undefined;
  const profile = user.get("profile") as UserProfile | undefined;
  return normalizePhotoUrl(professional?.photoUrl) || normalizePhotoUrl(profile?.photoUrl);
}

function getUserBio(user: User) {
  const profile = user.get("profile") as UserProfile | undefined;
  return profile?.bio ?? null;
}

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    photo: getUserPhoto(user),
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
    bio: getUserBio(user),
    role: user.role
  };
}

async function loadUserWithProfile(userId: number) {
  return User.findByPk(userId, {
    include: [
      {
        association: "professional",
        attributes: ["photoUrl"]
      },
      {
        association: "profile",
        attributes: ["photoUrl", "bio"]
      }
    ]
  });
}

export class AuthController {
  static async me(req: Request, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const user = await loadUserWithProfile(authenticatedUserId);
    if (!user) {
      return res.status(401).json({ message: "Usuario da sessao nao encontrado" });
    }

    return res.json({ user: publicUser(user) });
  }

  static async lookupByCpf(req: Request<CpfLookupParams>, res: Response) {
    const rawCpf = typeof req.params.cpf === "string" ? req.params.cpf : "";
    const normalizedCpf = normalizeCpf(rawCpf);

    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({ message: "CPF invalido" });
    }

    const user = await User.findOne({
      where: { cpf: normalizedCpf },
      include: [
        {
          association: "professional",
          attributes: ["photoUrl"]
        },
        {
          association: "profile",
          attributes: ["photoUrl", "bio"]
        }
      ]
    });

    if (!user) {
      return res.json({ exists: false });
    }

    return res.json({
      exists: true,
      user: publicUser(user)
    });
  }

  static async register(req: Request, res: Response) {
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
      photoUrl,
      bio
    } =
      req.body as RegisterBody;

    if (!name || !email || !cpf || !phone || !cep || !endereco || !numero || !bairro || !cidade || !uf || !password) {
      return res
        .status(400)
        .json({ message: "name, email, cpf, phone, cep, endereco, numero, bairro, cidade, uf e password sao obrigatorios" });
    }

    const passwordValidationError = getPasswordValidationError(password);
    if (passwordValidationError) {
      return res.status(400).json({ message: passwordValidationError });
    }

    const emailValidationError = getEmailValidationError(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    const phoneValidationError = getPhoneValidationError(phone);
    if (phoneValidationError) {
      return res.status(400).json({ message: phoneValidationError });
    }

    const normalizedCpf = normalizeCpf(cpf);
    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({ message: "CPF invalido" });
    }

    const normalizedCep = normalizeCep(cep);
    if (!isValidCep(normalizedCep)) {
      return res.status(400).json({ message: "CEP invalido" });
    }

    if (!/^[a-zA-Z]{2}$/.test(uf.trim())) {
      return res.status(400).json({ message: "UF invalida" });
    }

    const normalizedEmail = normalizeEmail(email);
    const [cpfExists, exists] = await Promise.all([
      User.findOne({ where: { cpf: normalizedCpf } }),
      User.findOne({
        where: {
          email: normalizedEmail
        }
      })
    ]);

    if (cpfExists) {
      return res.status(409).json({ message: "CPF ja cadastrado" });
    }

    if (exists) {
      return res.status(409).json({ message: "Email ja cadastrado" });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      cpf: normalizedCpf,
      phone: normalizePhone(phone),
      cep: normalizedCep,
      endereco: endereco.trim(),
      numero: numero.trim(),
      complemento: normalizeOptionalText(complemento),
      bairro: bairro.trim(),
      cidade: cidade.trim(),
      uf: uf.trim().toUpperCase(),
      estado: normalizeOptionalText(estado),
      password: hashPassword(password),
      role: "user"
    });

    const normalizedPhoto = normalizePhotoUrl(photoUrl);
    const normalizedBio = normalizeBio(bio);
    if (normalizedPhoto || normalizedBio) {
      await UserProfile.create({
        userId: user.id,
        photoUrl: normalizedPhoto || null,
        bio: normalizedBio
      });
    }

    const savedUser = await loadUserWithProfile(user.id);

    return res.status(201).json({
      message: "Conta criada com sucesso",
      token: generateToken({
        sub: String(user.id),
        role: user.role,
        email: user.email
      }),
      user: publicUser(savedUser ?? user)
    });
  }

  static async login(req: Request, res: Response) {
    const { email, password } = req.body as LoginBody;

    if (!email || !password) {
      return res.status(400).json({ message: "email e password sao obrigatorios" });
    }

    const emailValidationError = getEmailValidationError(email);
    if (emailValidationError) {
      return res.status(400).json({ message: emailValidationError });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({
      where: { email: normalizedEmail },
      include: [
        {
          association: "professional",
          attributes: ["photoUrl"]
        },
        {
          association: "profile",
          attributes: ["photoUrl", "bio"]
        }
      ]
    });

    if (!user?.password || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: "Email ou senha invalidos" });
    }

    return res.json({
      message: "Login realizado com sucesso",
      token: generateToken({
        sub: String(user.id),
        role: user.role,
        email: user.email
      }),
      user: publicUser(user)
    });
  }

  static async updateMyPhoto(req: Request<unknown, unknown, UpdatePhotoBody>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const photoUrl = normalizePhotoUrl(req.body.photoUrl) || null;
    const existingProfile = await UserProfile.findOne({
      where: { userId: authenticatedUserId }
    });

    if (existingProfile) {
      await existingProfile.update({ photoUrl });
    } else {
      await UserProfile.create({
        userId: authenticatedUserId,
        photoUrl,
        bio: null
      });
    }

    const user = await loadUserWithProfile(authenticatedUserId);

    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    return res.json({
      message: "Foto atualizada com sucesso",
      user: publicUser(user)
    });
  }

  static async updateMyProfile(req: Request<unknown, unknown, UpdateProfileBody>, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const user = await User.findByPk(authenticatedUserId);
    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    const {
      name,
      phone,
      cep,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      estado,
      photoUrl,
      bio
    } = req.body;

    if (typeof phone === "string" && phone.trim()) {
      const phoneValidationError = getPhoneValidationError(phone);
      if (phoneValidationError) {
        return res.status(400).json({ message: phoneValidationError });
      }
    }

    if (typeof cep === "string" && cep.trim()) {
      const normalizedCep = normalizeCep(cep);
      if (!isValidCep(normalizedCep)) {
        return res.status(400).json({ message: "CEP invalido" });
      }
    }

    if (typeof uf === "string" && uf.trim() && !/^[a-zA-Z]{2}$/.test(uf.trim())) {
      return res.status(400).json({ message: "UF invalida" });
    }

    await user.update({
      ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
      ...(typeof phone !== "undefined"
        ? {
            phone: typeof phone === "string" && phone.trim() ? normalizePhone(phone) : null
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
      ...(typeof estado !== "undefined" ? { estado: normalizeOptionalText(estado) } : {})
    });

    if (typeof photoUrl !== "undefined" || typeof bio !== "undefined") {
      const existingProfile = await UserProfile.findOne({
        where: { userId: authenticatedUserId }
      });

      const nextPhotoUrl =
        typeof photoUrl !== "undefined"
          ? normalizePhotoUrl(photoUrl) || null
          : existingProfile?.photoUrl ?? null;
      const nextBio = typeof bio !== "undefined" ? normalizeBio(bio) : existingProfile?.bio ?? null;

      if (existingProfile) {
        await existingProfile.update({
          photoUrl: nextPhotoUrl,
          bio: nextBio
        });
      } else if (nextPhotoUrl || nextBio) {
        await UserProfile.create({
          userId: authenticatedUserId,
          photoUrl: nextPhotoUrl,
          bio: nextBio
        });
      }
    }

    const updatedUser = await loadUserWithProfile(authenticatedUserId);
    if (!updatedUser) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    return res.json({
      message: "Perfil atualizado com sucesso",
      user: publicUser(updatedUser)
    });
  }
}
