import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthDeepLinkHandler() {
  useEffect(() => {
    // Listener para deep links quando o app está aberto
    const handleDeepLink = (url: string) => {
      console.log('🔗 Deep link recebido:', url);
      
      // Verificar se é callback do Google OAuth (redirect do Supabase)
      if (url.includes('access_token') && url.includes('refresh_token')) {
        console.log('🔄 Processando callback do Google OAuth...');
        
        // Extrair parâmetros da URL
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');
        const type = urlObj.searchParams.get('type');
        const expiresIn = urlObj.searchParams.get('expires_in');
        
        console.log('📋 Parâmetros OAuth extraídos:', { 
          accessToken: accessToken ? 'presente' : 'ausente',
          refreshToken: refreshToken ? 'presente' : 'ausente', 
          type,
          expiresIn 
        });
        
        if (accessToken && refreshToken) {
          console.log('🔐 Definindo sessão OAuth...');
          
          // Definir a sessão com os tokens do OAuth
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(async ({ data, error }) => {
            if (error) {
              console.error('❌ Erro ao definir sessão OAuth:', error);
              return;
            }
            
            console.log('✅ Sessão OAuth definida com sucesso:', data);
            console.log('👤 Usuário OAuth:', data.user);
            console.log('📧 Email confirmado?', data.user?.email_confirmed_at);
            
            // Verificar se a sessão foi realmente salva
            const { data: { session } } = await supabase.auth.getSession();
            console.log('🔍 Sessão verificada após setSession:', session);
            
            if (session && session.user) {
              // Navegar baseado no status do usuário
              if (data.user?.email_confirmed_at) {
                console.log('🎯 Usuário com email confirmado, redirecionando para agenda');
                router.replace('/(tabs)/agenda');
              } else {
                console.log('📧 Email não confirmado, redirecionando para confirmação');
                router.replace('/email-confirmation');
              }
            } else {
              console.error('❌ Sessão OAuth não foi salva corretamente');
            }
          });
        }
      }
      // Callback original para email confirmation
      else if (url.includes('marcaai://auth/callback')) {
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
