import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '../hooks/use-color-scheme';

const LIGHT_BG = '#f8f9fa';
const DARK_BG = '#1a1a1a';
const PRIMARY = '#667eea';
const LIGHT_TEXT = '#666666';
const DARK_TEXT = '#cccccc';

export default function AppSplashScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DARK_BG : LIGHT_BG }]}>
      <Text style={[styles.logo, { color: PRIMARY }]}>M</Text>
      <Text style={[styles.message, { color: isDark ? DARK_TEXT : LIGHT_TEXT }]}>
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
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: -1,
  },
  message: {
    marginTop: 16,
    fontSize: 15,
  },
});
