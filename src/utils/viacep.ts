/**
 * Integração com API ViaCEP para buscar dados de endereço
 * API: https://viacep.com.br/ws/{cep}/json/
 */

export type ViaCepResponse = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
};

export type ViaCepError = {
  erro: boolean;
};

/**
 * Busca dados de endereço usando a API ViaCEP
 * @param cep CEP a ser consultado (sem formatação)
 * @returns Dados do endereço ou null se não encontrado
 */
export async function fetchAddressByCep(cep: string): Promise<ViaCepResponse | null> {
  try {
    const normalizedCep = cep.replace(/\D/g, "");
    
    if (normalizedCep.length !== 8) {
      return null;
    }

    const response = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`, {
      method: "GET"
    });

    if (!response.ok) {
      console.error(`[ViaCEP] Erro na requisição: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as ViaCepResponse | ViaCepError;

    // ViaCEP retorna { erro: true } quando CEP não existe
    if ("erro" in data && data.erro === true) {
      return null;
    }

    return data as ViaCepResponse;
  } catch (error) {
    console.error("[ViaCEP] Erro ao buscar CEP:", error);
    return null;
  }
}

/**
 * Valida se um CEP existe e retorna mensagem de erro se inválido
 * @param cep CEP a ser validado
 * @returns Mensagem de erro ou null se válido
 */
export async function validateCepWithApi(cep: string): Promise<string | null> {
  if (!cep || !cep.trim()) {
    return null; // CEP é opcional, validação não obrigatória
  }

  const address = await fetchAddressByCep(cep);
  
  if (!address) {
    return "CEP nao encontrado ou invalido";
  }

  return null; // CEP válido
}
