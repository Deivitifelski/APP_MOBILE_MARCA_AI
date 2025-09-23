import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
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
  const [plans, setPlans] = useState<StripeProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

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

  const handleSubscribe = async (plan: StripeProduct) => {
    setSelectedPlan(plan.id);
    setIsSubscribing(true);

    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout-session', {
        body: { 
          productId: plan.id,
          productName: plan.name,
          amount: plan.value,
          currency: plan.currency
        }
      });

      if (error) {
        console.error('Erro ao criar sessão de pagamento:', error);
        Alert.alert(
          'Erro',
          'Ocorreu um erro ao processar o pagamento. Tente novamente.',
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedPlan(null);
                setIsSubscribing(false);
              }
            }
          ]
        );
        return;
      }

      if (data && data.url) {
        const canOpen = await Linking.canOpenURL(data.url);
        if (canOpen) {
          await Linking.openURL(data.url);
        } else {
          Alert.alert(
            'Erro',
            'Não foi possível abrir o link de pagamento.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setSelectedPlan(null);
                  setIsSubscribing(false);
                }
              }
            ]
          );
        }
      } else {
        Alert.alert(
          'Erro',
          'Resposta inválida do servidor.',
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedPlan(null);
                setIsSubscribing(false);
              }
            }
          ]
        );
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
      Alert.alert(
        'Erro',
        'Ocorreu um erro inesperado. Tente novamente.',
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedPlan(null);
              setIsSubscribing(false);
            }
          }
        ]
      );
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
                  Escolha o plano ideal para sua banda
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
});
