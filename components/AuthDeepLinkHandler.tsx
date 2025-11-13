import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { createOrUpdateUserFromGoogle } from '../services/supabase/userService';

export default function AuthDeepLinkHandler() {
  useEffect(() => {
    // Listener para deep links quando o app está aberto
    const handleDeepLink = (url: string) => {
      // Verificar se é callback de reset de senha
      if (url.includes('reset-password') || url.includes('type=recovery')) {
        // Extrair tokens da URL
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');
        
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
      if (url.includes('access_token') && url.includes('refresh_token')) {
        // Extrair parâmetros da URL
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');
        const type = urlObj.searchParams.get('type');
        const expiresIn = urlObj.searchParams.get('expires_in');

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
        // Extrair parâmetros da URL
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');
        const type = urlObj.searchParams.get('type');

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
