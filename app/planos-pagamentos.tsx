import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const [showModal, setShowModal] = useState(false);

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
        setShowModal(true);
        
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Carregando planos...
            </Text>
          </View>
        ) : packages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Nenhum plano disponível
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Não foi possível carregar os planos no momento.
            </Text>
          </View>
        ) : (
          <View style={styles.productsContainer}>
            {packages.map((pkg) => (
              <View
                key={pkg.identifier}
                style={[styles.productCard, { 
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                }]}
              >
                <View style={styles.productHeader}>
                  <View style={styles.productInfo}>
                    <Text style={[styles.productTitle, { color: colors.text }]}>
                      {pkg.product.title}
                    </Text>
                    <Text style={[styles.productPrice, { color: colors.primary }]}>
                      {pkg.product.priceString}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="star" size={16} color={colors.primary} />
                  </View>
                </View>

                {pkg.product.description && (
                  <Text style={[styles.productDescription, { color: colors.textSecondary }]}>
                    {pkg.product.description}
                  </Text>
                )}

                <View style={styles.productDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      Acesso completo a todos os recursos
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      Suporte prioritário
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.detailText, { color: colors.text }]}>
                      Atualizações ilimitadas
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.purchaseButton,
                    { 
                      backgroundColor: colors.primary,
                      opacity: purchasing === pkg.identifier ? 0.6 : 1,
                    }
                  ]}
                  onPress={() => comprar(pkg)}
                  disabled={purchasing === pkg.identifier}
                >
                  {purchasing === pkg.identifier ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="card" size={20} color="#ffffff" />
                      <Text style={styles.purchaseButtonText}>Assinar Agora</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal com produtos */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            {/* Header do Modal */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Planos Disponíveis
              </Text>
              <Pressable onPress={() => setShowModal(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Conteúdo do Modal */}
            <ScrollView 
              style={styles.modalContent}
              contentContainerStyle={styles.modalContentContainer}
              showsVerticalScrollIndicator={false}
            >
              {packages.length === 0 ? (
                <View style={styles.modalEmptyContainer}>
                  <Ionicons name="card-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.modalEmptyText, { color: colors.textSecondary }]}>
                    Nenhum produto encontrado
                  </Text>
                </View>
              ) : (
                packages.map((pkg) => (
                  <View
                    key={pkg.identifier}
                    style={[styles.modalProductCard, { 
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    }]}
                  >
                    <View style={styles.modalProductHeader}>
                      <View style={styles.modalProductInfo}>
                        <Text style={[styles.modalProductTitle, { color: colors.text }]}>
                          {pkg.product.title}
                        </Text>
                        <Text style={[styles.modalProductPrice, { color: colors.primary }]}>
                          {pkg.product.priceString}
                        </Text>
                      </View>
                      <View style={[styles.modalBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Ionicons name="star" size={16} color={colors.primary} />
                      </View>
                    </View>

                    {pkg.product.description && (
                      <Text style={[styles.modalProductDescription, { color: colors.textSecondary }]}>
                        {pkg.product.description}
                      </Text>
                    )}

                    <View style={styles.modalProductDetails}>
                      <View style={styles.modalDetailRow}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={[styles.modalDetailText, { color: colors.text }]}>
                          Acesso completo a todos os recursos
                        </Text>
                      </View>
                      <View style={styles.modalDetailRow}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={[styles.modalDetailText, { color: colors.text }]}>
                          Suporte prioritário
                        </Text>
                      </View>
                      <View style={styles.modalDetailRow}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={[styles.modalDetailText, { color: colors.text }]}>
                          Atualizações ilimitadas
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.modalPurchaseButton,
                        { 
                          backgroundColor: colors.primary,
                          opacity: purchasing === pkg.identifier ? 0.6 : 1,
                        }
                      ]}
                      onPress={() => comprar(pkg)}
                      disabled={purchasing === pkg.identifier}
                    >
                      {purchasing === pkg.identifier ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Ionicons name="card" size={18} color="#ffffff" />
                          <Text style={styles.modalPurchaseButtonText}>Assinar Agora</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  productsContainer: {
    gap: 16,
  },
  productCard: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
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
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 28,
    fontWeight: '800',
  },
  badge: {
    padding: 8,
    borderRadius: 8,
  },
  productDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  productDetails: {
    marginBottom: 20,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  purchaseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos do Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  modalEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  modalEmptyText: {
    marginTop: 16,
    fontSize: 16,
  },
  modalProductCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modalProductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalProductInfo: {
    flex: 1,
  },
  modalProductTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalProductPrice: {
    fontSize: 24,
    fontWeight: '800',
  },
  modalBadge: {
    padding: 6,
    borderRadius: 6,
  },
  modalProductDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  modalProductDetails: {
    marginBottom: 16,
    gap: 8,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalDetailText: {
    fontSize: 13,
    flex: 1,
  },
  modalPurchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  modalPurchaseButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

