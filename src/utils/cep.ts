export function normalizeCep(cep: string) {
  return cep.replace(/\D/g, "");
}

export function isNumberOnly(value: string) {
  return /^[0-9]+$/.test(value);
}

export function isValidCep(cep: string) {
  const normalizedCep = normalizeCep(cep);
  return normalizedCep.length === 8 && isNumberOnly(normalizedCep);
}

