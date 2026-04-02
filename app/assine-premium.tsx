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

const PREMIUM_SKUS = ['marcaai_mensal_app', 'marcaai_anual_app'];
const PLAN_LABELS: Record<string, string> = {
  marcaai_mensal_app: 'Marca AI Premium Mensal',
  marcaai_anual_app: 'Marca AI Premium Anual',
  marcaai_mensal: 'Marca AI Premium Mensal',
  marcaai_anual: 'Marca AI Premium Anual',
};
const PREMIUM_BENEFITS = [
  'Colaboradores ilimitados para artistas e equipes',
  'Financeiro completo com visão avançada de receitas',
  'Relatórios avançados e exportação em PDF',
  'Agenda compartilhada com mais controle operacional',
  'Suporte prioritário para assinantes',
];
const FREE_LIMITATIONS = [
  'Limite de recursos avançados de gestão',
  'Sem exportação de relatórios em PDF',
  'Visão financeira reduzida para o básico',
];
const PLAN_COMPARISON = [
  { feature: 'Colaboradores', free: 'Até 1', premium: 'Ilimitados' },
  { feature: 'Financeiro', free: 'Básico', premium: 'Completo' },
  { feature: 'Relatórios', free: 'Essenciais', premium: 'Avançados + PDF' },
  { feature: 'Agenda', free: 'Simples', premium: 'Compartilhada' },
  { feature: 'Suporte', free: 'Padrão', premium: 'Prioritário' },
];
const MONTHLY_SKU = 'marcaai_mensal_app';
const ANNUAL_SKU = 'marcaai_anual_app';

const parsePriceFromDisplay = (displayPrice: string): number | null => {
  const normalized = displayPrice.replace(/[^\d,.-]/g, '');
  if (!normalized) return null;

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : '.';

  if (lastComma === -1 && lastDot === -1) {
    const integerValue = Number(normalized.replace(/[^\d-]/g, ''));
    return Number.isFinite(integerValue) ? integerValue : null;
  }

  const thousandSeparator = decimalSeparator === ',' ? '.' : ',';
  const withoutThousands = normalized.split(thousandSeparator).join('');
  const canonical = withoutThousands.replace(decimalSeparator, '.');
  const value = Number(canonical);
  return Number.isFinite(value) ? value : null;
};

const getProductPrice = (product?: Product): number | null => {
  if (!product) return null;
  if (typeof product.price === 'number' && Number.isFinite(product.price) && product.price > 0) {
    return product.price;
  }
  return parsePriceFromDisplay(product.displayPrice);
};

const getAnnualSavingsPercent = (monthlyProduct?: Product, annualProduct?: Product): number | null => {
  const monthly = getProductPrice(monthlyProduct);
  const annual = getProductPrice(annualProduct);
  if (!monthly || !annual) return null;

  const yearlyFromMonthly = monthly * 12;
  if (yearlyFromMonthly <= 0) return null;

  const savingsPercent = Math.round(((yearlyFromMonthly - annual) / yearlyFromMonthly) * 100);
  return savingsPercent > 0 ? savingsPercent : null;
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

  const monthlyProduct = products.find((item) => item.id === MONTHLY_SKU);
  const annualProduct = products.find((item) => item.id === ANNUAL_SKU);
  const annualSavingsPercent = getAnnualSavingsPercent(monthlyProduct, annualProduct);

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
        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={14} color={colors.primary} />
            <Text style={[styles.heroBadgeText, { color: colors.primary }]}>Upgrade Premium</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Mais controle para crescer sua operação</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Assine para liberar recursos avançados de gestão, finanças e colaboração no Marca AI.
          </Text>
        </View>

        <View style={[styles.explainerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.explainerTitle, { color: colors.text }]}>O que muda com o Premium</Text>
          <Text style={[styles.explainerText, { color: colors.textSecondary }]}>
            O plano Premium foi criado para quem precisa escalar a operação com mais controle e produtividade.
          </Text>

          <View style={styles.listGroup}>
            {PREMIUM_BENEFITS.map((item) => (
              <View key={item} style={styles.listItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={[styles.listItemText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.freeBox, { borderColor: colors.border }]}>
            <Text style={[styles.freeBoxTitle, { color: colors.text }]}>No plano gratuito</Text>
            {FREE_LIMITATIONS.map((item) => (
              <View key={item} style={styles.listItem}>
                <Ionicons name="remove-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.freeBoxText, { color: colors.textSecondary }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.compareCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.compareTitle, { color: colors.text }]}>Free vs Premium</Text>
          <Text style={[styles.compareSubtitle, { color: colors.textSecondary }]}>
            Veja o que muda na pratica quando voce ativa seu plano.
          </Text>

          {PLAN_COMPARISON.map((item) => (
            <View key={item.feature} style={[styles.compareRow, { borderColor: colors.border }]}>
              <Text style={[styles.compareFeature, { color: colors.text }]}>{item.feature}</Text>
              <View style={styles.compareValuesGrid}>
                <View style={styles.compareValueBlock}>
                  <Text style={[styles.compareBlockLabel, { color: colors.textSecondary }]}>Free</Text>
                  <Text style={[styles.comparePill, styles.comparePillFree, { color: colors.textSecondary }]}>{item.free}</Text>
                </View>
                <View style={styles.compareValueBlock}>
                  <Text style={[styles.compareBlockLabel, { color: colors.primary }]}>Premium</Text>
                  <View style={[styles.comparePillPremiumWrap, { backgroundColor: `${colors.primary}16` }]}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    <Text style={[styles.comparePillPremiumText, { color: colors.primary }]}>{item.premium}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

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
              const isAnnual = sku === ANNUAL_SKU;
              const isHighlighted = isAnnual && annualSavingsPercent !== null;

              return (
                <View
                  key={sku}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isHighlighted ? colors.primary : colors.border,
                      shadowColor: isHighlighted ? colors.primary : '#000',
                    },
                  ]}
                >
                <View style={styles.planHeader}>
                  <Text style={[styles.planTitle, { color: colors.text }]}>{productName}</Text>
                  <Text style={[styles.planPrice, { color: colors.primary }]}>{productPrice}</Text>
                </View>
                {isHighlighted ? (
                  <View style={[styles.highlightTag, { backgroundColor: `${colors.primary}18` }]}>
                    <Ionicons name="diamond" size={12} color={colors.primary} />
                    <Text style={[styles.highlightTagText, { color: colors.primary }]}>Mais vantajoso</Text>
                  </View>
                ) : null}
                {activeSku === sku ? (
                  <View style={[styles.activeTag, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.activeTagText, { color: colors.primary }]}>Plano ativo</Text>
                  </View>
                ) : null}
                {sku === ANNUAL_SKU && annualSavingsPercent !== null ? (
                  <View style={[styles.savingsTag, { backgroundColor: `${colors.success}20` }]}>
                    <Text style={[styles.savingsTagText, { color: colors.success }]}>
                      Economize {annualSavingsPercent}% no anual
                    </Text>
                  </View>
                ) : null}
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

        <TouchableOpacity
          style={[styles.restoreBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={handleRestaurarCompras}
          disabled={restoring}
        >
          {restoring ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="refresh" size={16} color={colors.primary} />}
          <Text style={[styles.restoreBtnText, { color: colors.text }]}>Restaurar compras</Text>
        </TouchableOpacity>
        <Text style={[styles.restoreHint, { color: colors.textSecondary }]}>
          Use esta opcao se voce ja assinou antes e quer reativar seu acesso neste aparelho.
        </Text>
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
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  heroCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  heroBadgeText: { fontSize: 12, fontWeight: '800' },
  heroTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 2 },
  explainerCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  explainerTitle: { fontSize: 16, fontWeight: '800' },
  explainerText: { fontSize: 13, lineHeight: 19 },
  listGroup: { gap: 8, marginTop: 2 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  listItemText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  freeBox: { marginTop: 4, borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  freeBoxTitle: { fontSize: 13, fontWeight: '700' },
  freeBoxText: { flex: 1, fontSize: 12, lineHeight: 17 },
  compareCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  compareTitle: { fontSize: 16, fontWeight: '800' },
  compareSubtitle: { fontSize: 12, lineHeight: 18 },
  compareRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 10,
  },
  compareFeature: { fontSize: 13, fontWeight: '700' },
  compareValuesGrid: { flexDirection: 'row', gap: 8 },
  compareValueBlock: { flex: 1, gap: 4 },
  compareBlockLabel: { fontSize: 11, fontWeight: '700' },
  comparePill: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  comparePillFree: { backgroundColor: 'rgba(148, 163, 184, 0.15)' },
  comparePillPremiumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  comparePillPremiumText: { flex: 1, fontSize: 11, fontWeight: '800' },
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
  restoreHint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: -2 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  errorText: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, lineHeight: 20 },
  retryBtn: { alignSelf: 'flex-start', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  planCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  planTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  planPrice: { fontSize: 16, fontWeight: '800' },
  highlightTag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  highlightTagText: { fontSize: 12, fontWeight: '800' },
  activeTag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  activeTagText: { fontSize: 12, fontWeight: '700' },
  savingsTag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  savingsTagText: { fontSize: 12, fontWeight: '700' },
  planDesc: { fontSize: 13, lineHeight: 18 },
  planBtn: { marginTop: 2, borderRadius: 10, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  planBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
