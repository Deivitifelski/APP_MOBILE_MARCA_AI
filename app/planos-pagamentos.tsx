import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubscriptionModal } from '../components/SubscriptionModal';
import { getRevenueCatKey } from '../config/revenuecat-keys';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { purchaseSubscription } from '../services/iapService';
import { isPremiumUser } from '../services/supabase/userService';

export default function PlanosPagamentosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  
  // Estados do modal de resposta
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'info' | 'warning'>('info');
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [showCancelButton, setShowCancelButton] = useState(false);
  const [shouldNavigateBack, setShouldNavigateBack] = useState(false);

  useEffect(() => {
    const inicializar = async () => {
      try {
        // Configurar RevenueCat
        const apiKey = getRevenueCatKey();
        console.log('🔄 [RevenueCat] Configurando com chave:', apiKey);
        
        // Configurar RevenueCat (a configuração completa é feita no serviço iapService)
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

  // Função para obter o preço formatado do RevenueCat
  // O RevenueCat retorna o preço já formatado na moeda local do dispositivo
  const obterPrecoFormatado = (pkg: PurchasesPackage): string => {
    // Log detalhado do produto (usando console.error para contornar suppress-logs)
    console.error('💰 [obterPrecoFormatado] Dados do produto:', JSON.stringify({
      identifier: pkg.identifier,
      packageType: pkg.packageType,
      productId: pkg.product.identifier,
      productTitle: pkg.product.title,
      productDescription: pkg.product.description,
      price: pkg.product.price,
      priceString: pkg.product.priceString,
      currencyCode: pkg.product.currencyCode,
      introPrice: pkg.product.introPrice,
      discounts: pkg.product.discounts,
    }, null, 2));
    
    // Usar o priceString que vem do RevenueCat (já formatado na moeda local)
    const preco = pkg.product.priceString || '';
    console.error('✅ [obterPrecoFormatado] Preço formatado retornado:', preco);
    return preco;
  };

  // Função para buscar ofertas
  const buscarOfertas = async () => {
    try {
      console.error('🔍 [buscarOfertas] Buscando ofertas...');
      
      const offerings = await Purchases.getOfferings();
      console.error('📦 [buscarOfertas] Offerings recebidos:', JSON.stringify({
        current: offerings.current ? 'existe' : 'não existe',
        all: Object.keys(offerings.all),
      }, null, 2));

      if (offerings.current && offerings.current.availablePackages.length > 0) {
        console.error('✅ [buscarOfertas] Packages encontrados:', offerings.current.availablePackages.length);
        
        // Log detalhado de cada package
        offerings.current.availablePackages.forEach((pkg, index) => {
          console.error(`📦 [buscarOfertas] Package ${index + 1} completo:`, JSON.stringify({
            identifier: pkg.identifier,
            packageType: pkg.packageType,
            product: {
              identifier: pkg.product.identifier,
              description: pkg.product.description,
              title: pkg.product.title,
              price: pkg.product.price,
              priceString: pkg.product.priceString,
              currencyCode: pkg.product.currencyCode,
              introPrice: pkg.product.introPrice,
              subscriptionPeriod: pkg.product.subscriptionPeriod,
              discounts: pkg.product.discounts,
            }
          }, null, 2));
        });
        
        // Log do primeiro package (mais detalhado)
        const primeiroPacote = offerings.current.availablePackages[0];
        console.error('🎯 [buscarOfertas] PRIMEIRO PACKAGE DETALHADO:', JSON.stringify({
          identifier: primeiroPacote.identifier,
          packageType: primeiroPacote.packageType,
          productId: primeiroPacote.product.identifier,
          productTitle: primeiroPacote.product.title,
          productPrice: primeiroPacote.product.price,
          productPriceString: primeiroPacote.product.priceString,
          productCurrencyCode: primeiroPacote.product.currencyCode,
          productDescription: primeiroPacote.product.description,
        }, null, 2));
        
        setPackages(offerings.current.availablePackages);
        
        offerings.current.availablePackages.forEach((pkg: PurchasesPackage, index: number) => {
          console.error(`📦 Package ${index + 1}:`, JSON.stringify({
            identifier: pkg.identifier,
            packageType: pkg.packageType,
            productId: pkg.product.identifier,
            productTitle: pkg.product.title,
            productPrice: pkg.product.priceString,
            productDescription: pkg.product.description,
          }, null, 2));
        });
      } else {
        console.error('⚠️ [buscarOfertas] Nenhum package disponível');
        setPackages([]);
      }
      setLoading(false);
    } catch (error: any) {
      console.error('❌ [buscarOfertas] Erro:', error);
      setPackages([]);
      setLoading(false);
    }
  };

  // Função para mostrar modal
  const showModal = (
    type: 'success' | 'error' | 'info' | 'warning',
    title: string,
    message: string,
    showCancel: boolean = false
  ) => {
    setModalType(type);
    setModalTitle(title);
    setModalMessage(message);
    setShowCancelButton(showCancel);
    // Só marcar para navegar de volta se for sucesso e já estiver marcado
    if (type !== 'success') {
      setShouldNavigateBack(false);
    }
    setModalVisible(true);
  };

  // Função para comprar
  const comprar = async (packageToBuy: PurchasesPackage) => {
    try {
      setPurchasing(packageToBuy.identifier);
      console.log('🛒 [comprar] Iniciando compra do package:', packageToBuy.identifier);

      // Verificar se já tem assinatura ativa no banco de dados (atualizado pelo webhook)
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { isPremium } = await isPremiumUser(user.id);
        
        if (isPremium) {
          setPurchasing(null);
          
          // Buscar informações detalhadas da assinatura do banco
          const { data: userData } = await supabase
            .from('users')
            .select('subscription_expires_at, subscription_will_renew, subscription_status, subscription_product_identifier')
            .eq('id', user.id)
            .single();

          // Buscar o preço real dos offerings do RevenueCat
          console.error('🔍 [comprar] Buscando preço real dos offerings...');
          const offerings = await Purchases.getOfferings();
          const primeiroPacote = offerings.current?.availablePackages[0];
          
          console.error('📊 [comprar] Dados do primeiro pacote:', JSON.stringify({
            existe: !!primeiroPacote,
            identifier: primeiroPacote?.identifier,
            productId: primeiroPacote?.product?.identifier,
            productTitle: primeiroPacote?.product?.title,
            productPrice: primeiroPacote?.product?.price,
            productPriceString: primeiroPacote?.product?.priceString,
            productCurrencyCode: primeiroPacote?.product?.currencyCode,
          }, null, 2));
          
          console.error('📊 [comprar] Dados do packageToBuy:', JSON.stringify({
            identifier: packageToBuy?.identifier,
            productId: packageToBuy?.product?.identifier,
            productTitle: packageToBuy?.product?.title,
            productPrice: packageToBuy?.product?.price,
            productPriceString: packageToBuy?.product?.priceString,
            productCurrencyCode: packageToBuy?.product?.currencyCode,
          }, null, 2));
          
          const precoReal = primeiroPacote?.product?.priceString || packageToBuy?.product?.priceString || '';
          const packageTitle = primeiroPacote?.product?.title || packageToBuy?.product?.title || 'Premium';
          
          console.error('✅ [comprar] Valores finais usados:', JSON.stringify({
            precoReal,
            packageTitle,
          }, null, 2));
          
          // Formatar mensagem com informações claras
          let message = 'Você já possui uma assinatura Premium ativa.';
          
          if (precoReal) {
            message += `\n\n💎 Plano: ${packageTitle}`;
            message += `\n💰 Valor: ${precoReal}/mês`;
          }
          
          if (userData?.subscription_expires_at) {
            const date = new Date(userData.subscription_expires_at);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            
            message += `\n\n📅 Válida até: ${day}/${month}/${year} às ${hours}:${minutes}`;
            
            if (userData.subscription_will_renew) {
              message += `\n\n🔄 Renovação automática ativada`;
            }
          }

          // Mostrar modal informativo
          showModal(
            'info',
            'Assinatura Ativa',
            message,
            false
          );
          
          return;
        }
      }

      // Se não tem assinatura ativa, prosseguir com a compra
      // Usar a função centralizada do serviço que já sincroniza com Supabase
      const purchaseResult = await purchaseSubscription(packageToBuy);

      if (purchaseResult.success) {
        console.log('✅ [comprar] Compra realizada com sucesso');
        console.log('📊 [comprar] Status sincronizado:', {
          hasPremium: purchaseResult.customerInfo?.entitlements.active['premium'] ? true : false,
        });

        // Mostrar modal de sucesso e marcar para navegar de volta
        setShouldNavigateBack(true);
        showModal(
          'success',
          'Assinatura Ativada',
          'Sua assinatura Premium foi ativada com sucesso!',
          false
        );

        // Recarregar ofertas para atualizar a tela
        await buscarOfertas();
      } else {
        // Verificar se foi cancelamento
        if (purchaseResult.error === 'cancelado') {
          // Mostrar modal informando que foi cancelado
          showModal(
            'info',
            'Compra Cancelada',
            'A compra foi cancelada. Você pode tentar novamente quando desejar.',
            false
          );
          return;
        }
        
        // Mostrar modal de erro com opção de cancelar
        showModal(
          'error',
          'Erro na Compra',
          purchaseResult.error || 'Não foi possível processar sua compra. Tente novamente.',
          false
        );
      }
    } catch (error: any) {
      console.error('❌ [comprar] Erro:', error);
      
      // Verificar se foi cancelamento (em vários formatos possíveis)
      const errorMessage = error.message?.toLowerCase() || '';
      const isCancelled = 
        error.userCancelled || 
        errorMessage.includes('cancelada') || 
        errorMessage.includes('cancelado') ||
        errorMessage.includes('cancelled') ||
        errorMessage.includes('cancel') ||
        error.code === 'USER_CANCELLED';
      
      if (isCancelled) {
        console.log('⚠️ [comprar] Compra cancelada pelo usuário');
        setPurchasing(null);
        // Mostrar modal informando cancelamento
        showModal(
          'info',
          'Compra Cancelada',
          'A compra foi cancelada. Você pode tentar novamente quando desejar.',
          false
        );
        return;
      }
      
      // Traduzir mensagens de erro comuns para português
      let errorMsg = 'Não foi possível processar sua compra. Verifique sua conexão e tente novamente.';
      
      if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('network') || msg.includes('internet') || msg.includes('connection')) {
          errorMsg = 'Erro de conexão. Verifique sua internet e tente novamente.';
        } else if (msg.includes('payment') || msg.includes('purchase')) {
          errorMsg = 'Erro no pagamento. Verifique seus dados e tente novamente.';
        } else if (msg.includes('product') || msg.includes('unavailable')) {
          errorMsg = 'Produto não disponível no momento. Tente novamente mais tarde.';
        } else if (msg.includes('store') || msg.includes('app store')) {
          errorMsg = 'Erro ao conectar com a loja. Tente novamente.';
        } else if (!msg.includes('cancel')) {
          // Só usar a mensagem original se não for cancelamento
          errorMsg = error.message;
        }
      }
      
      // Mostrar modal de erro
      showModal(
        'error',
        'Erro na Compra',
        errorMsg,
        false
      );
    } finally {
      setPurchasing(null);
    }
  };

  // Função para restaurar compras (mantida para uso futuro)
  // const restaurarCompras = async () => {
  //   try {
  //     console.log('🔄 [restaurarCompras] Iniciando restauração...');

  //     const result = await restorePurchases();

  //     if (result.success) {
  //       console.log('✅ [restaurarCompras] Compras restauradas com sucesso');
        
  //       showModal(
  //         'success',
  //         'Compras Restauradas',
  //         'Suas compras anteriores foram restauradas com sucesso!'
  //       );

  //       // Recarregar ofertas
  //       await buscarOfertas();
  //     } else {
  //       showModal(
  //         'warning',
  //         'Nenhuma Compra Encontrada',
  //         result.error || 'Não encontramos nenhuma compra anterior para restaurar.'
  //       );
  //     }
  //   } catch (error: any) {
  //     console.error('❌ [restaurarCompras] Erro:', error);
      
  //     showModal(
  //       'error',
  //       'Erro ao Restaurar',
  //       'Não foi possível restaurar suas compras. Tente novamente.'
  //     );
  //   }
  // };

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

      <View 
        style={styles.content}
      >
        {/* Hero Section */}
        {!loading && packages.length > 0 && (
          <View style={[styles.heroSection, { backgroundColor: colors.primary + '08' }]}>
            <View style={[styles.heroIconContainer, { backgroundColor: colors.primary }]}>
              <Ionicons name="diamond" size={24} color="#ffffff" />
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Assinatura Premium
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Recursos ilimitados
            </Text>
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
            {packages.map((pkg, index) => {
              const isFeatured = index === 0;
              return (
                <View
                  key={pkg.identifier}
                  style={[
                    styles.productCard,
                    isFeatured && styles.featuredCard,
                    { 
                      backgroundColor: colors.surface,
                      borderColor: isFeatured ? colors.primary : colors.border,
                    }
                  ]}
                >
                  {/* Badge */}
                  {isFeatured && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="star" size={10} color="#ffffff" style={{ marginRight: 3 }} />
                      <Text style={styles.badgeText}>RECOMENDADO</Text>
                    </View>
                  )}

                  {/* Título e Preço */}
                  <View style={styles.headerSection}>
                    {isFeatured && (
                      <View style={[styles.premiumBadge, { backgroundColor: colors.primary + '15' }]}>
                        <Ionicons name="sparkles" size={12} color={colors.primary} />
                        <Text style={[styles.premiumBadgeText, { color: colors.primary }]}>Premium</Text>
                      </View>
                    )}
                    <Text style={[styles.planName, { color: colors.text }]}>
                      {pkg.product.title}
                    </Text>
                    <View style={styles.priceRow}>
                      <Text style={[styles.productPrice, { color: colors.primary }]}>
                        {obterPrecoFormatado(pkg)}
                      </Text>
                      <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>
                        /mês
                      </Text>
                    </View>
                  </View>

                  {/* Divisor */}
                  <View style={[styles.divider, { backgroundColor: isFeatured ? colors.primary + '30' : colors.border }]} />

                  {/* Benefícios */}
                  <View style={styles.benefitsContainer}>
                    <Text style={[styles.benefitsTitle, { color: colors.text }]}>
                      Benefícios incluídos:
                    </Text>
                    <View style={styles.benefitsList}>
                      {[
                        { icon: 'people', text: 'Artistas ilimitados' },
                        { icon: 'person-add', text: 'Colaboradores ilimitados' },
                        { icon: 'trending-up', text: 'Exportar finanças' },
                        { icon: 'calendar', text: 'Exportar agendas' },
                      ].map((benefit, idx) => (
                        <View key={idx} style={[styles.benefitItem, { backgroundColor: colors.background }]}>
                          <View style={[styles.benefitIconContainer, { backgroundColor: colors.success + '20' }]}>
                            <Ionicons name={benefit.icon as any} size={14} color={colors.success} />
                          </View>
                          <Text style={[styles.benefitText, { color: colors.text }]}>
                            {benefit.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Botão */}
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { 
                        backgroundColor: isFeatured ? colors.primary : colors.surface,
                        borderWidth: isFeatured ? 0 : 2,
                        borderColor: colors.primary,
                        opacity: purchasing === pkg.identifier ? 0.6 : 1,
                      }
                    ]}
                    onPress={() => comprar(pkg)}
                    disabled={purchasing === pkg.identifier}
                    activeOpacity={0.8}
                  >
                    {purchasing === pkg.identifier ? (
                      <ActivityIndicator size="small" color={isFeatured ? "#ffffff" : colors.primary} />
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={[styles.actionButtonText, { color: isFeatured ? "#ffffff" : colors.primary }]}>
                          Assinar
                        </Text>
                        {isFeatured && (
                          <Ionicons name="arrow-forward" size={16} color="#ffffff" style={{ marginLeft: 6 }} />
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
            
          </View>
        )}
      </View>

      {/* Modal de resposta de assinatura */}
      <SubscriptionModal
        visible={modalVisible}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={() => {
          setModalVisible(false);
          // Se foi uma assinatura com sucesso, voltar para configurações
          if (shouldNavigateBack && modalType === 'success') {
            setShouldNavigateBack(false);
            router.back();
          }
        }}
        onCancel={() => {
          setModalVisible(false);
          // Se foi uma assinatura com sucesso, voltar para configurações
          if (shouldNavigateBack && modalType === 'success') {
            setShouldNavigateBack(false);
            router.back();
          }
        }}
        showCancel={showCancelButton}
        buttonText="Entendi"
      />

      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    justifyContent: 'center',
  },
  // Hero Section
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    marginBottom: 8,
  },
  heroIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
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
    paddingTop: 4,
    flex: 1,
    justifyContent: 'center',
  },
  productCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  featuredCard: {
    borderWidth: 2.5,
    ...Platform.select({
      ios: {
        shadowColor: '#667eea',
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 8,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSection: {
    marginBottom: 12,
    alignItems: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  productPrice: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 14,
    marginLeft: 4,
    opacity: 0.7,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.3,
  },
  benefitsContainer: {
    marginBottom: 12,
  },
  benefitsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  benefitsList: {
    gap: 6,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  benefitIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Restaurar Compras
  restoreSection: {
    marginTop: 24,
    marginBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  restoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  restoreButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

