import type { Request, Response } from "express";
import { User } from "../models";
import { getEmailValidationError, normalizeEmail } from "../utils/email";
import { getPasswordValidationError, hashPassword, verifyPassword } from "../utils/password";
import { getPhoneValidationError, normalizePhone } from "../utils/phone";
import { generateToken } from "../utils/token";

type RegisterBody = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

export class AuthController {
  static async register(req: Request, res: Response) {
    const { name, email, phone, password } = req.body as RegisterBody;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "name, email, phone e password sao obrigatorios" });
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

    const normalizedEmail = normalizeEmail(email);
    const exists = await User.findOne({ where: { email: normalizedEmail } });

    if (exists) {
      return res.status(409).json({ message: "Email ja cadastrado" });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizePhone(phone),
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
