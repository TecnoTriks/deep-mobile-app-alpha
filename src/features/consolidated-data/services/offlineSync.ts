import type { SQLiteDatabase } from 'expo-sqlite';

import { fetchAgentWorkData, fetchConsolidatedData, fetchSituacoesBackoffice, fetchSituacoesCampo } from './offlineApi';
import type { AgentWorkData, ConsolidatedData, PreparationProgress, SituacaoBackoffice, SituacaoCampo } from '../types/offline';

const now = () => new Date().toISOString();
const RECORDS_BATCH_SIZE = 100;
export const BASELESS_GUID = '00000000-0000-0000-0000-000000000000';

const RECORDS_FTS_TRIGGERS_SQL = `
  CREATE TRIGGER IF NOT EXISTS offline_records_fts_insert AFTER INSERT ON offline_records BEGIN
    INSERT INTO offline_records_fts(rowid, name, address, street, customer_code)
    VALUES (new.rowid, new.name, new.address, new.street, new.customer_code);
  END;

  CREATE TRIGGER IF NOT EXISTS offline_records_fts_delete AFTER DELETE ON offline_records BEGIN
    INSERT INTO offline_records_fts(offline_records_fts, rowid, name, address, street, customer_code)
    VALUES ('delete', old.rowid, old.name, old.address, old.street, old.customer_code);
  END;

  CREATE TRIGGER IF NOT EXISTS offline_records_fts_update AFTER UPDATE ON offline_records BEGIN
    INSERT INTO offline_records_fts(offline_records_fts, rowid, name, address, street, customer_code)
    VALUES ('delete', old.rowid, old.name, old.address, old.street, old.customer_code);
    INSERT INTO offline_records_fts(rowid, name, address, street, customer_code)
    VALUES (new.rowid, new.name, new.address, new.street, new.customer_code);
  END;
`;

async function suspendRecordsSearchIndex(database: SQLiteDatabase) {
  await database.execAsync(`
    DROP TRIGGER IF EXISTS offline_records_fts_insert;
    DROP TRIGGER IF EXISTS offline_records_fts_delete;
    DROP TRIGGER IF EXISTS offline_records_fts_update;
  `);
}

async function rebuildRecordsSearchIndex(database: SQLiteDatabase) {
  await database.execAsync(`
    INSERT INTO offline_records_fts(offline_records_fts) VALUES ('rebuild');
    ${RECORDS_FTS_TRIGGERS_SQL}
  `);
}

/**
 * Le o flag `form_base_dados` de forma tolerante: o backend pode enviar booleano,
 * string ("false") ou numero (0). Qualquer uma dessas formas de "false" significa
 * "sem base de dados".
 */
function isFormBaseDados(equipe: unknown): boolean {
  const value = (equipe as { form_base_dados?: unknown } | null | undefined)?.form_base_dados;
  return !(value === false || value === 'false' || value === 0 || value === '0');
}

/**
 * Grava o registro virtual unico do modo "sem base".
 *
 * Suspende os triggers do FTS antes de mexer em `offline_records` e reconstroi o indice
 * depois — exatamente como o caminho com base. Sem isso, o `DELETE FROM offline_records`
 * dispara o trigger de delete do FTS linha a linha sobre o indice externo; se o indice
 * estiver inconsistente (ex.: troca de um dataset com base para sem base), o FTS5 levanta
 * um erro nativo que o try/catch do JS nao captura e que ENCERRA o app.
 */
async function saveBaselessRecord(
  database: SQLiteDatabase,
  teamGuid: string,
  contractGuid: string,
  agentGuid: string,
) {
  await suspendRecordsSearchIndex(database);
  try {
    await database.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync('DELETE FROM offline_backoffice; DELETE FROM offline_records;');
      await tx.runAsync(
        `INSERT OR REPLACE INTO offline_records
         (guid, name, address, street, neighborhood, customer_code,
          latitude, longitude, team_guid, contract_guid, agent_guid,
          field_record_guid, backoffice_status_guid, created_at, modified_at, visits, base_dados_guid, raw_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        BASELESS_GUID, 'Preenchimento sem base', null, null, null, null,
        null, null, teamGuid, contractGuid, agentGuid,
        null, null, null, null, 0, BASELESS_GUID, '{}',
      );
    });
  } finally {
    await rebuildRecordsSearchIndex(database);
    await database.execAsync('PRAGMA wal_checkpoint(PASSIVE);');
  }
}

function serializeRecord(record: Record<string, unknown>) {
  return JSON.stringify(record, (key, value) => key === 'campo_backoffice' ? undefined : value);
}

function assertValidRecordGuid(guid: unknown, index: number): asserts guid is string {
  if (typeof guid !== 'string' || !guid) {
    throw new Error(`Registro invalido na posicao ${index + 1}: identificador ausente.`);
  }
}

async function saveStructures(database: SQLiteDatabase, agent: AgentWorkData, consolidated: ConsolidatedData) {
  const updatedAt = now();
  const teamGuid = agent.equipe_guid || agent.equipe_id!;

  // Limpa as estruturas antigas antes de gravar as novas: como cada uma destas tabelas
  // guarda apenas os registros do "instantaneo" mais recente (perfil do agente, contrato,
  // grupo, equipe e formulario atuais), usar so INSERT OR REPLACE deixava linhas antigas
  // (de um contrato/equipe/formulario anterior) presas no banco apos uma nova
  // sincronizacao de dados consolidados.
  await database.execAsync(`
    DELETE FROM agent_profiles;
    DELETE FROM offline_contracts;
    DELETE FROM offline_groups;
    DELETE FROM offline_teams;
    DELETE FROM offline_forms;
  `);

  await database.runAsync(
    `INSERT OR REPLACE INTO agent_profiles
      (guid, name, cpf, phone, agent_type_guid, contract_guid, team_guid, team_name, group_guid, group_name, raw_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    agent.guid, agent.nome, agent.cpf, agent.telefone ?? null, agent.tipo_agente, agent.contrato_id!, teamGuid,
    agent.equipe_nome ?? null, agent.grupo_equipe_guid!, agent.grupo_nome ?? null, JSON.stringify(agent), updatedAt,
  );

  await database.runAsync(
    'INSERT OR REPLACE INTO offline_contracts (guid, raw_json, updated_at) VALUES (?, ?, ?)',
    agent.contrato_id!, JSON.stringify({ guid: agent.contrato_id }), updatedAt,
  );
  await database.runAsync(
    'INSERT OR REPLACE INTO offline_groups (guid, name, raw_json, updated_at) VALUES (?, ?, ?, ?)',
    agent.grupo_equipe_guid!, agent.grupo_nome ?? null,
    JSON.stringify({ guid: agent.grupo_equipe_guid, nome: agent.grupo_nome }), updatedAt,
  );
  await database.runAsync(
    `INSERT OR REPLACE INTO offline_teams (guid, name, contract_guid, group_guid, raw_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    teamGuid, agent.equipe_nome ?? null, agent.contrato_id!, agent.grupo_equipe_guid!, JSON.stringify(consolidated.equipe), updatedAt,
  );

  const form = consolidated.formulario;
  await database.runAsync(
    `INSERT OR REPLACE INTO offline_forms
      (guid, name, contract_guid, team_guid, number, is_main, raw_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    form.guid, form.nome ?? null, form.contrato_id ?? agent.contrato_id!, form.equipe_id ?? teamGuid,
    form.numero ?? null, form.form_principal ? 1 : 0, JSON.stringify(form), updatedAt,
  );
}

async function saveRecords(
  database: SQLiteDatabase,
  consolidated: ConsolidatedData,
  onProgress: (progress: PreparationProgress) => void,
) {
  const records = consolidated.registros ?? [];
  await suspendRecordsSearchIndex(database);

  try {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync('DELETE FROM offline_backoffice; DELETE FROM offline_records;');
    });

    for (let start = 0; start < records.length; start += RECORDS_BATCH_SIZE) {
      const end = Math.min(start + RECORDS_BATCH_SIZE, records.length);

      await database.withExclusiveTransactionAsync(async (transaction) => {
        for (let index = start; index < end; index += 1) {
          const record = records[index];
          assertValidRecordGuid(record?.guid, index);
          const backoffice = record.campo_backoffice ?? [];

          await transaction.runAsync(
            `INSERT OR REPLACE INTO offline_records
             (guid, name, address, street, neighborhood, customer_code, latitude, longitude, team_guid, contract_guid,
              agent_guid, field_record_guid, backoffice_status_guid, created_at, modified_at, visits, base_dados_guid, raw_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            record.guid, record.nome ?? null, record.endereco ?? null, record.rua ?? null, record.bairro ?? null,
            record.codigo_unico_cliente ?? null, record.latitude ?? null, record.longitude ?? null, record.equipe_id ?? null,
            record.contrato_id ?? null, record.agente_id ?? null, record.registro_campo_guid ?? null,
            record.situacao_backoffice_guid ?? null, record.data_criacao ?? null, record.data_modificacao ?? null,
            record.visitas ?? 0, record.guid, serializeRecord(record),
          );

          for (const item of backoffice) {
            await transaction.runAsync(
              `INSERT OR REPLACE INTO offline_backoffice
               (guid, record_guid, status_guid, contract_guid, team_guid, agent_guid, created_at, status_name, raw_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              item.guid, record.guid, item.situacao_backoffice ?? null, item.contrato_id ?? null, item.equipe_id ?? null,
              item.agente_id ?? null, item.data_criacao ?? null, item.situacao_nome ?? null, JSON.stringify(item),
            );
          }
        }
      });

      onProgress({ step: 'records', message: 'Organizando os registros para uso offline', current: end, total: records.length });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    onProgress({ step: 'records', message: 'Preparando busca dos registros', current: records.length, total: records.length });
    await rebuildRecordsSearchIndex(database);
    await database.execAsync('PRAGMA wal_checkpoint(PASSIVE);');
  }
}

async function ensureTables(database: SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_situacoes_campo (
      guid TEXT PRIMARY KEY NOT NULL,
      nome TEXT NOT NULL,
      cor TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS offline_situacoes_backoffice (
      guid TEXT PRIMARY KEY NOT NULL,
      nome TEXT NOT NULL,
      cor TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

async function saveSituacoes(database: SQLiteDatabase, campo: SituacaoCampo[], backoffice: SituacaoBackoffice[]) {
  const updatedAt = now();
  await ensureTables(database);

  await database.runAsync('DELETE FROM offline_situacoes_campo');
  const campoSql = 'INSERT OR REPLACE INTO offline_situacoes_campo (guid, nome, cor, raw_json, updated_at) VALUES (?, ?, ?, ?, ?)';
  for (const item of campo) {
    await database.runAsync(campoSql, item.guid, item.nome, item.cor ?? null, JSON.stringify(item), updatedAt);
  }

  await database.runAsync('DELETE FROM offline_situacoes_backoffice');
  const backofficeSql = 'INSERT OR REPLACE INTO offline_situacoes_backoffice (guid, nome, cor, raw_json, updated_at) VALUES (?, ?, ?, ?, ?)';
  for (const item of backoffice) {
    await database.runAsync(backofficeSql, item.guid, item.nome, item.cor ?? null, JSON.stringify(item), updatedAt);
  }
}

export async function prepareOfflineData(
  database: SQLiteDatabase,
  agentGuid: string,
  onProgress: (progress: PreparationProgress) => void,
) {
  try {
    await database.runAsync(
      `INSERT INTO offline_sync_state (agent_guid, status, records_count, updated_at, error_message)
       VALUES (?, 'preparing', 0, ?, NULL)
       ON CONFLICT(agent_guid) DO UPDATE SET
         status = excluded.status,
         records_count = excluded.records_count,
         updated_at = excluded.updated_at,
         error_message = NULL`,
      agentGuid,
      now(),
    );

    onProgress({ step: 'agent', message: 'Buscando suas informacoes de trabalho' });
    const agent = await fetchAgentWorkData(agentGuid);

    onProgress({ step: 'download', message: 'Baixando os dados da sua area de trabalho' });
    const consolidated = await fetchConsolidatedData(agent.grupo_equipe_guid!);

    onProgress({ step: 'structures', message: 'Preparando equipe, area, contrato e formulario' });
    await saveStructures(database, agent, consolidated);

    const formBaseDados = isFormBaseDados(consolidated.equipe);
    const teamGuid = agent.equipe_guid || agent.equipe_id!;
    const registrosCount = consolidated.registros?.length ?? 0;

    if (formBaseDados) {
      onProgress({ step: 'records', message: 'Organizando os registros para uso offline', current: 0, total: registrosCount });
      await saveRecords(database, consolidated, onProgress);
    } else {
      // Sem base: nao ha lista de registros — insere registro virtual unico.
      // Sem `current`/`total` para que a tela mostre so a mensagem (sem contador "0 de 1").
      onProgress({ step: 'records', message: 'Preparando preenchimento sem base de dados' });
      await saveBaselessRecord(database, teamGuid, agent.contrato_id!, agentGuid);
      onProgress({ step: 'records', message: 'Preenchimento sem base configurado' });
    }

    onProgress({ step: 'situacoes', message: 'Atualizando situacoes de campo e backoffice' });
    const [campo, backoffice] = await Promise.all([fetchSituacoesCampo(), fetchSituacoesBackoffice()]);
    await saveSituacoes(database, campo, backoffice);

    const recordsCount = formBaseDados ? registrosCount : 0;
    await database.runAsync(
      `INSERT OR REPLACE INTO offline_sync_state (agent_guid, status, records_count, updated_at, error_message)
       VALUES (?, 'ready', ?, ?, NULL)`,
      agentGuid, recordsCount, now(),
    );
    onProgress({ step: 'finish', message: 'Tudo pronto para trabalhar offline', current: recordsCount, total: recordsCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel preparar seus dados.';
    await database.runAsync(
      `INSERT OR REPLACE INTO offline_sync_state (agent_guid, status, records_count, updated_at, error_message)
       VALUES (?, 'error', 0, ?, ?)`,
      agentGuid, now(), message,
    );
    throw new Error(message);
  }
}
