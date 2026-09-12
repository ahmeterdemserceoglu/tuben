import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { THEME } from '../constants/theme';
import { Haptics } from '../utils/haptics';

export const AuthModal: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { signIn, signUp, signInGuest, error, clearError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return;
    Haptics.selection();
    setSubmitting(true);
    try {
      if (isRegister) {
        await signUp(email, password, displayName);
      } else {
        await signIn(email, password);
      }
      Haptics.success();
      navigation.goBack();
    } catch {
      Haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = async () => {
    Haptics.selection();
    setSubmitting(true);
    try {
      await signInGuest();
      Haptics.success();
      navigation.goBack();
    } catch {
      Haptics.error();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isRegister ? 'Hesap Oluştur' : 'Giriş Yap'}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.leadText}>
            {isRegister
              ? 'Tuben deneyiminizi cihazlar arası senkronize edin.'
              : 'Favorilerinizi ve kütüphanenizi kaybetmemek için giriş yapın.'}
          </Text>

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          {isRegister && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Ad Soyad</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: Ahmet Yılmaz"
                placeholderTextColor={THEME.colors.textTertiary}
                value={displayName}
                onChangeText={(t) => {
                  clearError();
                  setDisplayName(t);
                }}
              />
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>E-Posta</Text>
            <TextInput
              style={styles.input}
              placeholder="ornek@mail.com"
              placeholderTextColor={THEME.colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(t) => {
                clearError();
                setEmail(t);
              }}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Şifre</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={THEME.colors.textTertiary}
              secureTextEntry
              value={password}
              onChangeText={(t) => {
                clearError();
                setPassword(t);
              }}
            />
          </View>

          <TouchableOpacity
            style={styles.submitBtn}
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isRegister ? 'Kayıt Ol' : 'Giriş Yap'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => {
              clearError();
              setIsRegister(!isRegister);
            }}
          >
            <Text style={styles.switchModeText}>
              {isRegister
                ? 'Zaten bir hesabınız var mı? Giriş Yapın'
                : 'Hesabınız yok mu? Yeni Hesap Oluşturun'}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>VEYA</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.guestBtn}
            onPress={handleGuest}
            disabled={submitting}
          >
            <Ionicons name="person-outline" size={18} color={THEME.colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={styles.guestBtnText}>Misafir Olarak Devam Et</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  leadText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
    color: THEME.colors.error,
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.25)',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 46,
    backgroundColor: THEME.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    paddingHorizontal: 14,
    color: THEME.colors.textPrimary,
    fontSize: 15,
  },
  submitBtn: {
    height: 48,
    backgroundColor: THEME.colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  switchModeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchModeText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.colors.divider,
  },
  dividerText: {
    color: THEME.colors.textTertiary,
    fontSize: 11,
    paddingHorizontal: 12,
    fontWeight: '700',
  },
  guestBtn: {
    height: 46,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
