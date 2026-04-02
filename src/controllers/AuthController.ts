import type { Request, Response } from "express";
import { Professional, User, UserProfile } from "../models";
import { UserValidator, type LoginInput, type RegisterInput, type UpdateProfileInput } from "../validators/UserValidator";
import { isValidCpf, normalizeCpf } from "../utils/cpf";
import { normalizeEmail } from "../utils/email";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateToken } from "../utils/token";

type CpfLookupParams = {
  cpf?: string;
};

type UpdatePhotoBody = {
  photoUrl?: string;
};

/**
 * Helpers - Formatação de resposta
 */

function normalizePhotoUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function getUserPhoto(user: User): string {
  const professional = user.get("professional") as Professional | undefined;
  const profile = user.get("profile") as UserProfile | undefined;
  const profPhoto = professional?.photoUrl || "";
  const profilePhoto = profile?.photoUrl || "";
  return (typeof profPhoto === "string" ? profPhoto.trim() : "") || (typeof profilePhoto === "string" ? profilePhoto.trim() : "");
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

  /**
   * Verifica se CPF e Email já existem
   */
  private static async checkDuplicates(cpf: string, email: string) {
    const [cpfExists, emailExists] = await Promise.all([
      User.findOne({ where: { cpf } }),
      User.findOne({ where: { email } })
    ]);

    if (cpfExists) {
      return { field: "cpf", message: "CPF ja cadastrado" };
    }
    if (emailExists) {
      return { field: "email", message: "Email ja cadastrado" };
    }

    return null;
  }

  /**
   * Cria usuário e seu perfil no banco
   */
  private static async createUserAndProfile(registerData: ReturnType<typeof UserValidator.normalizeRegisterData>) {
    const user = await User.create({
      name: registerData.name,
      email: registerData.email,
      cpf: registerData.cpf,
      phone: registerData.phone,
      cep: registerData.cep,
      endereco: registerData.endereco,
      numero: registerData.numero,
      complemento: registerData.complemento,
      bairro: registerData.bairro,
      cidade: registerData.cidade,
      uf: registerData.uf,
      estado: registerData.estado,
      password: registerData.password,
      role: "user"
    });

    if (registerData.photoUrl || registerData.bio) {
      await UserProfile.create({
        userId: user.id,
        photoUrl: registerData.photoUrl || null,
        bio: registerData.bio
      });
    }

    return user.id;
  }

  /**
   * Registro de novo usuário
   */
  static async register(req: Request, res: Response) {
    const input = req.body as RegisterInput;

    // Validação centralizada
    const validationError = UserValidator.validateRegisterInput(input);
    if (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    // Verifica duplicatas
    const normalizedInput = {
      cpf: normalizeCpf(input.cpf || ""),
      email: normalizeEmail(input.email || "")
    };

    const duplicateError = await AuthController.checkDuplicates(normalizedInput.cpf, normalizedInput.email);
    if (duplicateError) {
      return res.status(409).json({ message: duplicateError.message });
    }

    // Cria usuário
    const registerData = UserValidator.normalizeRegisterData(input);
    const userId = await AuthController.createUserAndProfile(registerData);

    // Carrega usuário com relacionamentos
    const savedUser = await loadUserWithProfile(userId);

    return res.status(201).json({
      message: "Conta criada com sucesso",
      token: generateToken({
        sub: String(userId),
        role: "user",
        email: normalizedInput.email
      }),
      user: publicUser(savedUser || { id: userId } as User)
    });
  }

  /**
   * Login do usuário
   */
  static async login(req: Request, res: Response) {
    const input = req.body as LoginInput;

    // Validação centralizada
    const validationError = UserValidator.validateLoginInput(input);
    if (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    const normalizedEmail = normalizeEmail(input.email || "");
    const user = await AuthController.loadUserByEmail(normalizedEmail);

    // Verifica senha
    const passwordValid = user?.password && verifyPassword(input.password || "", user.password);
    if (!user || !passwordValid) {
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

  /**
   * Helper: carrega usuário por email com relacionamentos
   */
  private static async loadUserByEmail(email: string) {
    return User.findOne({
      where: { email: normalizeEmail(email) },
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

  /**
   * Valida que email não está sendo alterado
   */
  private static validateEmailNotChanged(providedEmail: string | undefined, userEmail: string): string | null {
    if (typeof providedEmail === "undefined") return null;

    const normalized = normalizeEmail(providedEmail || "");
    if (!normalized || normalized !== userEmail) {
      return "Nao e permitido alterar email";
    }
    return null;
  }

  /**
   * Valida que CPF não está sendo alterado
   */
  private static validateCpfNotChanged(providedCpf: string | undefined, userCpf: string | null): string | null {
    if (typeof providedCpf === "undefined") return null;

    const normalized = normalizeCpf(providedCpf || "");
    const cpfValid = isValidCpf(normalized);

    if (!normalized || !cpfValid) {
      return "CPF invalido";
    }
    if (normalized !== userCpf) {
      return "Nao e permitido alterar CPF";
    }
    return null;
  }

  /**
   * Valida dados de senha para atualização
   */
  private static validatePasswordUpdate(password: string | undefined, confirmPassword: string | undefined): string | null {
    const hasPassword = typeof password !== "undefined";
    const hasConfirmPassword = typeof confirmPassword !== "undefined";
    const normPassword = typeof password === "string" ? password.trim() : "";
    const normConfirmPassword = typeof confirmPassword === "string" ? confirmPassword.trim() : "";

    if (hasConfirmPassword && !hasPassword && normConfirmPassword) {
      return "Informe a nova senha para confirmar";
    }

    if (hasPassword && normPassword) {
      if (!normConfirmPassword) {
        return "Confirme a nova senha";
      }
      if (normPassword !== normConfirmPassword) {
        return "As senhas nao coincidem";
      }

      const error = UserValidator.validatePassword(normPassword);
      if (error) return error.message;
    } else if (hasConfirmPassword && normConfirmPassword) {
      return "Informe a nova senha para confirmar";
    }

    return null;
  }

  /**
   * Valida campos de endereço opcionais
   */
  private static validateAddressFields(input: UpdateProfileInput): string | null {
    if (typeof input.phone === "string" && input.phone.trim()) {
      const error = UserValidator.validatePhone(input.phone);
      if (error) return error.message;
    }

    if (typeof input.cep === "string" && input.cep.trim()) {
      const error = UserValidator.validateCep(input.cep);
      if (error) return error.message;
    }

    if (typeof input.uf === "string" && input.uf.trim()) {
      const error = UserValidator.validateUf(input.uf);
      if (error) return error.message;
    }

    return null;
  }

  /**
   * Constrói payload de atualização do usuário
   */
  private static buildUserUpdatePayload(input: UpdateProfileInput, password: string | null) {
    const updates: Record<string, any> = {};

    if (typeof input.name === "string" && input.name.trim()) {
      updates.name = input.name.trim();
    }

    if (typeof input.phone !== "undefined") {
      updates.phone = typeof input.phone === "string" && input.phone.trim() ? input.phone.trim() : null;
    }

    if (typeof input.cep !== "undefined") {
      updates.cep = typeof input.cep === "string" && input.cep.trim() ? input.cep.trim() : null;
    }

    if (typeof input.endereco !== "undefined") {
      updates.endereco = typeof input.endereco === "string" ? input.endereco.trim() || null : null;
    }

    if (typeof input.numero !== "undefined") {
      updates.numero = typeof input.numero === "string" ? input.numero.trim() || null : null;
    }

    if (typeof input.complemento !== "undefined") {
      updates.complemento = typeof input.complemento === "string" ? input.complemento.trim() || null : null;
    }

    if (typeof input.bairro !== "undefined") {
      updates.bairro = typeof input.bairro === "string" ? input.bairro.trim() || null : null;
    }

    if (typeof input.cidade !== "undefined") {
      updates.cidade = typeof input.cidade === "string" ? input.cidade.trim() || null : null;
    }

    if (typeof input.uf !== "undefined") {
      updates.uf = typeof input.uf === "string" && input.uf.trim() ? input.uf.trim().toUpperCase() : null;
    }

    if (typeof input.estado !== "undefined") {
      updates.estado = typeof input.estado === "string" ? input.estado.trim() || null : null;
    }

    if (password) {
      updates.password = password;
    }

    return updates;
  }

  /**
   * Atualiza ou cria profile do usuário com foto e bio
   */
  private static async updateUserProfile(userId: number, input: UpdateProfileInput) {
    const shouldUpdateProfile = typeof input.photoUrl !== "undefined" || typeof input.bio !== "undefined";
    if (!shouldUpdateProfile) return;

    const existingProfile = await UserProfile.findOne({ where: { userId } });

    const photoUrl = typeof input.photoUrl !== "undefined" ? (typeof input.photoUrl === "string" ? input.photoUrl.trim() : "") : existingProfile?.photoUrl ?? "";
    const bio = typeof input.bio !== "undefined" ? (typeof input.bio === "string" ? input.bio.trim() : "") : existingProfile?.bio ?? "";

    const nextPhotoUrl = photoUrl || null;
    const nextBio = bio || null;

    if (existingProfile) {
      await existingProfile.update({ photoUrl: nextPhotoUrl, bio: nextBio });
    } else if (nextPhotoUrl || nextBio) {
      await UserProfile.create({ userId, photoUrl: nextPhotoUrl, bio: nextBio });
    }
  }

  /**
   * Atualiza perfil do usuário autenticado
   */
  static async updateMyProfile(req: Request, res: Response) {
    const authenticatedUserId = req.user?.id ?? null;
    if (!authenticatedUserId) {
      return res.status(401).json({ message: "Token de autenticacao invalido ou ausente" });
    }

    const user = await User.findByPk(authenticatedUserId);
    if (!user) {
      return res.status(404).json({ message: "Usuario nao encontrado" });
    }

    const input = req.body as UpdateProfileInput;

    // Valida email (não pode mudar)
    const emailError = AuthController.validateEmailNotChanged(input.email, user.email);
    if (emailError) return res.status(400).json({ message: emailError });

    // Valida CPF (não pode mudar)
    const cpfError = AuthController.validateCpfNotChanged(input.cpf, user.cpf);
    if (cpfError) return res.status(400).json({ message: cpfError });

    // Valida senha se informada
    const passwordError = AuthController.validatePasswordUpdate(input.password, input.confirmPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });

    // Valida campos de endereço
    const addressError = AuthController.validateAddressFields(input);
    if (addressError) return res.status(400).json({ message: addressError });

    // Constrói e executa update
    const normalizedPassword = typeof input.password === "string" ? input.password.trim() : "";
    const hashedPassword = normalizedPassword ? hashPassword(normalizedPassword) : null;
    const updatePayload = AuthController.buildUserUpdatePayload(input, hashedPassword);

    await user.update(updatePayload);
    await AuthController.updateUserProfile(authenticatedUserId, input);

    // Carrega e retorna usuário atualizado
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
