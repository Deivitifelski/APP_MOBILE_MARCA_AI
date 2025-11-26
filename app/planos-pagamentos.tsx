import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getRevenueCatKey } from '../config/revenuecat-keys';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

export default function PlanosPagamentosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    const inicializar = async () => {
      try {
        // Configurar RevenueCat
        const apiKey = getRevenueCatKey();
        console.log('🔄 [RevenueCat] Configurando com chave:', apiKey);
        
        await Purchases.configure({ apiKey });
        console.log('✅ [RevenueCat] Configurado com sucesso');

        // Buscar ofertas
        await buscarOfertas();
      } catch (error: any) {
        console.error('❌ [RevenueCat] Erro ao inicializar:', error);
        setLoading(false);
      }
    };

    inicializar();
  }, []);

  // Função para buscar ofertas
  const buscarOfertas = async () => {
    try {
      console.log('🔍 [buscarOfertas] Buscando ofertas...');
      
      const offerings = await Purchases.getOfferings();
      console.log('📦 [buscarOfertas] Offerings recebidos:', {
        current: offerings.current ? 'existe' : 'não existe',
        all: Object.keys(offerings.all),
      });

      if (offerings.current && offerings.current.availablePackages.length > 0) {
        console.log('✅ [buscarOfertas] Packages encontrados:', offerings.current.availablePackages.length);
        setPackages(offerings.current.availablePackages);
        
        offerings.current.availablePackages.forEach((pkg: PurchasesPackage, index: number) => {
          console.log(`📦 Package ${index + 1}:`, {
            identifier: pkg.identifier,
            packageType: pkg.packageType,
            productId: pkg.product.identifier,
            productTitle: pkg.product.title,
            productPrice: pkg.product.priceString,
            productDescription: pkg.product.description,
          });
        });
      } else {
        console.warn('⚠️ [buscarOfertas] Nenhum package disponível');
        setPackages([]);
      }
      setLoading(false);
    } catch (error: any) {
      console.error('❌ [buscarOfertas] Erro:', error);
      setPackages([]);
      setLoading(false);
    }
  };

  // Função para comprar
  const comprar = async (packageToBuy: PurchasesPackage) => {
    try {
      setPurchasing(packageToBuy.identifier);
      console.log('🛒 [comprar] Iniciando compra do package:', packageToBuy.identifier);

      const purchaseResult = await Purchases.purchasePackage(packageToBuy);
      
      console.log('✅ [comprar] Compra realizada:', purchaseResult);
      
      // Sincronizar com Supabase
      await syncPurchaseWithSupabase(purchaseResult.customerInfo);

      Alert.alert(
        'Compra realizada!',
        'Sua assinatura foi ativada com sucesso. Obrigado!',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('❌ [comprar] Erro:', error);
      
      if (error.userCancelled) {
        console.log('⚠️ [comprar] Compra cancelada pelo usuário');
      } else {
        Alert.alert(
          'Erro na compra',
          error.message || 'Não foi possível processar a compra. Tente novamente.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setPurchasing(null);
    }
  };

  // Sincronizar compra com Supabase
  const syncPurchaseWithSupabase = async (customerInfo: any): Promise<void> => {
    try {
      console.log('🔄 [syncPurchaseWithSupabase] Sincronizando compra com Supabase...');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.warn('⚠️ [syncPurchaseWithSupabase] Usuário não autenticado');
        return;
      }

      // Verificar se tem assinatura premium ativa
      const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
      const plan = hasPremium ? 'premium' : 'free';
      const status = hasPremium ? 'active' : 'inactive';

      console.log('👤 [syncPurchaseWithSupabase] Usuário:', user.id);
      console.log('📊 [syncPurchaseWithSupabase] Plano:', plan, 'Status:', status);

      // Atualizar status da assinatura no Supabase
      const { error: updateError } = await supabase
        .from('users')
        .update({
          plan,
          subscription_status: status,
          subscription_updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ [syncPurchaseWithSupabase] Erro ao atualizar Supabase:', updateError);
      } else {
        console.log('✅ [syncPurchaseWithSupabase] Assinatura sincronizada com Supabase com sucesso');
      }
    } catch (error: any) {
      console.error('❌ [syncPurchaseWithSupabase] Erro ao sincronizar:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { 
        backgroundColor: colors.surface, 
        borderBottomColor: colors.border,
        paddingTop: insets.top > 0 ? 16 : 20
      }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Planos e Pagamentos</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        {!loading && packages.length > 0 && (
          <View style={styles.heroSection}>
            <View style={[styles.heroCard, { backgroundColor: colors.primary + '15' }]}>
              <View style={[styles.heroIconContainer, { backgroundColor: colors.primary + '25' }]}>
                <Ionicons name="diamond" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.text }]}>
                Upgrade para Premium
              </Text>
              <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                Desbloqueie todos os recursos e funcionalidades exclusivas
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Carregando planos...
            </Text>
          </View>
        ) : packages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
              <Ionicons name="card-outline" size={64} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Nenhum plano disponível
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Não foi possível carregar os planos no momento.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={buscarOfertas}
            >
              <Ionicons name="refresh" size={18} color="#ffffff" />
              <Text style={styles.retryButtonText}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.productsContainer}>
            {packages.map((pkg, index) => (
              <View
                key={pkg.identifier}
                style={[
                  styles.productCard,
                  index === 0 && styles.featuredCard,
                  { 
                    backgroundColor: colors.surface,
                    borderColor: index === 0 ? colors.primary : colors.border,
                  }
                ]}
              >
                {/* Badge Premium */}
                {index === 0 && (
                  <View style={[styles.premiumBadge, { backgroundColor: colors.primary }]}>
                    <Ionicons name="star" size={12} color="#ffffff" />
                    <Text style={styles.premiumBadgeText}>MAIS POPULAR</Text>
                  </View>
                )}

                {/* Header do Card */}
                <View style={styles.productHeader}>
                  <View style={styles.productInfo}>
                    <View style={styles.titleRow}>
                      <Ionicons 
                        name={index === 0 ? "diamond" : "star"} 
                        size={20} 
                        color={index === 0 ? colors.primary : colors.textSecondary} 
                        style={styles.titleIcon}
                      />
                      <Text style={[styles.productTitle, { color: colors.text }]}>
                        {pkg.product.title}
                      </Text>
                    </View>
                    <View style={styles.priceContainer}>
                      <Text style={[styles.productPrice, { color: colors.primary }]}>
                        {pkg.product.priceString}
                      </Text>
                      <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>
                        /mês
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Descrição */}
                {pkg.product.description && (
                  <View style={styles.descriptionContainer}>
                    <Text style={[styles.productDescription, { color: colors.textSecondary }]}>
                      {pkg.product.description}
                    </Text>
                  </View>
                )}

                {/* Divisor */}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Benefícios */}
                <View style={styles.productDetails}>
                  <View style={styles.detailRow}>
                    <View style={[styles.checkIconContainer, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                    </View>
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      Acesso completo a todos os recursos
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={[styles.checkIconContainer, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                    </View>
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      Suporte prioritário 24/7
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={[styles.checkIconContainer, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                    </View>
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      Atualizações ilimitadas
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <View style={[styles.checkIconContainer, { backgroundColor: colors.success + '20' }]}>
                      <Ionicons name="checkmark" size={14} color={colors.success} />
                    </View>
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      Sem anúncios
                    </Text>
                  </View>
                </View>

                {/* Botão de Compra */}
                <TouchableOpacity
                  style={[
                    styles.purchaseButton,
                    index === 0 && styles.featuredButton,
                    { 
                      backgroundColor: index === 0 ? colors.primary : colors.primary,
                      opacity: purchasing === pkg.identifier ? 0.6 : 1,
                    }
                  ]}
                  onPress={() => comprar(pkg)}
                  disabled={purchasing === pkg.identifier}
                  activeOpacity={0.8}
                >
                  {purchasing === pkg.identifier ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="card" size={20} color="#ffffff" />
                      <Text style={styles.purchaseButtonText}>
                        {index === 0 ? 'Começar Agora' : 'Assinar Agora'}
                      </Text>
                      <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  // Hero Section
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Products
  productsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },
  productCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  featuredCard: {
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
  },
  premiumBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: 6,
  },
  premiumBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  productHeader: {
    marginTop: 8,
    marginBottom: 16,
  },
  productInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleIcon: {
    marginRight: 8,
  },
  productTitle: {
    fontSize: 24,
    fontWeight: '800',
    flex: 1,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  productPrice: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  productDescription: {
    fontSize: 15,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    marginVertical: 20,
    opacity: 0.3,
  },
  productDetails: {
    marginBottom: 24,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
    lineHeight: 22,
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  featuredButton: {
    paddingVertical: 20,
  },
  purchaseButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

