import type { SQLiteDatabase } from 'expo-sqlite';

import type { BackofficeStatusGroup, HomeDashboardData, OverviewData, RecordsPage, SummaryData } from '../types/offline';

const FILLABLE_STATUS_GUIDS = [
  '0c8cc03f-0d22-4f84-afd5-d9a3e29b3d64',
  'cd547821-a95c-4073-8454-aa618c32ef6e',
];

/**
 * Le `form_base_dados` de forma tolerante (booleano, string "false" ou numero 0 contam
 * como "sem base"). Mantem a mesma logica usada na ingestao (offlineSync) para que toda a
 * UI concorde sobre o modo sem base.
 */
function parseFormBaseDados(equipe: { form_base_dados?: unknown }): boolean {
  const value = equipe.form_base_dados;
  return !(value === false || value === 'false' || value === 0 || value === '0');
}

export async function getSummaryData(database: SQLiteDatabase, agentGuid: string): Promise<SummaryData | null> {
  const profile = await database.getFirstAsync<{ team_name: string; group_name: string }>(
    'SELECT team_name, group_name FROM agent_profiles WHERE guid = ?',
    agentGuid,
  );
  if (!profile) return null;

  const form = await database.getFirstAsync<{ name: string }>('SELECT name FROM offline_forms LIMIT 1');
  const state = await database.getFirstAsync<{ records_count: number }>(
    'SELECT records_count FROM offline_sync_state WHERE agent_guid = ?',
    agentGuid,
  );

  return {
    teamName: profile.team_name ?? '—',
    groupName: profile.group_name ?? '—',
    formName: form?.name ?? '—',
    recordsCount: state?.records_count ?? 0,
    formBaseDados: await getFormBaseDados(database),
  };
}

export async function getOverviewData(database: SQLiteDatabase, agentGuid: string): Promise<OverviewData | null> {
  const profile = await database.getFirstAsync<{ team_name: string; group_name: string }>(
    'SELECT team_name, group_name FROM agent_profiles WHERE guid = ?',
    agentGuid,
  );
  if (!profile) return null;

  const form = await database.getFirstAsync<{ name: string }>('SELECT name FROM offline_forms LIMIT 1');
  const state = await database.getFirstAsync<{ records_count: number; updated_at: string }>(
    'SELECT records_count, updated_at FROM offline_sync_state WHERE agent_guid = ?',
    agentGuid,
  );

  const campoCount = await database.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM offline_situacoes_campo');
  const backofficeCount = await database.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM offline_situacoes_backoffice');

  return {
    teamName: profile.team_name ?? '—',
    groupName: profile.group_name ?? '—',
    formName: form?.name ?? '—',
    recordsCount: state?.records_count ?? 0,
    situacoesCampoCount: campoCount?.c ?? 0,
    situacoesBackofficeCount: backofficeCount?.c ?? 0,
    lastSyncAt: state?.updated_at ?? null,
    backofficeGroups: await getRecordsByBackofficeStatus(database),
  };
}

export async function getRecordsByBackofficeStatus(database: SQLiteDatabase): Promise<BackofficeStatusGroup[]> {
  const situacoes = await database.getAllAsync<{ guid: string; nome: string; cor: string }>(
    'SELECT guid, nome, cor FROM offline_situacoes_backoffice',
  );
  const situacaoMap = new Map(situacoes.map((s) => [s.guid, s]));

  const rows = await database.getAllAsync<{ backoffice_status_guid: string | null; total: number }>(
    `SELECT backoffice_status_guid, COUNT(*) as total
     FROM offline_records
     GROUP BY backoffice_status_guid`,
  );

  const groups: BackofficeStatusGroup[] = rows.map((row) => {
    const statusGuid = row.backoffice_status_guid ?? '';
    const situacao = statusGuid ? situacaoMap.get(statusGuid) : null;

    if (!statusGuid) {
      return {
        statusGuid: '',
        statusName: 'Disponível para preenchimento',
        count: row.total,
      };
    }

    if (situacao && situacao.nome === 'Pendente') {
      return {
        statusGuid,
        statusName: 'Já preenchido.',
        statusColor: situacao.cor,
        count: row.total,
      };
    }

    if (situacao) {
      return {
        statusGuid,
        statusName: situacao.nome,
        statusColor: situacao.cor,
        count: row.total,
      };
    }

    return {
      statusGuid,
      statusName: 'Já preenchido.',
      count: row.total,
    };
  });

  return groups.sort((a, b) => a.statusName.localeCompare(b.statusName));
}

export async function getBackofficeStatuses(database: SQLiteDatabase): Promise<{ guid: string; nome: string; cor: string }[]> {
  return database.getAllAsync<{ guid: string; nome: string; cor: string }>(
    'SELECT guid, nome, cor FROM offline_situacoes_backoffice ORDER BY nome',
  );
}

function createRecordsSearchQuery(search: string) {
  return (search.match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((term) => `"${term}"*`)
    .join(' AND ');
}

export async function getRecordsWithFilter(
  database: SQLiteDatabase,
  search: string = '',
  statusGuid: string = '',
  cursor: number | null = null,
  pageSize: number = 40,
): Promise<RecordsPage> {
  const conditions: string[] = [];
  const params: (number | string)[] = [];

  const searchQuery = createRecordsSearchQuery(search);
  if (searchQuery) {
    conditions.push('records.rowid IN (SELECT rowid FROM offline_records_fts WHERE offline_records_fts MATCH ?)');
    params.push(searchQuery);
  }

  if (statusGuid === '__available__') {
    conditions.push(`records.backoffice_status_guid IS NULL`);
    conditions.push(`NOT EXISTS (SELECT 1 FROM offline_form_drafts AS available_drafts WHERE available_drafts.record_guid = records.guid)`);
  } else if (statusGuid === '__offline_draft__') {
    conditions.push(`EXISTS (SELECT 1 FROM offline_form_drafts AS filtered_drafts WHERE filtered_drafts.record_guid = records.guid AND filtered_drafts.status = 'Rascunho')`);
  } else if (statusGuid === '__offline_filling__') {
    conditions.push(`EXISTS (SELECT 1 FROM offline_form_drafts AS filtered_filling WHERE filtered_filling.record_guid = records.guid AND filtered_filling.status = 'Preenchendo offline')`);
  } else if (statusGuid) {
    conditions.push(`records.backoffice_status_guid = ?`);
    conditions.push(`NOT EXISTS (SELECT 1 FROM offline_form_drafts AS status_drafts WHERE status_drafts.record_guid = records.guid)`);
    params.push(statusGuid);
  }

  if (cursor !== null) {
    conditions.push('records.rowid > ?');
    params.push(cursor);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await database.getAllAsync<{
    record_cursor: number;
    guid: string; name: string; address: string; street: string;
    customer_code: string; backoffice_status_guid: string | null;
    backoffice_status_name: string | null; backoffice_status_color: string | null;
    has_offline_draft: number;
    local_status: string | null;
  }>(
    `SELECT
       records.rowid AS record_cursor,
       records.guid,
       records.name,
       records.address,
       records.street,
       records.customer_code,
       records.backoffice_status_guid,
       EXISTS (
         SELECT 1 FROM offline_form_drafts AS drafts
         WHERE drafts.record_guid = records.guid
       ) AS has_offline_draft,
       (
         SELECT drafts.status FROM offline_form_drafts AS drafts
         WHERE drafts.record_guid = records.guid
         ORDER BY drafts.updated_at_ms DESC LIMIT 1
       ) AS local_status,
       statuses.nome AS backoffice_status_name,
       statuses.cor AS backoffice_status_color
     FROM offline_records AS records
     LEFT JOIN offline_situacoes_backoffice AS statuses
       ON statuses.guid = records.backoffice_status_guid
     ${where}
     ORDER BY records.rowid
     LIMIT ?`,
    ...params, pageSize + 1,
  );

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const records = pageRows.map((row) => {
    const statusGuid = row.backoffice_status_guid;
    const hasOfflineDraft = row.has_offline_draft === 1;
    const canFill = row.local_status !== 'Preenchendo offline' && (hasOfflineDraft || !statusGuid || FILLABLE_STATUS_GUIDS.includes(statusGuid));

    let statusName = hasOfflineDraft ? row.local_status ?? 'Rascunho' : row.backoffice_status_name ?? 'Disponivel para preenchimento';
    if (!hasOfflineDraft && row.backoffice_status_name === 'Pendente') {
      statusName = 'Ja preenchido, aguardo backoffice';
    } else if (!hasOfflineDraft && !row.backoffice_status_name && statusGuid) {
      statusName = 'Ja preenchido, aguardo backoffice';
    }

    return {
      guid: row.guid,
      sequentialNumber: row.record_cursor,
      name: row.name ?? '—',
      address: row.address ?? '—',
      street: row.street ?? '—',
      customerCode: row.customer_code ?? '—',
      hasOfflineDraft,
      backofficeStatusGuid: statusGuid,
      backofficeStatusName: statusName,
      backofficeStatusColor: hasOfflineDraft
        ? row.local_status === 'Preenchendo offline' ? '#f59e0b' : '#71717a'
        : row.backoffice_status_color ?? (statusName === 'Disponivel para preenchimento' ? '#22c55e' : undefined),
      canFill,
    };
  });

  return {
    hasMore,
    nextCursor: pageRows.at(-1)?.record_cursor ?? null,
    records,
  };
}

export async function clearAllOfflineData(database: SQLiteDatabase, agentGuid: string) {
  await database.runAsync('DELETE FROM offline_backoffice');
  await database.runAsync('DELETE FROM offline_form_drafts');
  await database.runAsync('DELETE FROM offline_records');
  await database.runAsync('DELETE FROM offline_forms');
  await database.runAsync('DELETE FROM offline_teams');
  await database.runAsync('DELETE FROM offline_groups');
  await database.runAsync('DELETE FROM offline_contracts');
  await database.runAsync('DELETE FROM offline_situacoes_campo');
  await database.runAsync('DELETE FROM offline_situacoes_backoffice');
  await database.runAsync('DELETE FROM agent_profiles');
  await database.runAsync('DELETE FROM offline_sync_state WHERE agent_guid = ?', agentGuid);
}

export async function getPendingDraftsCount(database: SQLiteDatabase): Promise<number> {
  const result = await database.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM offline_form_drafts WHERE status = 'Preenchendo offline'",
  );
  return result?.c ?? 0;
}

export async function getFormBaseDados(database: SQLiteDatabase): Promise<boolean> {
  const row = await database.getFirstAsync<{ raw_json: string }>('SELECT raw_json FROM offline_teams LIMIT 1');
  if (!row) return true;
  try {
    const equipe = JSON.parse(row.raw_json) as { form_base_dados?: unknown };
    return parseFormBaseDados(equipe);
  } catch {
    return true;
  }
}

export async function getHomeDashboardData(database: SQLiteDatabase, agentGuid: string): Promise<HomeDashboardData | null> {
  const profile = await database.getFirstAsync<{ team_name: string; group_name: string }>(
    'SELECT team_name, group_name FROM agent_profiles WHERE guid = ?',
    agentGuid,
  );
  if (!profile) return null;

  const [form, syncState, teamRow, backofficeReturn, waitingBackoffice, available, situacaoCampo, pendingSync] = await Promise.all([
    database.getFirstAsync<{ name: string }>('SELECT name FROM offline_forms ORDER BY is_main DESC, rowid LIMIT 1'),
    database.getFirstAsync<{ records_count: number; updated_at: string }>(
      'SELECT records_count, updated_at FROM offline_sync_state WHERE agent_guid = ?',
      agentGuid,
    ),
    database.getFirstAsync<{ raw_json: string }>('SELECT raw_json FROM offline_teams LIMIT 1'),
    // Registros reprovados/retornados pelo backoffice (tabela offline_backoffice)
    database.getFirstAsync<{ c: number }>(
      'SELECT COUNT(DISTINCT record_guid) as c FROM offline_backoffice',
    ),
    // Registros que o agente já preencheu e aguardam processamento do backoffice
    database.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) as c FROM offline_records WHERE backoffice_status_guid IS NOT NULL',
    ),
    database.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM offline_records
       WHERE backoffice_status_guid IS NULL
       AND NOT EXISTS (SELECT 1 FROM offline_form_drafts WHERE record_guid = offline_records.guid)`,
    ),
    database.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM offline_form_drafts
       WHERE json_extract(dados_json, '$.dados.situacao') IS NOT NULL`,
    ),
    database.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM offline_form_drafts WHERE status = 'Preenchendo offline'",
    ),
  ]);

  let formBaseDados = true;
  if (teamRow) {
    try {
      const equipe = JSON.parse(teamRow.raw_json) as { form_base_dados?: unknown };
      formBaseDados = parseFormBaseDados(equipe);
    } catch {
      /* default true */
    }
  }

  return {
    availableCount: available?.c ?? 0,
    backofficeReturnCount: backofficeReturn?.c ?? 0,
    waitingBackofficeCount: waitingBackoffice?.c ?? 0,
    formBaseDados,
    formName: form?.name ?? '—',
    groupName: profile.group_name ?? '—',
    lastSyncAt: syncState?.updated_at ?? null,
    pendingSyncCount: pendingSync?.c ?? 0,
    recordsCount: syncState?.records_count ?? 0,
    situacaoDeCampoCount: situacaoCampo?.c ?? 0,
    teamName: profile.team_name ?? '—',
  };
}

export async function isOfflineDataReady(database: SQLiteDatabase, agentGuid: string) {
  const result = await database.getFirstAsync<{ status: string }>(
    'SELECT status FROM offline_sync_state WHERE agent_guid = ?',
    agentGuid,
  );
  return result?.status === 'ready';
}
