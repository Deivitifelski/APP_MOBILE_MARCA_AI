import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import LogoMarcaAi from '../../../components/LogoMarcaAi';
import { useTheme } from '../../../contexts/ThemeContext';
import { loginUser } from '../../../services/supabase/authService';
import { signInWithGoogle } from '../../../services/supabase/googleAuthService';
import { checkUserExists } from '../../../services/supabase/userService';

export default function LoginScreen() {
  const { colors, isDarkMode } = useTheme();
  const [email, setEmail] = useState('deivitifelskiefisio@outlook.com');
  const [password, setPassword] = useState('campobom209');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCompleteProfileModal, setShowCompleteProfileModal] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      const result = await loginUser(email, password);
      
      if (result.error) {
        Alert.alert('Erro', result.error.message);
      } else if (result.data?.user) {
        // Verificar se o email foi confirmado
        if (result.data.user.email_confirmed_at) {
          // Verificar se o usuário existe na tabela users
          const userCheck = await checkUserExists(result.data.user.id);
          
          if (userCheck.error) {
            Alert.alert('Erro', 'Erro ao verificar dados do usuário');
            return;
          }
          
          if (!userCheck.exists) {
            // Usuário não existe na tabela users, mostrar modal personalizado
            setShowCompleteProfileModal(true);
          } else {
            // Usuário existe, pode acessar a agenda
            router.replace('/(tabs)/agenda');
          }
        } else {
          router.replace('/email-confirmation');
        }
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      console.log('🔍 Iniciando login com Google...');
      
      const result = await signInWithGoogle();
      
      if (!result.success) {
        Alert.alert(
          'Erro no Login Google', 
          result.error || 'Erro ao fazer login com Google',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      console.log('✅ OAuth iniciado - aguardando autenticação no navegador...');
      // O callback será processado pelo AuthDeepLinkHandler
      
    } catch (error: any) {
      console.error('💥 Erro inesperado no login Google:', error);
      Alert.alert(
        'Erro Inesperado', 
        error?.message || 'Erro ao fazer login com Google',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  // Estilos dinâmicos baseados no tema
  const dynamicStyles = createDynamicStyles(isDarkMode, colors);

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
              <LogoMarcaAi size="large" showTagline={true} />
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
    </SafeAreaView>
  );
}

// Função auxiliar para criar estilos dinâmicos (não usada atualmente, mas mantida para consistência)
const createDynamicStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  // Estilos dinâmicos podem ser adicionados aqui no futuro
});

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
    marginBottom: 40,
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
});