import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { AppState, LogBox } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppSplashScreen from '../components/AppSplashScreen';
import AuthDeepLinkHandler from '../components/AuthDeepLinkHandler';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ActiveArtistProvider } from '../contexts/ActiveArtistContext';
import { PermissionsProvider } from '../contexts/PermissionsContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { useColorScheme } from '../hooks/use-color-scheme';
import './error-handler';
import './suppress-logs';
// Registrar handler de background para badge no Android (antes de qualquer componente)
import '../services/backgroundMessageHandler';

// Esconder a tela de splash (ícone) assim que o app carregar
SplashScreen.preventAutoHideAsync();

// Desabilitar LogBox para não mostrar logs na tela
LogBox.ignoreAllLogs(true);

export const unstable_settings = {
  anchor: '(tabs)',
};

const SPLASH_VISIBLE_MS = 1200;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    (async () => {
      await SplashScreen.hideAsync();
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), SPLASH_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  // Zerar badge ao abrir o app e sempre que voltar ao foreground (iOS e Android)
  // Inclui: ao abrir pelo ícone, ao trocar de app de volta, ao abrir por notificação
  useEffect(() => {
    const { setAppIconBadge } = require('../services/appIconBadge');
    const { Platform } = require('react-native');

    const zeroBadge = () => {
      setAppIconBadge(0).catch(() => {});
    };

    const setupBadge = async () => {
      if (Platform.OS === 'android') {
        try {
          const Notifications = await import('expo-notifications');
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Padrão',
            importance: Notifications.AndroidImportance.HIGH,
            showBadge: true,
          });
        } catch {
          // ignora se falhar
        }
      }
      await setAppIconBadge(0).catch(() => {});
    };

    setupBadge();
    zeroBadge();

    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        zeroBadge();
        if (delayTimer) clearTimeout(delayTimer);
        // No iOS o sistema pode reaplicar o badge ao abrir por notificação; zerar de novo após um instante
        if (Platform.OS === 'ios') {
          delayTimer = setTimeout(() => {
            zeroBadge();
            delayTimer = null;
          }, 400);
        }
      }
    });
    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      sub.remove();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <ActiveArtistProvider>
            <PermissionsProvider>
              <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <AuthDeepLinkHandler />
                {showSplash && <AppSplashScreen />}
                <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="email-confirmation" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="cadastro-usuario" options={{ headerShown: false }} />
            <Stack.Screen name="cadastro-artista" options={{ headerShown: false }} />
            <Stack.Screen name="adicionar-evento" options={{ headerShown: false }} />
            <Stack.Screen name="editar-evento" options={{ headerShown: false }} />
            <Stack.Screen name="detalhes-evento" options={{ headerShown: false }} />
            <Stack.Screen name="adicionar-despesa" options={{ headerShown: false }} />
            <Stack.Screen name="adicionar-receita" options={{ headerShown: false }} />
            <Stack.Screen name="despesas-evento" options={{ headerShown: false }} />
            <Stack.Screen name="notificacoes" options={{ headerShown: false }} />
            <Stack.Screen name="editar-usuario" options={{ headerShown: false }} />
            <Stack.Screen name="editar-artista" options={{ headerShown: false }} />
            <Stack.Screen name="configuracoes-artista" options={{ headerShown: false }} />
            <Stack.Screen name="colaboradores-artista" options={{ headerShown: false }} />
            <Stack.Screen name="convites-enviados" options={{ headerShown: false }} />
            <Stack.Screen name="convites-recebidos" options={{ headerShown: false }} />
            <Stack.Screen name="selecionar-artista" options={{ headerShown: false }} />
            <Stack.Screen name="sair-artista" options={{ headerShown: false }} />
            <Stack.Screen name="transferir-propriedade" options={{ headerShown: false }} />
            <Stack.Screen name="screens/auth/LoginScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/profile/UserProfileScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/profile/ArtistProfileScreen" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                </Stack>
                <StatusBar style="auto" />
              </NavigationThemeProvider>
            </PermissionsProvider>
          </ActiveArtistProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
