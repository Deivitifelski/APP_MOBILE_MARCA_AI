import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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


interface StripeProduct {
  id: string;
  name: string;
  description: string;
  value: number;
  currency: string;
  default_price: string;
}


export default function PlanosPagamentosScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [plans, setPlans] = useState<StripeProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
          } catch {
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
    } catch {
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPaymentSheetParams = async (plan: StripeProduct) => {
    try {
      console.log('🔍 [create-payment-intent] Enviando requisição...');

      // Obter dados do usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || '';
      const userEmail = user?.email || '';
      const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';

      const requestBody = {
        userId: userId,
        email: userEmail,
        name: userName,
        priceId: plan.default_price,
        forceProduction: true,
      };
      console.log('🔍 [create-payment-intent] Request Body:', requestBody);

      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: requestBody
      });
         
      if (error) {
        console.error('❌ [create-payment-intent] Erro:', error);
        if (error.message.includes('non-2xx status code')) {
          throw new Error('Erro no servidor: A função do Supabase retornou um erro. Verifique se a função "create-payment-intent" está deployada e funcionando.');
        } else if (error.message.includes('Network request failed')) {
          throw new Error('Erro de conexão: Verifique sua internet e tente novamente.');
        } else {
          throw new Error(`Erro na função Supabase: ${error.message}`);
        }
      }

      if (!data) {
        throw new Error('A função do Supabase não retornou dados. Verifique se a função está funcionando corretamente.');
      }

      // Parse da resposta se vier como string JSON
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
        } catch {
          throw new Error('Erro ao processar resposta do servidor');
        }
      }

      if (parsedData && parsedData.error) {
        throw new Error(`Erro: ${parsedData.error}`);
      }

      const result = {
        setupIntent: parsedData.setupIntent,
        ephemeralKey: parsedData.ephemeralKey,
        customer: parsedData.customer,
        chaveStripe: parsedData.chaveStripe,
      };

      // Validação específica para a estrutura esperada
      if (!result.setupIntent || !result.ephemeralKey || !result.customer) {
        throw new Error('Dados do Stripe incompletos - campos obrigatórios ausentes');
      }

      return result;

    } catch (error) {
      console.error('💥 [fetchPaymentSheetParams] Erro geral:', error);
      throw error;
    }
  };


  // Chamada para ativar a assinatura no Stripe
const activateSubscription = async () => {
  try {
    console.log('🔍 [activate-subscription] Enviando requisição...');
    
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
      throw new Error("Usuário não autenticado.");
    }

    const { data, error } = await supabase.functions.invoke('activate-subscription', {
      body: { userId: userId , forceProduction: true}
    });

    console.log('📥 [activate-subscription] Resposta:', { data, error });

    if (error) {
      console.error('❌ [activate-subscription] Erro:', error);
      throw new Error(`Erro na função Supabase: ${error.message}`);
    }

    const parsedData = (typeof data === 'string') ? JSON.parse(data) : data;

    if (parsedData.status === "success") {
      console.log('✅ [activate-subscription] Assinatura ativada com sucesso!');
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('❌ [activateSubscription] Erro:', error);
    return false;
  }
};

  const initializePaymentSheet = async (plan: StripeProduct, userName: string, retryCount = 0) => {
    try {
      console.log('🔍 [create-payment-intent] Enviando requisição...');

      const {
        setupIntent,
        ephemeralKey,
        customer,
      } = await fetchPaymentSheetParams(plan);

      const paymentSheetConfig = {
        merchantDisplayName: "MarcaAi - Agenda & Finanças",
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        setupIntentClientSecret: setupIntent, 
        allowsDelayedPaymentMethods: true,
        allowsCreditCardPayments: true,
        allowsApplePay: true,
        allowsGooglePay: true,
        applePay: {
          merchantId: "merchant.com.marcaai.app",
          merchantCountryCode: "BR",
        },
        googlePay: {
          merchantId: "merchant.com.marcaai.app",
          merchantCountryCode: "BR",
        },
        defaultBillingDetails: {
          name: userName,
          address: {
            country: 'BR',
          },
        },
        // Configuração de localização para português brasileiro
        locale: "pt-BR",
        // Personalizar texto do botão principal
        primaryButtonLabel: "Assinar Premium",
        // Adicionar returnURL para iOS
        returnURL: "marcaai://stripe-redirect",
        
      };

      // Log detalhado da configuração antes de enviar para o Stripe
      console.log('🔍 [create-payment-intent] Configuração enviada para Stripe:', {
        setupIntentClientSecret: setupIntent,
        setupIntentLength: setupIntent?.length,
        hasSecret: setupIntent,
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        ephemeralKeyLength: ephemeralKey?.length
      });

      const { error } = await initPaymentSheet(paymentSheetConfig);
  

      if (!error) {
        console.log('✅ [create-payment-intent] PaymentSheet inicializado com sucesso');
        return true;
      } else {
        console.error('❌ [create-payment-intent] Erro:', error);
        
        // Verificar se é erro de Setup Intent expirado
        if (error.message && error.message.includes('setupintent')) {
          console.log('🔄 [create-payment-intent] Setup Intent com problema, criando novo...');
          console.log('🔍 [create-payment-intent] Erro detalhado:', {
            message: error.message,
            stripeErrorCode: error.stripeErrorCode,
            type: error.type,
            isResourceMissing: error.stripeErrorCode === 'resource_missing'
          });
          
          // Se for erro de resource_missing em produção, aguardar mais tempo
          if (error.stripeErrorCode === 'resource_missing') {
            console.log('⚠️ [create-payment-intent] Erro resource_missing em produção - aguardando mais tempo...');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          
          // Retry com novo Setup Intent (máximo 2 tentativas)
          if (retryCount < 2) {
            console.log(`🔄 [create-payment-intent] Tentativa ${retryCount + 1}/2`);
            // Aguardar mais tempo entre tentativas
            await new Promise(resolve => setTimeout(resolve, 2000));
            return await initializePaymentSheet(plan, userName, retryCount + 1);
          } else {
            console.error('❌ [create-payment-intent] Máximo de tentativas atingido');
            return false;
          }
        }
        
        return false;
      }
    } catch (error) {
      console.error('💥 [create-payment-intent] Erro geral:', error);
      return false;
    }
  };







/** Abre o sheet de pagamento */
  const openPaymentSheet = async () => {
    try {
      console.log('🔍 [presentPaymentSheet] Enviando requisição...');
      const { error } = await presentPaymentSheet();

      if (error) {
        // Verificar se é erro de Setup Intent expirado
        console.log('🔍 [presentPaymentSheet] Erro:', error);
        if (error.message && error.message.includes('setupintent')) {
          console.log('🔄 [presentPaymentSheet] Setup Intent expirado, criando nova sessão...');
          Alert.alert(
            'Sessão Expirada', 
            'A sessão de pagamento expirou. Vamos criar uma nova sessão.',
            [
              {
                text: 'Tentar Novamente',
                onPress: async () => {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
                    
                    const success = await initializePaymentSheet(plans[0], userName);
                    if (success) {
                      await openPaymentSheet();
                    } else {
                      Alert.alert('Erro', 'Não foi possível recriar a sessão de pagamento.');
                    }
                  } catch (retryError) {
                    console.error('❌ [presentPaymentSheet] Erro no retry:', retryError);
                    Alert.alert('Erro', 'Não foi possível recriar a sessão de pagamento.');
                  }
                }
              }
            ]
          );
          return;
        }
        
        // Converter erros comuns do Stripe para português
        let errorMessage = error.message;
        
        switch (error.code) {
          case 'Canceled':
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
        console.log('✅ [presentPaymentSheet] Pagamento processado com sucesso!');
        
        const subscriptionActivated = await activateSubscription();
        
        if (subscriptionActivated) {
          console.log('✅ [presentPaymentSheet] Assinatura ativada com sucesso!');
          setShowSuccessModal(true);
        } else {
          Alert.alert(
            'Atenção', 
            'Pagamento processado, mas houve um problema ao ativar sua assinatura. Entre em contato com o suporte.'
          );
        }
      }
    } catch (error) {
      console.error('💥 [presentPaymentSheet] Erro geral:', error);
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
        await new Promise(resolve => setTimeout(resolve, 500));
        await openPaymentSheet(); // Abre o sheet de pagamento
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
        } else if (error.message.includes('setupintent')) {
          errorMessage = 'Erro na sessão de pagamento. Tente novamente.';
        } else if (error.message.includes('Setup Intent inválido')) {
          errorMessage = 'Erro na configuração do pagamento. Tente novamente.';
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
