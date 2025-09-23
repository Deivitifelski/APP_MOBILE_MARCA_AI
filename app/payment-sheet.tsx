import { Ionicons } from '@expo/vector-icons';
import { useStripe } from "@stripe/stripe-react-native";
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

export default function PaymentSheetScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  
  const params = useLocalSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const {
    subscriptionId,
    customerId,
    planName,
    planValue,
    planCurrency,
    clientSecret,
    hasClientSecret
  } = params;

  useEffect(() => {
    if (hasClientSecret === 'true' && clientSecret) {
      // Auto-abrir o payment sheet quando a tela carregar
      openPaymentSheet(clientSecret as string);
    }
  }, []);

  const formatPrice = (value: string, currency: string) => {
    const numValue = parseInt(value);
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });
    return formatter.format(numValue / 100); // Stripe usa centavos
  };

  const openPaymentSheet = async (setupIntentClientSecret: string) => {
    setIsLoading(true);
    
    try {
      // Inicializa o PaymentSheet com o SetupIntent
      const { error } = await initPaymentSheet({
        setupIntentClientSecret,
        merchantDisplayName: "Marca AI",
        allowsDelayedPaymentMethods: false,
      });

      if (error) {
        console.log("Erro ao inicializar PaymentSheet:", error);
        setPaymentStatus('error');
        Alert.alert('Erro', 'Erro ao inicializar o formulário de pagamento');
        return;
      }

      // Abre o formulário para o usuário inserir o cartão
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        console.log("Erro ao abrir PaymentSheet:", presentError);
        setPaymentStatus('error');
        Alert.alert('Erro', 'Erro ao processar o pagamento');
        return;
      }

      console.log("Método de pagamento salvo com sucesso! 🚀");
      setPaymentStatus('success');
      
      // Navegar para tela de sucesso após 2 segundos
      setTimeout(() => {
        router.replace('/(tabs)/agenda');
      }, 2000);

    } catch (error) {
      console.error('Erro inesperado:', error);
      setPaymentStatus('error');
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryPayment = () => {
    if (clientSecret) {
      setPaymentStatus('idle');
      openPaymentSheet(clientSecret as string);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Pagamento',
      'Tem certeza que deseja cancelar o pagamento?',
      [
        { text: 'Não', style: 'cancel' },
        { 
          text: 'Sim', 
          style: 'destructive',
          onPress: () => router.back()
        }
      ]
    );
  };

  const renderContent = () => {
    if (paymentStatus === 'success') {
      return (
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: '#10B981' + '20' }]}>
            <Ionicons name="checkmark-circle" size={60} color="#10B981" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            Pagamento Confirmado!
          </Text>
          <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
            Seu método de pagamento foi salvo com sucesso.
          </Text>
          <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
            Redirecionando para a agenda...
          </Text>
        </View>
      );
    }

    if (paymentStatus === 'error') {
      return (
        <View style={styles.errorContainer}>
          <View style={[styles.errorIcon, { backgroundColor: '#EF4444' + '20' }]}>
            <Ionicons name="close-circle" size={60} color="#EF4444" />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Erro no Pagamento
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Não foi possível processar seu pagamento. Tente novamente.
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: '#F59E0B' }]}
              onPress={handleRetryPayment}
              disabled={isLoading}
            >
              <Text style={styles.retryButtonText}>Tentar Novamente</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: colors.border }]}
              onPress={handleCancel}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Estado de loading/processando
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={[styles.loadingTitle, { color: colors.text }]}>
          Processando Pagamento
        </Text>
        <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
          Aguarde enquanto processamos seu pagamento...
        </Text>
        
        {/* Informações do plano */}
        <View style={[styles.planInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.planInfoTitle, { color: colors.text }]}>Plano Selecionado</Text>
          <Text style={[styles.planInfoName, { color: colors.text }]}>
            {planName || 'Plano Premium'}
          </Text>
          <Text style={[styles.planInfoPrice, { color: '#F59E0B' }]}>
            {planValue && planCurrency ? formatPrice(planValue as string, planCurrency as string) : 'R$ 29,90'}/mês
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={handleCancel}
          disabled={isLoading}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { 
          backgroundColor: colors.surface, 
          borderBottomColor: colors.border,
          paddingTop: insets.top + 20
        }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Pagamento</Text>
            <View style={styles.placeholder} />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderContent()}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  planInfo: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    alignItems: 'center',
  },
  planInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.7,
  },
  planInfoName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planInfoPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
