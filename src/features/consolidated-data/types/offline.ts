export type AgentWorkData = {
  primeiro_acesso: boolean;
  guid: string;
  nome: string;
  cpf: string;
  telefone?: string | null;
  tipo_agente: string;
  contrato_id?: string | null;
  equipe_id?: string | null;
  equipe_nome?: string | null;
  equipe_guid?: string | null;
  grupo_equipe_guid?: string | null;
  grupo_nome?: string | null;
};

export type OfflineRecord = {
  guid: string;
  nome?: string | null;
  endereco?: string | null;
  rua?: string | null;
  bairro?: string | null;
  codigo_unico_cliente?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  equipe_id?: string | null;
  contrato_id?: string | null;
  agente_id?: string | null;
  registro_campo_guid?: string | null;
  situacao_backoffice_guid?: string | null;
  data_criacao?: string | null;
  data_modificacao?: string | null;
  visitas?: number | null;
  campo_backoffice?: OfflineBackoffice[] | null;
  base_dados_guid?: string | null;
  [key: string]: unknown;
};

export type OfflineBackoffice = {
  guid: string;
  situacao_backoffice?: string | null;
  contrato_id?: string | null;
  equipe_id?: string | null;
  agente_id?: string | null;
  data_criacao?: string | null;
  situacao_nome?: string | null;
  [key: string]: unknown;
};

export type ConsolidatedData = {
  equipe: Record<string, unknown>;
  formulario: {
    guid: string;
    nome?: string | null;
    contrato_id?: string | null;
    equipe_id?: string | null;
    numero?: string | null;
    form_principal?: boolean | null;
    [key: string]: unknown;
  };
  registros_quantidade: number;
  registros: OfflineRecord[];
};

export type SituacaoCampo = {
  guid: string;
  nome: string;
  cor?: string;
};

export type SituacaoBackoffice = {
  guid: string;
  nome: string;
  cor?: string;
};

export type PreparationStep = 'agent' | 'download' | 'structures' | 'records' | 'situacoes' | 'finish';

export type PreparationProgress = {
  step: PreparationStep;
  message: string;
  current?: number;
  total?: number;
};

export type SummaryData = {
  teamName: string;
  groupName: string;
  formName: string;
  recordsCount: number;
  formBaseDados: boolean;
};

export type HomeDashboardData = {
  teamName: string;
  groupName: string;
  formName: string;
  formBaseDados: boolean;
  recordsCount: number;
  lastSyncAt: string | null;
  /** Registros reprovados/retornados pelo backoffice (tabela offline_backoffice) */
  backofficeReturnCount: number;
  /** Registros aguardando processamento do backoffice (backoffice_status_guid IS NOT NULL) */
  waitingBackofficeCount: number;
  availableCount: number;
  situacaoDeCampoCount: number;
  pendingSyncCount: number;
};

export type OverviewData = {
  teamName: string;
  groupName: string;
  formName: string;
  recordsCount: number;
  situacoesCampoCount: number;
  situacoesBackofficeCount: number;
  lastSyncAt: string | null;
  backofficeGroups: BackofficeStatusGroup[];
};

export type BackofficeStatusGroup = {
  statusGuid: string;
  statusName: string;
  statusColor?: string;
  count: number;
};

export type RecordCard = {
  guid: string;
  sequentialNumber: number;
  name: string;
  address: string;
  street: string;
  customerCode: string;
  hasOfflineDraft: boolean;
  backofficeStatusGuid: string | null;
  backofficeStatusName: string;
  backofficeStatusColor?: string;
  canFill: boolean;
};

export type RecordsPage = {
  hasMore: boolean;
  nextCursor: number | null;
  records: RecordCard[];
};
