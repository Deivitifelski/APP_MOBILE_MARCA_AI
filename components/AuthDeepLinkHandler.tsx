import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { createOrUpdateUserFromGoogle } from '../services/supabase/userService';

// Função auxiliar para fazer parsing de URLs customizadas (marcaai://)
const parseCustomURL = (url: string): { path: string; params: URLSearchParams } => {
  try {
    // Tentar usar URL nativo primeiro (funciona se a URL for http/https)
    const urlObj = new URL(url);
    return { path: urlObj.pathname, params: urlObj.searchParams };
  } catch {
    // Se falhar, fazer parsing manual para URLs customizadas (marcaai://)
    const match = url.match(/^([^:]+):\/\/([^?#]+)(\?.*)?$/);
    if (match) {
      const path = match[2] || '';
      const queryString = match[3] ? match[3].substring(1) : '';
      const params = new URLSearchParams(queryString);
      return { path, params };
    }
    return { path: '', params: new URLSearchParams() };
  }
};

export default function AuthDeepLinkHandler() {
  useEffect(() => {
    // Listener para deep links quando o app está aberto
    const handleDeepLink = (url: string) => {
      console.log('🔵 [Deep Link] URL recebida:', url);
      
      // Verificar se é callback de reset de senha
      if (url.includes('reset-password') || url.includes('type=recovery')) {
        console.log('🔵 [Reset Password] Processando deep link de reset de senha');
        
        // Extrair tokens da URL usando função auxiliar
        const { path, params } = parseCustomURL(url);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');
        
        console.log('🔵 [Reset Password] Tokens extraídos:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken,
          type 
        });
        
        if (accessToken && refreshToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(({ data, error }) => {
            if (error) {
              console.error('❌ [Reset Password] Erro ao definir sessão:', error);
              Alert.alert('Erro', 'Link de recuperação inválido ou expirado');
              router.replace('/login');
              return;
            }
            console.log('✅ [Reset Password] Sessão definida com sucesso, navegando para reset-password');
            router.replace('/reset-password');
          });
        } else {
          console.error('❌ [Reset Password] Tokens não encontrados na URL');
          Alert.alert('Erro', 'Link de recuperação inválido');
          router.replace('/login');
        }
        
        return;
      }
      
      // Verificar se é callback do Google OAuth (redirect do Supabase)
      if (url.includes('access_token') && url.includes('refresh_token') && !url.includes('reset-password')) {
        // Extrair parâmetros da URL usando função auxiliar
        const { params } = parseCustomURL(url);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');
        const expiresIn = params.get('expires_in');

        if (accessToken && refreshToken) {
          // Definir a sessão com os tokens do OAuth
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(async ({ data, error }) => {
            if (error) {
              console.error('❌ Erro ao definir sessão OAuth:', error);
              return;
            }

            // Verificar se a sessão foi realmente salva
            const { data: { session } } = await supabase.auth.getSession();

            if (session && session.user) {
              // Criar ou atualizar usuário com dados do Google OAuth
              const userMetadata = session.user.user_metadata;
              
              if (userMetadata && session.user.email) {
                const result = await createOrUpdateUserFromGoogle(
                  session.user.id,
                  {
                    name: userMetadata.full_name || userMetadata.name || session.user.email,
                    email: session.user.email,
                    photo: userMetadata.avatar_url || userMetadata.picture || undefined,
                  }
                );
              }
              
              // Redirecionar para agenda
              router.replace('/(tabs)/agenda');
            } else {
              console.error('❌ Sessão OAuth não foi salva corretamente');
            }
          });
        }
      }
      // Callback original para email confirmation
      else if (url.includes('marcaai://auth/callback')) {
        // Extrair parâmetros da URL usando função auxiliar
        const { params } = parseCustomURL(url);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken && type === 'signup') {
          // Trocar o código pela sessão
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(async ({ data, error }) => {
            if (error) {
              console.error('Erro ao definir sessão:', error);
              return;
            }

            // Verificar se a sessão foi realmente salva
            const { data: { session } } = await supabase.auth.getSession();

            if (session && session.user) {
              // Verificar se o usuário existe na tabela users antes de redirecionar
              const { checkUserExists } = await import('../services/supabase/userService');
              const userCheck = await checkUserExists(session.user.id);
              
              if (userCheck.error) {
                console.error('❌ Erro ao verificar usuário:', userCheck.error);
                return;
              }
              
              // Navegar baseado no status do usuário
              if (session.user.email_confirmed_at) {
                if (userCheck.exists) {
                  router.replace('/(tabs)/agenda');
                } else {
                  router.replace('/cadastro-usuario');
                }
              } else {
                router.replace('/email-confirmation');
              }
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
