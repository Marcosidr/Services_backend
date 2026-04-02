import { Op } from "sequelize";
import { Category, Professional, ProfessionalReview, User, UserProfile } from "../models";
import { isValidCep, normalizeCep } from "../utils/cep";
import { isValidCpf, normalizeCpf } from "../utils/cpf";
import { getEmailValidationError, normalizeEmail } from "../utils/email";
import { getPasswordValidationError, hashPassword } from "../utils/password";
import { getPhoneValidationError, normalizePhone } from "../utils/phone";
import { ProfessionalParser } from "../parsers/ProfessionalParser";

export type ValidationError = {
  field: string;
  message: string;
};

export type RegisterProfessionalInput = {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  password?: string;
  description?: string;
  experience?: string;
  price?: string | number;
  priceUnit?: string;
  area?: string | number;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  city?: string;
  uf?: string;
  estado?: string;
  online?: boolean | string;
  photoUrl?: string;
  latitude?: string | number;
  longitude?: string | number;
  categoryIds?: unknown;
  categoryId?: unknown;
  "categoryIds[]"?: unknown;
};

export class ProfessionalValidator {
  /**
   * Valida campos obrigatórios para registro profissional
   */
  static validateRegisterRequired(input: RegisterProfessionalInput): ValidationError | null {
    if (!input.email || !input.cpf || !input.password) {
      return {
        field: "required",
        message: "email, cpf e password sao obrigatorios"
      };
    }

    if (!input.description || !input.description.toString().trim()) {
      return {
        field: "description",
        message: "description e obrigatorio"
      };
    }

    if (!input.phone) {
      return {
        field: "phone",
        message: "phone e obrigatorio"
      };
    }

    if (!input.cep || !this.isValidCep(input.cep.toString())) {
      return {
        field: "cep",
        message: "CEP invalido"
      };
    }

    if (!input.endereco || !input.endereco.toString().trim()) {
      return {
        field: "endereco",
        message: "endereco e obrigatorio"
      };
    }

    if (!input.numero || !input.numero.toString().trim()) {
      return {
        field: "numero",
        message: "numero e obrigatorio"
      };
    }

    if (!input.bairro || !input.bairro.toString().trim()) {
      return {
        field: "bairro",
        message: "bairro e obrigatorio"
      };
    }

    if (!input.city || !input.city.toString().trim()) {
      return {
        field: "city",
        message: "city e obrigatorio"
      };
    }

    if (!input.uf || !/^[a-zA-Z]{2}$/.test(input.uf.toString().trim())) {
      return {
        field: "uf",
        message: "UF invalida"
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
   * Valida password
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
    if (!this.isValidCep(cep)) {
      return { field: "cep", message: "CEP invalido" };
    }
    return null;
  }

  /**
   * Valida UF
   */
  static validateUf(uf: string): ValidationError | null {
    if (!/^[a-zA-Z]{2}$/.test(uf.trim())) {
      return { field: "uf", message: "UF invalida" };
    }
    return null;
  }

  /**
   * Valida category IDs
   */
  static validateCategoryIds(categoryIds: number[] | null): ValidationError | null {
    if (!categoryIds || categoryIds.length === 0) {
      return { field: "categoryIds", message: "categoryIds invalido" };
    }
    return null;
  }

  /**
   * Valida entrada completa de registro profissional
   */
  static validateRegisterInput(input: RegisterProfessionalInput): ValidationError | null {
    // Campos obrigatórios
    const requiredError = this.validateRegisterRequired(input);
    if (requiredError) return requiredError;

    // Email
    const emailError = this.validateEmail(input.email || "");
    if (emailError) return emailError;

    // Password
    const passwordError = this.validatePassword(input.password || "");
    if (passwordError) return passwordError;

    // CPF
    const cpfError = this.validateCpf(input.cpf || "");
    if (cpfError) return cpfError;

    // Phone
    const phoneError = this.validatePhone(input.phone || "");
    if (phoneError) return phoneError;

    // CEP
    const cepError = this.validateCep(input.cep?.toString() || "");
    if (cepError) return cepError;

    // UF
    const ufError = this.validateUf(input.uf?.toString() || "");
    if (ufError) return ufError;

    return null;
  }

  /**
   * Normaliza dados de registro profissional
   */
  static normalizeRegisterData(input: RegisterProfessionalInput) {
    return {
      name: input.name ? input.name.trim() : "",
      email: normalizeEmail(input.email || ""),
      cpf: normalizeCpf(input.cpf || ""),
      phone: normalizePhone(input.phone || ""),
      cep: normalizeCep(input.cep?.toString() || ""),
      endereco: ProfessionalParser.normalizeText(input.endereco?.toString()),
      numero: ProfessionalParser.normalizeText(input.numero?.toString()),
      complemento: ProfessionalParser.normalizeOptionalText(input.complemento?.toString()),
      bairro: ProfessionalParser.normalizeText(input.bairro?.toString()),
      city: ProfessionalParser.normalizeText(input.city?.toString()),
      uf: (input.uf?.toString() || "").trim().toUpperCase(),
      estado: ProfessionalParser.normalizeOptionalText(input.estado?.toString()),
      description: ProfessionalParser.normalizeText(input.description?.toString()),
      experience: ProfessionalParser.normalizeOptionalText(input.experience?.toString()),
      password: hashPassword(input.password || ""),
      price: ProfessionalParser.parseOptionalNumber(input.price),
      priceUnit: ProfessionalParser.normalizeOptionalText(input.priceUnit?.toString()) || "servico",
      area: ProfessionalParser.parseOptionalNumber(input.area),
      online: ProfessionalParser.parseOnlineFlag(input.online),
      photoUrl: ProfessionalParser.normalizePhotoUrl(input.photoUrl)
    };
  }

  /**
   * Helper: valida CEP
   */
  private static isValidCep(cep: string): boolean {
    return isValidCep(cep);
  }

  /**
   * Verifica se categoria existe e está ativa
   */
  static async categoriesAreValid(categoryIds: number[]): Promise<boolean> {
    const categoriesCount = await Category.count({
      where: {
        id: {
          [op.in]: categoryIds
        },
        is_active: true
      }
    });

    return categoriesCount === categoryIds.length;
  }
}

// Helper para Op que precisa estar definido
import { Op as op } from "sequelize";
