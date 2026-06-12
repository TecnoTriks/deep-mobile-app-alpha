import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View } from 'react-native';

import { useRecordsNavigation } from '../../../../navigation/hooks';
import { useRecordsListContext } from '../../../../navigation/RecordsListContext';
import { FilterModal } from '../../components/FilterModal';
import { RecordCardItem } from '../../components/RecordCardItem';
import { RecordsToolbar } from '../../components/RecordsToolbar';
import { useRecords } from '../../hooks/useRecords';
import type { RecordCard } from '../../../consolidated-data/types/offline';
import { BASELESS_GUID } from '../../../consolidated-data/services/offlineSync';

export function RecordsScreen() {
  const isFocused = useIsFocused();
  const navigation = useRecordsNavigation();
  const { localState } = useRecordsListContext();
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
  } = useRecords(isFocused);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const listRef = useRef<FlatList<RecordCard>>(null);
  const scrollOffset = useRef(0);

  const openRecord = useCallback(
    (recordGuid: string) => navigation.navigate('Fill', { recordGuid }),
    [navigation],
  );

  useEffect(() => {
    if (localState) markOfflineDraft(localState.recordGuid, localState.status);
  }, [localState, markOfflineDraft]);

  useEffect(() => {
    scrollOffset.current = 0;
    listRef.current?.scrollToOffset({ animated: false, offset: 0 });
  }, [resetToken, search, selectedStatus]);

  useEffect(() => {
    if (!isFocused || scrollOffset.current === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ animated: false, offset: scrollOffset.current });
    });
  }, [isFocused]);

  const clearFilter = () => {
    clearFilters();
    setIsFilterVisible(false);
  };

  const selectStatus = useCallback((statusGuid: string) => {
    setSelectedStatus(statusGuid);
    setIsFilterVisible(false);
  }, [setSelectedStatus]);

  const renderRecord = useCallback(({ item }: { item: RecordCard }) => (
    <RecordCardItem item={item} onOpenRecord={openRecord} />
  ), [openRecord]);

  if (isLoading && records.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-50">
        <ActivityIndicator color="#8b5cf6" size="large" />
      </View>
    );
  }

  if (!formBaseDados) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-50 px-6">
        <View className="w-full max-w-sm rounded-3xl border border-primary-200 bg-white p-6">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-primary-100">
            <Text className="text-2xl">📋</Text>
          </View>
          <Text className="text-lg font-bold text-zinc-900">Preenchimentos sem base</Text>
          <Text className="mt-1 text-sm leading-5 text-zinc-500">
            Este formulário não está vinculado a registros específicos. Inicie um novo preenchimento diretamente.
          </Text>
          <Pressable
            className="mt-5 min-h-12 items-center justify-center rounded-2xl bg-primary-500 px-4 active:bg-primary-600"
            onPress={() => openRecord(BASELESS_GUID)}
          >
            <Text className="text-base font-semibold text-white">Iniciar preenchimento</Text>
          </Pressable>
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
