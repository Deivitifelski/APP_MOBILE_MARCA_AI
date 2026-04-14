import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '../hooks/use-color-scheme';

/** Mesma identidade da splash nativa (app.json) — azul + M branco */
const LIGHT_BG = '#667eea';
const DARK_BG = '#4c51bf';
const LOGO_COLOR = '#ffffff';
const SUBTEXT_LIGHT = 'rgba(255,255,255,0.88)';
const SUBTEXT_DARK = 'rgba(255,255,255,0.82)';

export default function AppSplashScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DARK_BG : LIGHT_BG }]}>
      <Text style={[styles.logo, { color: LOGO_COLOR }]}>M</Text>
      <Text style={[styles.message, { color: isDark ? SUBTEXT_DARK : SUBTEXT_LIGHT }]}>
        Carregando suas informações
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 88,
    fontWeight: '800',
    letterSpacing: -2,
  },
  message: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: '500',
  },
});
