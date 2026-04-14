import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from '../hooks/use-color-scheme';

/** Alinhado à splash nativa (app.json) */
const LIGHT_BG = '#667eea';
const DARK_BG = '#4c51bf';
const ACCENT = '#ffffff';

export default function AppSplashScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? DARK_BG : LIGHT_BG }]}>
      <Text style={styles.logo}>M</Text>
      <ActivityIndicator
        style={styles.spinner}
        color={ACCENT}
        size="small"
      />
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
    color: ACCENT,
    fontSize: 88,
    fontWeight: '800',
    letterSpacing: -2,
  },
  spinner: {
    marginTop: 36,
    transform: [{ scale: 1.15 }],
  },
});
