import { isValidCep, normalizeCep } from "../utils/cep";
import { isValidCpf, normalizeCpf } from "../utils/cpf";
import { getEmailValidationError, normalizeEmail } from "../utils/email";
import { getPasswordValidationError, hashPassword } from "../utils/password";
import { getPhoneValidationError, normalizePhone } from "../utils/phone";

export type ValidationError = {
  field: string;
  message: string;
};

export type RegisterInput = {
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  photoUrl?: string;
  bio?: string;
  password?: string;
};

export type LoginInput = {
  email?: string;
  password?: string;
};

export type UpdateProfileInput = {
  email?: string;
  cpf?: string;
  name?: string;
  phone?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  photoUrl?: string;
  bio?: string;
  password?: string;
  confirmPassword?: string;
};

export class UserValidator {
  /**
   * Valida campos obrigatórios para registro
   */
  static validateRegisterRequired(input: RegisterInput): ValidationError | null {
    const required = ["name", "email", "cpf", "phone", "cep", "endereco", "numero", "bairro", "cidade", "uf", "password"];
    const missing = required.filter((field) => !input[field as keyof RegisterInput]);

    if (missing.length > 0) {
      return {
        field: "required",
        message: `${missing.join(", ")} sao obrigatorios`
      };
    }

    return null;
  }

  /**
   * Valida email
   */
  static validateEmail(email: string): ValidationError | null {
    const error = getEmailValidationError(email);
    if (error) {
      return { field: "email", message: error };
    }
    return null;
  }

  /**
   * Valida senha
   */
  static validatePassword(password: string): ValidationError | null {
    const error = getPasswordValidationError(password);
    if (error) {
      return { field: "password", message: error };
    }
    return null;
  }

  /**
   * Valida CPF
   */
  static validateCpf(cpf: string): ValidationError | null {
    const normalized = normalizeCpf(cpf);
    if (!isValidCpf(normalized)) {
      return { field: "cpf", message: "CPF invalido" };
    }
    return null;
  }

  /**
   * Valida telefone
   */
  static validatePhone(phone: string): ValidationError | null {
    const error = getPhoneValidationError(phone);
    if (error) {
      return { field: "phone", message: error };
    }
    return null;
  }

  /**
   * Valida CEP
   */
  static validateCep(cep: string): ValidationError | null {
    const normalized = normalizeCep(cep);
    if (!isValidCep(normalized)) {
      return { field: "cep", message: "CEP invalido" };
    }
    return null;
  }

  /**
   * Valida UF (sigla de estado)
   */
  static validateUf(uf: string): ValidationError | null {
    if (!/^[a-zA-Z]{2}$/.test(uf.trim())) {
      return { field: "uf", message: "UF invalida" };
    }
    return null;
  }

  /**
   * Valida confirmação de senha
   */
  static validatePasswordConfirmation(password: string, confirmPassword: string): ValidationError | null {
    if (password !== confirmPassword) {
      return { field: "confirmPassword", message: "As senhas nao coincidem" };
    }
    return null;
  }

  /**
   * Valida dados obrigatórios para login
   */
  static validateLoginRequired(input: LoginInput): ValidationError | null {
    if (!input.email || !input.password) {
      return {
        field: "required",
        message: "email e password sao obrigatorios"
      };
    }
    return null;
  }

  /**
   * Valida toda a entrada de registro
   */
  static validateRegisterInput(input: RegisterInput): ValidationError | null {
    // Campos obrigatórios
    const requiredError = this.validateRegisterRequired(input);
    if (requiredError) return requiredError;

    // Email
    const emailError = this.validateEmail(input.email || "");
    if (emailError) return emailError;

    // Senha
    const passwordError = this.validatePassword(input.password || "");
    if (passwordError) return passwordError;

    // CPF
    const cpfError = this.validateCpf(input.cpf || "");
    if (cpfError) return cpfError;

    // Telefone
    const phoneError = this.validatePhone(input.phone || "");
    if (phoneError) return phoneError;

    // CEP
    const cepError = this.validateCep(input.cep || "");
    if (cepError) return cepError;

    // UF
    const ufError = this.validateUf(input.uf || "");
    if (ufError) return ufError;

    return null;
  }

  /**
   * Valida toda a entrada de login
   */
  static validateLoginInput(input: LoginInput): ValidationError | null {
    // Campos obrigatórios
    const requiredError = this.validateLoginRequired(input);
    if (requiredError) return requiredError;

    // Email
    const emailError = this.validateEmail(input.email || "");
    if (emailError) return emailError;

    return null;
  }

  /**
   * Normaliza e retorna dados de registro validados
   */
  static normalizeRegisterData(input: RegisterInput) {
    return {
      name: (input.name || "").trim(),
      email: normalizeEmail(input.email || ""),
      cpf: normalizeCpf(input.cpf || ""),
      phone: normalizePhone(input.phone || ""),
      cep: normalizeCep(input.cep || ""),
      endereco: (input.endereco || "").trim(),
      numero: (input.numero || "").trim(),
      complemento: this.normalizeOptionalText(input.complemento),
      bairro: (input.bairro || "").trim(),
      cidade: (input.cidade || "").trim(),
      uf: (input.uf || "").trim().toUpperCase(),
      estado: this.normalizeOptionalText(input.estado),
      password: hashPassword(input.password || ""),
      photoUrl: this.normalizePhotoUrl(input.photoUrl),
      bio: this.normalizeBio(input.bio)
    };
  }

  /**
   * Helper: normaliza texto opcional
   */
  private static normalizeOptionalText(value: string | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  /**
   * Helper: normaliza URL de foto
   */
  private static normalizePhotoUrl(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  /**
   * Helper: normaliza bio
   */
  private static normalizeBio(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
