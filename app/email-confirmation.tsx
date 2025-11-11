import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

export default function EmailConfirmationScreen() {
  const { colors } = useTheme();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const { email: paramEmail, password: paramPassword } = useLocalSearchParams();

  useEffect(() => {
    if (paramEmail) {
      setEmail(paramEmail as string);
    }
    if (paramPassword) {
      setPassword(paramPassword as string);
    }
  }, [paramEmail, paramPassword]);

  const handleResendEmail = async () => {
    if (!email) {
      Alert.alert('Erro', 'Email não encontrado');
      return;
    }

    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        Alert.alert('Erro', error.message);
      } else {
        Alert.alert('Sucesso', 'Email de confirmação reenviado!');
      }
    } catch {
      Alert.alert('Erro', 'Erro ao reenviar email');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoToLogin = () => {
    router.replace('/login');
  };

  const handleCheckEmail = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha seu email e senha para verificar');
      return;
    }

    setIsChecking(true);
    
    try {
      console.log('Tentando fazer login para verificar email...');
      
      // Fazer login para verificar o status do email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        console.error('Erro ao fazer login:', error);
        Alert.alert('Erro', 'Email ou senha incorretos. Verifique suas credenciais.');
        return;
      }

      // Verificar se o email foi confirmado
      if (data?.user?.email_confirmed_at) {
        console.log('✅ E-mail verificado em:', data.user.email_confirmed_at);
        setIsEmailVerified(true);
        setShowResultModal(true);
      } else {
        console.log('❌ E-mail ainda não verificado');
        setIsEmailVerified(false);
        setShowResultModal(true);
        
        // Fazer logout já que o email não está confirmado
        await supabase.auth.signOut();
      }
      
    } catch (error) {
      console.error('Erro ao verificar confirmação:', error);
      Alert.alert('Erro', 'Erro ao verificar confirmação. Tente novamente.');
    } finally {
      setIsChecking(false);
    }
  };

  const dynamicStyles = createDynamicStyles(colors);

  return (
    <SafeAreaView style={[dynamicStyles.container, { backgroundColor: colors.background }]}>
      <View style={dynamicStyles.content}>
        {/* Header */}
        <View style={dynamicStyles.header}>
          <View style={[dynamicStyles.iconContainer, { backgroundColor: colors.primary }]}>
            <Ionicons name="mail-outline" size={80} color="#fff" />
          </View>
          <Text style={[dynamicStyles.title, { color: colors.text }]}>Confirme seu Email</Text>
          <Text style={[dynamicStyles.subtitle, { color: colors.textSecondary }]}>
            Enviamos um link de confirmação para:
          </Text>
          <Text style={[dynamicStyles.email, { color: colors.text }]}>{email}</Text>
        </View>

        {/* Instruções */}
        <View style={[dynamicStyles.instructions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={dynamicStyles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[dynamicStyles.instructionText, { color: colors.text }]}>
              Verifique sua caixa de entrada
            </Text>
          </View>
          <View style={dynamicStyles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[dynamicStyles.instructionText, { color: colors.text }]}>
              Clique no link de confirmação
            </Text>
          </View>
          <View style={dynamicStyles.instructionItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[dynamicStyles.instructionText, { color: colors.text }]}>
              Volte ao app após confirmar
            </Text>
          </View>
        </View>

        {/* Aviso sobre spam */}
        <View style={[dynamicStyles.spamWarning, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={[dynamicStyles.spamText, { color: colors.text }]}>
            Não esqueça de verificar a pasta de spam/lixo eletrônico
          </Text>
        </View>

        {/* Botões */}
        <View style={dynamicStyles.buttonContainer}>
          <TouchableOpacity
            style={[
              dynamicStyles.primaryButton, 
              { backgroundColor: colors.primary },
              isChecking && dynamicStyles.buttonDisabled
            ]}
            onPress={handleCheckEmail}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={dynamicStyles.primaryButtonText}>
                  Verificando...
                </Text>
              </>
            ) : (
              <Text style={dynamicStyles.primaryButtonText}>
                Já confirmei meu email
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              dynamicStyles.secondaryButton, 
              { backgroundColor: colors.surface, borderColor: colors.border },
              isResending && dynamicStyles.buttonDisabled
            ]}
            onPress={handleResendEmail}
            disabled={isResending}
          >
            {isResending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="refresh" size={20} color={colors.primary} />
            )}
            <Text style={[dynamicStyles.secondaryButtonText, { color: colors.text }]}>
              {isResending ? 'Reenviando...' : 'Reenviar email'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.linkButton}
            onPress={handleGoToLogin}
          >
            <Text style={[dynamicStyles.linkButtonText, { color: colors.primary }]}>
              Voltar ao login
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de Resultado */}
      <Modal
        visible={showResultModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={[dynamicStyles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[
              dynamicStyles.modalIconContainer, 
              { backgroundColor: isEmailVerified ? colors.success + '20' : colors.error + '20' }
            ]}>
              <Ionicons 
                name={isEmailVerified ? 'checkmark-circle' : 'close-circle'} 
                size={80} 
                color={isEmailVerified ? colors.success : colors.error} 
              />
            </View>
            
            <Text style={[dynamicStyles.modalTitle, { color: colors.text }]}>
              {isEmailVerified ? 'Email Verificado!' : 'Email Não Verificado'}
            </Text>
            
            <Text style={[dynamicStyles.modalMessage, { color: colors.textSecondary }]}>
              {isEmailVerified 
                ? 'Seu email foi confirmado com sucesso! Agora vamos completar seu perfil.' 
                : 'Seu email ainda não foi confirmado. Por favor, verifique sua caixa de entrada e clique no link de confirmação.'}
            </Text>

            <TouchableOpacity
              style={[dynamicStyles.modalButton, { backgroundColor: isEmailVerified ? colors.success : colors.primary }]}
              onPress={() => {
                setShowResultModal(false);
                if (isEmailVerified) {
                  router.replace('/cadastro-usuario');
                }
              }}
            >
              <Text style={dynamicStyles.modalButtonText}>
                {isEmailVerified ? 'Continuar' : 'OK, Entendi'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createDynamicStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 30,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  instructions: {
    marginBottom: 30,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  spamWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 30,
    borderWidth: 1,
  },
  spamText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    height: 56,
    borderWidth: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkButtonText: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  modalIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
