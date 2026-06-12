import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { FillRecordLocalStatus } from '../features/form-fill/types/form';

type LocalState = { recordGuid: string; status: FillRecordLocalStatus } | null;

type RecordsListContextValue = {
  localState: LocalState;
  setLocalState: (state: LocalState) => void;
};

const RecordsListContext = createContext<RecordsListContextValue | null>(null);

export function RecordsListProvider({ children }: PropsWithChildren) {
  const [localState, setLocalState] = useState<LocalState>(null);
  const value = useMemo(() => ({ localState, setLocalState }), [localState]);

  return <RecordsListContext.Provider value={value}>{children}</RecordsListContext.Provider>;
}

export function useRecordsListContext() {
  const context = useContext(RecordsListContext);
  if (!context) {
    throw new Error('useRecordsListContext deve ser usado dentro de RecordsListProvider.');
  }
  return context;
}
