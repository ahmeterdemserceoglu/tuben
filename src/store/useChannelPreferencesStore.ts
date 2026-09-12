import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
export type ChannelNotification = 'all' | 'personalized' | 'none';
export const useChannelPreferencesStore = create<{ notifications: Record<string, ChannelNotification>; setNotifications: (id: string, preference: ChannelNotification) => void }>()(persist(set => ({ notifications: {}, setNotifications: (id, preference) => set(s => ({ notifications: { ...s.notifications, [id]: preference } })) }), { name: 'tuben-channel-preferences', storage: createJSONStorage(() => AsyncStorage) }));
