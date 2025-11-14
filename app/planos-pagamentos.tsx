import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface Plan {
  id: string;
  name: string;
  description: string;
  value: number;
  currency: string;
  features: string[];
  limitations?: string[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Plano Gratuito',
    description: 'Para começar a usar o app',
    value: 0,
    currency: 'BRL',
    features: [
      '1 usuário',
      'Eventos básicos',
      'Agenda simples',
      'Notificações básicas',
    ],
    limitations: [
      'Sem acesso a finanças',
      'Sem relatórios avançados',
      'Sem suporte prioritário',
    ],
  },
  {
    id: 'premium',
    name: 'Plano Premium',
    description: 'Acesso total a todos os recursos',
    value: 999,
    currency: 'BRL',
    features: [
      'Usuários ilimitados',
      'Eventos completos',
      'Finanças completas',
      'Relatórios avançados',
      'Exportação PDF',
      'Suporte prioritário',
      'Colaboradores ilimitados',
      'Agenda compartilhada',
    ],
  },
];

export default function PlanosPagamentosScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handlePlanInfo = (plan: Plan) => {
    if (plan.value === 0) {
      Alert.alert(
        'Plano Gratuito',
        'Você já está usando o plano gratuito! Experimente o Premium para ter acesso a todos os recursos.',
        [{ text: 'OK' }]
      );
    } else {
      // Detectar plataforma e mostrar instruções específicas
      const isIOS = Platform.OS === 'ios';
      const isAndroid = Platform.OS === 'android';
      
      let title = 'Como Assinar o Plano Premium';
      let message = '';
      
      if (isIOS) {
        message = `📱 Para assinar no iPhone/iPad:\n\n` +
          `1. Abra a App Store\n` +
          `2. Toque no seu perfil (canto superior direito)\n` +
          `3. Toque em "Assinaturas"\n` +
          `4. Procure por "MarcaAi"\n` +
          `5. Selecione o plano Premium\n` +
          `6. Confirme com Face ID/Touch ID\n\n` +
          `💳 Será cobrado R$ 9,99/mês na sua conta da Apple.`;
      } else if (isAndroid) {
        message = `📱 Para assinar no Android:\n\n` +
          `1. Abra o Google Play Store\n` +
          `2. Toque no ícone de perfil\n` +
          `3. Toque em "Pagamentos e assinaturas"\n` +
          `4. Toque em "Assinaturas"\n` +
          `5. Procure por "MarcaAi"\n` +
          `6. Selecione o plano Premium\n` +
          `7. Confirme o pagamento\n\n` +
          `💳 Será cobrado R$ 9,99/mês na sua conta do Google.`;
      } else {
        // Web ou outra plataforma
        message = `As assinaturas premium estarão disponíveis em breve através das lojas de aplicativos (App Store e Google Play).\n\n` +
          `Por favor, acesse o aplicativo no seu dispositivo móvel para assinar.`;
      }
      
      Alert.alert(title, message, [
        { text: 'Entendi', style: 'default' }
      ]);
    }
  };

  const formatPrice = (value: number, currency: string) => {
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
    });
    return formatter.format(value / 100);
  };

  const renderPlanCard = (plan: Plan) => (
    <View
      key={plan.id}
      style={[
        styles.planCard,
        {
          backgroundColor: colors.surface,
          borderColor: plan.id === 'premium' ? '#F59E0B' : colors.border,
          borderWidth: plan.id === 'premium' ? 2 : 1,
        }
      ]}
    >
      {/* Badge Premium */}
      {plan.id === 'premium' && (
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>RECOMENDADO</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.planHeader}>
        <View style={[
          styles.planIcon, 
          { backgroundColor: plan.id === 'premium' ? '#F59E0B' + '20' : '#6B7280' + '20' }
        ]}>
          <Ionicons 
            name={plan.id === 'premium' ? 'diamond' : 'gift'} 
            size={24} 
            color={plan.id === 'premium' ? '#F59E0B' : '#6B7280'} 
          />
        </View>
        <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
        <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
          {plan.description}
        </Text>
      </View>

      {/* Price */}
      <View style={styles.priceContainer}>
        <Text style={[
          styles.price, 
          { color: plan.id === 'premium' ? '#F59E0B' : '#6B7280' }
        ]}>
          {formatPrice(plan.value, plan.currency)}
        </Text>
        <Text style={[styles.period, { color: colors.textSecondary }]}>/mês</Text>
      </View>

      {/* Features */}
      <View style={styles.featuresContainer}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
          </View>
        ))}
        
        {plan.limitations && plan.limitations.map((limitation, index) => (
          <View key={`limit-${index}`} style={styles.featureRow}>
            <Ionicons name="close-circle" size={20} color="#EF4444" />
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>{limitation}</Text>
          </View>
        ))}
      </View>

      {/* Button */}
      <TouchableOpacity
        style={[
          styles.subscribeButton,
          {
            backgroundColor: plan.id === 'premium' ? '#F59E0B' : '#6B7280',
          }
        ]}
        onPress={() => handlePlanInfo(plan)}
      >
        <Text style={styles.buttonText}>
          {plan.id === 'premium' ? 'Assinar' : 'Plano Atual'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: 12 }] }>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Planos e Pagamentos</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Seja Premium
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Gerencie eventos, finanças e colaboradores com facilidade
            </Text>
          </View>

          {/* Plans Grid */}
          <View style={styles.plansContainer}>
            {PLANS.map(renderPlanCard)}
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              Toque em Assinar para ver as instruções de como assinar através da {Platform.OS === 'ios' ? 'App Store' : Platform.OS === 'android' ? 'Google Play Store' : 'loja do seu dispositivo'}.
            </Text>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
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
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  plansContainer: {
    gap: 12,
    marginBottom: 24,
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
    elevation: 2,
    position: 'relative',
  },
  premiumBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  planDescription: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 14,
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
  featuresContainer: {
    gap: 10,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 13,
    flex: 1,
  },
  subscribeButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  comparisonSection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
    paddingVertical: 10,
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    textAlign: 'center',
  },
});
