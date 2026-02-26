import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { AppState, LogBox } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Canal Android com showBadge para o contador no ícone; zerar badge ao abrir/foreground
  useEffect(() => {
    const setupBadge = async () => {
      const { setAppIconBadge } = require('../services/appIconBadge');
      const { Platform } = require('react-native');
      if (Platform.OS === 'android') {
        try {
          const Notifications = await import('expo-notifications');
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Padrão',
            importance: Notifications.AndroidImportance.DEFAULT,
            showBadge: true,
          });
        } catch {
          // ignora se falhar
        }
      }
      setAppIconBadge(0);
    };
    setupBadge();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const { setAppIconBadge } = require('../services/appIconBadge');
        setAppIconBadge(0);
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <ActiveArtistProvider>
            <PermissionsProvider>
              <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <AuthDeepLinkHandler />
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
