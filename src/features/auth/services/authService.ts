import { apiClient } from '../../../shared/api/apiClient';
import type {
  AuthenticatedAgent,
  AuthSession,
  LoginInput,
  PrimeiroAcessoInput,
  PrimeiroAcessoResponse,
  VerificarAcessoResponse,
} from '../types/auth';

export async function verificarAcesso(cpf: string): Promise<VerificarAcessoResponse['data']> {
  const response = await apiClient.post<VerificarAcessoResponse>('/auth/verificar-acesso', { cpf });

  if (response.data.code !== 200) {
    throw new Error(response.data.message || 'Erro ao verificar acesso.');
  }

  return response.data.data;
}

export async function primeiroAcesso(guid: string, input: PrimeiroAcessoInput): Promise<void> {
  const response = await apiClient.post<PrimeiroAcessoResponse>(`/auth/primeiro-acesso/${guid}?navegador=true`, input);

  if (response.data.code !== 200) {
    throw new Error(response.data.message || 'Erro ao redefinir senha.');
  }
}

// ─── Shape of the agente object returned by /auth/login ─────────────────────
// Login returns equipe nested ({ guid, nome }) plus full identity fields
// (tipo_agente, cpf, tipo, nome). Group fields are NOT present in login.
type LoginAgenteRaw = {
  guid: string;
  nome: string;
  cpf: string;
  tipo: string;
  tipo_agente: import('../types/auth').AgentType;
  equipe?: { guid: string | null; nome: string | null } | null;
  equipe_id?: string | null;
  equipe_guid?: string | null;
  equipe_nome?: string | null;
  contrato_id?: string | null;
};

// ─── Shape returned by GET /campo-agentes/{guid}?mobile=true ─────────────────
// This endpoint returns team + group membership fields only. Identity fields
// (cpf, tipo, tipo_agente) are NOT guaranteed to be present and must NOT be
// used — the base session values are preserved via refreshSession merge.
type AgentProfileRaw = {
  equipe_id?: string | null;
  equipe_guid?: string | null;
  equipe_nome?: string | null;
  grupo_equipe_guid?: string | null;
  grupo_nome?: string | null;
  contrato_id?: string | null;
};

type AgentProfileResponseRaw = {
  code: number;
  status: boolean;
  message?: string;
  data: AgentProfileRaw;
};

type LoginResponseRaw = {
  code: number;
  status: boolean;
  message: string;
  data: {
    agente: LoginAgenteRaw;
    token: string;
  };
};

type JoinTeamResponse = {
  code: number;
  status: boolean;
  message?: string;
  data?: unknown;
};

type LeaveTeamResponse = {
  code: number;
  status: boolean;
  message?: string;
};

// Maps the raw API agente shape (which uses nested equipe in login responses) to
// our flat AuthenticatedAgent type. Handles both nested and flat API shapes.
function mapAgente(raw: LoginAgenteRaw): AuthenticatedAgent {
  return {
    guid: raw.guid,
    nome: raw.nome,
    cpf: raw.cpf,
    tipo: raw.tipo,
    tipo_agente: raw.tipo_agente,
    // Prefer flat fields (from getAgentProfile) over nested (from login).
    equipe_id: raw.equipe_id ?? null,
    equipe_guid: raw.equipe_guid ?? raw.equipe?.guid ?? null,
    equipe_nome: raw.equipe_nome ?? raw.equipe?.nome ?? null,
    // grupo fields are not returned by login — they are populated after
    // getAgentProfile is called and merged via refreshSession.
    grupo_equipe_guid: null,
    grupo_nome: null,
    contrato_id: raw.contrato_id ?? null,
  };
}

// Returns only the team/group fields from the profile endpoint.
// Identity fields (guid, nome, cpf, tipo, tipo_agente) are intentionally
// excluded — they are not returned by this endpoint and must be preserved
// from the existing session via the refreshSession merge.
export async function getAgentProfile(agenteGuid: string): Promise<Partial<AuthenticatedAgent>> {
  const response = await apiClient.get<AgentProfileResponseRaw>(`/campo-agentes/${agenteGuid}?mobile=true`);
  if (response.data.code !== 200 || !response.data.data) {
    throw new Error(response.data.message || 'Não foi possível buscar os dados do agente.');
  }
  const raw = response.data.data;
  return {
    equipe_id: raw.equipe_id ?? null,
    equipe_guid: raw.equipe_guid ?? null,
    equipe_nome: raw.equipe_nome ?? null,
    grupo_equipe_guid: raw.grupo_equipe_guid ?? null,
    grupo_nome: raw.grupo_nome ?? null,
    contrato_id: raw.contrato_id ?? null,
  };
}

export async function joinTeam(agenteGuid: string, codeEquipe: string): Promise<void> {
  const response = await apiClient.post<JoinTeamResponse>(
    '/campo-equipe/ingressar?navegador=true',
    { agente_guid: agenteGuid, code_equipe: codeEquipe },
  );
  if (response.data.code !== 200) {
    throw new Error(response.data.message || 'Código inválido ou equipe não encontrada.');
  }
}

export async function leaveTeam(agenteGuid: string): Promise<void> {
  const response = await apiClient.put<LeaveTeamResponse>(
    `/campo-agentes/${agenteGuid}?mobile=true`,
    { equipe_id: null, grupo_equipe_guid: null, contrato_id: null },
  );
  if (response.data.code !== 200) {
    throw new Error(response.data.message || 'Não foi possível sair da equipe.');
  }
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const response = await apiClient.post<LoginResponseRaw>('/auth/login', input);

  if (response.data.code !== 200 || !response.data.status || !response.data.data?.token || !response.data.data?.agente) {
    throw new Error(response.data.message || 'Nao foi possivel realizar o login.');
  }

  return {
    agent: mapAgente(response.data.data.agente),
    token: response.data.data.token,
  };
}
