import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getBackofficeStatuses, getFormBaseDados, getRecordsWithFilter } from '../../consolidated-data/services/offlineQueries';
import type { RecordCard } from '../../consolidated-data/types/offline';
import { AVAILABLE_STATUS_GUID, OFFLINE_DRAFT_STATUS_GUID, OFFLINE_FILLING_STATUS_GUID, type StatusFilter } from '../types/records';
import type { FillRecordLocalStatus } from '../../form-fill/types/form';

const SEARCH_DEBOUNCE_MS = 250;
const PAGE_SIZE = 40;

export function useRecords(enabled = true) {
  const database = useSQLiteContext();
  const requestId = useRef(0);
  const [records, setRecords] = useState<RecordCard[]>([]);
  const [statuses, setStatuses] = useState<StatusFilter[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [resetToken, setResetToken] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const hasMoreRef = useRef(true);
  const isLoadingRef = useRef(true);
  const isLoadingMoreRef = useRef(false);
  const nextCursor = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formBaseDados, setFormBaseDados] = useState(true);

  const loadRecords = useCallback(async (query: string, status: string, append = false) => {
    if (append && (!hasMoreRef.current || isLoadingRef.current || isLoadingMoreRef.current)) return;

    const currentRequestId = ++requestId.current;
    const databaseStatus = status === AVAILABLE_STATUS_GUID
      ? '__available__'
      : status === OFFLINE_DRAFT_STATUS_GUID
        ? '__offline_draft__'
        : status === OFFLINE_FILLING_STATUS_GUID
          ? '__offline_filling__'
        : status;

    if (append) {
      isLoadingMoreRef.current = true;
      setIsLoadingMore(true);
    } else {
      isLoadingRef.current = true;
      isLoadingMoreRef.current = false;
      setIsLoading(true);
      setIsLoadingMore(false);
      nextCursor.current = null;
    }

    try {
      const page = await getRecordsWithFilter(
        database,
        query.trim(),
        databaseStatus,
        append ? nextCursor.current : null,
        PAGE_SIZE,
      );
      if (currentRequestId === requestId.current) {
        setRecords((currentRecords) => {
          const startIndex = append ? currentRecords.length : 0;
          const numberedRecords = page.records.map((record, index) => ({
            ...record,
            sequentialNumber: startIndex + index + 1,
          }));

          return append ? [...currentRecords, ...numberedRecords] : numberedRecords;
        });
        nextCursor.current = page.nextCursor;
        hasMoreRef.current = page.hasMore;
        setError(null);
      }
    } catch {
      if (currentRequestId === requestId.current) {
        setError('Nao foi possivel carregar os registros.');
      }
    } finally {
      if (currentRequestId === requestId.current) {
        isLoadingRef.current = false;
        isLoadingMoreRef.current = false;
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [database]);

  useEffect(() => {
    if (!enabled) return;
    getFormBaseDados(database)
      .then(setFormBaseDados)
      .catch(() => setFormBaseDados(true));
  }, [database, enabled]);

  useEffect(() => {
    if (!enabled) return;
    getBackofficeStatuses(database)
      .then((data) => {
        const mappedStatuses = data.map<StatusFilter>((status) => ({
          color: status.cor,
          displayName: status.nome === 'Pendente' ? 'Ja preenchendo, aguardo backoffice' : status.nome,
          guid: status.guid,
        }));

        setStatuses([
          {
            color: '#71717a',
            displayName: 'Rascunho',
            guid: OFFLINE_DRAFT_STATUS_GUID,
          },
          {
            color: '#f59e0b',
            displayName: 'Preenchendo offline',
            guid: OFFLINE_FILLING_STATUS_GUID,
          },
          {
            color: '#22c55e',
            displayName: 'Disponivel para preenchimento',
            guid: AVAILABLE_STATUS_GUID,
          },
          ...mappedStatuses,
        ]);
      })
      .catch(() => setError('Nao foi possivel carregar os filtros.'));
  }, [database, enabled]);

  useEffect(() => {
    if (!enabled) return;
    requestId.current += 1;
    isLoadingRef.current = true;
    isLoadingMoreRef.current = false;
    setIsLoading(true);
    setIsLoadingMore(false);

    const timeout = setTimeout(() => {
      loadRecords(search, selectedStatus);
    }, search ? SEARCH_DEBOUNCE_MS : 0);

    return () => clearTimeout(timeout);
  }, [enabled, loadRecords, resetToken, search, selectedStatus]);

  const clearFilters = () => {
    setSearch('');
    setSelectedStatus('');
    setResetToken((currentToken) => currentToken + 1);
  };
  const markOfflineDraft = useCallback((recordGuid: string, status: FillRecordLocalStatus) => {
    setRecords((currentRecords) => {
      const matchingLocalFilter = (
        selectedStatus === OFFLINE_DRAFT_STATUS_GUID && status === 'Rascunho'
      ) || (
        selectedStatus === OFFLINE_FILLING_STATUS_GUID && status === 'Preenchendo offline'
      );
      if (selectedStatus && !matchingLocalFilter) {
        return currentRecords.filter((record) => record.guid !== recordGuid);
      }

      return currentRecords.map((record) => (
        record.guid === recordGuid
          ? {
            ...record,
            backofficeStatusColor: status === 'Preenchendo offline' ? '#f59e0b' : '#71717a',
            backofficeStatusName: status,
            canFill: status === 'Rascunho',
            hasOfflineDraft: true,
          }
          : record
      ));
    });
  }, [selectedStatus]);
  const loadMore = useCallback(() => {
    loadRecords(search, selectedStatus, true);
  }, [loadRecords, search, selectedStatus]);

  const activeFilterLabel = selectedStatus
    ? statuses.find((status) => status.guid === selectedStatus)?.displayName ?? 'Filtrado'
    : undefined;

  return {
    activeFilterLabel,
    clearFilters,
    error,
    formBaseDados,
    isLoading,
    isLoadingMore,
    loadMore,
    markOfflineDraft,
    records,
    resetToken,
    search,
    selectedStatus,
    setSearch,
    setSelectedStatus,
    statuses,
  };
}
