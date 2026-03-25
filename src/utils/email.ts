const EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const MAX_EMAIL_LENGTH = 254;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return EMAIL_REGEX.test(normalizeEmail(email));
}

export function getEmailValidationError(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return "Informe o email";
  }

  if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
    return "Email invalido";
  }

  if (!isValidEmail(normalizedEmail)) {
    return "Email invalido. Exemplo: nome@dominio.com";
  }

  return null;
}
