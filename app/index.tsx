import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export default function Index() {
  useEffect(() => {
    // Redirecionar para a tela de login após um pequeno delay
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#667eea' }}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={{ color: 'white', fontSize: 18, marginTop: 16 }}>Carregando...</Text>
    </View>
  );
}
