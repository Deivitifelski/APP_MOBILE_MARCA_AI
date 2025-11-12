import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { checkUserExists, createOrUpdateUserFromGoogle } from '../services/supabase/userService';

export default function Index() {
  useEffect(() => {
    // Listener para mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔵 [Auth State Change] Evento:', event);
      console.log('🔵 [Auth State Change] Session:', JSON.stringify(session?.user, null, 2));
      
      // Quando o login OAuth completar (SIGNED_IN)
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('✅ [Auth State Change] Usuário autenticado via OAuth');
        
        // Verificar se é login via Google (OAuth)
        const userMetadata = session.user.user_metadata;
        const identities = session.user.identities;
        
        console.log('🔵 [Auth State Change] User metadata:', JSON.stringify(userMetadata, null, 2));
        console.log('🔵 [Auth State Change] Identities:', JSON.stringify(identities, null, 2));
        
        // Se tem dados do Google no metadata, criar/atualizar usuário
        if (userMetadata?.full_name || userMetadata?.name) {
          console.log('🔵 [Auth State Change] Criando usuário com dados do Google...');
          
          await createOrUpdateUserFromGoogle(
            session.user.id,
            {
              name: userMetadata.full_name || userMetadata.name || session.user.email || 'Usuário',
              email: session.user.email || '',
              photo: userMetadata.avatar_url || userMetadata.picture || undefined,
            }
          );
          
          console.log('✅ [Auth State Change] Usuário criado/atualizado!');
        }
      }
    });

    // Pequeno delay para garantir que o AsyncStorage está pronto
    const timer = setTimeout(() => {
      checkAuthStatus();
    }, 500);

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Verificar se existe uma sessão ativa
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        router.replace('/login');
        return;
      }

      if (session?.user) {
        // Verificar se o email foi confirmado
        if (!session.user.email_confirmed_at) {
          router.replace('/email-confirmation');
          return;
        }

        // Verificar se o perfil do usuário está completo
        const userCheck = await checkUserExists(session.user.id);
        
        if (userCheck.error) {
          router.replace('/login');
          return;
        }

        if (!userCheck.exists) {
          router.replace('/login');
        } else {
          router.replace('/(tabs)/agenda');
        }
      } else {
        router.replace('/login');
      }
    } catch (error) {
      router.replace('/login');
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
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
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
