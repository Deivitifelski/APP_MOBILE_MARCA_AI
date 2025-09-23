import { Ionicons } from '@expo/vector-icons';
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
        console.error('Erro ao buscar planos:', error);
        Alert.alert('Erro', 'Não foi possível carregar os planos. Tente novamente.');
        setPlans([]); // Garante que plans seja sempre um array
        return;
      }

      if (data && Array.isArray(data)) {
        setPlans(data);
      } else {
        setPlans([]); // Se data não for um array, inicializa como vazio
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
      setPlans([]); // Garante que plans seja sempre um array
    } finally {
      setIsLoading(false);
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
        <View style={[styles.planIcon, { backgroundColor: '#3B82F6' + '20' }]}>
          <Ionicons name="star" size={32} color="#3B82F6" />
        </View>
        <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
        <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
          {plan.description}
        </Text>
      </View>

      {/* Price */}
      <View style={styles.priceContainer}>
        <Text style={[styles.price, { color: '#3B82F6' }]}>
          {formatPrice(plan.value, plan.currency)}
        </Text>
        <Text style={[styles.period, { color: colors.textSecondary }]}>/mês</Text>
      </View>

      {/* Button */}
      <TouchableOpacity
        style={[
          styles.subscribeButton,
          {
            backgroundColor: '#3B82F6',
            opacity: selectedPlan === plan.id ? 0.7 : 1,
          }
        ]}
        onPress={() => {}}
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
});
