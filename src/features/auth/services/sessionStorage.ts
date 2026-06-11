import type { SQLiteDatabase } from 'expo-sqlite';

import type { AuthSession } from '../types/auth';

type StoredSession = {
  token: string;
  agent_guid: string;
  agent_name: string;
  agent_cpf: string;
  agent_type: string;
  agent_type_guid: string;
  agent_type_name: string;
  equipe_guid: string | null;
  grupo_equipe_guid: string | null;
};

export async function loadSession(database: SQLiteDatabase): Promise<AuthSession | null> {
  const row = await database.getFirstAsync<StoredSession>('SELECT * FROM auth_session WHERE id = 1');

  if (!row) return null;

  return {
    token: row.token,
    agent: {
      guid: row.agent_guid,
      nome: row.agent_name,
      cpf: row.agent_cpf,
      tipo: row.agent_type,
      tipo_agente: {
        guid: row.agent_type_guid,
        nome: row.agent_type_name,
      },
      // Keep null as null — do NOT convert to undefined.
      // hasTeam/hasGroup in AppNavigator use != null (loose) which catches both
      // null and undefined. A null means the API confirmed no team/group.
      equipe_guid: row.equipe_guid,
      grupo_equipe_guid: row.grupo_equipe_guid,
    },
  };
}

export async function saveSession(database: SQLiteDatabase, session: AuthSession) {
  await database.runAsync(
    `INSERT OR REPLACE INTO auth_session (
      id, token, agent_guid, agent_name, agent_cpf, agent_type,
      agent_type_guid, agent_type_name, equipe_guid, grupo_equipe_guid, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.token,
    session.agent.guid,
    session.agent.nome,
    session.agent.cpf,
    session.agent.tipo,
    session.agent.tipo_agente.guid,
    session.agent.tipo_agente.nome,
    session.agent.equipe_guid ?? null,
    session.agent.grupo_equipe_guid ?? null,
    new Date().toISOString(),
  );
}

export async function clearSession(database: SQLiteDatabase) {
  await database.runAsync('DELETE FROM auth_session WHERE id = 1');
}
