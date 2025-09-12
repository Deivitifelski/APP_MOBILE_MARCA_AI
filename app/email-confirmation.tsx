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

export default function EmailConfirmationScreen() {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        Alert.alert('Sucesso', 'Email confirmado! Agora complete seu perfil.', [
          {
            text: 'OK',
            onPress: () => router.replace('/cadastro-usuario'),
          },
        ]);
      } else {
        Alert.alert('Aviso', 'Email ainda não foi confirmado. Verifique sua caixa de entrada.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao verificar confirmação');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gradient}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="mail-outline" size={80} color="#fff" />
            </View>
            <Text style={styles.title}>Confirme seu Email</Text>
            <Text style={styles.subtitle}>
              Enviamos um link de confirmação para:
            </Text>
            <Text style={styles.email}>{email}</Text>
          </View>

          {/* Instruções */}
          <View style={styles.instructions}>
            <View style={styles.instructionItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.instructionText}>
                Verifique sua caixa de entrada
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.instructionText}>
                Clique no link de confirmação
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.instructionText}>
                Volte ao app após confirmar
              </Text>
            </View>
          </View>

          {/* Aviso sobre spam */}
          <View style={styles.spamWarning}>
            <Ionicons name="warning-outline" size={20} color="#FF9800" />
            <Text style={styles.spamText}>
              Não esqueça de verificar a pasta de spam/lixo eletrônico
            </Text>
          </View>

          {/* Botões */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCheckEmail}
            >
              <Text style={styles.primaryButtonText}>
                Já confirmei meu email
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, isResending && styles.buttonDisabled]}
              onPress={handleResendEmail}
              disabled={isResending}
            >
              {isResending ? (
                <ActivityIndicator size="small" color="#667eea" />
              ) : (
                <Ionicons name="refresh" size={20} color="#667eea" />
              )}
              <Text style={styles.secondaryButtonText}>
                {isResending ? 'Reenviando...' : 'Reenviar email'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={handleGoToLogin}
            >
              <Text style={styles.linkButtonText}>
                Voltar ao login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    backgroundColor: '#667eea',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  instructions: {
    marginBottom: 30,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 12,
  },
  spamWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 30,
  },
  spamText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  linkButtonText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
