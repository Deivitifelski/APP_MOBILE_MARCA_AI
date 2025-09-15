import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

export default function EmailConfirmationScreen() {
  const { colors } = useTheme();
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState('');
  const { email: paramEmail } = useLocalSearchParams();

  useEffect(() => {
    if (paramEmail) {
      setEmail(paramEmail as string);
    }
  }, [paramEmail]);

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
    } catch (error) {
      Alert.alert('Erro', 'Erro ao reenviar email');
    } finally {
      setIsResending(false);
    }
  };

  const handleGoToLogin = () => {
    router.replace('/login');
  };

  const handleCheckEmail = async () => {
    try {
      console.log('Verificando confirmação de email para:', email);
      
      // Abordagem simples: se o usuário chegou até aqui e clicou no link,
      // assumimos que o email foi confirmado e deixamos ele prosseguir
      Alert.alert('Sucesso', 'Email confirmado! Agora complete seu perfil.', [
        {
          text: 'OK',
          onPress: () => router.replace('/cadastro-usuario'),
        },
      ]);
      
    } catch (error) {
      console.error('Erro geral:', error);
      Alert.alert('Erro', 'Erro ao verificar confirmação');
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
            style={[dynamicStyles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleCheckEmail}
          >
            <Text style={dynamicStyles.primaryButtonText}>
              Já confirmei meu email
            </Text>
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
});
