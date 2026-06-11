import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 12;

async function ensureRecordsSearchTriggers(database: SQLiteDatabase) {
  await database.execAsync(`
    CREATE VIRTUAL TABLE IF NOT EXISTS offline_records_fts USING fts5(
      name,
      address,
      street,
      customer_code,
      content = 'offline_records',
      content_rowid = 'rowid',
      tokenize = 'unicode61 remove_diacritics 2'
    );

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
  `);
}

export async function migrateDatabase(database: SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);

  const result = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    await ensureRecordsSearchTriggers(database);
    return;
  }

  if (currentVersion === 0) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        payload TEXT,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );
    `);
  }

  if (currentVersion < 2) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS auth_session (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        token TEXT NOT NULL,
        agent_guid TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        agent_cpf TEXT NOT NULL,
        agent_type TEXT NOT NULL,
        agent_type_guid TEXT NOT NULL,
        agent_type_name TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  if (currentVersion < 3) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS agent_profiles (
        guid TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        cpf TEXT NOT NULL,
        phone TEXT,
        agent_type_guid TEXT NOT NULL,
        contract_guid TEXT NOT NULL,
        team_guid TEXT NOT NULL,
        team_name TEXT,
        group_guid TEXT NOT NULL,
        group_name TEXT,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_sync_state (
        agent_guid TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL,
        records_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS offline_contracts (
        guid TEXT PRIMARY KEY NOT NULL,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_groups (
        guid TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_teams (
        guid TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        contract_guid TEXT,
        group_guid TEXT,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_forms (
        guid TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        contract_guid TEXT,
        team_guid TEXT,
        number TEXT,
        is_main INTEGER NOT NULL DEFAULT 0,
        raw_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_records (
        guid TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        address TEXT,
        street TEXT,
        neighborhood TEXT,
        customer_code TEXT,
        latitude REAL,
        longitude REAL,
        team_guid TEXT,
        contract_guid TEXT,
        agent_guid TEXT,
        field_record_guid TEXT,
        backoffice_status_guid TEXT,
        created_at TEXT,
        modified_at TEXT,
        visits INTEGER NOT NULL DEFAULT 0,
        raw_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_backoffice (
        guid TEXT PRIMARY KEY NOT NULL,
        record_guid TEXT NOT NULL,
        status_guid TEXT,
        contract_guid TEXT,
        team_guid TEXT,
        agent_guid TEXT,
        created_at TEXT,
        status_name TEXT,
        raw_json TEXT NOT NULL,
        FOREIGN KEY (record_guid) REFERENCES offline_records(guid) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_offline_records_team ON offline_records(team_guid);
      CREATE INDEX IF NOT EXISTS idx_offline_records_contract ON offline_records(contract_guid);
      CREATE INDEX IF NOT EXISTS idx_offline_records_agent ON offline_records(agent_guid);
      CREATE INDEX IF NOT EXISTS idx_offline_records_status ON offline_records(backoffice_status_guid);
      CREATE INDEX IF NOT EXISTS idx_offline_backoffice_record ON offline_backoffice(record_guid);
      CREATE INDEX IF NOT EXISTS idx_offline_backoffice_status ON offline_backoffice(status_guid);
    `);
  }

  if (currentVersion < 4) {
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

  if (currentVersion < 5) {
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_offline_records_name ON offline_records(name);
      CREATE INDEX IF NOT EXISTS idx_offline_records_address ON offline_records(address);
      CREATE INDEX IF NOT EXISTS idx_offline_records_customer_code ON offline_records(customer_code);
      CREATE INDEX IF NOT EXISTS idx_offline_records_street ON offline_records(street);
    `);
  }

  if (currentVersion < 6) {
    await database.execAsync(`
      CREATE VIRTUAL TABLE IF NOT EXISTS offline_records_fts USING fts5(
        name,
        address,
        street,
        customer_code,
        content = 'offline_records',
        content_rowid = 'rowid',
        tokenize = 'unicode61 remove_diacritics 2'
      );

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

      INSERT INTO offline_records_fts(offline_records_fts) VALUES ('rebuild');
    `);
  }

  if (currentVersion < 7) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_form_drafts (
        record_guid TEXT NOT NULL,
        form_guid TEXT NOT NULL,
        values_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (record_guid, form_guid)
      );

      CREATE INDEX IF NOT EXISTS idx_offline_form_drafts_updated_at
      ON offline_form_drafts(updated_at);
    `);
  }

  if (currentVersion < 8) {
    await database.execAsync(`
      ALTER TABLE offline_form_drafts ADD COLUMN state_json TEXT;
      ALTER TABLE offline_form_drafts ADD COLUMN dados_json TEXT;
      ALTER TABLE offline_form_drafts ADD COLUMN status TEXT NOT NULL DEFAULT 'Preenchendo offline';
      ALTER TABLE offline_form_drafts ADD COLUMN updated_at_ms INTEGER NOT NULL DEFAULT 0;

      UPDATE offline_form_drafts
      SET state_json = values_json,
          dados_json = json_object('dados', json(values_json)),
          updated_at_ms = CAST(strftime('%s', updated_at) AS INTEGER) * 1000
      WHERE state_json IS NULL;
    `);
  }

  if (currentVersion < 9) {
    await database.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_offline_form_drafts_status_record
      ON offline_form_drafts(status, record_guid);
    `);
  }

  if (currentVersion < 10) {
    await database.execAsync(`
      ALTER TABLE offline_records ADD COLUMN base_dados_guid TEXT;
    `);
    await database.execAsync(`
      UPDATE offline_records SET base_dados_guid = guid;
    `);
  }

  if (currentVersion < 11) {
    await database.execAsync(`
      UPDATE offline_records SET base_dados_guid = guid WHERE base_dados_guid IS NULL;
    `);
  }

  if (currentVersion < 12) {
    await database.execAsync(`
      ALTER TABLE auth_session ADD COLUMN equipe_guid TEXT;
      ALTER TABLE auth_session ADD COLUMN grupo_equipe_guid TEXT;
    `);
  }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
  await ensureRecordsSearchTriggers(database);
}
