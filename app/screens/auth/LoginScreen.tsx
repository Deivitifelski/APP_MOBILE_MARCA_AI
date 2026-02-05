import { Ionicons } from '@expo/vector-icons';
import messaging from '@react-native-firebase/messaging';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    LogBox,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppleSignInButton, { AppleSignInResult } from '../../../components/AppleSignInButton';
import FCMTokenModal from '../../../components/FCMTokenModal';
import LogoMarcaAi from '../../../components/LogoMarcaAi';
import { useActiveArtistContext } from '../../../contexts/ActiveArtistContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { supabase } from '../../../lib/supabase';
import { checkArtistsAndRedirect, getCurrentUser, loginUser, resendConfirmationEmail, sendPasswordResetEmail } from '../../../services/supabase/authService';
import {
    checkUserExists,
    createOrUpdateUserFromApple,
    createOrUpdateUserFromGoogle,
    saveFCMToken,
} from '../../../services/supabase/userService';

// Configurar Google Sign-In (conforme documentação)
GoogleSignin.configure({
  webClientId: '169304206053-i5bm2l2sofd011muqr66ddm2dosn5bn9.apps.googleusercontent.com',
  iosClientId: '169304206053-642isf3lub3ds2thkiupcje9r7lo7dh7.apps.googleusercontent.com',
  // Android Client ID será configurado após adicionar SHA-1 no Google Cloud Console
  // Veja o guia: RESOLVER_ERRO_DEVELOPER_ERROR_ANDROID.md
});

// Ignorar erros de rede no console
LogBox.ignoreLogs([
  'Network request failed',
  'TypeError: Network request failed',
]);

export default function LoginScreen() {
  const { colors, isDarkMode } = useTheme();
  const { setActiveArtist } = useActiveArtistContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCompleteProfileModal, setShowCompleteProfileModal] = useState(false);
  const [showNoInternetModal, setShowNoInternetModal] = useState(false);
  const [showEmailConfirmationModal, setShowEmailConfirmationModal] = useState(false);
  const [emailConfirmationError, setEmailConfirmationError] = useState<string>('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [userName, setUserName] = useState('');
  const [welcomeProvider, setWelcomeProvider] = useState<'google' | 'apple' | null>(null);
  const [welcomeName, setWelcomeName] = useState('');
  const [welcomeEmail, setWelcomeEmail] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Solicitar permissões ao carregar a tela de login
  useEffect(() => {
    const requestPermissions = async () => {
      if (Platform.OS === 'ios') {
        try {
          console.log('📱 [LoginScreen] Solicitando permissões de notificação...');
          const authStatus = await messaging().requestPermission();
          const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;

          if (enabled) {
            console.log('✅ [LoginScreen] Permissão de notificação concedida');
            // Registrar dispositivo para mensagens remotas
            try {
              await messaging().registerDeviceForRemoteMessages();
              console.log('✅ [LoginScreen] Dispositivo registrado para mensagens remotas');
            } catch (regError: any) {
              if (regError?.code !== 'messaging/device-already-registered') {
                console.log('⚠️ [LoginScreen] Erro ao registrar dispositivo:', regError);
              }
            }
          } else {
            console.log('⚠️ [LoginScreen] Permissão de notificação negada');
          }
        } catch (error) {
          console.error('❌ [LoginScreen] Erro ao solicitar permissões:', error);
        }
      }
    };

    requestPermissions();
  }, []);

  const getFCMToken = async () => {
    try {
      console.log('🔍 Iniciando busca do token FCM...');
      
      // No iOS, garantir que temos permissão e registro
      if (Platform.OS === 'ios') {
        console.log('📱 iOS detectado - verificando permissões...');
        
        // Verificar se já temos permissão
        const authStatus = await messaging().requestPermission();
        const hasPermission = 
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!hasPermission) {
          console.log('⚠️ Permissão de notificação não concedida');
          // Não mostrar modal se não tiver permissão
          return;
        }

        console.log('✅ Permissão concedida, registrando dispositivo...');
        
        // Registrar dispositivo para mensagens remotas
        try {
          await messaging().registerDeviceForRemoteMessages();
          console.log('✅ Dispositivo registrado, aguardando processamento...');
          // Aguardar para garantir que o registro foi processado
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (regError: any) {
          // Se já estiver registrado, pode dar erro, mas continuamos
          if (regError?.code === 'messaging/device-already-registered') {
            console.log('✅ Dispositivo já estava registrado');
          } else {
            console.log('⚠️ Erro ao registrar dispositivo:', regError);
            // Continuar mesmo assim, pode funcionar
          }
        }
      }
      
      // Obter o token
      console.log('🔑 Obtendo token FCM...');
      const token = await messaging().getToken();
      
      if (token) {
        console.log('✅ Token FCM obtido com sucesso!');
        setFcmToken(token);
        
        // Salvar token no banco de dados
        const { user } = await getCurrentUser();
        if (user) {
          const saveResult = await saveFCMToken(user.id, token);
          if (saveResult.success) {
            console.log('✅ Token FCM salvo no banco de dados!');
          } else {
            console.error('❌ Erro ao salvar token FCM:', saveResult.error);
          }
        }
        
        setShowTokenModal(true); // Mostrar modal apenas se obteve o token com sucesso
      } else {
        console.log('⚠️ Token FCM não disponível');
        // Não mostrar modal se não obteve token
      }
    } catch (error: any) {
      console.error('❌ Erro ao obter token FCM:', error);
      console.error('❌ Código do erro:', error?.code);
      console.error('❌ Mensagem do erro:', error?.message);
      
      // Se o erro for de não registrado, tentar registrar novamente
      if (error?.code === 'messaging/unregistered' && Platform.OS === 'ios') {
        console.log('🔄 Erro: dispositivo não registrado. Tentando registrar novamente...');
        try {
          await messaging().registerDeviceForRemoteMessages();
          console.log('✅ Registrado novamente, aguardando...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const token = await messaging().getToken();
          if (token) {
            console.log('✅ Token FCM obtido após novo registro!');
            setFcmToken(token);
            
            // Salvar token no banco de dados
            const { user } = await getCurrentUser();
            if (user) {
              const saveResult = await saveFCMToken(user.id, token);
              if (saveResult.success) {
                console.log('✅ Token FCM salvo no banco de dados!');
              } else {
                console.error('❌ Erro ao salvar token FCM:', saveResult.error);
              }
            }
            
            setShowTokenModal(true); // Mostrar modal apenas se obteve o token com sucesso
            return;
          }
        } catch (retryError: any) {
          console.error('❌ Erro ao tentar novamente:', retryError);
          console.error('❌ Código do erro (retry):', retryError?.code);
        }
      }
      
      // Não mostrar modal se deu erro
      console.log('⚠️ Não foi possível obter o token FCM - modal não será exibido');
    }
  };

  const handleAppleSuccess = async ({ user, credentialEmail, credentialFullName, isNewUser }: AppleSignInResult) => {
    setLoading(true);
    try {
      const appleFullName = credentialFullName
        ? [credentialFullName.givenName, credentialFullName.middleName, credentialFullName.familyName]
            .filter(Boolean)
            .join(' ')
            .trim()
        : '';

      const storedName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        '';

      const finalName = appleFullName || storedName;
      const displayName = (finalName || credentialEmail || 'Usuário').trim();
      const emailToPersist = credentialEmail || user.email || '';

      const result = await createOrUpdateUserFromApple(user.id, {
        name: displayName || 'Usuário',
        email: emailToPersist,
        photo:
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          undefined,
      });

      setWelcomeProvider('apple');
      setWelcomeName(finalName);
      setWelcomeEmail(emailToPersist);
      setUserName(displayName);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao salvar o usuário Apple');
      }

      if (isNewUser) {
        setShowWelcomeModal(true);
        return;
      }

      getFCMToken().catch((error) => {
        console.error('Erro ao buscar token FCM:', error);
      });

      // Verificar artistas e redirecionar adequadamente
      const { shouldRedirectToSelection, activeArtist: artistToSet } = await checkArtistsAndRedirect();
      if (artistToSet) await setActiveArtist(artistToSet);

      setTimeout(() => {
        if (shouldRedirectToSelection) {
          router.replace('/selecionar-artista');
        } else {
          router.replace('/(tabs)/agenda');
        }
      }, 100);
    } finally {
      setLoading(false);
    }
  };

  const resetWelcomeContext = () => {
    setWelcomeProvider(null);
    setWelcomeName('');
    setWelcomeEmail('');
  };

  const handleAppleError = (error: Error) => {
    console.error('Erro no login com Apple:', error);
    Alert.alert('Erro', error?.message || 'Não foi possível autenticar com a Apple');
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (response.type === 'success') {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: response.data.idToken || '',
        });

        if (error) {
          Alert.alert('Erro', error.message);
          return;
        }

        if (data?.user) {
          const result = await createOrUpdateUserFromGoogle(
            data.user.id,
            {
              name: response.data.user.name || response.data.user.email,
              email: response.data.user.email,
              photo: response.data.user.photo || undefined,
            }
          );

          if (result.isNewUser) {
            const googleName = response.data.user.name || response.data.user.email || 'Usuário';
            const googleEmail = response.data.user.email || '';
            setUserName(googleName);
            setWelcomeProvider('google');
            setWelcomeName(response.data.user.name || '');
            setWelcomeEmail(googleEmail);
            setShowWelcomeModal(true);
          } else {
            getFCMToken().catch((error) => {
              console.error('Erro ao buscar token FCM:', error);
            });
            
            // Verificar artistas e redirecionar adequadamente
            const { shouldRedirectToSelection, activeArtist: artistToSet } = await checkArtistsAndRedirect();
            if (artistToSet) await setActiveArtist(artistToSet);
            
            setTimeout(() => {
              if (shouldRedirectToSelection) {
                router.replace('/selecionar-artista');
              } else {
                router.replace('/(tabs)/agenda');
              }
            }, 100);
          }
        }
      }
    } catch (error: any) {
      if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Atenção', 'Login já em andamento');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Erro', 'Google Play Services não disponível');
      } else if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Login com Google cancelado pelo usuário');
      } else if (error.code === '10' || error.message?.includes('DEVELOPER_ERROR')) {
        Alert.alert(
          'Erro de Configuração',
          'O app não está configurado corretamente para login com Google. Por favor, verifique se o SHA-1 está configurado no Google Cloud Console.\n\nVeja o guia: RESOLVER_ERRO_DEVELOPER_ERROR_ANDROID.md'
        );
      } else {
        console.error('Erro no login com Google:', error);
        Alert.alert('Erro', error?.message || 'Erro ao fazer login com Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      const result = await loginUser(email, password);
      
      if (result.error) {
        // Verificar se é erro de rede
        const errorMsg = result.error.message?.toLowerCase() || '';
        if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('failed')) {
          setShowNoInternetModal(true);
        } else if (errorMsg.includes('email não confirmado') || errorMsg.includes('email not confirmed')) {
          // Apenas mostrar modal de confirmação de email se o erro for especificamente sobre isso
          setEmailConfirmationError(result.error.message);
          setShowEmailConfirmationModal(true);
        } else {
          // Para outros erros (senha incorreta, etc), mostrar Alert simples
          Alert.alert('Erro', result.error.message);
        }
      } else if (result.data?.user) {
        if (result.data.user.email_confirmed_at) {
          const userCheck = await checkUserExists(result.data.user.id);
          
          if (userCheck.error) {
            Alert.alert('Atenção', 'Erro ao verificar dados do usuário');
            return;
          }
          
          if (!userCheck.exists) {
            setShowCompleteProfileModal(true);
          } else {
            // Buscar token FCM e mostrar modal (não navegar ainda, o modal vai aparecer)
            getFCMToken().catch((error) => {
              console.error('Erro ao buscar token FCM:', error);
            });
            
            // Verificar artistas e redirecionar adequadamente
            const { shouldRedirectToSelection, activeArtist: artistToSet } = await checkArtistsAndRedirect();
            
            // Se tinha apenas 1 artista, já foi salvo no AsyncStorage; atualizar o contexto para a agenda usar
            if (artistToSet) {
              await setActiveArtist(artistToSet);
            }
            
            // Navegar após um pequeno delay para garantir que o modal apareça
            setTimeout(() => {
              if (shouldRedirectToSelection) {
                router.replace('/selecionar-artista');
              } else {
                router.replace('/(tabs)/agenda');
              }
            }, 100);
          }
        } else {
          Alert.alert('Atenção', 'Erro ao verificar dados do usuário');
        }
      }
    } catch (error: any) {
      // Verificar se é erro de rede
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('failed')) {
        setShowNoInternetModal(true);
      } else {
        Alert.alert('Atenção', 'Ocorreu um erro inesperado');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Erro', 'Por favor, preencha o campo de email');
      return;
    }

    setResendingEmail(true);
    try {
      const result = await resendConfirmationEmail(email);
      
      if (result.error) {
        Alert.alert('Erro', result.error);
      } else {
        Alert.alert(
          'Sucesso',
          'Email de confirmação reenviado! Verifique sua caixa de entrada.',
          [
            {
              text: 'OK',
              onPress: () => setShowEmailConfirmationModal(false),
            },
          ]
        );
      }
    } catch {
      Alert.alert('Erro', 'Ocorreu um erro ao reenviar o email');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Erro', 'Por favor, preencha o campo de email');
      return;
    }

    setSendingResetEmail(true);
    try {
      const result = await sendPasswordResetEmail(resetEmail);
      
      if (result.error) {
        Alert.alert('Erro', result.error);
      } else {
        Alert.alert(
          'Email Enviado',
          'Enviamos um link de recuperação para seu email. Verifique sua caixa de entrada e spam.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowForgotPasswordModal(false);
                setResetEmail('');
              },
            },
          ]
        );
      }
    } catch {
      Alert.alert('Erro', 'Ocorreu um erro ao enviar o email');
    } finally {
      setSendingResetEmail(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            {/* Logo/Header */}
            <View style={styles.header}>
              <LogoMarcaAi size="large" showTagline={true} showIcon={false} />
            </View>

            {/* Formulário de Login */}
            <View style={[styles.form, { backgroundColor: colors.surface }]}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Email</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Digite seu email"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Senha</Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Digite sua senha"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => {
                  setResetEmail(email); // Preencher com o email digitado
                  setShowForgotPasswordModal(true);
                }}
              >
                <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Esqueceu sua senha?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: colors.primary }, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.loginButtonText}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textSecondary }]}>ou</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <View style={styles.socialButtonsRow}>
                <TouchableOpacity
                  style={StyleSheet.flatten([
                    styles.socialIconButton,
                    styles.socialIconButtonGoogle,
                    loading ? styles.socialIconButtonDisabled : undefined,
                  ])}
                  onPress={handleGoogleLogin}
                  disabled={loading}
                >
                  <Ionicons name="logo-google" size={24} color="#fff" />
                </TouchableOpacity>

                <AppleSignInButton
                  iconOnly
                  icon={<Ionicons name="logo-apple" size={24} color="#fff" />}
                  style={StyleSheet.flatten([
                    styles.socialIconButton,
                    styles.socialIconButtonApple,
                    loading ? styles.socialIconButtonDisabled : undefined,
                  ])}
                  disabled={loading}
                  onSuccess={handleAppleSuccess}
                  onError={handleAppleError}
                />
              </View>

              <View style={styles.signupContainer}>
                <Text style={[styles.signupText, { color: colors.textSecondary }]}>Não tem uma conta? </Text>
                <TouchableOpacity onPress={() => router.push('/register')}>
                  <Text style={[styles.signupLink, { color: colors.primary }]}>Cadastre-se</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal para completar cadastro */}
      {showCompleteProfileModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: colors.background }]}>
                <Ionicons name="person-add" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Complete seu Cadastro</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Você precisa finalizar seu perfil pessoal para continuar
              </Text>
            </View>

            {/* Fluxo de cadastro visual */}
            <View style={styles.modalFlowContainer}>
              <View style={styles.modalFlowStep}>
                <View style={[styles.modalFlowIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="person" size={20} color="#fff" />
                </View>
                <Text style={[styles.modalFlowText, { color: colors.primary, fontWeight: 'bold' }]}>
                  Perfil Pessoal
                </Text>
                <Text style={[styles.modalFlowDescription, { color: colors.textSecondary }]}>
                  Nome, telefone, cidade
                </Text>
              </View>

              <View style={styles.modalFlowArrow}>
                <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
              </View>

              <View style={styles.modalFlowStep}>
                <View style={[styles.modalFlowIcon, { backgroundColor: colors.border }]}>
                  <Ionicons name="musical-notes" size={20} color={colors.textSecondary} />
                </View>
                <Text style={[styles.modalFlowText, { color: colors.textSecondary }]}>
                  Perfil Artista
                </Text>
                <Text style={[styles.modalFlowDescription, { color: colors.textSecondary }]}>
                  Nome artístico, foto
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowCompleteProfileModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalContinueButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowCompleteProfileModal(false);
                  router.replace('/cadastro-usuario');
                }}
              >
                <Text style={styles.modalContinueText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal de Sem Internet */}
      <Modal
        visible={showNoInternetModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: isDarkMode ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.1)' }]}>
                <Ionicons name="cloud-offline-outline" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Você está sem internet
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.modalContinueButton, 
                { 
                  backgroundColor: colors.primary,
                  width: '100%',
                  paddingVertical: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center'
                }
              ]}
              onPress={() => setShowNoInternetModal(false)}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                Entendi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Confirmação de Email */}
      <Modal
        visible={showEmailConfirmationModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.15)' : 'rgba(244, 67, 54, 0.1)' }]}>
                <Ionicons name="mail-unread-outline" size={40} color="#F44336" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Email não confirmado
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
                {emailConfirmationError}
              </Text>
            </View>

            {/* Informação adicional */}
            <View style={[styles.emailInfoContainer, { backgroundColor: isDarkMode ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)' }]}>
              <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.emailInfoText, { color: colors.textSecondary }]}>
                Verifique sua caixa de entrada e spam. Caso não tenha recebido, você pode solicitar um novo email.
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowEmailConfirmationModal(false)}
                disabled={resendingEmail}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Fechar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalContinueButton, 
                  { backgroundColor: resendingEmail ? colors.border : colors.primary },
                ]}
                onPress={handleResendEmail}
                disabled={resendingEmail}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.modalContinueText}>
                    {resendingEmail ? 'Enviando...' : 'Reenviar Email'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Boas-Vindas após Login com Google */}
      <Modal
        visible={showWelcomeModal}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface, maxWidth: 450 }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: isDarkMode ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.1)' }]}>
                <Ionicons name="sparkles" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Bem-vindo, {userName}! 🎉
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
                {welcomeProvider === 'apple'
                  ? 'Você está conectado com sua conta Apple'
                  : 'Você está conectado com sua conta Google'}
              </Text>
              {!welcomeName && welcomeEmail ? (
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary, marginTop: 4 }]}>
                  Email: {welcomeEmail}
                </Text>
              ) : null}
            </View>

            {/* Informação sobre o app */}
            <View style={styles.welcomeInfoContainer}>
              <Text style={[styles.welcomeTitle, { color: colors.text }]}>
                Como funciona o Marca AI
              </Text>
              
              <View style={styles.welcomeFeature}>
                <View style={[styles.welcomeFeatureIcon, { backgroundColor: isDarkMode ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.1)' }]}>
                  <Ionicons name="person-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.welcomeFeatureContent}>
                  <Text style={[styles.welcomeFeatureTitle, { color: colors.text }]}>Crie seu Perfil Artista</Text>
                  <Text style={[styles.welcomeFeatureText, { color: colors.textSecondary }]}>
                    Configure seu nome artístico e foto de perfil
                  </Text>
                </View>
              </View>

              <View style={styles.welcomeFeature}>
                <View style={[styles.welcomeFeatureIcon, { backgroundColor: isDarkMode ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.1)' }]}>
                  <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.welcomeFeatureContent}>
                  <Text style={[styles.welcomeFeatureTitle, { color: colors.text }]}>Gerencie Eventos</Text>
                  <Text style={[styles.welcomeFeatureText, { color: colors.textSecondary }]}>
                    Organize shows, ensaios e compromissos
                  </Text>
                </View>
              </View>

              <View style={styles.welcomeFeature}>
                <View style={[styles.welcomeFeatureIcon, { backgroundColor: isDarkMode ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.1)' }]}>
                  <Ionicons name="cash-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.welcomeFeatureContent}>
                  <Text style={[styles.welcomeFeatureTitle, { color: colors.text }]}>Controle Financeiro</Text>
                  <Text style={[styles.welcomeFeatureText, { color: colors.textSecondary }]}>
                    Acompanhe receitas, despesas e lucros
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={async () => {
                  setShowWelcomeModal(false);
                  resetWelcomeContext();
                  // Buscar token FCM e mostrar modal (não navegar ainda, o modal vai aparecer)
                  getFCMToken().catch((error) => {
                    console.error('Erro ao buscar token FCM:', error);
                  });
                  
                  // Verificar artistas e redirecionar adequadamente
                  const { shouldRedirectToSelection, activeArtist: artistToSet } = await checkArtistsAndRedirect();
                  if (artistToSet) await setActiveArtist(artistToSet);
                  
                  // Navegar após um pequeno delay para garantir que o modal apareça
                  setTimeout(() => {
                    if (shouldRedirectToSelection) {
                      router.replace('/selecionar-artista');
                    } else {
                      router.replace('/(tabs)/agenda');
                    }
                  }, 100);
                }}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Pular</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalContinueButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowWelcomeModal(false);
                  resetWelcomeContext();
                  router.replace('/cadastro-artista');
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="musical-notes" size={18} color="#FFFFFF" />
                  <Text style={styles.modalContinueText}>Criar Artista</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Esqueceu a Senha */}
      <Modal
        visible={showForgotPasswordModal}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: isDarkMode ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.1)' }]}>
                <Ionicons name="key-outline" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Esqueceu sua senha?
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
                Digite seu email e enviaremos um link para redefinir sua senha
              </Text>
            </View>

            {/* Campo de email */}
            <View style={styles.forgotPasswordEmailContainer}>
              <Text style={[styles.label, { color: colors.text, marginBottom: 8 }]}>Email</Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  placeholder="Digite seu email"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!sendingResetEmail}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => {
                  setShowForgotPasswordModal(false);
                  setResetEmail('');
                }}
                disabled={sendingResetEmail}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalContinueButton, 
                  { backgroundColor: sendingResetEmail ? colors.border : colors.primary },
                ]}
                onPress={handleForgotPassword}
                disabled={sendingResetEmail}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="send-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.modalContinueText}>
                    {sendingResetEmail ? 'Enviando...' : 'Enviar Link'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Token FCM */}
      <FCMTokenModal
        visible={showTokenModal}
        token={fcmToken}
        onClose={() => setShowTokenModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
    marginTop: 20,
  },
  form: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  socialButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  socialIconButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  socialIconButtonGoogle: {
    backgroundColor: '#db4437',
  },
  socialIconButtonApple: {
    backgroundColor: '#000',
  },
  socialIconButtonDisabled: {
    opacity: 0.6,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Estilos do modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalFlowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  modalFlowStep: {
    alignItems: 'center',
    flex: 1,
    minWidth: 100,
  },
  modalFlowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalFlowText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalFlowDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  modalFlowArrow: {
    marginHorizontal: 8,
    alignItems: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContinueButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalContinueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emailInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  emailInfoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  welcomeInfoContainer: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  welcomeFeatureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeFeatureContent: {
    flex: 1,
  },
  welcomeFeatureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  welcomeFeatureText: {
    fontSize: 14,
    lineHeight: 20,
  },
  forgotPasswordEmailContainer: {
    marginBottom: 24,
  },
});