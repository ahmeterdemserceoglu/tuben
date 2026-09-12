import { PlaybackDiagnostics } from './src/services/playbackDiagnostics';
import { DownloadSheet } from './src/components/DownloadSheet';
import React, { useEffect } from 'react';
import { AppState, StatusBar } from 'react-native';
import { NativePlayerBridge } from './src/services/nativePlayerBridge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { AppNavigator, RootStackParamList } from './src/navigation/AppNavigator';
import { MiniPlayer } from './src/components/MiniPlayer';
import { FullPlayerModal } from './src/components/FullPlayerModal';
import { ShortsPlayerModal } from './src/components/ShortsPlayerModal';
import { PresenceService } from './src/services/presenceService';
import { usePlayerStore } from './src/store/usePlayerStore';
import { THEME } from './src/constants/theme';

import { ToastContainer } from './src/components/common/Toast';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const NavigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: THEME.colors.primary,
    background: THEME.colors.background,
    card: THEME.colors.surface,
    text: THEME.colors.textPrimary,
    border: THEME.colors.border,
    notification: THEME.colors.primary,
  },
};

function AppContent() {
  useEffect(() => { PlaybackDiagnostics.installCrashHandler(); }, []);
  const { user } = useAuth();
  const { setMinimized } = usePlayerStore();
  const fullscreenVideo = usePlayerStore((state) => Boolean(state.currentVideo && state.isFullscreen && !state.isMinimized && !state.isShortsPlayerVisible));

  useEffect(() => {
    const keepBrowsingPortrait = () => {
      const state = usePlayerStore.getState();
      if (state.currentVideo && state.isFullscreen && !state.isMinimized && !state.isShortsPlayerVisible) { void NativePlayerBridge.setOrientation('landscape'); return; }
      void NativePlayerBridge.setOrientation('portrait');
    };
    keepBrowsingPortrait();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') keepBrowsingPortrait();
    });
    return () => listener.remove();
  }, [fullscreenVideo]);

  useEffect(() => {
    if (user?.uid) {
      PresenceService.startPresence(user.uid);
    } else {
      PresenceService.stopPresence();
    }
    return () => {
      PresenceService.stopPresence();
    };
  }, [user?.uid]);

  return (
    <NavigationContainer ref={navigationRef} theme={NavigationTheme}>
      <AppNavigator />
      <FullPlayerModal />
      <ShortsPlayerModal />
      <MiniPlayer onExpand={() => setMinimized(false)} />
      <DownloadSheet />
      <ToastContainer />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
