import type { Request, Response } from "express";
import { User } from "../models";
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
  password?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

type CpfLookupParams = {
  cpf?: string;
};

function normalizeOptionalText(value: string | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
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
    role: user.role
  };
}

export class AuthController {
  static async lookupByCpf(req: Request<CpfLookupParams>, res: Response) {
    const rawCpf = typeof req.params.cpf === "string" ? req.params.cpf : "";
    const normalizedCpf = normalizeCpf(rawCpf);

    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({ message: "CPF invalido" });
    }

    const user = await User.findOne({ where: { cpf: normalizedCpf } });

    if (!user) {
      return res.json({ exists: false });
    }

    return res.json({
      exists: true,
      user: publicUser(user)
    });
  }

  static async register(req: Request, res: Response) {
    const { name, email, cpf, phone, cep, endereco, numero, complemento, bairro, cidade, uf, estado, password } =
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

    return res.status(201).json({
      message: "Conta criada com sucesso",
      token: generateToken({
        sub: String(user.id),
        role: user.role,
        email: user.email
      }),
      user: publicUser(user)
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
    const user = await User.findOne({ where: { email: normalizedEmail } });

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
}
