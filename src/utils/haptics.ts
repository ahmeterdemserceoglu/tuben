import { Platform, Vibration } from 'react-native';

export const Haptics = {
  light: () => {
    if (Platform.OS === 'android') {
      Vibration.vibrate(10);
    }
  },
  medium: () => {
    if (Platform.OS === 'android') {
      Vibration.vibrate(20);
    }
  },
  selection: () => {
    if (Platform.OS === 'android') {
      Vibration.vibrate(6);
    }
  },
  success: () => {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 15, 60, 15]);
    }
  },
  error: () => {
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 30, 80, 40]);
    }
  },
};
