import { Directory, File, Paths } from 'expo-file-system';

// Copia no maximo essa quantidade de arquivos em paralelo. Com ate 30+ imagens selecionadas de
// uma vez, copiar tudo em um unico Promise.all sobrecarrega memoria/IO em aparelhos mais fracos
// e pode travar o app. Processar em pequenos lotes mantem a UI responsiva e evita picos de uso
// de memoria, sem mudar o fluxo percebido pelo usuario (o indicador "Salvando..." ja cobre essa espera).
const COPY_BATCH_SIZE = 3;

export type PersistedFileResult = { ok: true; uri: string } | { ok: false; uri: null };

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

// Nome unico e estavel por arquivo (UUID), no mesmo formato que o backend ja recebe
// do app web (ex.: "f5e56112-c90e-4988-899c-43881be48be3.jpeg"). A unicidade do nome e
// a identidade do arquivo no envio: dois arquivos NUNCA podem compartilhar nome, senao
// colidem no servidor. O nome guardado no disco e o mesmo enviado em `dados`.
function safeFileName(uri: string) {
  const rawExtension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const extension = /^[a-z0-9]{1,5}$/.test(rawExtension) ? rawExtension : 'dat';
  return `${uuidv4()}.${extension}`;
}

/**
 * Copia os arquivos selecionados para a pasta do rascunho em pequenos lotes.
 *
 * Retorna um resultado por arquivo (sucesso/falha) em vez de rejeitar tudo na primeira falha:
 * assim, se 1 de 30 imagens falhar ao copiar, as outras 29 nao sao perdidas.
 */
export async function persistDraftFiles(recordGuid: string, formGuid: string, fieldId: string, uris: string[]): Promise<PersistedFileResult[]> {
  const directory = new Directory(Paths.document, 'form-drafts', recordGuid, formGuid, fieldId);
  directory.create({ idempotent: true, intermediates: true });

  const results: PersistedFileResult[] = [];

  for (let start = 0; start < uris.length; start += COPY_BATCH_SIZE) {
    const batch = uris.slice(start, start + COPY_BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const batchResults = await Promise.allSettled(batch.map(async (uri) => {
      if (uri.startsWith(directory.uri)) return uri;

      const source = new File(uri);
      const destination = new File(directory, safeFileName(uri));
      await source.copy(destination);
      return destination.uri;
    }));

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push({ ok: true, uri: result.value });
      } else {
        results.push({ ok: false, uri: null });
      }
    });
  }

  return results;
}

export function deleteDraftFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The draft value is still removed even if the underlying file no longer exists.
  }
}

/**
 * Remove a pasta de arquivos de um rascunho (todas as imagens/documentos do preenchimento)
 * apos a sincronizacao ter sido confirmada com sucesso pela API.
 */
export function deleteDraftDirectory(recordGuid: string, formGuid: string) {
  try {
    const directory = new Directory(Paths.document, 'form-drafts', recordGuid, formGuid);
    if (directory.exists) directory.delete();
  } catch {
    // Limpeza de arquivos e best-effort: nao deve impedir a confirmacao do envio.
  }
}
