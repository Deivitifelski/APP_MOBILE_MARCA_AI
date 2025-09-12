import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { View, Text } from 'react-native';

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
      <Text style={{ color: 'white', fontSize: 18 }}>Carregando...</Text>
    </View>
  );
}
