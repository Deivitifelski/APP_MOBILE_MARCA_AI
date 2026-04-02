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
const FREE_VS_PREMIUM = [
  { label: 'Perfis de artista', free: '1', premium: 'Ilimitados' },
  { label: 'Colaboradores por artista', free: 'Até 4', premium: 'Ilimitados' },
  { label: 'Financeiro', free: 'Básico', premium: 'Completo' },
  { label: 'Relatórios', free: 'Essenciais', premium: 'Avançados + PDF' },
  { label: 'Suporte', free: 'Padrão', premium: 'Prioritário' },
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
          Alert.alert('Assinatura ativada', 'Seu plano Premium foi ativado com sucesso.', [
            {
              text: 'Continuar',
              onPress: () => router.back(),
            },
          ]);
        } catch {
          setProcessingSku(null);
          Alert.alert(
            'Erro ao confirmar assinatura',
            'Sua compra foi processada, mas nao conseguimos finalizar automaticamente. Tente restaurar compras.',
          );
        }
      }),
    );

    subscriptions.push(
      purchaseErrorListener((purchaseError) => {
        setProcessingSku(null);
        const rawMessage = purchaseError?.message?.trim();
        const message = rawMessage
          ? `Nao foi possivel concluir sua assinatura. Detalhes: ${rawMessage}`
          : 'Nao foi possivel concluir sua assinatura agora. Tente novamente em instantes.';
        Alert.alert('Assinatura nao concluida', message);
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
        Alert.alert('Nao foi possivel abrir assinaturas', 'Tente abrir o gerenciamento de assinaturas nas configuracoes da loja.');
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
      const details = purchaseStartError instanceof Error ? purchaseStartError.message : '';
      const msg = details
        ? `Nao foi possivel iniciar a compra. Detalhes: ${details}`
        : 'Nao foi possivel iniciar a compra.';
      Alert.alert('Erro ao iniciar assinatura', msg);
    }
  };

  const handleRestaurarCompras = async () => {
    try {
      setRestoring(true);
      await restorePurchases();
      await syncPurchasedStatus();
      Alert.alert('Compras restauradas', 'Suas assinaturas foram sincronizadas com sucesso.');
    } catch (restoreError) {
      const details = restoreError instanceof Error ? restoreError.message : '';
      const msg = details
        ? `Nao foi possivel restaurar suas compras. Detalhes: ${details}`
        : 'Nao foi possivel restaurar suas compras.';
      Alert.alert('Erro ao restaurar compras', msg);
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
        <View style={[styles.compareCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.compareSectionTitle, { color: colors.text }]}>Free vs Premium</Text>
          <Text style={[styles.compareSectionHint, { color: colors.textSecondary }]}>
            O que você ganha ao assinar.
          </Text>

          <View style={[styles.tableHeader, { backgroundColor: colors.secondary }]}>
            <View style={styles.tableColFeature}>
              <Text style={[styles.tableHeadText, { color: colors.textSecondary }]}>Recurso</Text>
            </View>
            <View style={styles.tableColPlan}>
              <Text style={[styles.tableHeadText, { color: colors.textSecondary }]}>Free</Text>
            </View>
            <View style={styles.tableColPlan}>
              <Text style={[styles.tableHeadText, { color: colors.primary }]}>Premium</Text>
            </View>
          </View>

          {FREE_VS_PREMIUM.map((item, index) => (
            <View
              key={item.label}
              style={[
                styles.tableRow,
                { borderBottomColor: colors.border },
                index === FREE_VS_PREMIUM.length - 1 && styles.tableRowLast,
              ]}
            >
              <View style={styles.tableColFeature}>
                <Text style={[styles.tableCellFeature, { color: colors.text }]}>{item.label}</Text>
              </View>
              <View style={styles.tableColPlan}>
                <Text style={[styles.tableCellFree, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.free}
                </Text>
              </View>
              <View style={[styles.tableColPlan, styles.premiumCell]}>
                <Ionicons name="checkmark-circle" size={15} color={colors.primary} style={styles.premiumIcon} />
                <Text style={[styles.tableCellPremium, { color: colors.primary }]} numberOfLines={2}>
                  {item.premium}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.plansSectionLabel, { color: colors.textSecondary }]}>Planos</Text>

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
              const rawDescription = product?.description?.trim() ?? '';
              const showDescription = rawDescription.length > 0 && rawDescription !== 'Produto ainda não retornado pela loja.';
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
                <View style={styles.planTop}>
                  <View style={styles.planTitleBlock}>
                    <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>
                      {isAnnual ? 'Cobrança anual' : 'Cobrança mensal'}
                    </Text>
                    <Text style={[styles.planTitle, { color: colors.text }]} numberOfLines={2}>
                      {productName}
                    </Text>
                  </View>
                  <Text style={[styles.planPrice, { color: colors.primary }]}>{productPrice}</Text>
                </View>
                <View style={styles.planTags}>
                  {isHighlighted ? (
                    <View style={[styles.highlightTag, { backgroundColor: `${colors.primary}18` }]}>
                      <Ionicons name="diamond" size={12} color={colors.primary} />
                      <Text style={[styles.highlightTagText, { color: colors.primary }]}>Melhor custo</Text>
                    </View>
                  ) : null}
                  {sku === ANNUAL_SKU && annualSavingsPercent !== null ? (
                    <View style={[styles.savingsTag, { backgroundColor: `${colors.success}22` }]}>
                      <Text style={[styles.savingsTagText, { color: colors.success }]}>−{annualSavingsPercent}%</Text>
                    </View>
                  ) : null}
                  {activeSku === sku ? (
                    <View style={[styles.activeTag, { backgroundColor: `${colors.primary}20` }]}>
                      <Text style={[styles.activeTagText, { color: colors.primary }]}>Ativo</Text>
                    </View>
                  ) : null}
                </View>
                {showDescription ? (
                  <Text style={[styles.planDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                    {rawDescription}
                  </Text>
                ) : null}
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
                      {unavailable
                        ? 'Indisponível'
                        : activeSku === sku
                          ? 'Gerenciar assinatura'
                          : isAnnual
                            ? 'Assinar plano anual'
                            : 'Assinar plano mensal'}
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
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  compareCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 0,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  compareSectionTitle: { fontSize: 18, fontWeight: '800', paddingHorizontal: 16, marginBottom: 4 },
  compareSectionHint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 16, marginBottom: 14 },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  tableHeadText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableColFeature: { flex: 1.15, minWidth: 0, paddingRight: 6 },
  tableColPlan: { flex: 1, minWidth: 0, paddingLeft: 2 },
  tableCellFeature: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  tableCellFree: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  tableCellPremium: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  premiumCell: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  premiumIcon: { marginTop: 1 },
  plansSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
    marginBottom: -4,
  },
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
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  planTitleBlock: { flex: 1, minWidth: 0, gap: 4 },
  planPeriod: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  planTitle: { fontSize: 17, fontWeight: '800', lineHeight: 22 },
  planPrice: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  planTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  highlightTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  highlightTagText: { fontSize: 11, fontWeight: '800' },
  activeTag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  activeTagText: { fontSize: 11, fontWeight: '800' },
  savingsTag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  savingsTagText: { fontSize: 11, fontWeight: '800' },
  planDesc: { fontSize: 13, lineHeight: 19 },
  planBtn: { borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  planBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
