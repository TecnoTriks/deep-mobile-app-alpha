import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterModal } from '../../components/FilterModal';
import { RecordCardItem } from '../../components/RecordCardItem';
import { RecordsToolbar } from '../../components/RecordsToolbar';
import { useRecords } from '../../hooks/useRecords';
import type { RecordCard } from '../../../consolidated-data/types/offline';
import type { FillRecordLocalStatus } from '../../../form-fill/types/form';
import { ClipboardIcon, PlusIcon } from '../../../../shared/components/Icon';

const BASELESS_GUID = '00000000-0000-0000-0000-000000000000';

type Props = {
  localState?: { recordGuid: string; status: FillRecordLocalStatus } | null;
  onOpenRecord: (recordGuid: string) => void;
  visible: boolean;
};

export function RecordsScreen({ localState, onOpenRecord, visible }: Props) {
  const {
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
  } = useRecords();
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const listRef = useRef<FlatList<RecordCard>>(null);
  const scrollOffset = useRef(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (localState) markOfflineDraft(localState.recordGuid, localState.status);
  }, [localState, markOfflineDraft]);

  useEffect(() => {
    scrollOffset.current = 0;
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [resetToken, search, selectedStatus]);

  useEffect(() => {
    if (!visible || scrollOffset.current === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ animated: false, offset: scrollOffset.current });
    });
  }, [visible]);

  const clearFilter = () => {
    clearFilters();
    setIsFilterVisible(false);
  };

  const selectStatus = useCallback((statusGuid: string) => {
    setSelectedStatus(statusGuid);
    setIsFilterVisible(false);
  }, [setSelectedStatus]);

  const renderRecord = useCallback(({ item }: { item: RecordCard }) => (
    <RecordCardItem item={item} onOpenRecord={onOpenRecord} />
  ), [onOpenRecord]);

  if (isLoading && records.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-50">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </View>
    );
  }

  if (!formBaseDados) {
    return (
      <View className="flex-1 bg-primary-500" style={{ paddingBottom: insets.bottom + 24 }}>
        <View className="flex-1 items-center justify-center px-8">
          {/* Ilustração em círculos concêntricos */}
          <View className="h-52 w-52 items-center justify-center rounded-full bg-white/10">
            <View className="h-40 w-40 items-center justify-center rounded-full bg-white/15">
              <View
                className="h-28 w-28 items-center justify-center rounded-full bg-white"
                style={{ elevation: 8 }}
              >
                <ClipboardIcon color="#8b5cf6" size={48} />
              </View>
            </View>
          </View>

          <Text className="mt-12 text-center text-[28px] font-bold leading-9 text-white">
            Preenchimentos{'\n'}sem base
          </Text>
          <Text className="mt-3 max-w-[300px] text-center text-base leading-6 text-primary-100">
            Este formulário não está vinculado a registros específicos. Inicie um novo preenchimento diretamente.
          </Text>

          <View className="mt-10 w-full px-6">
            <Pressable
              className="min-h-[60px] flex-row items-center justify-center gap-2 rounded-2xl bg-white px-4 active:bg-primary-50"
              onPress={() => onOpenRecord(BASELESS_GUID)}
            >
              <PlusIcon color="#ef561d" size={22} />
              <Text className="text-base font-bold text-primary-600">Iniciar preenchimento</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-50">
      <RecordsToolbar
        activeFilterLabel={activeFilterLabel}
        onChangeSearch={setSearch}
        onOpenFilter={() => setIsFilterVisible(true)}
        search={search}
      />

      {error ? (
        <View className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-3">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      ) : null}

      {records.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base text-zinc-500">Nenhum registro encontrado.</Text>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 64, paddingTop: 12 }}
          data={records}
          initialNumToRender={10}
          keyboardDismissMode="on-drag"
          keyExtractor={(item) => item.guid}
          ListFooterComponent={isLoadingMore ? (
            <View className="items-center py-4">
              <ActivityIndicator color="#8b5cf6" />
            </View>
          ) : null}
          maxToRenderPerBatch={10}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={100}
          removeClippedSubviews={Platform.OS === 'android'}
          ref={listRef}
          renderItem={renderRecord}
          updateCellsBatchingPeriod={50}
          windowSize={7}
        />
      )}

      <FilterModal
        onClear={clearFilter}
        onClose={() => setIsFilterVisible(false)}
        onSelect={selectStatus}
        selectedStatus={selectedStatus}
        statuses={statuses}
        visible={isFilterVisible}
      />
    </View>
  );
}
