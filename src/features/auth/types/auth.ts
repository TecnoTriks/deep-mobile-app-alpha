export type AgentType = {
  guid: string;
  nome: string;
};

export type AuthenticatedAgent = {
  guid: string;
  nome: string;
  cpf: string;
  tipo: string;
  tipo_agente: AgentType;
  equipe_id?: string | null;
  equipe_guid?: string | null;
  equipe_nome?: string | null;
  grupo_equipe_guid?: string | null;
  grupo_nome?: string | null;
  contrato_id?: string | null;
};

export type AuthSession = {
  agent: AuthenticatedAgent;
  token: string;
};

export type LoginInput = {
  cpf: string;
  senha: string;
  // Expo Push Token deste dispositivo. Enviado no login para o backend persistir
  // na coluna `mobile_app_push_code_user` do agente de campo e poder disparar push.
  // Opcional: pode ser null quando o registro de push falha (Expo Go, sem permissao,
  // emulador) — o login NUNCA deve ser bloqueado por isso.
  mobile_app_push_code_user?: string | null;
};

export type LoginResponse = {
  code: number;
  data: {
    agente: AuthenticatedAgent;
    token: string;
  };
  message: string;
  status: boolean;
};

export type VerificarAcessoResponse = {
  code: number;
  status: boolean;
  message: string;
  data: {
    liberado: boolean;
    guid: string;
    tipo_agente: string;
  };
};

export type PrimeiroAcessoInput = {
  senha: string;
};

export type PrimeiroAcessoResponse = {
  code: number;
  status: boolean;
  message: string;
  data?: unknown;
};
