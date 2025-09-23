import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
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
  default_price: string;
}


export default function PlanosPagamentosScreen() {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<StripeProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<StripeProduct | null>(null);
  // Não precisamos mais do formulário de pagamento
  const [paymentError, setPaymentError] = useState<string | null>(null);

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

  const handleSubscribe = (plan: StripeProduct) => {
    setSelectedPlanForPayment(plan);
    setShowPaymentModal(true);
    setPaymentError(null);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedPlanForPayment) return;

    // Não há validações necessárias - só precisamos do plano selecionado

    setIsSubscribing(true);
    setPaymentError(null);

    try {
      // 1. Verificar configuração do Supabase
      console.log('Supabase configurado:', !!supabase);

      // 2. Obter usuário autenticado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // 3. Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('Usuário autenticado:', user.id);
      console.log('Token presente:', !!session?.access_token);

      // 4. Criar assinatura no Supabase
      console.log('=== DEBUG DETALHADO ===');
      console.log('priceId enviado:', selectedPlanForPayment.id);
      console.log('userId enviado:', user.id);
      console.log('Exemplo que funciona:', 'price_1S94AlFP5oK5C2EuKtuowWZt');
      console.log('Comparação priceId:', selectedPlanForPayment.id === 'price_1S94AlFP5oK5C2EuKtuowWZt');
      console.log('Token de autenticação:', session?.access_token?.substring(0, 20) + '...');
      console.log('========================');

      // Usar fetch direto como no teste do Supabase
      const supabaseUrl = 'https://ctulmpyaikxsnjqmrzxf.supabase.co';
      const functionUrl = `${supabaseUrl}/functions/v1/create-subscription`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dWxtcHlhaWt4c25qcW1yenhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDc4MzIxNjUsImV4cCI6MjAyMzQwODE2NX0.xeDf7zJKk8lFbWdShCIjNdOFJwqPePALHcWcBjRvKj8'
        },
        body: JSON.stringify({
          priceId: selectedPlanForPayment.default_price,
          userId: user.id
        })
      });

      let data, error;
      if (response.ok) {
        data = await response.json();
        error = null;
      } else {
        const errorText = await response.text();
        console.log('Erro do Supabase (texto completo):', errorText);
        error = { 
          message: `HTTP ${response.status}: ${errorText}`,
          context: { status: response.status }
        };
        data = null;
      }

      console.log('Resposta da função:', { data, error });

      if (error) {
      
        // Log do status do erro
        console.error('Status do erro:', error.context?.status);
        
        // Para erro 400, mostrar detalhes específicos
        let errorMessage = error.message || `Erro ${error.context?.status || 'desconhecido'} ao criar assinatura`;
        
        if (error.context?.status === 400) {
          errorMessage = `Erro 400: Parâmetros inválidos. Verifique se priceId e userId estão corretos.`;
          console.error('Parâmetros enviados:', { 
            priceId: selectedPlanForPayment.id, 
            userId: user.id,
            priceIdType: typeof selectedPlanForPayment.id,
            userIdType: typeof user.id
          });
        }
        
        throw new Error(errorMessage);
      }

      const { subscriptionId, clientSecret, customer } = data;

      if (!subscriptionId) {
        throw new Error('Subscription ID não recebido');
      }

      // 2. Fechar modal
      setShowPaymentModal(false);

      // 3. Processar assinatura criada
      if (subscriptionId && customer) {
        // Se não há clientSecret, a assinatura foi criada com sucesso diretamente
        if (!clientSecret) {
          Alert.alert(
            '✅ Assinatura Criada!',
            `Sua assinatura do ${selectedPlanForPayment.name} foi criada com sucesso!\n\nSubscription ID: ${subscriptionId}\nCustomer ID: ${customer}`,
            [
              {
                text: 'OK',
                onPress: () => {
                  setSelectedPlanForPayment(null);
                  router.back();
                }
              }
            ]
          );
        } else {
          // Se há clientSecret, pode precisar de confirmação adicional
          Alert.alert(
            '⚠️ Confirmação Necessária',
            `Assinatura criada mas requer confirmação adicional.\n\nSubscription ID: ${subscriptionId}`,
            [
              {
                text: 'OK',
                onPress: () => {
                  setSelectedPlanForPayment(null);
                  router.back();
                }
              }
            ]
          );
        }
      } else {
        throw new Error('Dados da assinatura incompletos');
      }

    } catch (error: any) {
      console.error('Erro no pagamento:', error);
      setPaymentError(error.message || 'Erro ao processar pagamento. Tente novamente.');
      setShowPaymentModal(true); // Reabrir modal em caso de erro
    } finally {
      setIsSubscribing(false);
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
          <Ionicons name="diamond" size={32} color="#F59E0B" />
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
            opacity: selectedPlan === plan.id ? 0.7 : 1,
          }
        ]}
        onPress={() => handleSubscribe(plan)}
        disabled={isSubscribing}
      >
        {isSubscribing && selectedPlan === plan.id ? (
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

      {/* Modal de Pagamento */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setShowPaymentModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Criar Assinatura</Text>
            <View style={styles.modalPlaceholder} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {selectedPlanForPayment && (
              <View style={[styles.paymentPlanCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.paymentPlanHeader}>
                  <View style={[styles.paymentPlanIcon, { backgroundColor: '#F59E0B' + '20' }]}>
                    <Ionicons name="diamond" size={24} color="#F59E0B" />
                  </View>
                  <View style={styles.paymentPlanInfo}>
                    <Text style={[styles.paymentPlanName, { color: colors.text }]}>
                      {selectedPlanForPayment.name}
                    </Text>
                    <Text style={[styles.paymentPlanPrice, { color: '#F59E0B' }]}>
                      {formatPrice(selectedPlanForPayment.value, selectedPlanForPayment.currency)}/mês
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={[styles.paymentForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.paymentFormTitle, { color: colors.text }]}>Confirmar Assinatura</Text>
              
              {/* Informação sobre a assinatura */}
              <View style={[styles.infoContainer, { backgroundColor: colors.background }]}>
                <Ionicons name="information-circle" size={20} color="#3B82F6" />
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  Sua assinatura será criada automaticamente utilizando seus dados de usuário. Você receberá os detalhes da assinatura após a confirmação.
                </Text>
              </View>

              {/* Resumo do plano */}
              {selectedPlanForPayment && (
                <View style={[styles.summaryContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.summaryTitle, { color: colors.text }]}>Resumo da Assinatura</Text>
                  <Text style={[styles.summaryItem, { color: colors.textSecondary }]}>
                    Plano: {selectedPlanForPayment.name}
                  </Text>
                  <Text style={[styles.summaryItem, { color: colors.textSecondary }]}>
                    Valor: {formatPrice(selectedPlanForPayment.value, selectedPlanForPayment.currency)}/mês
                  </Text>
                  <Text style={[styles.summaryItem, { color: colors.textSecondary }]}>
                    Price ID: {selectedPlanForPayment.id}
                  </Text>
                </View>
              )}

              {/* Erro de Pagamento */}
              {paymentError && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#F44336" />
                  <Text style={styles.errorText}>{paymentError}</Text>
                </View>
              )}

              {/* Botão de Pagamento */}
              <TouchableOpacity
                style={[styles.paymentButton, { backgroundColor: '#F59E0B' }]}
                onPress={handlePaymentSubmit}
                disabled={isSubscribing}
              >
                {isSubscribing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.paymentButtonText}>
                      Criar Assinatura
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    gap: 20,
    marginBottom: 40,
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
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  planIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 24,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  period: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  subscribeButton: {
    paddingVertical: 16,
    borderRadius: 12,
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
  // Estilos do modal de pagamento
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  modalPlaceholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  paymentPlanCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  paymentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentPlanInfo: {
    flex: 1,
  },
  paymentPlanName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  paymentPlanPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  paymentForm: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  paymentFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  rowInputs: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EBF8FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  summaryContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryItem: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});