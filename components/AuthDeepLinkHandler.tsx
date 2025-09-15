import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function AuthDeepLinkHandler() {
  useEffect(() => {
    // Listener para deep links quando o app está aberto
    const handleDeepLink = (url: string) => {
      console.log('Deep link recebido:', url);
      
      if (url.includes('marcaai://auth/callback')) {
        // Extrair parâmetros da URL
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');
        const type = urlObj.searchParams.get('type');
        
        console.log('Parâmetros extraídos:', { accessToken, refreshToken, type });
        
        if (accessToken && refreshToken && type === 'signup') {
          console.log('Definindo sessão com tokens...');
          
          // Trocar o código pela sessão
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(async ({ data, error }) => {
            if (error) {
              console.error('Erro ao definir sessão:', error);
              return;
            }
            
            console.log('Sessão definida com sucesso:', data);
            console.log('Usuário na sessão:', data.user);
            console.log('Email confirmado?', data.user?.email_confirmed_at);
            
            // Verificar se a sessão foi realmente salva
            const { data: { session } } = await supabase.auth.getSession();
            console.log('Sessão verificada após setSession:', session);
            
            if (session) {
              // Navegar para a tela de confirmação
              router.replace('/email-confirmation');
            } else {
              console.error('Sessão não foi salva corretamente');
            }
          });
        }
      }
    };

    // Listener para quando o app é aberto via deep link
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Verificar se o app foi aberto via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  return null; // Este componente não renderiza nada
}
