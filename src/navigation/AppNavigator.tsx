import { DiagnosticsScreen } from '../screens/DiagnosticsScreen';
import { DownloadsScreen } from '../screens/DownloadsScreen';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { HomeScreen } from '../screens/HomeScreen';
import { TrendingScreen } from '../screens/TrendingScreen';
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { ChannelScreen } from '../screens/ChannelScreen';
import { PlaylistScreen } from '../screens/PlaylistScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PlayerScreen } from '../screens/PlayerScreen';
import { AuthModal } from '../screens/AuthModal';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { useNavigationLayoutStore } from '../store/useNavigationLayoutStore';
import { DEFAULT_BOTTOM_BAR_HEIGHT, floatingNavigationBottom } from '../constants/navigationLayout';

// ... (keep types)

export type RootStackParamList = {
  MainTabs: undefined;
  Search: undefined;
  Channel: { channelId: string; channelName?: string };
  Playlist: { playlistId: string; title?: string };
  History: undefined;
  Downloads: undefined;
  Diagnostics: undefined;
  Settings: undefined;
  Player: { videoId: string; video?: any; startPosition?: number };
  Auth: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Trending: undefined;
  Subscriptions: undefined;
  Library: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TouchableOpacity, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Haptics } from '../utils/haptics';

interface TabConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

const TAB_CONFIGS: Record<string, TabConfig> = {
  Home: { label: 'Ana Sayfa', icon: 'home-outline', activeIcon: 'home' },
  Trending: { label: 'Keşfet', icon: 'compass-outline', activeIcon: 'compass' },
  Subscriptions: { label: 'Abonelikler', icon: 'albums-outline', activeIcon: 'albums' },
  Library: { label: 'Kitaplık', icon: 'library-outline', activeIcon: 'library' },
};

export const TAB_BAR_HEIGHT = DEFAULT_BOTTOM_BAR_HEIGHT;

function VoxenFloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const setBottomBarHeight = useNavigationLayoutStore((state) => state.setBottomBarHeight);
  const bottomMargin = floatingNavigationBottom(insets.bottom, Platform.OS);

  return (
    <View style={[styles.floatingNavWrapper, { bottom: bottomMargin }]} pointerEvents="box-none">
      <View style={styles.floatingNavContainer} onLayout={(event) => setBottomBarHeight(event.nativeEvent.layout.height)}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIGS[route.name] || {
            label: route.name,
            icon: 'ellipse-outline',
            activeIcon: 'ellipse',
          };

          const onPress = () => {
            Haptics.selection();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.floatingTabBtn}
              activeOpacity={0.7}
              onPress={onPress}
            >
              <Ionicons
                name={isFocused ? config.activeIcon : config.icon}
                size={22}
                color={isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)'}
              />
              <Text style={[styles.floatingTabLabel, isFocused && styles.floatingTabLabelActive]}>
                {config.label}
              </Text>
              {isFocused && <View style={styles.floatingTabDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <VoxenFloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Trending" component={TrendingScreen} />
      <Tab.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const colors = useThemeStore((s) => s.colors);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Channel" component={ChannelScreen} />
      <Stack.Screen name="Playlist" component={PlaylistScreen} />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
      <Stack.Screen name="Downloads" component={DownloadsScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen
        name="Player"
        component={PlayerScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="Auth"
        component={AuthModal}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  floatingNavWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    alignItems: 'center',
    zIndex: 100,
  },
  floatingNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 22, 24, 0.95)',
    borderRadius: 36,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 14,
  },
  floatingTabBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    minWidth: 68,
  },
  floatingTabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  floatingTabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  floatingTabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF0033',
    marginTop: 3,
  },
});

