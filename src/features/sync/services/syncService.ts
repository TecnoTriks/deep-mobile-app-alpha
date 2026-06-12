import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { apiClient } from '../../../shared/api/apiClient';
import { getErrorMessage } from '../../../shared/utils/getErrorMessage';
import { collectFieldsByType } from '../../form-fill/engine/formEngine';
import { deleteDraftDirectory } from '../../form-fill/services/draftFileService';
import { clearFillRecordDraft, parseFields } from '../../form-fill/services/fillRecordService';
import type { DynamicField, FormValue, FormValues } from '../../form-fill/types/form';
import type { SyncableDraft, SyncResult } from '../types/sync';

type AgentProfileRow = {
  guid: string;
  contract_guid: string;
  team_guid: string;
  group_guid: string;
};

type DraftRow = {
  dados_json: string | null;
  form_guid: string;
  record_guid: string;
  state_json: string | null;
  values_json: string | null;
};

type RecordRow = {
  base_dados_guid: string | null;
  latitude: number | null;
  longitude: number | null;
  raw_json: string;
};

type SyncApiResponse = {
  codigo?: number;
  status?: string;
  mensagem?: string;
  dados?: {
    registro_campo_guid?: string;
    visita_guid?: string;
    base_dados_guid?: string;
  };
};

// Envio de imagens em base64 pode gerar payloads grandes (varias imagens por preenchimento).
// Usa o mesmo timeout generoso aplicado a outras chamadas pesadas da API.
const SYNC_TIMEOUT_MS = 300000;

function parseJsonObject(rawJson: string | null | undefined): Record<string, unknown> {
  if (!rawJson) return {};
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseFormValues(rawJson: string | null | undefined): FormValues {
  const parsed = parseJsonObject(rawJson);
  return parsed as FormValues;
}

function inferMimeType(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}

function asStringArray(value: FormValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Converte os arquivos de campos "upload" para base64, mantendo o nome de arquivo
 * que ja esta presente em `dados[field_id]` (o mesmo que sera enviado no corpo "dados").
 *
 * Os arquivos sao lidos um de cada vez (sequencial) para evitar picos de memoria quando
 * existem dezenas de imagens em um unico preenchimento.
 */
async function buildUploads(uploadFields: DynamicField[], dados: FormValues, stateValues: FormValues) {
  const uploads: { field_id: string; urls: string[] }[] = [];

  for (const field of uploadFields) {
    const fileNames = asStringArray(dados[field.id]);
    if (fileNames.length === 0) continue;

    const uris = asStringArray(stateValues[field.id]);
    const urls: string[] = [];

    // Tudo-ou-nada por preenchimento: cada nome em `dados[field]` precisa ter o seu base64
    // na MESMA posicao em `urls` (o servidor casa por field_id + indice). Se um arquivo
    // referenciado nao existir/nao puder ser lido, falha o preenchimento inteiro (mantido
    // para reenvio) em vez de enviar uma lista parcial e desalinhada — o que apagaria o
    // rascunho com dado faltando (falso positivo).
    for (let index = 0; index < fileNames.length; index += 1) {
      const uri = uris[index];
      if (!uri) {
        throw new Error(`Arquivo "${fileNames[index]}" do campo ${field.id} nao foi encontrado para envio.`);
      }
      const base64 = await new File(uri).base64();
      urls.push(`data:${inferMimeType(fileNames[index])};base64,${base64}`);
    }

    if (urls.length > 0) {
      uploads.push({ field_id: field.id, urls });
    }
  }

  return uploads;
}

/**
 * Procura coordenadas dentro de campos do tipo "mult_capturas" (cada captura guarda
 * { id, label, latitude, longitude }). Se nenhuma captura tiver coordenadas, usa as
 * coordenadas do registro salvas localmente.
 */
function resolveCoordinates(multCapturaFields: DynamicField[], dados: FormValues, record: RecordRow) {
  for (const field of multCapturaFields) {
    const value = dados[field.id];
    if (!Array.isArray(value)) continue;

    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const capture = item as Record<string, FormValue>;
      const { latitude, longitude } = capture;
      if ((typeof latitude === 'number' || typeof latitude === 'string')
        && (typeof longitude === 'number' || typeof longitude === 'string')) {
        return { latitude: String(latitude), longitude: String(longitude) };
      }
    }
  }

  return {
    latitude: record.latitude != null ? String(record.latitude) : '',
    longitude: record.longitude != null ? String(record.longitude) : '',
  };
}

const BASELESS_GUID = '00000000-0000-0000-0000-000000000000';

export async function getSyncableDrafts(database: SQLiteDatabase): Promise<SyncableDraft[]> {
  const rows = await database.getAllAsync<{
    dados_json: string | null;
    form_guid: string;
    form_name: string | null;
    record_guid: string;
    record_name: string | null;
    base_dados_guid: string | null;
    status: string;
    updated_at: string;
  }>(
    `SELECT
      drafts.record_guid,
      records.name AS record_name,
      records.base_dados_guid,
      drafts.form_guid,
      forms.name AS form_name,
      drafts.status,
      drafts.updated_at,
      drafts.dados_json
    FROM offline_form_drafts AS drafts
    LEFT JOIN offline_records AS records ON records.guid = drafts.record_guid
    LEFT JOIN offline_forms AS forms ON forms.guid = drafts.form_guid
    WHERE drafts.status = 'Preenchendo offline'
    ORDER BY drafts.updated_at DESC`,
  );

  return rows.map((row) => {
    const dados = parseJsonObject(row.dados_json).dados;
    const dadosObj = dados && typeof dados === 'object' && !Array.isArray(dados)
      ? (dados as Record<string, unknown>)
      : null;

    const fieldsCount = dadosObj ? Object.keys(dadosObj).length : 0;
    const situacao = dadosObj?.situacao;
    const isSituacaoDeCampo = !!(situacao && typeof situacao === 'object' && !Array.isArray(situacao));
    const situacaoTitulo = isSituacaoDeCampo
      ? String((situacao as Record<string, unknown>).titulo ?? '')
      : '';

    return {
      fieldsCount,
      formGuid: row.form_guid,
      formName: row.form_name ?? '',
      isBaseless: row.base_dados_guid === BASELESS_GUID,
      isSituacaoDeCampo,
      recordGuid: row.record_guid,
      recordName: row.record_name ?? '',
      situacaoTitulo,
      status: row.status as 'Rascunho' | 'Preenchendo offline',
      updatedAt: row.updated_at,
    };
  });
}

/**
 * Envia um preenchimento offline para a API e, em caso de sucesso (code === 200),
 * remove o rascunho e os arquivos locais correspondentes.
 *
 * Em caso de falha, o rascunho permanece salvo no aparelho para nova tentativa.
 */
export async function syncDraft(database: SQLiteDatabase, agentGuid: string, draft: SyncableDraft): Promise<SyncResult> {
  const failure = (message: string): SyncResult => ({
    formGuid: draft.formGuid,
    message,
    recordGuid: draft.recordGuid,
    recordName: draft.recordName,
    success: false,
  });

  try {
    const agentProfile = await database.getFirstAsync<AgentProfileRow>(
      'SELECT guid, contract_guid, team_guid, group_guid FROM agent_profiles WHERE guid = ?',
      agentGuid,
    );
    if (!agentProfile) {
      return failure('Perfil do agente nao encontrado nos dados offline.');
    }

    const formRow = await database.getFirstAsync<{ raw_json: string }>(
      'SELECT raw_json FROM offline_forms WHERE guid = ?',
      draft.formGuid,
    );
    if (!formRow) {
      return failure('Formulario nao encontrado nos dados offline.');
    }

    const draftRow = await database.getFirstAsync<DraftRow>(
      'SELECT record_guid, form_guid, dados_json, state_json, values_json FROM offline_form_drafts WHERE record_guid = ? AND form_guid = ? LIMIT 1',
      draft.recordGuid,
      draft.formGuid,
    );
    if (!draftRow?.dados_json) {
      return failure('Dados do preenchimento nao encontrados nos dados offline.');
    }

    const recordRow = await database.getFirstAsync<RecordRow>(
      'SELECT base_dados_guid, latitude, longitude, raw_json FROM offline_records WHERE guid = ?',
      draft.recordGuid,
    );
    if (!recordRow) {
      return failure('Registro nao encontrado nos dados offline.');
    }

    const baseDadosGuid = recordRow.base_dados_guid;
    if (typeof baseDadosGuid !== 'string' || !baseDadosGuid) {
      return failure('O registro nao possui "base_dados_guid" nos dados consolidados.');
    }

    const fields = parseFields(formRow.raw_json);
    const dados = (parseJsonObject(draftRow.dados_json).dados ?? {}) as FormValues;
    const stateValues = parseFormValues(draftRow.state_json ?? draftRow.values_json);

    const uploadFields = collectFieldsByType(fields, ['upload']);
    const multCapturaFields = collectFieldsByType(fields, ['mult_capturas']);

    const uploads = await buildUploads(uploadFields, dados, stateValues);

    // Situação de Campo photo upload
    const situacaoFotoUris = asStringArray(stateValues['__situacao_foto__']);
    let situacaoCampoId: string | null = null;
    if (situacaoFotoUris.length > 0) {
      const uri = situacaoFotoUris[0];
      const fileName = uri.split('/').pop() ?? 'foto.jpg';
      // Mesma regra tudo-ou-nada: se a foto da situacao foi registrada mas nao pode ser lida,
      // falha o envio (mantem o rascunho) em vez de enviar a situacao sem a foto.
      const base64 = await new File(uri).base64();
      uploads.push({ field_id: 'foto', urls: [`data:${inferMimeType(fileName)};base64,${base64}`] });
    }
    const dadosRecord = dados as Record<string, unknown>;
    const situacaoData = dadosRecord.situacao as Record<string, unknown> | undefined;
    if (typeof situacaoData?.guid === 'string') {
      situacaoCampoId = situacaoData.guid;
    }

    const { latitude, longitude } = resolveCoordinates(multCapturaFields, dados, recordRow);

    const payload = {
      agente_id: agentProfile.guid,
      base_dados_guid: baseDadosGuid,
      contrato_id: agentProfile.contract_guid,
      dados,
      equipe_id: agentProfile.team_guid,
      form_id: draft.formGuid,
      latitude,
      longitude,
      situacao_campo_id: situacaoCampoId,
      uploads,
    };

    const response = await apiClient.post<SyncApiResponse>('/campo-visitas/registro', payload, { timeout: SYNC_TIMEOUT_MS });

    // Sucesso apenas quando a API retorna exatamente: { codigo: 200, status: "sucesso", ... }
    const isSyncSuccess = response.data?.codigo === 200 && response.data?.status === 'sucesso';
    if (!isSyncSuccess) {
      return failure(response.data?.mensagem || 'A API retornou uma resposta inesperada ao processar o preenchimento.');
    }

    await clearFillRecordDraft(database, draft.recordGuid, draft.formGuid);
    deleteDraftDirectory(draft.recordGuid, draft.formGuid);

    return {
      formGuid: draft.formGuid,
      recordGuid: draft.recordGuid,
      recordName: draft.recordName,
      success: true,
    };
  } catch (error) {
    return failure(getErrorMessage(error, 'Falha ao enviar o preenchimento.'));
  }
}

/**
 * Sincroniza todos os preenchimentos prontos, um por vez (uma requisicao por preenchimento).
 * Falhas em um item nao interrompem o envio dos demais.
 */
export async function syncAll(
  database: SQLiteDatabase,
  agentGuid: string,
  drafts: SyncableDraft[],
  onProgress?: (result: SyncResult, completed: number, total: number) => void,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const result = await syncDraft(database, agentGuid, drafts[index]);
    results.push(result);
    onProgress?.(result, index + 1, drafts.length);
  }

  return results;
}
