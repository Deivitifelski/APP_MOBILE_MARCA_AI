import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { setAppIconBadge } from '../services/appIconBadge';
import { setupPushNotificationHandlers } from '../services/pushNotificationHandler';
import { checkArtistsAndRedirect } from '../services/supabase/authService';
import { checkUserExists } from '../services/supabase/userService';

const LOADING_TIMEOUT_MS = 8000; // Se não redirecionar em 8s, vai para login

export default function Index() {
  const hasNavigated = useRef(false);

  const navigateTo = (route: string) => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    router.replace(route as any);
  };

  useEffect(() => {
    // ✅ Configurar handlers de notificações push
    const firebaseTimer = setTimeout(() => {
      setupPushNotificationHandlers();
    }, 1000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});

    // Timeout de segurança: se travar, redireciona para login
    const safetyTimer = setTimeout(() => {
      if (!hasNavigated.current) {
        hasNavigated.current = true;
        router.replace('/login');
      }
    }, LOADING_TIMEOUT_MS);

    const authTimer = setTimeout(() => {
      checkAuthStatus();
    }, 400);

    return () => {
      clearTimeout(firebaseTimer);
      clearTimeout(authTimer);
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        navigateTo('/login');
        return;
      }

      if (session?.user) {
        if (!session.user.email_confirmed_at) {
          navigateTo('/email-confirmation');
          return;
        }

        const userCheck = await checkUserExists(session.user.id);

        if (userCheck.error) {
          navigateTo('/login');
          return;
        }

        if (!userCheck.exists) {
          navigateTo('/login');
          return;
        }

        const { shouldRedirectToSelection } = await checkArtistsAndRedirect();

        setAppIconBadge(0);
        if (shouldRedirectToSelection) {
          navigateTo('/selecionar-artista');
        } else {
          navigateTo('/(tabs)/agenda');
        }
        return;
      }

      navigateTo('/login');
    } catch {
      navigateTo('/login');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {/* Logo M */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>M</Text>
      </View>
      
      {/* Texto e Loading */}
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Carregando informações...</Text>
      </View>
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
});
