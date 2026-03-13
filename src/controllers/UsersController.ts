import type { Request, Response } from "express";
import { User } from "../models";

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export class UsersController {
  static async index(req: Request, res: Response) {
    const users = await User.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "name", "email", "createdAt", "updatedAt"]
    });
    return res.json(users);
  }

  static async show(req: Request, res: Response) {
    const idParam = req.params.id;
    if (typeof idParam !== "string") return res.status(400).json({ message: "id inválido" });
    const id = idParam;
    if (!isValidUuid(id)) return res.status(400).json({ message: "id inválido" });

    const user = await User.findByPk(id, {
      attributes: ["id", "name", "email", "createdAt", "updatedAt"]
    });
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

    return res.json(user);
  }

  static async store(req: Request, res: Response) {
    const { name, email } = req.body as { name?: string; email?: string };

    if (!name || !email) {
      return res.status(400).json({ message: "name e email são obrigatórios" });
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ message: "Email já cadastrado" });

    const user = await User.create({ name, email });

    return res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  }

  static async update(req: Request, res: Response) {
    const idParam = req.params.id;
    if (typeof idParam !== "string") return res.status(400).json({ message: "id inválido" });
    const id = idParam;
    if (!isValidUuid(id)) return res.status(400).json({ message: "id inválido" });

    const { name, email } = req.body as { name?: string; email?: string };
    if (!name && !email) {
      return res.status(400).json({ message: "Informe name e/ou email" });
    }

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

    if (email && email !== user.email) {
      const exists = await User.findOne({ where: { email } });
      if (exists) return res.status(409).json({ message: "Email já cadastrado" });
    }

    await user.update({
      ...(name ? { name } : {}),
      ...(email ? { email } : {})
    });

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  }

  static async destroy(req: Request, res: Response) {
    const idParam = req.params.id;
    if (typeof idParam !== "string") return res.status(400).json({ message: "id inválido" });
    const id = idParam;
    if (!isValidUuid(id)) return res.status(400).json({ message: "id inválido" });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

    await user.destroy();
    return res.status(204).send();
  }
}
