import type { SQLiteDatabase } from 'expo-sqlite';

import type { DadosRetornos, DynamicField, FillRecordData, FillRecordLocalStatus, FormValues, OfflineDraftPayload, RetornoItem } from '../types/form';

type StoredForm = {
  contract_guid: string | null;
  guid: string;
  name: string | null;
  raw_json: string;
};

type StoredRecord = {
  address: string | null;
  customer_code: string | null;
  guid: string;
  name: string | null;
  raw_json: string;
};

function stripFieldPrefix(id: string): string {
  return id.startsWith('form-group-') ? id.slice('form-group-'.length) : id;
}

function tryParseJsonObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function getMostRecentRetornos(database: SQLiteDatabase, recordGuid: string): Promise<DadosRetornos | null> {
  const rows = await database.getAllAsync<{ raw_json: string }>(
    'SELECT raw_json FROM offline_backoffice WHERE record_guid = ?',
    recordGuid,
  );

  let bestDate = '';
  let bestRetornos: DadosRetornos | null = null;

  for (const row of rows) {
    const parsed = tryParseJsonObject(row.raw_json);
    const dr = parsed.dados_retornos;
    if (!dr || typeof dr !== 'object' || Array.isArray(dr)) continue;

    const date = typeof parsed.data_criacao === 'string' ? parsed.data_criacao : '';
    if (bestDate && date <= bestDate) continue;
    bestDate = date;

    const raw = dr as Record<string, unknown>;

    const reprovados: RetornoItem[] = (Array.isArray(raw.reprovados) ? raw.reprovados : [])
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        id: stripFieldPrefix(String(item.id ?? '')),
        observacao: typeof item.observacao === 'string' ? item.observacao : undefined,
      }));

    const dados_aprovados: RetornoItem[] = (Array.isArray(raw.dados_aprovados) ? raw.dados_aprovados : [])
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        id: stripFieldPrefix(String(item.id ?? '')),
        value: typeof item.value === 'string' ? item.value : undefined,
      }));

    bestRetornos = { reprovados, dados_aprovados };
  }

  return bestRetornos;
}

function computeInitialValues(
  fields: DynamicField[],
  retornos: DadosRetornos | null,
  rawData: Record<string, unknown>,
): FormValues {
  const values: FormValues = {};
  const reprovadoIds = new Set((retornos?.reprovados ?? []).map((r) => r.id));

  const applyReference = (items: DynamicField[]) => {
    for (const field of items) {
      if (field.type === 'group') {
        applyReference(field.config.children ?? []);
        continue;
      }
      if (
        field.type === 'text'
        && typeof field.config.reference === 'string'
        && !reprovadoIds.has(field.id)
      ) {
        const refValue = rawData[field.config.reference as string];
        if (refValue !== undefined && refValue !== null) {
          values[field.id] = String(refValue);
        }
      }
    }
  };
  applyReference(fields);

  for (const item of (retornos?.dados_aprovados ?? [])) {
    if (!reprovadoIds.has(item.id)) {
      values[item.id] = item.value ?? '';
    }
  }

  return values;
}

let lastDraftVersion = 0;

function nextDraftVersion() {
  lastDraftVersion = Math.max(Date.now(), lastDraftVersion + 1);
  return lastDraftVersion;
}

export function parseFields(rawJson: string): DynamicField[] {
  const form = JSON.parse(rawJson) as { json?: string | { campos?: DynamicField[] } };
  const schema = typeof form.json === 'string'
    ? JSON.parse(form.json) as { campos?: DynamicField[] }
    : form.json;
  return Array.isArray(schema?.campos) ? schema.campos : [];
}

function parseDraftValues(rawJson?: string): FormValues {
  if (!rawJson) return {};
  try {
    return JSON.parse(rawJson) as FormValues;
  } catch {
    return {};
  }
}

function parseRecordData(rawJson: string): Record<string, unknown> {
  try {
    return JSON.parse(rawJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function getFillRecordData(database: SQLiteDatabase, recordGuid: string): Promise<FillRecordData | null> {
  const [record, form, retornos] = await Promise.all([
    database.getFirstAsync<StoredRecord>(
      'SELECT guid, name, address, customer_code, raw_json FROM offline_records WHERE guid = ?',
      recordGuid,
    ),
    database.getFirstAsync<StoredForm>(
      'SELECT guid, name, contract_guid, raw_json FROM offline_forms ORDER BY is_main DESC, rowid LIMIT 1',
    ),
    getMostRecentRetornos(database, recordGuid),
  ]);

  if (!record || !form) return null;

  const draft = await database.getFirstAsync<{ state_json: string | null; status: FillRecordLocalStatus; updated_at_ms: number; values_json: string }>(
    'SELECT state_json, status, updated_at_ms, values_json FROM offline_form_drafts WHERE record_guid = ? AND form_guid = ? LIMIT 1',
    recordGuid,
    form.guid,
  );
  lastDraftVersion = Math.max(lastDraftVersion, draft?.updated_at_ms ?? 0);

  const fields = parseFields(form.raw_json);
  const rawData = parseRecordData(record.raw_json);

  return {
    hasDraft: Boolean(draft),
    draftStatus: draft?.status ?? null,
    draftValues: parseDraftValues(draft?.state_json ?? draft?.values_json),
    computedInitialValues: computeInitialValues(fields, retornos, rawData),
    retornos,
    form: {
      contractGuid: form.contract_guid,
      fields,
      guid: form.guid,
      name: form.name ?? '',
    },
    record: {
      address: record.address ?? '',
      customerCode: record.customer_code ?? '',
      guid: record.guid,
      name: record.name ?? '',
      rawData,
    },
  };
}

export async function saveFillRecordDraft(
  database: SQLiteDatabase,
  recordGuid: string,
  formGuid: string,
  state: FormValues,
  dados: FormValues,
  status: FillRecordLocalStatus = 'Rascunho',
) {
  const draftVersion = nextDraftVersion();
  const updatedAt = new Date().toISOString();
  // values_json e state_json guardam o mesmo conteudo: serializa uma unica vez para nao
  // pagar dois JSON.stringify (potencialmente grandes, ex.: assinatura em base64) por save.
  const stateJson = JSON.stringify(state);
  await database.runAsync(
    `INSERT INTO offline_form_drafts
       (record_guid, form_guid, values_json, state_json, dados_json, status, updated_at, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(record_guid, form_guid) DO UPDATE SET
       values_json = excluded.values_json,
       state_json = excluded.state_json,
       dados_json = excluded.dados_json,
       status = excluded.status,
       updated_at = excluded.updated_at,
       updated_at_ms = excluded.updated_at_ms
     WHERE excluded.updated_at_ms >= offline_form_drafts.updated_at_ms`,
    recordGuid,
    formGuid,
    stateJson,
    stateJson,
    JSON.stringify({ dados } satisfies OfflineDraftPayload),
    status,
    updatedAt,
    draftVersion,
  );
}

export async function clearFillRecordDraft(database: SQLiteDatabase, recordGuid: string, formGuid: string) {
  await database.runAsync(
    'DELETE FROM offline_form_drafts WHERE record_guid = ? AND form_guid = ?',
    recordGuid,
    formGuid,
  );
}

export async function saveSituacaoDeCampo(
  database: SQLiteDatabase,
  recordGuid: string,
  formGuid: string,
  situacao: { guid: string; titulo: string },
  photoUri: string,
) {
  const fileName = photoUri.split('/').pop() ?? `situacao-${Date.now()}.jpg`;
  const draftVersion = nextDraftVersion();
  const updatedAt = new Date().toISOString();

  const state = { __situacao_foto__: [photoUri] };
  const dados = { situacao: { guid: situacao.guid, titulo: situacao.titulo, foto: fileName } };
  const stateJson = JSON.stringify(state);

  await database.runAsync(
    `INSERT INTO offline_form_drafts
       (record_guid, form_guid, values_json, state_json, dados_json, status, updated_at, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, 'Preenchendo offline', ?, ?)
     ON CONFLICT(record_guid, form_guid) DO UPDATE SET
       values_json = excluded.values_json,
       state_json = excluded.state_json,
       dados_json = excluded.dados_json,
       status = excluded.status,
       updated_at = excluded.updated_at,
       updated_at_ms = excluded.updated_at_ms
     WHERE excluded.updated_at_ms >= offline_form_drafts.updated_at_ms`,
    recordGuid,
    formGuid,
    stateJson,
    stateJson,
    JSON.stringify({ dados } satisfies OfflineDraftPayload),
    updatedAt,
    draftVersion,
  );
}
