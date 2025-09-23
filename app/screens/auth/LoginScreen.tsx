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
import { supabase } from '../../../lib/supabase';
import { loginUser } from '../../../services/supabase/authService';
import { checkUserExists } from '../../../services/supabase/userService';

export default function LoginScreen() {
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
      setLoading(true);
      
      // Log detalhado para debug
      console.log('🔍 Iniciando login com Google...');
      console.log('📱 Platform:', Platform.OS);
      console.log('🌐 Redirect URL:', window.location?.origin || 'Expo development');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location?.origin || 'exp://192.168.1.100:8081', // pode trocar por rota específica
        },
      });
      
      if (error) {
        console.error('❌ Erro detalhado do Supabase:', {
          message: error.message,
          status: error.status,
          name: error.name,
          stack: error.stack,
        });
        
        // Soluções automáticas baseadas no tipo de erro
        let errorMessage = error.message;
        let suggestedSolution = '';
        
        if (error.message.includes('redirect_uri_mismatch')) {
          suggestedSolution = 'Problema de configuração de redirect URI. Verifique as configurações do Google OAuth.';
          console.log('🔧 Solução sugerida: Configurar redirect URI no Google Console');
        } else if (error.message.includes('invalid_client')) {
          suggestedSolution = 'Client ID inválido. Verifique as configurações do Google OAuth.';
          console.log('🔧 Solução sugerida: Verificar Client ID no Google Console');
        } else if (error.message.includes('access_denied')) {
          suggestedSolution = 'Usuário cancelou a autenticação ou não concedeu permissões.';
          console.log('🔧 Solução sugerida: Usuário precisa conceder permissões');
        } else if (error.message.includes('network')) {
          suggestedSolution = 'Problema de conexão. Verifique sua internet.';
          console.log('🔧 Solução sugerida: Verificar conexão com internet');
        } else if (error.message.includes('popup_blocked')) {
          suggestedSolution = 'Popup bloqueado pelo navegador. Permita popups para este site.';
          console.log('🔧 Solução sugerida: Permitir popups no navegador');
        }
        
        Alert.alert(
          'Erro no Login Google', 
          `${errorMessage}\n\n${suggestedSolution || 'Tente novamente ou entre em contato com o suporte.'}`,
          [
            { text: 'OK', style: 'default' },
            ...(error.message.includes('redirect_uri_mismatch') ? [{
              text: 'Ver Configurações',
              onPress: () => {
                console.log('🔧 Usuário quer verificar configurações de redirect URI');
                // Aqui você pode adicionar navegação para página de configurações
              }
            }] : [])
          ]
        );
      } else {
        console.log('✅ Login iniciado com sucesso');
        // O usuário será redirecionado para o Google
      }
    } catch (error: any) {
      // Log completo do erro inesperado
      console.error('💥 Erro inesperado completo:', {
        error,
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      
      // Tentar identificar o tipo de erro
      let errorType = 'Desconhecido';
      if (error?.message?.includes('Network')) errorType = 'Rede';
      if (error?.message?.includes('Timeout')) errorType = 'Timeout';
      if (error?.message?.includes('CORS')) errorType = 'CORS';
      
      Alert.alert(
        'Erro Inesperado', 
        `Tipo: ${errorType}\nMensagem: ${error?.message || 'Erro desconhecido'}\n\nTente novamente ou verifique sua conexão.`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Tentar Novamente', 
            onPress: () => {
              console.log('🔄 Tentando login novamente...');
              handleGoogleLogin();
            }
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            {/* Logo/Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Ionicons name="musical-notes" size={60} color="#667eea" />
              </View>
              <Text style={styles.title}>Marca AI</Text>
              <Text style={styles.subtitle}>Gerencie seus shows e eventos</Text>
            </View>

            {/* Formulário de Login */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Digite seu email"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Senha</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Digite sua senha"
                    placeholderTextColor="#999"
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
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Esqueceu sua senha?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.loginButtonText}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
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
                <Text style={styles.signupText}>Não tem uma conta? </Text>
                <TouchableOpacity onPress={() => router.push('/register')}>
                  <Text style={styles.signupLink}>Cadastre-se</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal para completar cadastro */}
      {showCompleteProfileModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="person-add" size={32} color="#667eea" />
              </View>
              <Text style={styles.modalTitle}>Complete seu Cadastro</Text>
              <Text style={styles.modalSubtitle}>
                Você precisa finalizar seu perfil pessoal para continuar
              </Text>
            </View>

            {/* Fluxo de cadastro visual */}
            <View style={styles.modalFlowContainer}>
              <View style={styles.modalFlowStep}>
                <View style={[styles.modalFlowIcon, { backgroundColor: '#667eea' }]}>
                  <Ionicons name="person" size={20} color="#fff" />
                </View>
                <Text style={[styles.modalFlowText, { color: '#667eea', fontWeight: 'bold' }]}>
                  Perfil Pessoal
                </Text>
                <Text style={styles.modalFlowDescription}>
                  Nome, telefone, cidade
                </Text>
              </View>

              <View style={styles.modalFlowArrow}>
                <Ionicons name="arrow-forward" size={20} color="#999" />
              </View>

              <View style={styles.modalFlowStep}>
                <View style={[styles.modalFlowIcon, { backgroundColor: '#e9ecef' }]}>
                  <Ionicons name="musical-notes" size={20} color="#999" />
                </View>
                <Text style={[styles.modalFlowText, { color: '#999' }]}>
                  Perfil Artista
                </Text>
                <Text style={[styles.modalFlowDescription, { color: '#999' }]}>
                  Nome artístico, foto
                </Text>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowCompleteProfileModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalContinueButton}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
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
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputIcon: {
    marginLeft: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333',
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
    color: '#667eea',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#667eea',
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
    backgroundColor: '#e9ecef',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#666',
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
    color: '#666',
  },
  signupLink: {
    fontSize: 14,
    color: '#667eea',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
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
    color: '#666',
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
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalContinueButton: {
    flex: 1,
    backgroundColor: '#667eea',
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