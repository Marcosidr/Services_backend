import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { hashPassword } from "../src/utils/password";

jest.mock("../src/models", () => ({
  User: {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn()
  },
  UserProfile: {
    findOne: jest.fn(),
    create: jest.fn()
  },
  Professional: {}
}));

jest.mock("../src/utils/token", () => ({
  generateToken: jest.fn(() => "fake-jwt-token")
}));

const { AuthController } = require("../src/controllers/AuthController") as typeof import("../src/controllers/AuthController");

type Role = "user" | "professional" | "admin";

type FakeUserOptions = {
  id?: number;
  name?: string;
  email?: string;
  cpf?: string | null;
  phone?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  estado?: string | null;
  password?: string | null;
  role?: Role;
  profile?: { photoUrl?: string | null; bio?: string | null } | null;
  professional?: { photoUrl?: string | null } | null;
};

type MockResponse = Response & {
  statusCode?: number;
  body?: unknown;
};

const models = jest.requireMock("../src/models") as any;

function createFakeUser(options: FakeUserOptions = {}) {
  const profile = options.profile ?? null;
  const professional = options.professional ?? null;

  return {
    id: options.id ?? 1,
    name: options.name ?? "Usuario Teste",
    email: options.email ?? "usuario@teste.com",
    cpf: options.cpf ?? "52998224725",
    phone: options.phone ?? "11999999999",
    cep: options.cep ?? "01310930",
    endereco: options.endereco ?? "Avenida Paulista",
    numero: options.numero ?? "1000",
    complemento: options.complemento ?? null,
    bairro: options.bairro ?? "Bela Vista",
    cidade: options.cidade ?? "Sao Paulo",
    uf: options.uf ?? "SP",
    estado: options.estado ?? "Sao Paulo",
    password: options.password ?? hashPassword("Senha@123"),
    role: options.role ?? "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    update: jest.fn(async () => undefined),
    get: jest.fn((association: string) => {
      if (association === "profile") return profile;
      if (association === "professional") return professional;
      return undefined;
    })
  };
}

function createRequest(partial: Partial<Request>) {
  return partial as Request;
}

function createResponse() {
  const res = {} as MockResponse;

  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response["status"];

  res.json = jest.fn((payload: unknown) => {
    res.body = payload;
    return res;
  }) as unknown as Response["json"];

  return res;
}

describe("auth requirements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers user with required fields and returns JWT", async () => {
    const createdUser = createFakeUser({
      id: 7,
      email: "novo@teste.com",
      cpf: "52998224725"
    });

    models.User.findOne
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => null);
    models.User.create.mockImplementation(async () => createdUser);
    models.User.findByPk.mockImplementation(async () => createdUser);

    const req = createRequest({
      body: {
        name: "Novo Usuario",
        email: "novo@teste.com",
        cpf: "529.982.247-25",
        phone: "(11) 99999-9999",
        cep: "01310-930",
        endereco: "Avenida Paulista",
        numero: "1000",
        bairro: "Bela Vista",
        cidade: "Sao Paulo",
        uf: "SP",
        password: "Senha@123"
      }
    });
    const res = createResponse();

    await AuthController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body).toMatchObject({
      message: "Conta criada com sucesso",
      token: "fake-jwt-token",
      user: {
        id: 7,
        email: "novo@teste.com"
      }
    });
  });

  it("prevents duplicate email on register (409)", async () => {
    models.User.findOne
      .mockImplementationOnce(async () => null)
      .mockImplementationOnce(async () => createFakeUser({ email: "duplicado@teste.com" }));

    const req = createRequest({
      body: {
        name: "Duplicado",
        email: "duplicado@teste.com",
        cpf: "529.982.247-25",
        phone: "(11) 99999-9999",
        cep: "01310-930",
        endereco: "Rua A",
        numero: "1",
        bairro: "Centro",
        cidade: "Sao Paulo",
        uf: "SP",
        password: "Senha@123"
      }
    });
    const res = createResponse();

    await AuthController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Email ja cadastrado" });
  });

  it("allows login only with valid credentials", async () => {
    const user = createFakeUser({
      email: "login@teste.com",
      password: hashPassword("Senha@123")
    });
    models.User.findOne.mockImplementation(async () => user);

    const req = createRequest({
      body: {
        email: "login@teste.com",
        password: "Senha@123"
      }
    });
    const res = createResponse();

    await AuthController.login(req, res);

    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({
      message: "Login realizado com sucesso",
      token: "fake-jwt-token",
      user: { email: "login@teste.com" }
    });
  });

  it("returns 401 for invalid login credentials", async () => {
    const user = createFakeUser({
      email: "login@teste.com",
      password: hashPassword("Senha@123")
    });
    models.User.findOne.mockImplementation(async () => user);

    const req = createRequest({
      body: {
        email: "login@teste.com",
        password: "SenhaErrada@123"
      }
    });
    const res = createResponse();

    await AuthController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ message: "Email ou senha invalidos" });
  });

  it("returns authenticated user in /me", async () => {
    const user = createFakeUser({ id: 12, email: "me@teste.com" });
    models.User.findByPk.mockImplementation(async () => user);

    const req = createRequest({ user: { id: 12, sub: "12", role: "user" } });
    const res = createResponse();

    await AuthController.me(req, res);

    expect(res.body).toMatchObject({
      user: {
        id: 12,
        email: "me@teste.com"
      }
    });
  });

  it("blocks e-mail change in profile update", async () => {
    const user = createFakeUser({ id: 1, email: "original@teste.com" });
    models.User.findByPk.mockImplementation(async () => user);

    const req = createRequest({
      user: { id: 1, sub: "1", role: "user" },
      body: {
        email: "novo@teste.com"
      }
    });
    const res = createResponse();

    await AuthController.updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ message: "Nao e permitido alterar email" });
  });

  it("requires confirmPassword when password is updated", async () => {
    const user = createFakeUser({ id: 1, email: "perfil@teste.com" });
    models.User.findByPk.mockImplementation(async () => user);

    const req = createRequest({
      user: { id: 1, sub: "1", role: "user" },
      body: {
        password: "SenhaNova@123"
      }
    });
    const res = createResponse();

    await AuthController.updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ message: "Confirme a nova senha" });
  });
});
