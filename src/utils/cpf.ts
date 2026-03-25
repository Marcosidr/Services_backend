export function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

function calculateCpfDigit(base: string, startFactor: number) {
  let total = 0;
  let factor = startFactor;

  for (const digit of base) {
    total += Number(digit) * factor;
    factor -= 1;
  }

  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(cpf: string) {
  const normalizedCpf = normalizeCpf(cpf);

  if (!/^\d{11}$/.test(normalizedCpf)) return false;
  if (/^(\d)\1{10}$/.test(normalizedCpf)) return false;

  const firstDigit = calculateCpfDigit(normalizedCpf.slice(0, 9), 10);
  if (firstDigit !== Number(normalizedCpf[9])) return false;

  const secondDigit = calculateCpfDigit(normalizedCpf.slice(0, 10), 11);
  return secondDigit === Number(normalizedCpf[10]);
}
