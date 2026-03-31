import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../src/app";

describe("error response format", () => {
  it("wraps middleware auth errors with standard envelope", async () => {
    const response = await request(app).get("/api/users");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      message: "Token invalido ou ausente",
      error: {
        status: 401,
        code: "UNAUTHORIZED",
        message: "Token invalido ou ausente"
      }
    });
  });

  it("returns standardized 404 for unknown routes", async () => {
    const response = await request(app).get("/api/rota-inexistente");

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      status: 404,
      code: "NOT_FOUND"
    });
    expect(response.body.message).toContain("Rota nao encontrada");
  });
});
