import { recordCrashSync } from './crashLog';

/**
 * Instala um handler global para erros JS fatais (os que encerram o app sem RedBox em
 * build de release) e para promessas rejeitadas sem tratamento. Apenas REGISTRA o crash
 * em disco e repassa o erro adiante — nao muda o comportamento padrao do React Native.
 *
 * Deve ser chamado uma unica vez, o mais cedo possivel no boot.
 */

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

type ErrorUtilsLike = {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

type GlobalWithErrorUtils = {
  ErrorUtils?: ErrorUtilsLike;
  __crashHandlerInstalled?: boolean;
  HermesInternal?: { enablePromiseRejectionTracker?: (options: unknown) => void };
};

export function installGlobalErrorHandler() {
  const root = globalThis as unknown as GlobalWithErrorUtils;
  if (root.__crashHandlerInstalled) return;
  root.__crashHandlerInstalled = true;

  const errorUtils = root.ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      const err = error as { message?: string; stack?: string } | undefined;
      recordCrashSync({
        origin: 'global',
        isFatal: Boolean(isFatal),
        message: err?.message ?? String(error),
        stack: err?.stack ?? null,
        timestamp: new Date().toISOString(),
      });
      previous?.(error, isFatal);
    });
  }
}
