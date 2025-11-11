import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LogoMarcaAi from '../components/LogoMarcaAi';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Erro', 'Por favor, insira um email válido');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Tentando criar conta para:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: 'marcaai://auth/callback'
        }
      });

      console.log('Resposta do Supabase:', { data, error });

      if (error) {
        console.error('Erro no cadastro:', error);
        Alert.alert('Erro', error.message);
      } else if (data.user) {
        console.log('Usuário criado com sucesso:', data.user);
        
         // Verificar se o email foi enviado
         if (data.user.email_confirmed_at) {
           Alert.alert('Sucesso', 'Conta criada com sucesso!');
           router.push('/cadastro-usuario');
         } else {
          Alert.alert(
            'Confirmação de Email', 
            'Um email de confirmação foi enviado para ' + email + '. Verifique sua caixa de entrada e clique no link para confirmar sua conta.'
          );
          // Navegar para tela de confirmação de email
          router.push({
            pathname: '/email-confirmation',
            params: { email: email }
          });
         }
      }
    } catch (error) {
      console.error('Erro geral:', error);
      Alert.alert('Erro', 'Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const dynamicStyles = createDynamicStyles(colors);

  return (
    <SafeAreaView style={[dynamicStyles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={dynamicStyles.keyboardView}
      >
        <ScrollView contentContainerStyle={dynamicStyles.scrollContent}>
          <View style={dynamicStyles.content}>
            {/* Header */}
            <View style={dynamicStyles.header}>
              <TouchableOpacity
                style={dynamicStyles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <LogoMarcaAi size="medium" showTagline={false} />
              <Text style={[dynamicStyles.title, { color: colors.text }]}>Criar Conta</Text>
              <Text style={[dynamicStyles.subtitle, { color: colors.textSecondary }]}>
                Preencha os dados para criar sua conta
              </Text>
            </View>

            {/* Formulário de Cadastro */}
            <View style={dynamicStyles.form}>
              <View style={[dynamicStyles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={dynamicStyles.inputIcon} />
                <TextInput
                  style={[dynamicStyles.input, { color: colors.text }]}
                  placeholder="Email"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={[dynamicStyles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={dynamicStyles.inputIcon} />
                <TextInput
                  style={[dynamicStyles.input, { color: colors.text }]}
                  placeholder="Senha"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={dynamicStyles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={[dynamicStyles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={dynamicStyles.inputIcon} />
                <TextInput
                  style={[dynamicStyles.input, { color: colors.text }]}
                  placeholder="Confirmar Senha"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={dynamicStyles.eyeIcon}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Indicadores de validação */}
              <View style={dynamicStyles.validationContainer}>
                <View style={dynamicStyles.validationItem}>
                  <Ionicons
                    name={password.length >= 6 ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={password.length >= 6 ? colors.success : colors.textSecondary}
                  />
                  <Text style={[
                    dynamicStyles.validationText,
                    { color: password.length >= 6 ? colors.success : colors.textSecondary }
                  ]}>
                    Mínimo 6 caracteres
                  </Text>
                </View>
                
                <View style={dynamicStyles.validationItem}>
                  <Ionicons
                    name={password === confirmPassword && password.length > 0 ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={password === confirmPassword && password.length > 0 ? colors.success : colors.textSecondary}
                  />
                  <Text style={[
                    dynamicStyles.validationText,
                    { color: password === confirmPassword && password.length > 0 ? colors.success : colors.textSecondary }
                  ]}>
                    Senhas coincidem
                  </Text>
                </View>
                
                <View style={dynamicStyles.validationItem}>
                  <Ionicons
                    name={isValidEmail(email) ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={isValidEmail(email) ? colors.success : colors.textSecondary}
                  />
                  <Text style={[
                    dynamicStyles.validationText,
                    { color: isValidEmail(email) ? colors.success : colors.textSecondary }
                  ]}>
                    Email válido
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  dynamicStyles.registerButton,
                  { backgroundColor: colors.primary },
                  (!isValidEmail(email) || password.length < 6 || password !== confirmPassword) && dynamicStyles.registerButtonDisabled
                ]}
                onPress={handleRegister}
                disabled={!isValidEmail(email) || password.length < 6 || password !== confirmPassword || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={dynamicStyles.registerButtonText}>
                    Criar Conta
                  </Text>
                )}
              </TouchableOpacity>

              <View style={dynamicStyles.divider}>
                <View style={[dynamicStyles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[dynamicStyles.dividerText, { color: colors.textSecondary }]}>ou</Text>
                <View style={[dynamicStyles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <TouchableOpacity style={[dynamicStyles.googleButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="logo-google" size={20} color={colors.text} />
                <Text style={[dynamicStyles.googleButtonText, { color: colors.text }]}>
                  Cadastrar com Google
                </Text>
              </TouchableOpacity>

              <View style={dynamicStyles.loginContainer}>
                <Text style={[dynamicStyles.loginText, { color: colors.textSecondary }]}>
                  Já tem uma conta?{' '}
                </Text>
                <Link href="/login" asChild>
                  <TouchableOpacity>
                    <Text style={[dynamicStyles.loginLink, { color: colors.primary }]}>
                      Faça login
                    </Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createDynamicStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  validationContainer: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  validationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  validationText: {
    fontSize: 14,
    marginLeft: 8,
  },
  registerButton: {
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  registerButtonDisabled: {
    opacity: 0.5,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    height: 56,
    marginBottom: 24,
    borderWidth: 1,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
