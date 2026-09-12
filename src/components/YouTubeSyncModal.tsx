import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Linking,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { YouTubeAuthService, DeviceCodeResponse } from '../services/youtubeAuthService';
import { YouTubeService } from '../services/youtubeService';
import { THEME } from '../constants/theme';
import { useThemeStore } from '../store/useThemeStore';
import { Haptics } from '../utils/haptics';

interface YouTubeSyncModalProps {
  visible: boolean;
  onClose: () => void;
}

export const YouTubeSyncModal: React.FC<YouTubeSyncModalProps> = ({ visible, onClose }) => {
  const colors = useThemeStore((s) => s.colors);

  const [isConnected, setIsConnected] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'waiting' | 'syncing' | 'success' | 'error'>('idle');
  const [deviceData, setDeviceData] = useState<DeviceCodeResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopPollingRef = useRef<(() => void) | null>(null);
  const attemptId = useRef(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const currentAttempt = ++attemptId.current;
    if (visible) {
      setLoadingInitial(true);
      setStatus('idle');
      setErrorMessage(null);
      setDeviceData(null);
      YouTubeAuthService.isAuthenticated()
        .then((connected) => { if (currentAttempt === attemptId.current) setIsConnected(connected); })
        .finally(() => { if (currentAttempt === attemptId.current) setLoadingInitial(false); });
    } else {
      if (stopPollingRef.current) {
        stopPollingRef.current();
      }
    }
    return () => {
      attemptId.current++;
      stopPollingRef.current?.();
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [visible]);

  useEffect(() => {
    if (status === 'waiting') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [status, pulseAnim]);

  const verifyFeeds = async (currentAttempt: number) => {
    setStatus('syncing');
    setErrorMessage(null);
    const results = await Promise.allSettled([
      YouTubeService.getHomeFeed('all'),
      YouTubeService.getPersonalSubscriptionFeed(),
    ]);
    if (currentAttempt !== attemptId.current) return;
    const errors = results.flatMap((result) => result.status === 'rejected'
      ? [result.reason instanceof Error ? result.reason.message : 'YouTube akışı yüklenemedi.'] : []);
    if (errors.length > 0) {
      Haptics.error();
      setStatus('error');
      setErrorMessage(Array.from(new Set(errors)).join(' '));
      return;
    }
    Haptics.success();
    YouTubeAuthService.requestFeedReload();
    setStatus('success');
    closeTimerRef.current = setTimeout(onClose, 1400);
  };

  const handleStartConnect = async () => {
    Haptics.selection();
    const currentAttempt = ++attemptId.current;
    if (isConnected) {
      await verifyFeeds(currentAttempt);
      return;
    }
    setStatus('loading');
    setErrorMessage(null);

    try {
      const codeInfo = await YouTubeAuthService.requestDeviceCode();
      if (currentAttempt !== attemptId.current) return;
      setDeviceData(codeInfo);
      setStatus('waiting');

      const targetUrl = `${codeInfo.verificationUrl}?user_code=${encodeURIComponent(codeInfo.userCode)}`;
      void Linking.openURL(targetUrl).catch(() => {
        void Linking.openURL(codeInfo.verificationUrl);
      });

      stopPollingRef.current = YouTubeAuthService.startPolling(
        codeInfo.deviceCode,
        codeInfo.interval,
        () => {
          if (currentAttempt !== attemptId.current) return;
          setIsConnected(true);
          void verifyFeeds(currentAttempt);
        },
        (err) => {
          if (currentAttempt !== attemptId.current) return;
          Haptics.error();
          setStatus('error');
          setErrorMessage(err);
        }
      );
    } catch (err: any) {
      if (currentAttempt !== attemptId.current) return;
      Haptics.error();
      setStatus('error');
      setErrorMessage(err?.message || 'Eşleme başlatılamadı. İnternet bağlantınızı kontrol edin.');
    }
  };

  const handleOpenBrowser = () => {
    if (!deviceData) return;
    Haptics.selection();
    const targetUrl = `${deviceData.verificationUrl}?user_code=${encodeURIComponent(deviceData.userCode)}`;
    void Linking.openURL(targetUrl).catch(() => {
      void Linking.openURL(deviceData.verificationUrl);
    });
  };

  const handleCancel = () => {
    attemptId.current++;
    Haptics.selection();
    if (stopPollingRef.current) {
      stopPollingRef.current();
    }
    setStatus('idle');
    setDeviceData(null);
    setErrorMessage(null);
  };

  const handleDisconnect = async () => {
    attemptId.current++;
    Haptics.selection();
    await YouTubeAuthService.signOut();
    setIsConnected(false);
    setStatus('idle');
    setDeviceData(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider || 'rgba(255,255,255,0.08)' }]}>
            <Text style={styles.headerTitle}>YouTube Senkronizasyonu</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {loadingInitial ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={THEME.colors.primary} />
              </View>
            ) : isConnected && status === 'idle' ? (
              /* Already Synced State */
              <View style={styles.stateContainer}>
                <View style={styles.iconCircleSuccess}>
                  <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                </View>

                <Text style={styles.heroTitle}>YouTube Hesabı Bağlı</Text>
                <Text style={styles.heroDesc}>
                  Ana sayfa, keşfet ve abonelikleriniz bağlı YouTube hesabından yüklenir. Akışlara erişimi aşağıdan kontrol edebilirsiniz.
                </Text>

                <View style={styles.syncBadge}>
                  <Ionicons name="sync-outline" size={16} color="#10B981" style={{ marginRight: 6 }} />
                  <Text style={styles.syncBadgeText}>YouTube Bağlantısı Açık</Text>
                </View>

                <TouchableOpacity style={[styles.primaryBtn, { marginBottom: 12 }]} onPress={handleStartConnect}>
                  <Text style={styles.primaryBtnText}>Akışları Kontrol Et</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.disconnectBtn, { borderColor: 'rgba(255,255,255,0.15)' }]}
                  activeOpacity={0.75}
                  onPress={handleDisconnect}
                >
                  <Ionicons name="link-outline" size={18} color="#FF4D4D" style={{ marginRight: 8 }} />
                  <Text style={styles.disconnectBtnText}>Senkronizasyonu Durdur</Text>
                </TouchableOpacity>
              </View>
            ) : status === 'waiting' && deviceData ? (
              /* Waiting for Google confirmation */
              <View style={styles.stateContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name="logo-youtube" size={36} color="#FF0033" />
                </View>

                <Text style={styles.heroTitle}>Google Doğrulama Kodu</Text>
                <Text style={styles.heroDesc}>
                  Tarayıcınızda açılan Google sayfasında bu kodu onaylayın:
                </Text>

                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{deviceData.userCode}</Text>
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.85}
                  onPress={handleOpenBrowser}
                >
                  <Ionicons name="open-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Google Sayfasını Aç</Text>
                </TouchableOpacity>

                <Animated.View style={[styles.waitingRow, { opacity: pulseAnim }]}>
                  <ActivityIndicator size="small" color={THEME.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.waitingText}>Sayfada "İzin Ver" bekleniyor...</Text>
                </Animated.View>

                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>
              </View>
            ) : status === 'syncing' ? (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginBottom: 20 }} />
                <Text style={styles.heroTitle}>YouTube Akışları Yükleniyor</Text>
                <Text style={styles.heroDesc}>Ana sayfanız ve abonelikleriniz kontrol ediliyor…</Text>
              </View>
            ) : status === 'success' ? (
              /* Success Screen */
              <View style={styles.stateContainer}>
                <View style={styles.iconCircleSuccess}>
                  <Ionicons name="checkmark-circle" size={54} color="#10B981" />
                </View>
                <Text style={styles.heroTitle}>Başarıyla Eşitlendi! 🎉</Text>
                <Text style={styles.heroDesc}>
                  YouTube ana sayfanız ve abonelik akışınız başarıyla yüklendi.
                </Text>
              </View>
            ) : (
              /* Idle / Connect Screen */
              <View style={styles.stateContainer}>
                <View style={styles.iconCircle}>
                  <Ionicons name="logo-youtube" size={42} color="#FF0033" />
                </View>

                <Text style={styles.heroTitle}>{isConnected ? 'Hesap Bağlı, Akış Yüklenemedi' : 'YouTube ile Eşitle'}</Text>
                <Text style={styles.heroDesc}>
                  Kendi YouTube ana sayfanızı, önerilen videolarınızı ve keşfet akışınızı Tuben ile senkronize edin.
                </Text>

                <View style={styles.featureList}>
                  <View style={styles.featureItem}>
                    <Ionicons name="sparkles-outline" size={18} color={THEME.colors.primary} style={styles.featureIcon} />
                    <Text style={styles.featureText}>Kişiselleştirilmiş Ana Sayfa ve Keşfet</Text>
                  </View>

                  <View style={styles.featureItem}>
                    <Ionicons name="albums-outline" size={18} color="#38BDF8" style={styles.featureIcon} />
                    <Text style={styles.featureText}>YouTube aboneliklerinizdeki taze videolar</Text>
                  </View>

                  <View style={styles.featureItem}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" style={styles.featureIcon} />
                    <Text style={styles.featureText}>Şifresiz resmi Google Cihaz Eşleme güvenliği</Text>
                  </View>
                </View>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={18} color="#FF4D4D" style={{ marginRight: 8 }} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.85}
                  onPress={handleStartConnect}
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={18} color="#FFFFFF" style={{ marginRight: 10 }} />
                      <Text style={styles.primaryBtnText}>{isConnected ? 'Tekrar Dene' : 'Google ile Eşitle'}</Text>
                    </>
                  )}
                </TouchableOpacity>

                {isConnected && (
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleDisconnect}>
                    <Text style={styles.disconnectBtnText}>Bağlantıyı Kes</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.footerNote}>
                  Şifre girmeniz gerekmez. Eşleme işlemi doğrudan resmi Google sayfası üzerinden yapılır.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 30,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    padding: 24,
  },
  centerBox: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 0, 51, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 51, 0.25)',
  },
  iconCircleSuccess: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  heroTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 10,
  },
  featureList: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureIcon: {
    marginRight: 10,
  },
  featureText: {
    color: THEME.colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '500',
    flex: 1,
  },
  codeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 3,
    fontFamily: 'monospace',
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  waitingText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    color: THEME.colors.textTertiary,
    fontSize: 13.5,
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#FF4D4D',
    fontSize: 13,
    flex: 1,
  },
  footerNote: {
    color: THEME.colors.textTertiary,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 24,
  },
  syncBadgeText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  disconnectBtn: {
    width: '100%',
    height: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectBtnText: {
    color: '#FF4D4D',
    fontSize: 14,
    fontWeight: '600',
  },
});
