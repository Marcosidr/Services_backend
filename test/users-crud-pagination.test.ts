import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { errorEnvelopeMiddleware, errorHandler, notFoundHandler } from "../src/middlewares/errorHandlers";

jest.mock("../src/services/usersService", () => {
  const actual = jest.requireActual("../src/services/usersService") as any;
  return {
    ...actual,
    listUsers: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    updateUserById: jest.fn(),
    deleteUserById: jest.fn()
  };
});

jest.mock("../src/middlewares/auth", () => ({
  auth: (_req: unknown, _res: unknown, next: () => void) => next()
}));

jest.mock("../src/middlewares/requireRole", () => ({
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next()
}));

const usersRouter = require("../src/routes/users.routes").default as typeof import("../src/routes/users.routes").default;
const usersService = require("../src/services/usersService") as typeof import("../src/services/usersService");

const { createUser, deleteUserById, getUserById, listUsers, updateUserById, UsersServiceError } = usersService;

const listUsersMock = listUsers as unknown as jest.Mock;
const getUserByIdMock = getUserById as unknown as jest.Mock;
const createUserMock = createUser as unknown as jest.Mock;
const updateUserByIdMock = updateUserById as unknown as jest.Mock;
const deleteUserByIdMock = deleteUserById as unknown as jest.Mock;

function createUsersTestApp() {
  const app = express();
  app.use(express.json());
  app.use(errorEnvelopeMiddleware);
  app.use("/api/users", usersRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function buildUser(id: number) {
  return {
    id,
    name: `Usuario ${id}`,
    email: `usuario${id}@teste.com`,
    cpf: `529982247${String(id).padStart(2, "0")}`,
    phone: null,
    cep: null,
    endereco: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    uf: null,
    estado: null,
    role: "user",
    photo: "",
    bio: null,
    categories: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe("users crud + pagination requirements", () => {
  const app = createUsersTestApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns paginated users with page, limit, total, totalPages and hasNext", async () => {
    const users = Array.from({ length: 25 }, (_, index) => buildUser(index + 1));
    listUsersMock.mockImplementation(async () => users);

    const response = await request(app).get("/api/users?page=2&limit=10");

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(2);
    expect(response.body.limit).toBe(10);
    expect(response.body.total).toBe(25);
    expect(response.body.totalPages).toBe(3);
    expect(response.body.hasNext).toBe(true);
    expect(response.body.items).toHaveLength(10);
  });

  it("returns 404 standardized error when user does not exist", async () => {
    getUserByIdMock.mockImplementation(async () => {
      throw new UsersServiceError(404, "Usuario nao encontrado");
    });

    const response = await request(app).get("/api/users/9999");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Usuario nao encontrado",
      error: {
        status: 404,
        code: "NOT_FOUND",
        message: "Usuario nao encontrado"
      }
    });
  });

  it("returns 409 standardized error for duplicate e-mail on create", async () => {
    createUserMock.mockImplementation(async () => {
      throw new UsersServiceError(409, "Email ja cadastrado");
    });

    const response = await request(app).post("/api/users").send({
      name: "Duplicado",
      email: "duplicado@teste.com",
      cpf: "52998224725",
      password: "Senha@123"
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Email ja cadastrado"
    });
  });

  it("returns 404 standardized error on update for non-existent user", async () => {
    updateUserByIdMock.mockImplementation(async () => {
      throw new UsersServiceError(404, "Usuario nao encontrado");
    });

    const response = await request(app).put("/api/users/7777").send({
      name: "Nao Existe"
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Usuario nao encontrado"
    });
  });

  it("returns 404 standardized error on delete for non-existent user", async () => {
    deleteUserByIdMock.mockImplementation(async () => {
      throw new UsersServiceError(404, "Usuario nao encontrado");
    });

    const response = await request(app).delete("/api/users/5555");

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Usuario nao encontrado"
    });
  });
});
