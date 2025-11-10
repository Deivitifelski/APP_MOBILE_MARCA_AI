import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { checkUserExists } from '../services/supabase/userService';

export default function Index() {
  const { colors } = useTheme();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Listener para mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 Estado de autenticação mudou:', _event, !!session);
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
      console.log('🔍 Verificando status de autenticação...');
      
      // Verificar se existe uma sessão ativa
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('📊 Resultado da verificação:', {
        temSessao: !!session,
        temUser: !!session?.user,
        email: session?.user?.email,
        emailConfirmado: !!session?.user?.email_confirmed_at,
        erro: error?.message
      });
      
      if (error) {
        console.error('❌ Erro ao verificar sessão:', error);
        router.replace('/login');
        return;
      }

      if (session?.user) {
        console.log('✅ Sessão encontrada para usuário:', session.user.email);
        
        // Verificar se o email foi confirmado
        if (!session.user.email_confirmed_at) {
          console.log('📧 Email não confirmado, redirecionando...');
          router.replace('/email-confirmation');
          return;
        }

        // Verificar se o perfil do usuário está completo
        const userCheck = await checkUserExists(session.user.id);
        
        if (userCheck.error) {
          console.error('❌ Erro ao verificar perfil:', userCheck.error);
          router.replace('/login');
          return;
        }

        if (!userCheck.exists) {
          console.log('👤 Perfil incompleto, redirecionando para cadastro...');
          router.replace('/cadastro-usuario');
        } else {
          console.log('🎉 Login automático bem-sucedido! Redirecionando para agenda...');
          router.replace('/(tabs)/agenda');
        }
      } else {
        console.log('🔐 Nenhuma sessão encontrada, redirecionando para login...');
        router.replace('/login');
      }
    } catch (error) {
      console.error('❌ Erro ao verificar autenticação:', error);
      router.replace('/login');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={{ color: 'white', fontSize: 18, marginTop: 16 }}>
        {isChecking ? 'Carregando...' : 'Redirecionando...'}
      </Text>
    </View>
  );
}
