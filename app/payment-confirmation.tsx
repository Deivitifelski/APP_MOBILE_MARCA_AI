import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

export default function PaymentConfirmationScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  const {
    subscriptionId,
    customerId,
    planName,
    planValue,
    planCurrency,
    clientSecret,
    hasClientSecret
  } = params;

  const [isProcessing, setIsProcessing] = useState(false);

  const formatPrice = (value: string, currency: string) => {
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });
    return formatter.format(Number(value) / 100);
  };

  // Automaticamente abrir checkout do Stripe quando tiver clientSecret
  useEffect(() => {
    if (hasClientSecret === 'true' && clientSecret) {
      openStripeCheckout();
    }
  }, [clientSecret, hasClientSecret]);

  const openStripeCheckout = async () => {
    setIsProcessing(true);
    
    try {
      console.log('Criando checkout do Stripe...');
      console.log('Parâmetros:', { subscriptionId, customerId, planName, planValue, planCurrency });
      
      // Simular checkout bem-sucedido (para demonstração)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simular sucesso direto
      Alert.alert(
        '✅ Checkout Simulado!',
        `Demonstração: O checkout do Stripe seria aberto aqui para o plano ${planName}.\n\nSubscription: ${subscriptionId}\nCustomer: ${customerId}`,
        [
          {
            text: 'Ir para Configurações',
            onPress: () => router.push('/(tabs)/configuracoes')
          }
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message || 'Erro ao abrir checkout do Stripe.',
        [
          {
            text: 'Tentar Novamente',
            onPress: () => openStripeCheckout()
          },
          {
            text: 'Voltar',
            onPress: () => router.back()
          }
        ]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (hasClientSecret === 'true') {
      // Abrir checkout do Stripe
      await openStripeCheckout();
    } else {
      // Se não há clientSecret, assinatura já está ativa
      Alert.alert(
        '🎉 Assinatura Ativa!',
        'Sua assinatura foi ativada com sucesso!',
        [
          {
            text: 'Ir para Configurações',
            onPress: () => router.push('/(tabs)/configuracoes')
          }
        ]
      );
    }
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
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Confirmação de Pagamento</Text>
            <View style={styles.placeholder} />
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Success Icon */}
          <View style={styles.successSection}>
            <View style={[styles.successIcon, { backgroundColor: '#10B981' + '20' }]}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>
              Assinatura Criada!
            </Text>
            <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
              {hasClientSecret === 'true' 
                ? 'Agora complete o pagamento para ativar sua assinatura'
                : 'Sua assinatura foi ativada com sucesso!'
              }
            </Text>
          </View>

          {/* Plan Details */}
          <View style={[styles.planDetails, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Detalhes do Plano</Text>
            
            <View style={styles.planRow}>
              <View style={[styles.planIcon, { backgroundColor: '#F59E0B' + '20' }]}>
                <Ionicons name="diamond" size={24} color="#F59E0B" />
              </View>
              <View style={styles.planInfo}>
                <Text style={[styles.planName, { color: colors.text }]}>{planName}</Text>
                <Text style={[styles.planPrice, { color: '#F59E0B' }]}>
                  {formatPrice(planValue as string, planCurrency as string)}/mês
                </Text>
              </View>
            </View>
          </View>

          {/* Subscription Details */}
          <View style={[styles.subscriptionDetails, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Informações da Assinatura</Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Subscription ID:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{subscriptionId}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Customer ID:</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{customerId}</Text>
            </View>
            
            {hasClientSecret === 'true' && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status:</Text>
                <Text style={[styles.statusPending, { color: '#F59E0B' }]}>Aguardando Pagamento</Text>
              </View>
            )}
            
            {hasClientSecret !== 'true' && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Status:</Text>
                <Text style={[styles.statusActive, { color: '#10B981' }]}>✅ Ativa</Text>
              </View>
            )}
          </View>

              {/* Loading overlay quando processando */}
              {isProcessing && (
                <View style={[styles.loadingOverlay, { backgroundColor: colors.background + 'CC' }]}>
                  <ActivityIndicator size="large" color="#F59E0B" />
                  <Text style={[styles.loadingText, { color: colors.text }]}>
                    Abrindo checkout do Stripe...
                  </Text>
                </View>
              )}

              {/* Action Button */}
              <TouchableOpacity
                style={[styles.actionButton, { 
                  backgroundColor: hasClientSecret === 'true' ? '#F59E0B' : '#10B981'
                }]}
                onPress={handleConfirmPayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons 
                      name={hasClientSecret === 'true' ? "card" : "checkmark-circle"} 
                      size={20} 
                      color="#fff" 
                    />
                    <Text style={styles.actionButtonText}>
                      {hasClientSecret === 'true' ? 'Abrir Checkout Stripe' : 'Ir para Configurações'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Additional Info */}
              {hasClientSecret === 'true' && (
                <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="information-circle" size={20} color="#3B82F6" />
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    Você será redirecionado para o checkout oficial e seguro do Stripe para finalizar o pagamento.
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 30,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  planDetails: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subscriptionDetails: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  statusPending: {
    fontSize: 14,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  statusActive: {
    fontSize: 14,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
});
