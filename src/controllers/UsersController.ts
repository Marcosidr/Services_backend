import type { Request, Response } from "express";
import {
  createUser,
  deleteUserById,
  getUserById,
  listUsers,
  type UserPayload,
  UsersServiceError,
  updateUserById
} from "../services/usersService";
import { paginateItems, parsePagination } from "../utils/pagination";

function parseUserId(value: string) {
  if (!/^\d+$/.test(value)) return null;

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  return id;
}

function handleServiceError(res: Response, error: unknown) {
  if (error instanceof UsersServiceError) {
    return res.status(error.status).json({ message: error.message });
  }

  console.error(error);
  return res.status(500).json({ message: "Erro interno do servidor" });
}

function parseIdFromParams(req: Request, res: Response) {
  const idParam = req.params.id;
  if (typeof idParam !== "string") {
    res.status(400).json({ message: "id invalido" });
    return null;
  }

  const id = parseUserId(idParam);
  if (id === null) {
    res.status(400).json({ message: "id invalido" });
    return null;
  }

  return id;
}

export class UsersController {
  static async index(req: Request, res: Response) {
    try {
      const users = await listUsers();
      const pagination = parsePagination({
        page: req.query.page,
        limit: req.query.limit
      });

      if (pagination) {
        return res.json(paginateItems(users, pagination));
      }

      return res.json(users);
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async show(req: Request, res: Response) {
    const userId = parseIdFromParams(req, res);
    if (userId === null) return;

    try {
      const user = await getUserById(userId);
      return res.json(user);
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async store(req: Request, res: Response) {
    try {
      const user = await createUser(req.body as UserPayload);
      return res.status(201).json(user);
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async update(req: Request, res: Response) {
    const userId = parseIdFromParams(req, res);
    if (userId === null) return;

    try {
      const user = await updateUserById(userId, req.body as UserPayload);
      return res.json(user);
    } catch (error) {
      return handleServiceError(res, error);
    }
  }

  static async destroy(req: Request, res: Response) {
    const userId = parseIdFromParams(req, res);
    if (userId === null) return;

    try {
      await deleteUserById(userId);
      return res.status(204).send();
    } catch (error) {
      return handleServiceError(res, error);
    }
  }
}
