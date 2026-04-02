import { Ionicons } from '@expo/vector-icons';
import {
  deepLinkToSubscriptions,
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Product,
  type Purchase,
} from 'expo-iap';
import { router, Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const PREMIUM_SKUS = ['marcaai_mensal_app'];
const PLAN_LABELS: Record<string, string> = {
  marcaai_mensal_app: 'Marca AI Premium Mensal',
  marcaai_mensal: 'Marca AI Premium Mensal',
  marcaai_anual: 'Marca AI Premium Anual',
};

export default function AssinePremiumScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingSku, setProcessingSku] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [activeSku, setActiveSku] = useState<string | null>(null);

  const syncPurchasedStatus = useCallback(async () => {
    const purchases = await getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
    });
    const premiumPurchase = purchases.find((purchase) => PREMIUM_SKUS.includes(purchase.productId));
    setActiveSku(premiumPurchase?.productId || null);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setError(null);
      const ok = await initConnection();
      if (!ok) throw new Error('Não foi possível inicializar a loja.');

      const fetched = (await fetchProducts({
        skus: PREMIUM_SKUS,
        type: 'subs',
      })) as Product[] | null;

      const filtered = (fetched || []).filter((p) => PREMIUM_SKUS.includes(p.id));
      filtered.sort((a, b) => PREMIUM_SKUS.indexOf(a.id) - PREMIUM_SKUS.indexOf(b.id));
      setProducts(filtered);
      await syncPurchasedStatus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao carregar produtos da loja.';
      setError(msg);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [syncPurchasedStatus]);

  useEffect(() => {
    const subscriptions: { remove: () => void }[] = [];

    subscriptions.push(
      purchaseUpdatedListener(async (purchase: Purchase) => {
        try {
          if (!PREMIUM_SKUS.includes(purchase.productId)) return;
          await finishTransaction({ purchase, isConsumable: false });
          await syncPurchasedStatus();
          setProcessingSku(null);
          Alert.alert('Assinatura confirmada', 'Seu plano premium foi ativado com sucesso.');
        } catch {
          setProcessingSku(null);
          Alert.alert('Erro na assinatura', 'A compra foi processada, mas houve erro ao finalizar a transação.');
        }
      }),
    );

    subscriptions.push(
      purchaseErrorListener((purchaseError) => {
        setProcessingSku(null);
        const message = purchaseError?.message || 'Não foi possível concluir sua assinatura.';
        Alert.alert('Compra não concluída', message);
      }),
    );

    void loadProducts();
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      void endConnection();
    };
  }, [loadProducts, syncPurchasedStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
  };

  const handleAssinar = async (product: Product) => {
    if (activeSku === product.id) {
      try {
        await deepLinkToSubscriptions({
          packageNameAndroid: 'com.organizei.marcaai',
          skuAndroid: product.id,
        });
      } catch {
        Alert.alert('Aviso', 'Não foi possível abrir o gerenciamento de assinatura.');
      }
      return;
    }

    try {
      setProcessingSku(product.id);
      if (Platform.OS === 'ios') {
        await requestPurchase({
          type: 'subs',
          request: { apple: { sku: product.id } },
        });
      } else {
        await requestPurchase({
          type: 'subs',
          request: { google: { skus: [product.id] } },
        });
      }
    } catch (purchaseStartError) {
      setProcessingSku(null);
      const msg = purchaseStartError instanceof Error ? purchaseStartError.message : 'Não foi possível iniciar a compra.';
      Alert.alert('Erro', msg);
    }
  };

  const handleRestaurarCompras = async () => {
    try {
      setRestoring(true);
      await restorePurchases();
      await syncPurchasedStatus();
      Alert.alert('Restauração concluída', 'Suas assinaturas foram sincronizadas com sucesso.');
    } catch (restoreError) {
      const msg = restoreError instanceof Error ? restoreError.message : 'Não foi possível restaurar as compras.';
      Alert.alert('Erro', msg);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Assine Premium</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Planos disponíveis na App Store / Play Store para desbloquear recursos premium.
        </Text>

        <TouchableOpacity
          style={[styles.restoreBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={handleRestaurarCompras}
          disabled={restoring}
        >
          {restoring ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="refresh" size={16} color={colors.primary} />}
          <Text style={[styles.restoreBtnText, { color: colors.text }]}>Restaurar compras</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando planos...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => void loadProducts()}>
              <Text style={styles.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading && !error
          ? PREMIUM_SKUS.map((sku) => {
              const product = products.find((item) => item.id === sku);
              const productName = product?.displayName || product?.title || PLAN_LABELS[sku] || sku;
              const productPrice = product?.displayPrice || 'Valor indisponível';
              const productDescription = product?.description || 'Produto ainda não retornado pela loja.';
              const unavailable = !product;

              return (
                <View key={sku} style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.planHeader}>
                  <Text style={[styles.planTitle, { color: colors.text }]}>{productName}</Text>
                  <Text style={[styles.planPrice, { color: colors.primary }]}>{productPrice}</Text>
                </View>
                {activeSku === sku ? (
                  <View style={[styles.activeTag, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.activeTagText, { color: colors.primary }]}>Plano ativo</Text>
                  </View>
                ) : null}
                <Text style={[styles.planId, { color: colors.textSecondary }]}>SKU: {sku}</Text>
                <Text style={[styles.planDesc, { color: colors.textSecondary }]}>{productDescription}</Text>
                <TouchableOpacity
                  style={[
                    styles.planBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: unavailable || (processingSku && processingSku !== sku) ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => {
                    if (product) void handleAssinar(product);
                  }}
                  disabled={unavailable || !!processingSku}
                >
                  {processingSku === sku ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.planBtnText}>
                      {unavailable ? 'Indisponível na loja' : activeSku === sku ? 'Gerenciar plano' : 'Assinar plano'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              );
            })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 28, gap: 12 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  restoreBtn: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  restoreBtnText: { fontSize: 14, fontWeight: '600' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  errorText: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, lineHeight: 20 },
  retryBtn: { alignSelf: 'flex-start', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  planCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  planTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  planPrice: { fontSize: 16, fontWeight: '800' },
  activeTag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  activeTagText: { fontSize: 12, fontWeight: '700' },
  planId: { fontSize: 12 },
  planDesc: { fontSize: 13, lineHeight: 18 },
  planBtn: { marginTop: 2, borderRadius: 10, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  planBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
