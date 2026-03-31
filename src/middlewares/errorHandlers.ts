import type { NextFunction, Request, Response } from "express";
import { buildErrorResponse, getErrorCodeByStatus, normalizeErrorResponse } from "../utils/errorResponse";

type ErrorWithStatus = {
  status?: unknown;
  message?: unknown;
  code?: unknown;
  details?: unknown;
};

function parseHttpStatus(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const parsed = Math.trunc(value);
  if (parsed < 400 || parsed > 599) return null;
  return parsed;
}

function parseErrorMessage(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function parseErrorCode(value: unknown, fallbackStatus: number) {
  if (typeof value === "string" && value.trim()) return value.trim().toUpperCase();
  return getErrorCodeByStatus(fallbackStatus);
}

export function errorEnvelopeMiddleware(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res) as Response["json"];

  res.json = ((body: unknown) => {
    if (res.statusCode >= 400) {
      return originalJson(normalizeErrorResponse(res.statusCode, body));
    }

    return originalJson(body);
  }) as Response["json"];

  next();
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    message: `Rota nao encontrada: ${req.method} ${req.originalUrl}`
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(error);
  }

  const normalizedError = error as ErrorWithStatus;
  const status = parseHttpStatus(normalizedError?.status) ?? 500;
  const message = parseErrorMessage(
    normalizedError?.message,
    status === 500 ? "Erro interno do servidor" : "Erro na requisicao"
  );
  const code = parseErrorCode(normalizedError?.code, status);

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json(
    buildErrorResponse(status, message, {
      code,
      ...(typeof normalizedError?.details !== "undefined"
        ? { details: normalizedError.details }
        : {})
    })
  );
}
