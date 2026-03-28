import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { dispatchResetToLogin } from '../lib/resetToLoginStack';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { setAppIconBadge } from '../services/appIconBadge';
import { setupPushNotificationHandlers } from '../services/pushNotificationHandler';
import { checkArtistsAndRedirect } from '../services/supabase/authService';
import { checkUserExists } from '../services/supabase/userService';
import { isLikelyNetworkFailure } from '../utils/isLikelyNetworkFailure';

const LOADING_TIMEOUT_MS = 8000;

function isNetOffline(state: { isConnected: boolean | null; isInternetReachable: boolean | null }) {
  return state.isConnected === false || state.isInternetReachable === false;
}

export default function Index() {
  const navigation = useNavigation();
  const hasNavigated = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const openOfflineModal = useCallback(() => {
    if (hasNavigated.current) return;
    clearSafetyTimer();
    setShowOfflineModal(true);
  }, [clearSafetyTimer]);

  const scheduleSafetyTimer = useCallback(() => {
    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => {
      if (!hasNavigated.current) {
        openOfflineModal();
      }
    }, LOADING_TIMEOUT_MS);
  }, [clearSafetyTimer, openOfflineModal]);

  const navigateTo = useCallback(
    (route: string) => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      clearSafetyTimer();
      setShowOfflineModal(false);
      router.replace(route as any);
    },
    [clearSafetyTimer]
  );

  const goToLogin = useCallback(() => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    clearSafetyTimer();
    setShowOfflineModal(false);
    dispatchResetToLogin(navigation);
  }, [clearSafetyTimer, navigation]);

  /** Evita mandar para login sem rede (mensagem de erro nem sempre indica rede). */
  const goToLoginUnlessOffline = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (isNetOffline(net)) {
      openOfflineModal();
      return;
    }
    goToLogin();
  }, [goToLogin, openOfflineModal]);

  const applyArtistRedirect = useCallback(
    (artistRedirect: Awaited<ReturnType<typeof checkArtistsAndRedirect>>) => {
      setAppIconBadge(0);
      if (artistRedirect.shouldRedirectToSelection) {
        navigateTo('/selecionar-artista');
      } else {
        navigateTo('/(tabs)/agenda');
      }
    },
    [navigateTo]
  );

  const checkAuthStatus = useCallback(async () => {
    let session: Session | null = null;
    try {
      const {
        data: { session: s },
        error: sessionError,
      } = await supabase.auth.getSession();
      session = s;

      if (sessionError) {
        if (isLikelyNetworkFailure(sessionError, sessionError.message)) {
          openOfflineModal();
          return;
        }
        await goToLoginUnlessOffline();
        return;
      }

      if (!session?.user) {
        await goToLoginUnlessOffline();
        return;
      }

      if (!session.user.email_confirmed_at) {
        navigateTo('/email-confirmation');
        return;
      }

      const userId = session.user.id;

      const [userCheck, artistRedirect] = await Promise.all([
        checkUserExists(userId),
        checkArtistsAndRedirect(userId),
      ]);

      if (userCheck.error) {
        if (isLikelyNetworkFailure(null, userCheck.error)) {
          applyArtistRedirect(artistRedirect);
          return;
        }
        await goToLoginUnlessOffline();
        return;
      }

      if (!userCheck.exists) {
        goToLogin();
        return;
      }

      applyArtistRedirect(artistRedirect);
    } catch (e) {
      if (isLikelyNetworkFailure(e) && session?.user?.email_confirmed_at) {
        const artistRedirect = await checkArtistsAndRedirect(session.user.id);
        applyArtistRedirect(artistRedirect);
        return;
      }
      if (isLikelyNetworkFailure(e)) {
        openOfflineModal();
        return;
      }
      await goToLoginUnlessOffline();
    }
  }, [applyArtistRedirect, goToLogin, goToLoginUnlessOffline, navigateTo, openOfflineModal]);

  const checkAuthRef = useRef(checkAuthStatus);
  checkAuthRef.current = checkAuthStatus;

  const handleRetryConnection = useCallback(async () => {
    if (isRetrying || hasNavigated.current) return;
    setIsRetrying(true);
    try {
      const net = await NetInfo.fetch();
      if (isNetOffline(net)) {
        return;
      }
      hasNavigated.current = false;
      setShowOfflineModal(false);
      scheduleSafetyTimer();
      await checkAuthRef.current();
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, scheduleSafetyTimer]);

  const retryRef = useRef(handleRetryConnection);
  retryRef.current = handleRetryConnection;

  useEffect(() => {
    if (!showOfflineModal) return;
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (online) {
        setTimeout(() => void retryRef.current(), 0);
      }
    });
    return () => unsub();
  }, [showOfflineModal]);

  useEffect(() => {
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      setupPushNotificationHandlers();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {});

    scheduleSafetyTimer();
    void checkAuthRef.current();

    return () => {
      interactionTask.cancel?.();
      clearSafetyTimer();
      subscription.unsubscribe();
    };
  }, [clearSafetyTimer, scheduleSafetyTimer]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>M</Text>
      </View>

      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Carregando informações...</Text>
      </View>

      <Modal
        visible={showOfflineModal}
        transparent
        animationType="fade"
        onRequestClose={() => void handleRetryConnection()}
      >
        <View style={styles.offlineOverlay}>
          <View style={styles.offlineCard}>
            <View style={styles.offlineIconWrap}>
              <Ionicons name="cloud-offline-outline" size={40} color="#667eea" />
            </View>
            <Text style={styles.offlineTitle}>Sem conexão com a internet</Text>
            <Text style={styles.offlineMessage}>
              Verifique sua rede e tente novamente para continuar.
            </Text>
            <TouchableOpacity
              style={styles.offlineButton}
              onPress={() => void handleRetryConnection()}
              disabled={isRetrying}
              activeOpacity={0.85}
            >
              {isRetrying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.offlineButtonText}>Tentar novamente</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.3,
    shadowRadius: Platform.OS === 'android' ? 0 : 16,
    elevation: Platform.OS === 'android' ? 0 : 10,
  },
  logoText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
  offlineOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  offlineCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  offlineIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(102, 126, 234, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  offlineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: 8,
  },
  offlineMessage: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
  },
  offlineButton: {
    backgroundColor: '#667eea',
    width: '100%',
    minHeight: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
