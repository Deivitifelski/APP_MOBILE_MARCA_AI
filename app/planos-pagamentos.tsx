import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  color: string;
  badge?: string;
  features: string[];
  limitations: string[];
  buttonText: string;
  popular?: boolean;
  premium?: boolean;
}

export default function PlanosPagamentosScreen() {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const plans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 'R$ 0',
      period: '/mês',
      description: 'Perfeito para começar',
      color: '#6B7280',
      features: [
        '1 usuário',
        'Criação de eventos básicos',
        'Tags: ensaio, reunião, show',
        'Agenda simples',
        'Notificações básicas'
      ],
      limitations: [
        'Sem acesso a finanças',
        'Sem relatórios avançados',
        'Sem suporte prioritário'
      ],
      buttonText: 'Começar Grátis'
    },
    {
      id: 'basico',
      name: 'Básico',
      price: 'R$ 4,90',
      period: '/mês',
      description: 'Para bandas em crescimento',
      color: '#3B82F6',
      badge: 'Mais Popular',
      popular: true,
      features: [
        'Até 4 usuários',
        'Gerenciamento completo de eventos',
        'Acesso parcial a finanças',
        'Relatórios simples',
        'Suporte por e-mail',
        'Exportação básica'
      ],
      limitations: [
        'Limitado a 4 usuários',
        'Relatórios básicos'
      ],
      buttonText: 'Assinar Básico'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 'R$ 9,90',
      period: '/mês',
      description: 'Para bandas profissionais',
      color: '#F59E0B',
      badge: 'Premium',
      premium: true,
      features: [
        'Usuários ilimitados',
        'Agenda compartilhada completa',
        'Acesso total às finanças',
        'Relatórios avançados',
        'Exportação CSV/Excel',
        'Suporte prioritário + chat',
        'Divisão de custos entre membros'
      ],
      limitations: [],
      buttonText: 'Assinar Pro'
    }
  ];

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlan(planId);
    setIsLoading(true);

    // Simular processamento
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert(
        'Plano Selecionado',
        `Você selecionou o plano ${plans.find(p => p.id === planId)?.name}. Em breve implementaremos o sistema de pagamento!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedPlan(null);
              router.back();
            }
          }
        ]
      );
    }, 1500);
  };

  const renderPlanCard = (plan: Plan) => (
    <View
      key={plan.id}
      style={[
        styles.planCard,
        {
          backgroundColor: colors.surface,
          borderColor: plan.popular ? plan.color : colors.border,
          borderWidth: plan.popular ? 2 : 1,
          transform: plan.popular ? [{ scale: 1.02 }] : [{ scale: 1 }],
        }
      ]}
    >
      {/* Badge */}
      {plan.badge && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: plan.color,
              top: plan.popular ? -12 : -8,
            }
          ]}
        >
          <Text style={styles.badgeText}>{plan.badge}</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.planHeader}>
        <View style={[styles.planIcon, { backgroundColor: plan.color + '20' }]}>
          <Ionicons
            name={
              plan.id === 'free' ? 'gift' :
              plan.id === 'basico' ? 'star' : 'diamond'
            }
            size={32}
            color={plan.color}
          />
        </View>
        <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
        <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
          {plan.description}
        </Text>
      </View>

      {/* Price */}
      <View style={styles.priceContainer}>
        <Text style={[styles.price, { color: plan.color }]}>{plan.price}</Text>
        <Text style={[styles.period, { color: colors.textSecondary }]}>{plan.period}</Text>
      </View>

      {/* Features */}
      <View style={styles.featuresContainer}>
        <Text style={[styles.featuresTitle, { color: colors.text }]}>Inclui:</Text>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
          </View>
        ))}
      </View>

      {/* Limitations */}
      {plan.limitations.length > 0 && (
        <View style={styles.limitationsContainer}>
          <Text style={[styles.limitationsTitle, { color: colors.textSecondary }]}>Limitações:</Text>
          {plan.limitations.map((limitation, index) => (
            <View key={index} style={styles.limitationItem}>
              <Ionicons name="close-circle" size={16} color="#EF4444" />
              <Text style={[styles.limitationText, { color: colors.textSecondary }]}>
                {limitation}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Button */}
      <TouchableOpacity
        style={[
          styles.selectButton,
          {
            backgroundColor: plan.color,
            opacity: selectedPlan === plan.id ? 0.7 : 1,
          }
        ]}
        onPress={() => handleSelectPlan(plan.id)}
        disabled={isLoading}
      >
        {isLoading && selectedPlan === plan.id ? (
          <Text style={styles.buttonText}>Processando...</Text>
        ) : (
          <Text style={styles.buttonText}>{plan.buttonText}</Text>
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
            {plans.map(renderPlanCard)}
          </View>

          {/* Comparison Table */}
          <View style={[styles.comparisonSection, { backgroundColor: colors.surface }]}>
            <Text style={[styles.comparisonTitle, { color: colors.text }]}>
              Comparação de Funcionalidades
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
                  Básico
                </Text>
                <Text style={[styles.tableHeaderText, { color: colors.textSecondary }]}>
                  Pro
                </Text>
              </View>

              {[
                { feature: 'Usuários', free: '1', basico: '4', pro: 'Ilimitado' },
                { feature: 'Eventos', free: 'Básicos', basico: 'Completos', pro: 'Completos' },
                { feature: 'Finanças', free: '❌', basico: 'Parcial', pro: 'Completo' },
                { feature: 'Relatórios', free: '❌', basico: 'Simples', pro: 'Avançados' },
                { feature: 'Suporte', free: '❌', basico: 'E-mail', pro: 'Prioritário' },
                { feature: 'Exportação', free: '❌', basico: 'Básica', pro: 'CSV/Excel' }
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
                    {row.basico}
                  </Text>
                  <Text style={[styles.tableCell, { color: colors.textSecondary }]}>
                    {row.pro}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* FAQ Section */}
          <View style={styles.faqSection}>
            <Text style={[styles.faqTitle, { color: colors.text }]}>
              Perguntas Frequentes
            </Text>
            
            {[
              {
                question: 'Posso mudar de plano a qualquer momento?',
                answer: 'Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento.'
              },
              {
                question: 'O que acontece se eu cancelar?',
                answer: 'Você mantém acesso às funcionalidades até o final do período pago.'
              },
              {
                question: 'Há período de teste?',
                answer: 'Sim! Todos os planos têm 7 dias de teste gratuito.'
              }
            ].map((faq, index) => (
              <View key={index} style={[styles.faqItem, { backgroundColor: colors.surface }]}>
                <Text style={[styles.faqQuestion, { color: colors.text }]}>
                  {faq.question}
                </Text>
                <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                  {faq.answer}
                </Text>
              </View>
            ))}
          </View>
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
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -12,
    left: '50%',
    marginLeft: -50,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 1,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
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
  featuresContainer: {
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  limitationsContainer: {
    marginBottom: 20,
  },
  limitationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  limitationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  limitationText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  selectButton: {
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
  faqSection: {
    marginBottom: 32,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
