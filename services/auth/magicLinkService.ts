import 'react-native-url-polyfill/auto';
import { Linking, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { router } from 'expo-router';

export interface MagicLinkService {
  sendMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  handleMagicLink: (url: string) => Promise<void>;
  initializeListener: () => () => void;
}

class MagicLinkServiceImpl implements MagicLinkService {
  private linkingSubscription: any = null;

  /**
   * Envia um magic link para o email especificado
   */
  async sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('MagicLink: Enviando link para:', email);
      
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: 'marcaai://auth/callback',
          shouldCreateUser: true
        }
      });

      if (error) {
        console.error('MagicLink: Erro ao enviar:', error);
        return { success: false, error: error.message };
      }

      console.log('MagicLink: Enviado com sucesso:', data);
      return { success: true };
    } catch (error) {
      console.error('MagicLink: Erro inesperado:', error);
      return { success: false, error: 'Erro ao enviar link de confirmação' };
    }
  }

  /**
   * Processa um magic link recebido
   */
  async handleMagicLink(url: string): Promise<void> {
    try {
      console.log('MagicLink: Processando URL:', url);

      // Verificar se é um magic link válido
      if (!url.includes('access_token') && !url.includes('code')) {
        console.log('MagicLink: URL não contém tokens válidos');
        return;
      }

      const urlObj = new URL(url);
      const accessToken = urlObj.searchParams.get('access_token');
      const refreshToken = urlObj.searchParams.get('refresh_token');
      const code = urlObj.searchParams.get('code');

      console.log('MagicLink: Parâmetros extraídos:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasCode: !!code
      });

      // Método 1: Se temos access_token e refresh_token diretamente
      if (accessToken && refreshToken) {
        console.log('MagicLink: Usando tokens diretos');
        
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('MagicLink: Erro ao definir sessão:', error);
          Alert.alert('Erro', 'Erro ao confirmar email. Tente novamente.');
          return;
        }

        if (data.user) {
          console.log('MagicLink: Usuário autenticado:', data.user.email);
          this.handleSuccessfulAuth(data.user);
        }
      }
      // Método 2: Se temos um código para trocar por sessão
      else if (code) {
        console.log('MagicLink: Trocando código por sessão');
        
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('MagicLink: Erro ao trocar código:', error);
          Alert.alert('Erro', 'Erro ao confirmar email. Tente novamente.');
          return;
        }

        if (data.user) {
          console.log('MagicLink: Usuário autenticado via código:', data.user.email);
          this.handleSuccessfulAuth(data.user);
        }
      } else {
        console.log('MagicLink: Nenhum token válido encontrado na URL');
        Alert.alert('Erro', 'Link de confirmação inválido.');
      }
    } catch (error) {
      console.error('MagicLink: Erro ao processar:', error);
      Alert.alert('Erro', 'Erro ao processar link de confirmação.');
    }
  }

  /**
   * Lida com autenticação bem-sucedida
   */
  private handleSuccessfulAuth(user: any) {
    // Verificar se o usuário já tem perfil completo
    if (user.user_metadata && user.user_metadata.full_name) {
      // Usuário já tem perfil, ir para o app principal
      Alert.alert('Bem-vindo!', 'Login realizado com sucesso!', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)/agenda')
        }
      ]);
    } else {
      // Usuário precisa completar o perfil
      Alert.alert('Email Confirmado!', 'Agora complete seu perfil para continuar.', [
        {
          text: 'OK',
          onPress: () => router.replace('/cadastro-usuario')
        }
      ]);
    }
  }

  /**
   * Inicializa o listener de deep links
   */
  initializeListener(): () => void {
    console.log('MagicLink: Inicializando listener');

    // Verificar se o app foi aberto com um deep link
    const handleInitialURL = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          console.log('MagicLink: App aberto com URL inicial:', url);
          await this.handleMagicLink(url);
        }
      } catch (error) {
        console.error('MagicLink: Erro ao obter URL inicial:', error);
      }
    };

    // Listener para deep links quando o app já está aberto
    const handleURL = (event: { url: string }) => {
      console.log('MagicLink: Deep link recebido:', event.url);
      this.handleMagicLink(event.url);
    };

    // Configurar listeners
    handleInitialURL();
    this.linkingSubscription = Linking.addEventListener('url', handleURL);

    // Retornar função de cleanup
    return () => {
      console.log('MagicLink: Removendo listener');
      this.linkingSubscription?.remove();
    };
  }
}

// Exportar instância singleton
export const magicLinkService = new MagicLinkServiceImpl();
