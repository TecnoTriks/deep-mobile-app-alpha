import { StatusBar } from 'expo-status-bar';
import { type PropsWithChildren, useCallback, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../features/auth/context/AuthContext';
import { OverviewScreen } from '../../features/overview/screens/OverviewScreen';
import { RecordsFlow } from '../../features/records/RecordsFlow';
import { SyncScreen } from '../../features/sync/screens/SyncScreen';
import { TeamScreen } from '../../features/team/screens/TeamScreen';
import { AppNavContext } from '../context/AppNavContext';
import { MenuIcon } from '../components/MenuIcon';
import { MenuItem } from '../components/MenuItem';

export type AppScreen = 'home' | 'overview' | 'records' | 'sync' | 'team';

const SCREEN_TITLES: Record<AppScreen, string> = {
  home: 'Inicio',
  overview: 'Visão Geral',
  records: 'Preenchimentos',
  sync: 'Sincronização',
  team: 'Equipe',
};

export function AuthenticatedLayout({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const { session, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [pageTitle, setPageTitle] = useState(SCREEN_TITLES.home);
  const [isFillingRecord, setIsFillingRecord] = useState(false);
  const [recordsResetSignal, setRecordsResetSignal] = useState(0);
  const menuWidth = Math.min(width * 0.88, 360);
  const menuTranslate = useRef(new Animated.Value(-menuWidth)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const initials = session?.agent.nome
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
    menuTranslate.setValue(-menuWidth);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(menuTranslate, {
        duration: 260,
        toValue: 0,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        duration: 260,
        toValue: 1,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [menuTranslate, menuWidth, overlayOpacity]);

  const closeMenu = useCallback(() => {
    Animated.parallel([
      Animated.timing(menuTranslate, {
        duration: 220,
        toValue: -menuWidth,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        duration: 220,
        toValue: 0,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setIsMenuOpen(false));
  }, [menuTranslate, menuWidth, overlayOpacity]);

  const navigateTo = useCallback(
    (screen: AppScreen) => {
      if (screen === 'records' && currentScreen === 'records' && isFillingRecord) {
        setRecordsResetSignal((n) => n + 1);
        closeMenu();
        return;
      }
      setCurrentScreen(screen);
      setPageTitle(SCREEN_TITLES[screen]);
      if (isMenuOpen) closeMenu();
    },
    [closeMenu, currentScreen, isFillingRecord, isMenuOpen],
  );

  const updatePageTitle = useCallback((title: string) => setPageTitle(title), []);

  const isRecords = currentScreen === 'records';

  return (
    <AppNavContext.Provider value={{ navigateTo }}>
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <StatusBar style="dark" />

        <View className="min-h-20 flex-row items-center bg-white px-4 py-3">
          <Pressable
            accessibilityLabel="Abrir menu"
            className="mr-3 h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 active:bg-primary-600"
            onPress={openMenu}
          >
            <MenuIcon />
          </Pressable>
          <View className="flex-1">
            <Text className="mt-1 text-base font-semibold text-zinc-950" numberOfLines={1} ellipsizeMode="tail">
              {session?.agent.nome}
            </Text>
            <Text className="mt-0.5 text-xs text-zinc-500" numberOfLines={1} ellipsizeMode="tail">
              {session?.agent.tipo_agente.nome}
            </Text>
          </View>
          <Text className="ml-3 text-sm font-semibold text-primary-600">{pageTitle}</Text>
        </View>

        <View className="flex-1 overflow-hidden rounded-t-3xl bg-primary-50">
          {currentScreen === 'home' && children}
          {currentScreen === 'overview' && <OverviewScreen />}
          {currentScreen === 'sync' && <SyncScreen />}
          {currentScreen === 'team' && <TeamScreen />}

          {/*
           * RecordsFlow is always mounted to preserve its internal state
           * (scroll position, active record, etc.). When not active it is
           * hidden via display:none AND pointerEvents="none" so it never
           * intercepts touches that belong to whichever screen is visible.
           */}
          <View
            pointerEvents={isRecords ? 'auto' : 'none'}
            style={{ flex: 1, display: isRecords ? 'flex' : 'none' }}
          >
            <RecordsFlow
              active={isRecords}
              onFillingChange={setIsFillingRecord}
              onTitleChange={updatePageTitle}
              resetSignal={recordsResetSignal}
            />
          </View>
        </View>

        <Modal
          animationType="none"
          onRequestClose={closeMenu}
          statusBarTranslucent={Platform.OS === 'android'}
          transparent
          visible={isMenuOpen}
        >
          <View className="flex-1 flex-row">
            <Animated.View
              className="bg-white"
              style={{ width: menuWidth, transform: [{ translateX: menuTranslate }] }}
            >
              <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
                <View className="flex-row items-center justify-between px-5 pb-6 pt-4">
                  <Image
                    className="h-12 w-32 rounded-xl"
                    resizeMode="contain"
                    source={require('../../../assets/deep/logo.jpg')}
                  />
                  <Pressable
                    className="h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100"
                    onPress={closeMenu}
                  >
                    <MenuIcon dark />
                  </Pressable>
                </View>

                <View className="mx-5 flex-row items-center rounded-3xl bg-zinc-100 p-4">
                  <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-500">
                    <Text className="text-sm font-bold text-white">{initials}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text
                      className="text-base font-semibold text-zinc-950"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {session?.agent.nome}
                    </Text>
                    <Text
                      className="mt-0.5 text-sm text-primary-600"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {session?.agent.tipo_agente.nome}
                    </Text>
                  </View>
                </View>

                <View className="mt-6 flex-1 px-3">
                  <MenuItem
                    active={currentScreen === 'home'}
                    label="Inicio"
                    onPress={() => navigateTo('home')}
                    symbol="I"
                  />
                  <MenuItem
                    active={currentScreen === 'records' && !isFillingRecord}
                    label="Preenchimentos"
                    onPress={() => navigateTo('records')}
                    symbol="P"
                  />
                  <MenuItem
                    active={currentScreen === 'sync'}
                    label="Sincronização"
                    onPress={() => navigateTo('sync')}
                    symbol="S"
                  />
                  <MenuItem
                    active={currentScreen === 'overview'}
                    label="Visão Geral"
                    onPress={() => navigateTo('overview')}
                    symbol="V"
                  />
                  <MenuItem
                    active={currentScreen === 'team'}
                    label="Equipe"
                    onPress={() => navigateTo('team')}
                    symbol="E"
                  />
                </View>

                <View className="border-t border-zinc-200 px-3 pb-3 pt-3">
                  <MenuItem label="Sair deste aparelho" onPress={signOut} symbol="S" />
                </View>
              </SafeAreaView>
            </Animated.View>

            <Animated.View className="flex-1" style={{ opacity: overlayOpacity }}>
              <Pressable className="flex-1 bg-black/30" onPress={closeMenu} />
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </AppNavContext.Provider>
  );
}
