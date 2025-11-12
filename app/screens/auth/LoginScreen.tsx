import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
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
import LogoMarcaAi from '../../../components/LogoMarcaAi';
import { useTheme } from '../../../contexts/ThemeContext';
import { supabase } from '../../../lib/supabase';
import { loginUser, resendConfirmationEmail } from '../../../services/supabase/authService';
import { checkUserExists } from '../../../services/supabase/userService';

// Ignorar erros de rede no console
LogBox.ignoreLogs([
  'Network request failed',
  'TypeError: Network request failed',
]);
LogBox.ignoreAllLogs(true); // Remove TODOS os erros/warnings visuais

export default function LoginScreen() {
  const { colors, isDarkMode } = useTheme();
  const [email, setEmail] = useState('marcaaiapp@gmail.com');
  const [password, setPassword] = useState('campobom209');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCompleteProfileModal, setShowCompleteProfileModal] = useState(false);
  const [showNoInternetModal, setShowNoInternetModal] = useState(false);
  const [showEmailConfirmationModal, setShowEmailConfirmationModal] = useState(false);
  const [emailConfirmationError, setEmailConfirmationError] = useState<string>('');
  const [resendingEmail, setResendingEmail] = useState(false);

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
        } else {
          setEmailConfirmationError(result.error.message);
          setShowEmailConfirmationModal(true);
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
            router.replace('/(tabs)/agenda');
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

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      console.log('🔵 [Google Login] Iniciando login com Google...');
      
      // Fazer login com Google usando OAuth do Supabase
      console.log('🔵 [Google Login] Chamando signInWithOAuth...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'marcaai://google-callback',
          skipBrowserRedirect: false,
        },
      });
      
      console.log('✅ [Google Login] Resposta do signInWithOAuth:', JSON.stringify({ data, error }, null, 2));
      
      if (error) {
        console.error('❌ [Google Login] Erro no OAuth:', error);
        const errorMsg = error.message?.toLowerCase() || '';
        if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('failed')) {
          setShowNoInternetModal(true);
        } else {
          Alert.alert('Erro no Login Google', error.message);
        }
        return;
      }

      console.log('✅ [Google Login] OAuth iniciado com sucesso!');
      console.log('🔵 [Google Login] URL de autenticação:', data?.url);
      
      // O fluxo OAuth abrirá o navegador e retornará via deep link
      // O listener de auth state no app vai detectar quando o login completar
      
    } catch (error: any) {
      console.error('❌ [Google Login] Erro capturado:', error);
      console.error('❌ [Google Login] Stack trace:', error.stack);
      
      // Verificar se é erro de rede
      const errorMsg = error?.message?.toLowerCase() || '';
      if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('failed')) {
        setShowNoInternetModal(true);
      } else {
        Alert.alert('Erro Inesperado', error?.message || 'Erro ao fazer login com Google');
      }
    } finally {
      console.log('🔵 [Google Login] Finalizando processo de login');
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

              <TouchableOpacity style={styles.forgotPassword}>
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

              <TouchableOpacity 
                style={[styles.googleButton, loading && styles.loginButtonDisabled]}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={20} color="#fff" />
                <Text style={styles.googleButtonText}>
                  {loading ? 'Entrando...' : 'Entrar com Google'}
                </Text>
              </TouchableOpacity>

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
  googleButton: {
    backgroundColor: '#db4437',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
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
});