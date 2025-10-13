import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from '../../lib/supabase';
import { checkUserExists, createUser } from './userService';

interface GoogleAuthResponse {
  success: boolean;
  user?: any;
  session?: any;
  error?: string;
  needsProfile?: boolean;
}

/**
 * ✅ PADRÃO DO MERCADO: Configuração do Google Sign-In
 * Deve ser chamado uma vez ao iniciar o app
 */
export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: '507253415369-bl50sd12odg2h4ktds2ht26i95c057qm.apps.googleusercontent.com',
    iosClientId: '507253415369-bl50sd12odg2h4ktds2ht26i95c057qm.apps.googleusercontent.com',
    offlineAccess: true,
  });
  console.log('✅ [Google Auth] Configuração inicializada');
}

/**
 * ✅ PADRÃO DO MERCADO: Login com Google usando ID Token
 * 
 * Este é o método recomendado pela documentação oficial do Supabase
 * Referência: https://supabase.com/docs/guides/auth/social-login/auth-google
 */
export async function signInWithGoogle(): Promise<GoogleAuthResponse> {
  try {
    console.log('🔐 [Google Auth] Iniciando autenticação...');
    
    // ✅ PASSO 1: Verificar Google Play Services (necessário)
    await GoogleSignin.hasPlayServices();
    console.log('✅ [Google Auth] Play Services disponíveis');
    
    // ✅ PASSO 2: Fazer sign in com Google (abre modal nativo)
    console.log('📱 [Google Auth] Abrindo seleção de conta Google...');
    const userInfo = await GoogleSignin.signIn();
    
    console.log('✅ [Google Auth] Usuário selecionou conta:', {
      email: userInfo.data?.user.email,
      name: userInfo.data?.user.name,
      hasIdToken: !!userInfo.data?.idToken,
    });

    // ✅ PASSO 3: Verificar se recebemos o ID Token
    if (!userInfo.data?.idToken) {
      console.error('❌ [Google Auth] ID Token não recebido');
      return {
        success: false,
        error: 'Erro ao obter token de autenticação do Google',
      };
    }

    console.log('🔑 [Google Auth] ID Token recebido, autenticando no Supabase...');
    
    // ✅ PASSO 4: Autenticar no Supabase usando o ID Token do Google
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: userInfo.data.idToken,
    });

    if (error) {
      console.error('❌ [Google Auth] Erro ao autenticar no Supabase:', error);
      return {
        success: false,
        error: `Erro ao autenticar: ${error.message}`,
      };
    }

    if (!data.user || !data.session) {
      console.error('❌ [Google Auth] Usuário ou sessão não retornados');
      return {
        success: false,
        error: 'Erro ao criar sessão de autenticação',
      };
    }

    console.log('✅ [Google Auth] Autenticado no Supabase:', {
      userId: data.user.id,
      email: data.user.email,
      provider: data.user.app_metadata.provider,
    });

    // ✅ PASSO 5: Verificar se usuário existe no banco de dados
    console.log('🔍 [Google Auth] Verificando se usuário existe no banco...');
    const userCheck = await checkUserExists(data.user.id);

    if (userCheck.error) {
      console.error('❌ [Google Auth] Erro ao verificar usuário:', userCheck.error);
      return {
        success: false,
        error: 'Erro ao verificar dados do usuário',
      };
    }

    // ✅ PASSO 6: Criar usuário no banco se não existir
    if (!userCheck.exists) {
      console.log('📝 [Google Auth] Usuário não existe, criando perfil...');
      
      const googleData = userInfo.data.user;
      const userData = {
        id: data.user.id,
        email: googleData.email,
        name: googleData.name || googleData.givenName || 'Usuário Google',
        phone: '',
        city: '',
        state: '',
        profile_url: googleData.photo || '',
        plan: 'free' as const,
      };

      console.log('👤 [Google Auth] Dados do perfil Google:', {
        name: userData.name,
        email: userData.email,
        hasPhoto: !!userData.profile_url,
      });

      const createResult = await createUser(userData);

      if (createResult.error) {
        console.error('❌ [Google Auth] Erro ao criar usuário:', createResult.error);
        return {
          success: false,
          error: 'Erro ao criar perfil no banco de dados',
        };
      }

      console.log('✅ [Google Auth] Perfil criado com sucesso!');
      
      return {
        success: true,
        user: data.user,
        session: data.session,
        needsProfile: true, // Pode completar telefone/endereço depois
      };
    }

    // ✅ Usuário já existe
    console.log('✅ [Google Auth] Login concluído! Usuário já cadastrado.');
    return {
      success: true,
      user: data.user,
      session: data.session,
      needsProfile: false,
    };
    
  } catch (error: any) {
    console.error('💥 [Google Auth] Erro:', error);
    
    // Tratar erros específicos do Google Sign-In
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      console.log('⚠️ [Google Auth] Usuário cancelou o login');
      return {
        success: false,
        error: 'Login cancelado',
      };
    } else if (error.code === statusCodes.IN_PROGRESS) {
      console.log('⚠️ [Google Auth] Login já em andamento');
      return {
        success: false,
        error: 'Login já está em andamento',
      };
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      console.error('❌ [Google Auth] Play Services não disponíveis');
      return {
        success: false,
        error: 'Google Play Services não disponível (necessário para Android)',
      };
    }
    
    return {
      success: false,
      error: error.message || 'Erro ao fazer login com Google',
    };
  }
}


/**
 * Verifica se há uma sessão ativa do Google
 */
export async function checkGoogleSession(): Promise<{
  hasSession: boolean;
  user?: any;
}> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session && session.user.app_metadata.provider === 'google') {
      return {
        hasSession: true,
        user: session.user,
      };
    }
    
    return { hasSession: false };
  } catch (error) {
    console.error('Erro ao verificar sessão Google:', error);
    return { hasSession: false };
  }
}

/**
 * Logout do Google
 */
export async function signOutGoogle(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }
    
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao fazer logout',
    };
  }
}

