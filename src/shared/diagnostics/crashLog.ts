import { File, Paths } from 'expo-file-system';

/**
 * Captura de falhas 100% local (sem servico externo, funciona offline).
 *
 * Grava o ultimo crash em um arquivo no diretorio de documentos usando a escrita
 * SINCRONA do expo-file-system (`File.write` retorna void), o que permite registrar
 * o erro mesmo quando o app esta prestes a ser encerrado pelo handler global de erros
 * fatais. Na proxima abertura o app le esse arquivo e mostra o que aconteceu — assim
 * deixa de "fechar sozinho sem deixar rastro".
 */

const CRASH_FILE_NAME = 'last-crash.json';

export type CrashOrigin = 'render' | 'global' | 'unhandledRejection';

export type CrashRecord = {
  origin: CrashOrigin;
  isFatal: boolean;
  message: string;
  stack: string | null;
  componentStack?: string | null;
  /** Contexto livre para correlacionar (ex.: form_base_dados, tela atual, registro). */
  context?: Record<string, string | number | boolean | null>;
  timestamp: string;
};

function crashFile() {
  return new File(Paths.document, CRASH_FILE_NAME);
}

/**
 * Grava o crash de forma sincrona. Best-effort: qualquer falha de IO e engolida para
 * nunca lancar de dentro do proprio handler de erro.
 */
export function recordCrashSync(record: CrashRecord) {
  try {
    const file = crashFile();
    file.create({ overwrite: true });
    file.write(JSON.stringify(record));
  } catch {
    // Se nem o registro do crash funcionar, nao ha o que fazer — evita loop de erro.
  }
}

export async function readLastCrash(): Promise<CrashRecord | null> {
  try {
    const file = crashFile();
    if (!file.exists) return null;
    const text = await file.text();
    return JSON.parse(text) as CrashRecord;
  } catch {
    return null;
  }
}

export function clearLastCrash() {
  try {
    const file = crashFile();
    if (file.exists) file.delete();
  } catch {
    // Limpeza best-effort.
  }
}
