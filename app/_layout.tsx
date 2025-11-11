import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthDeepLinkHandler from '../components/AuthDeepLinkHandler';
import { ActiveArtistProvider } from '../contexts/ActiveArtistContext';
import { PermissionsProvider } from '../contexts/PermissionsContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { useColorScheme } from '../hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
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
            <Stack.Screen name="planos-pagamentos" options={{ headerShown: false }} />
            <Stack.Screen name="cancelar-plano" options={{ headerShown: false }} />
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
  );
}
