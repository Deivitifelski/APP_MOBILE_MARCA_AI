import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  value: number;
  currency: string;
}


export default function PlanosPagamentosScreen() {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [plans, setPlans] = useState<StripeProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  // Buscar planos do Supabase
  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('list-stripe-products');
      
      if (error) {
        Alert.alert('Erro', 'Não foi possível carregar os planos. Tente novamente.');
        setPlans([]);
        return;
      }

      if (data) {
        // Se data já é um array, usar diretamente
        if (Array.isArray(data)) {
          setPlans(data);
        } 
        // Se data é uma string JSON, fazer parse
        else if (typeof data === 'string') {
          try {
            const parsedData = JSON.parse(data);
            if (Array.isArray(parsedData)) {
              setPlans(parsedData);
            } else {
              setPlans([]);
            }
          } catch (parseError) {
            setPlans([]);
          }
        }
        // Se data é um objeto, tentar extrair array
        else if (typeof data === 'object') {
          const arrayData = Object.values(data).find(item => Array.isArray(item));
          if (arrayData) {
            setPlans(arrayData as StripeProduct[]);
          } else {
            setPlans([]);
          }
        }
        else {
          setPlans([]);
        }
      } else {
        setPlans([]);
      }
    } catch (err) {
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPaymentSheetParams = async (plan: StripeProduct) => {
    try {
      // Obter dados do usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';

      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: plan.value,
          currency: plan.currency.toLowerCase(),
          email: userEmail,
          name: userName,
          description: `Assinatura ${plan.name}`
        }
      });
      
      if (error) {
        throw new Error(`Erro na função Supabase: ${error.message}`);
      }

      // Parse da resposta se vier como string JSON
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch (parseError) {
          throw new Error('Erro ao processar resposta do servidor');
        }
      }

      if (parsedData && parsedData.error) {
        throw new Error(`Erro: ${parsedData.error}`);
      }

      return {
        paymentIntent: parsedData.paymentIntent,
        ephemeralKey: parsedData.ephemeralKey,
        customer: parsedData.customer,
      };

    } catch (error) {
      throw error;
    }
  };

  const initializePaymentSheet = async (plan: StripeProduct, userName: string) => {
    try {
      const {
        paymentIntent,
        ephemeralKey,
        customer,
      } = await fetchPaymentSheetParams(plan);

      const { error } = await initPaymentSheet({
        merchantDisplayName: "App Organizei",
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: userName,
        }
      });

      if (!error) {
        setLoading(true);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  };

  const openPaymentSheet = async () => {
    try {
      const { error } = await presentPaymentSheet();

      if (error) {
        // Converter erros comuns do Stripe para português
        let errorMessage = error.message;
        
        switch (error.code) {
          case 'Canceled':
            // Usuário cancelou o pagamento - não mostrar erro
            return;
          case 'Failed':
            if (error.message.includes('Your card was declined')) {
              errorMessage = 'Seu cartão foi recusado. Verifique os dados ou tente outro cartão.';
            } else if (error.message.includes('Your card has insufficient funds')) {
              errorMessage = 'Saldo insuficiente no cartão. Verifique sua conta bancária.';
            } else if (error.message.includes('Your card has expired')) {
              errorMessage = 'Seu cartão expirou. Use um cartão válido.';
            } else if (error.message.includes('Invalid card number')) {
              errorMessage = 'Número do cartão inválido. Verifique os dados inseridos.';
            } else if (error.message.includes('Incorrect CVC')) {
              errorMessage = 'Código de segurança (CVC) incorreto.';
            } else {
              errorMessage = 'Erro ao processar o pagamento. Tente novamente.';
            }
            break;
          default:
            errorMessage = 'Erro ao processar o pagamento. Tente novamente.';
        }
        
        Alert.alert('Erro no Pagamento', errorMessage);
      } else {
        setShowSuccessModal(true);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir o pagamento. Tente novamente.');
    }
  };

  const handleSubscribe = async (plan: StripeProduct) => {
    // Evitar múltiplos cliques
    if (processingPlan) return;
    
    // Verificar se é um plano gratuito
    if (plan.value === 0) {
      Alert.alert(
        'Plano Gratuito',
        'Este é um plano gratuito. Você pode começar a usar agora mesmo!',
        [
          {
            text: 'OK',
            onPress: () => router.push('/')
          }
        ]
      );
      return;
    }

    setProcessingPlan(plan.id);
    
    try {
      // Obter dados do usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
      
      const success = await initializePaymentSheet(plan, userName);
      
      if (success) {
        // Aguardar um pouco para garantir que o loading foi setado
        await new Promise(resolve => setTimeout(resolve, 1000));
        await openPaymentSheet();
      } else {
        Alert.alert('Erro', 'Não foi possível inicializar o pagamento. Tente novamente.');
      }
    } catch (error: any) {
      let errorMessage = 'Não foi possível processar o pagamento. Tente novamente.';
      
      // Tratar erros específicos
      if (error.message) {
        if (error.message.includes('Network request failed')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
        } else if (error.message.includes('STRIPE_SECRET_KEY')) {
          errorMessage = 'Erro de configuração do pagamento. Entre em contato com o suporte.';
        } else if (error.message.includes('customer')) {
          errorMessage = 'Erro ao criar conta de pagamento. Tente novamente.';
        } else if (error.message.includes('payment intent')) {
          errorMessage = 'Erro ao processar pagamento. Verifique seus dados e tente novamente.';
        }
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setProcessingPlan(null);
    }
  };

  const formatPrice = (value: number, currency: string) => {
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });
    return formatter.format(value / 100); // Stripe usa centavos
  };

  const renderPlanCard = (plan: StripeProduct) => (
    <View
      key={plan.id}
      style={[
        styles.planCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }
      ]}
    >
      {/* Header */}
      <View style={styles.planHeader}>
        <View style={[styles.planIcon, { backgroundColor: '#F59E0B' + '20' }]}>
          <Ionicons name="diamond" size={24} color="#F59E0B" />
        </View>
        <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
        <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
          {plan.description}
        </Text>
      </View>

      {/* Price */}
      <View style={styles.priceContainer}>
        <Text style={[styles.price, { color: '#F59E0B' }]}>
          {formatPrice(plan.value, plan.currency)}
        </Text>
        <Text style={[styles.period, { color: colors.textSecondary }]}>/mês</Text>
      </View>

      {/* Button */}
      <TouchableOpacity
        style={[
          styles.subscribeButton,
          {
            backgroundColor: '#F59E0B',
            opacity: processingPlan === plan.id ? 0.7 : 1,
          }
        ]}
        onPress={() => handleSubscribe(plan)}
        disabled={processingPlan === plan.id}
      >
        {processingPlan === plan.id ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>Assinar</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Modal de Sucesso */}
        {showSuccessModal && (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={80} color="#10B981" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Parabéns! 🎉
              </Text>
              <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
                Seu pagamento foi processado com sucesso!{'\n'}
                Bem-vindo ao plano Premium!
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.back();
                }}
              >
                <Text style={styles.modalButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Header */}
        <View style={[styles.header, { 
          backgroundColor: colors.surface, 
          borderBottomColor: colors.border,
          paddingTop: insets.top + 20
        }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Planos e Pagamentos</Text>
            <View style={styles.placeholder} />
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={[styles.loadingText, { color: colors.text }]}>
                Carregando planos...
              </Text>
            </View>
          ) : (
            <>
              {/* Hero Section */}
              <View style={styles.heroSection}>
                <Text style={[styles.heroTitle, { color: colors.text }]}>
                  Seja Premium
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                  Gerencie eventos, finanças e colaboradores com facilidade
                </Text>
              </View>


              {/* Plans Grid */}
              <View style={styles.plansContainer}>
                {plans && plans.length > 0 ? (
                  plans.map(renderPlanCard)
                ) : (
                  <View style={styles.noPlansContainer}>
                    <Text style={[styles.noPlansText, { color: colors.textSecondary }]}>
                      Nenhum plano disponível no momento.
                    </Text>
                  </View>
                )}
              </View>

              {/* Comparison Table */}
              <View style={[styles.comparisonSection, { backgroundColor: colors.surface }]}>
                <Text style={[styles.comparisonTitle, { color: colors.text }]}>
                  Comparação de Planos
                </Text>
                
                <View style={styles.comparisonTable}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>
                      Funcionalidade
                    </Text>
                    <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>
                      Free
                    </Text>
                    <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>
                      Premium
                    </Text>
                  </View>

                  {[
                    { feature: 'Usuários', free: '1', premium: 'Ilimitado' },
                    { feature: 'Eventos', free: 'Básicos', premium: 'Completos' },
                    { feature: 'Finanças', free: '❌', premium: '✅' },
                    { feature: 'Relatórios', free: '❌', premium: '✅' },
                    { feature: 'Suporte', free: '❌', premium: '✅' },
                    { feature: 'Exportação', free: '❌', premium: '✅' },
                    { feature: 'Colaboradores', free: '❌', premium: '✅' },
                    { feature: 'Agenda Compartilhada', free: '❌', premium: '✅' }
                  ].map((row, index) => (
                    <View key={index} style={[
                      styles.tableRow,
                      { borderBottomColor: colors.border }
                    ]}>
                      <Text style={[styles.tableCell, { color: colors.text }]}>
                        {row.feature}
                      </Text>
                      <Text style={[styles.tableCell, { color: colors.textSecondary }]}>
                        {row.free}
                      </Text>
                      <Text style={[styles.tableCell, { color: colors.textSecondary }]}>
                        {row.premium}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    color: '#666',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  plansContainer: {
    gap: 16,
    marginBottom: 32,
  },
  noPlansContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noPlansText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 16,
  },
  price: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  period: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  subscribeButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  comparisonSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comparisonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  comparisonTable: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
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
    padding: 32,
    marginHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    maxWidth: 320,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
