type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE_ENTITY"
  | "INTERNAL_SERVER_ERROR";

const DEFAULT_MESSAGES: Record<number, string> = {
  400: "Requisicao invalida",
  401: "Nao autorizado",
  403: "Acesso negado",
  404: "Recurso nao encontrado",
  409: "Conflito de dados",
  422: "Entidade nao processavel",
  500: "Erro interno do servidor"
};

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  500: "INTERNAL_SERVER_ERROR"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getMessageFromBody(body: unknown) {
  if (typeof body === "string" && body.trim()) return body.trim();
  if (!isRecord(body)) return null;

  const message = body.message;
  if (typeof message === "string" && message.trim()) return message.trim();

  const error = body.error;
  if (!isRecord(error)) return null;
  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return null;
}

function getCodeFromBody(body: unknown) {
  if (!isRecord(body)) return null;

  const code = body.code;
  if (typeof code === "string" && code.trim()) return code.trim().toUpperCase();

  const error = body.error;
  if (!isRecord(error)) return null;
  if (typeof error.code === "string" && error.code.trim()) {
    return error.code.trim().toUpperCase();
  }

  return null;
}

function getDetailsFromBody(body: unknown) {
  if (!isRecord(body)) return undefined;

  if (Object.prototype.hasOwnProperty.call(body, "details")) {
    return body.details;
  }

  const error = body.error;
  if (!isRecord(error)) return undefined;
  if (Object.prototype.hasOwnProperty.call(error, "details")) {
    return error.details;
  }

  return undefined;
}

function isStandardErrorBody(body: unknown) {
  if (!isRecord(body)) return false;
  if (typeof body.message !== "string") return false;
  if (!isRecord(body.error)) return false;

  const error = body.error;
  return (
    typeof error.status === "number" &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}

export function getErrorCodeByStatus(status: number) {
  return STATUS_TO_CODE[status] ?? "INTERNAL_SERVER_ERROR";
}

export function getDefaultMessageByStatus(status: number) {
  return DEFAULT_MESSAGES[status] ?? DEFAULT_MESSAGES[500];
}

export function buildErrorResponse(
  status: number,
  message?: string,
  options?: {
    code?: string;
    details?: unknown;
  }
) {
  const resolvedMessage =
    typeof message === "string" && message.trim()
      ? message.trim()
      : getDefaultMessageByStatus(status);
  const resolvedCode =
    typeof options?.code === "string" && options.code.trim()
      ? options.code.trim().toUpperCase()
      : getErrorCodeByStatus(status);

  const payload: {
    message: string;
    error: {
      status: number;
      code: string;
      message: string;
      details?: unknown;
    };
  } = {
    message: resolvedMessage,
    error: {
      status,
      code: resolvedCode,
      message: resolvedMessage
    }
  };

  if (typeof options?.details !== "undefined") {
    payload.error.details = options.details;
  }

  return payload;
}

export function normalizeErrorResponse(status: number, body: unknown) {
  if (isStandardErrorBody(body)) return body;

  const message = getMessageFromBody(body) ?? getDefaultMessageByStatus(status);
  const code = getCodeFromBody(body) ?? getErrorCodeByStatus(status);
  const details = getDetailsFromBody(body);

  return buildErrorResponse(status, message, {
    code,
    ...(typeof details !== "undefined" ? { details } : {})
  });
}
