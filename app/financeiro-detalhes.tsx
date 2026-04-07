import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Sharing from 'expo-sharing';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FinancialPieChart, { PieSlice } from '../components/FinancialPieChart';
import { useActiveArtistContext } from '../contexts/ActiveArtistContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatCalendarDate } from '../lib/dateUtils';
import { supabase } from '../lib/supabase';
import { getEventsByMonth } from '../services/supabase/eventService';
import { generateFinanceiroDetalhesPdf } from '../services/financeiroDetalhesPdfService';
import { getExpensesByEvent, getStandaloneExpensesByArtist } from '../services/supabase/expenseService';
import {
  checkUserSubscriptionFromTable,
  consumeFinancialTrialAction,
} from '../services/supabase/userService';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#14b8a6'];

interface EventWithExpenses {
  id: string;
  name: string;
  event_date: string;
  value?: number;
  created_by?: string;
  expenses: { id: string; name: string; value: number }[];
  totalExpenses: number;
}

export default function FinanceiroDetalhesScreen() {
  const { colors, isDarkMode } = useTheme();
  const { activeArtist } = useActiveArtistContext();
  const params = useLocalSearchParams<{ month?: string; year?: string }>();
  const month = Math.max(0, Math.min(11, parseInt(params.month ?? '0', 10) || 0));
  const year = parseInt(params.year ?? String(new Date().getFullYear()), 10) || new Date().getFullYear();

  const [events, setEvents] = useState<EventWithExpenses[]>([]);
  const [standalone, setStandalone] = useState<any[]>([]);
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const exportLockRef = useRef(false);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const checkAccess = useCallback(async () => {
    if (!activeArtist) {
      setHasAccess(null);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setHasAccess(false);
      return;
    }
    const { data: memberData, error } = await supabase
      .from('artist_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('artist_id', activeArtist.id)
      .single();
    if (error || !memberData) {
      setHasAccess(false);
      return;
    }
    setHasAccess(memberData.role !== 'viewer');
  }, [activeArtist]);

  const load = useCallback(async () => {
    if (!activeArtist || !hasAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { events: monthEvents, error: evErr } = await getEventsByMonth(activeArtist.id, year, month);
      if (evErr || !monthEvents) {
        setEvents([]);
        setStandalone([]);
        return;
      }
      const withExp = await Promise.all(
        monthEvents.map(async (ev) => {
          const { expenses } = await getExpensesByEvent(ev.id);
          const list = expenses || [];
          const totalExpenses = list.reduce((s, e) => s + e.value, 0);
          return {
            id: ev.id,
            name: ev.name,
            event_date: ev.event_date,
            value: ev.value,
            created_by: ev.created_by,
            expenses: list.map((e) => ({
              id: e.id,
              name: e.name || e.description || 'Despesa',
              value: e.value,
            })),
            totalExpenses,
          };
        })
      );
      setEvents(withExp);

      const { success, expenses: st } = await getStandaloneExpensesByArtist(activeArtist.id, month, year);
      setStandalone(success && st ? st : []);

      const creatorIds = [...new Set(withExp.map((e) => e.created_by).filter(Boolean))] as string[];
      if (creatorIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, name').in('id', creatorIds);
        const map: Record<string, string> = {};
        (users || []).forEach((u: { id: string; name?: string }) => {
          map[u.id] = u.name?.trim() || 'Usuário';
        });
        setNameByUserId(map);
      } else {
        setNameByUserId({});
      }
    } finally {
      setLoading(false);
    }
  }, [activeArtist, hasAccess, year, month]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (hasAccess) void load();
    else setLoading(false);
  }, [load, hasAccess]);

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const standaloneIncome = useMemo(() => standalone.filter((x) => x.value < 0), [standalone]);
  const standaloneExpensesOnly = useMemo(() => standalone.filter((x) => x.value > 0), [standalone]);

  const totals = useMemo(() => {
    const totalRevenue = events.reduce((s, e) => s + (e.value || 0), 0);
    const standaloneIncomeTotal = Math.abs(
      standaloneIncome.reduce((s, x) => s + (x.value || 0), 0)
    );
    const eventsExpenses = events.reduce((s, e) => s + e.totalExpenses, 0);
    const standaloneExpensesTotal = standaloneExpensesOnly.reduce((s, x) => s + (x.value || 0), 0);
    const totalRevenueWithIncome = totalRevenue + standaloneIncomeTotal;
    const totalExpenses = eventsExpenses + standaloneExpensesTotal;
    const eventCount = events.length;
    const expenseEntriesCount =
      events.reduce((s, e) => s + e.expenses.length, 0) + standaloneExpensesOnly.length;
    const totalEventProfits = events.reduce(
      (s, e) => s + (e.value || 0) - e.totalExpenses,
      0
    );
    return {
      totalRevenue,
      standaloneIncomeTotal,
      totalRevenueWithIncome,
      totalExpenses,
      netProfit: totalRevenueWithIncome - totalExpenses,
      eventCount,
      expenseEntriesCount,
      totalEventProfits,
    };
  }, [events, standaloneIncome, standaloneExpensesOnly]);

  const pieSlices: PieSlice[] = useMemo(() => {
    const byUser: Record<string, number> = {};
    for (const ev of events) {
      const uid = ev.created_by || '_none';
      byUser[uid] = (byUser[uid] || 0) + (ev.value || 0);
    }
    const slices: PieSlice[] = [];
    let colorIdx = 0;
    for (const [uid, value] of Object.entries(byUser)) {
      if (value <= 0) continue;
      const label =
        uid === '_none'
          ? 'Evento sem responsável'
          : nameByUserId[uid] || 'Colaborador';
      slices.push({
        value,
        color: PIE_COLORS[colorIdx % PIE_COLORS.length],
        label: `${label} (eventos)`,
      });
      colorIdx += 1;
    }
    if (totals.standaloneIncomeTotal > 0) {
      slices.push({
        value: totals.standaloneIncomeTotal,
        color: PIE_COLORS[colorIdx % PIE_COLORS.length],
        label: 'Receitas avulsas',
      });
    }
    return slices;
  }, [events, nameByUserId, totals.standaloneIncomeTotal]);

  const topExpenses = useMemo(() => {
    const rows: { name: string; value: number; source: string }[] = [];
    for (const ev of events) {
      for (const ex of ev.expenses) {
        rows.push({ name: ex.name, value: ex.value, source: ev.name });
      }
    }
    for (const s of standaloneExpensesOnly) {
      rows.push({
        name: s.description || 'Despesa avulsa',
        value: s.value,
        source: 'Avulsa',
      });
    }
    return rows.sort((a, b) => b.value - a.value).slice(0, 8);
  }, [events, standaloneExpensesOnly]);

  const topProfits = useMemo(() => {
    return events
      .map((ev) => ({
        name: ev.name,
        profit: (ev.value || 0) - ev.totalExpenses,
        date: ev.event_date,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);
  }, [events]);

  const pieTotal = pieSlices.reduce((s, x) => s + x.value, 0);

  const handleExportPdf = useCallback(async () => {
    if (!activeArtist || exportLockRef.current) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      Alert.alert('Erro', 'Faça login novamente.');
      return;
    }
    const { isActive, error: subErr } = await checkUserSubscriptionFromTable(uid);
    if (subErr) {
      Alert.alert('Erro', `Não foi possível verificar sua assinatura. ${subErr}`);
      return;
    }
    if (!isActive) {
      const consumed = await consumeFinancialTrialAction('export');
      if (!consumed.ok) {
        if (consumed.reason === 'exhausted_exports') {
          Alert.alert(
            'Assinatura Premium',
            'Você já usou suas exportações financeiras gratuitas. Assine o Premium para exportar sem limite.',
            [
              { text: 'Agora não', style: 'cancel' },
              { text: 'Ver Premium', onPress: () => router.push('/assine-premium') },
            ],
          );
          return;
        }
        if (consumed.error === 'rpc_missing') {
          Alert.alert(
            'Configuração',
            'O período de testes gratuito ainda não está ativo no servidor. Aplique o script database/free_financial_trial.sql no Supabase.',
          );
          return;
        }
        Alert.alert('Erro', consumed.error || 'Não foi possível liberar a exportação.');
        return;
      }
    }
    exportLockRef.current = true;
    setExportingPdf(true);
    try {
      const result = await generateFinanceiroDetalhesPdf({
        artistName: activeArtist.name,
        month,
        year,
        pieSlices,
        pieTotal,
        totals,
        topExpenses,
        topProfits,
      });
      if (!result.success || !result.uri) {
        Alert.alert('Erro', result.error || 'Não foi possível gerar o PDF.');
        return;
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Exportar detalhes financeiros',
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao exportar.');
    } finally {
      exportLockRef.current = false;
      setExportingPdf(false);
    }
  }, [activeArtist, month, year, pieSlices, pieTotal, totals, topExpenses, topProfits]);

  if (!activeArtist) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, padding: 24 }}>Selecione um artista na aba Financeiro.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 16 }}>
          <Text style={{ color: colors.primary }}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (hasAccess === null) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (hasAccess === false) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Detalhes financeiros</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={48} color={colors.textSecondary} />
          <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 12, textAlign: 'center' }]}>
            Apenas gerentes e editores podem ver os detalhes.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          Detalhes · {MONTHS[month]}/{year}
        </Text>
        <TouchableOpacity
          onPress={() => void handleExportPdf()}
          style={styles.headerExportBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={loading || exportingPdf}
          accessibilityLabel="Exportar PDF com gráficos e resumo"
        >
          {exportingPdf ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.chartCard, { backgroundColor: colors.surface }]}>
            <View style={styles.chartCardHeader}>
              <View style={[styles.chartIconWrap, { backgroundColor: colors.primary + '22' }]}>
                <Ionicons name="bar-chart" size={22} color={colors.primary} />
              </View>
              <View style={styles.chartCardHeaderText}>
                <Text style={[styles.chartCardTitle, { color: colors.text }]}>
                  Distribuição da receita
                </Text>
                <Text style={[styles.chartCardSub, { color: colors.textSecondary }]}>
                  Por colaborador que cadastrou o evento; receitas avulsas em fatia separada.
                </Text>
              </View>
            </View>

            <View style={styles.chartInner}>
              <FinancialPieChart
                slices={pieSlices}
                size={200}
                variant="detailed"
                totalLabel={formatCurrency(pieTotal)}
              />
            </View>

            <Text style={[styles.legendSectionTitle, { color: colors.textSecondary }]}>
              Legenda
            </Text>
            {pieSlices.map((sl, i) => {
              const pct = pieTotal > 0 ? (sl.value / pieTotal) * 100 : 0;
              return (
                <View key={i} style={styles.legendBlock}>
                  <View style={styles.legendTopRow}>
                    <View style={[styles.dot, { backgroundColor: sl.color }]} />
                    <Text style={[styles.legendLabel, { color: colors.text }]} numberOfLines={2}>
                      {sl.label}
                    </Text>
                    <Text style={[styles.legendVal, { color: colors.text }]}>
                      {formatCurrency(sl.value)}
                    </Text>
                  </View>
                  <Text style={[styles.legendPct, { color: colors.textSecondary }]}>
                    {pct.toFixed(1)}% do total
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22 }]}>
            Resumo do mês
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Row label="Receita total" value={formatCurrency(totals.totalRevenueWithIncome)} colors={colors} strong />
            <Row label="Despesas totais" value={formatCurrency(totals.totalExpenses)} colors={colors} />
            <Row
              label="Lucro líquido"
              value={formatCurrency(totals.netProfit)}
              colors={colors}
              valueColor={totals.netProfit >= 0 ? colors.success : colors.error}
              strong
            />
            <CountInline
              label="Total de eventos"
              count={totals.eventCount}
              colors={colors}
            />
            <CountInline
              label="Total de despesas"
              count={totals.expenseEntriesCount}
              colors={colors}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22 }]}>
            Maiores despesas
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {topExpenses.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>Nenhuma despesa neste mês.</Text>
            ) : (
              <>
                {topExpenses.map((row, i) => (
                  <View
                    key={`${row.name}-${i}`}
                    style={[styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listName, { color: colors.text }]} numberOfLines={2}>
                        {row.name}
                      </Text>
                      <Text style={[styles.listSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {row.source}
                      </Text>
                    </View>
                    <Text style={[styles.listValue, { color: colors.error }]}>{formatCurrency(row.value)}</Text>
                  </View>
                ))}
                <View
                  style={[
                    styles.listRow,
                    styles.listTotalFooter,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listName, { color: colors.text, fontWeight: '700' }]}>Total</Text>
                  </View>
                  <Text style={[styles.listValue, { color: colors.error, fontWeight: '700' }]}>
                    {formatCurrency(totals.totalExpenses)}
                  </Text>
                </View>
              </>
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22 }]}>
            Maiores lucros por evento
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: 32 }]}>
            {topProfits.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>Nenhum evento neste mês.</Text>
            ) : (
              <>
                {topProfits.map((row, i) => (
                  <View
                    key={`${row.name}-${i}`}
                    style={[styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listName, { color: colors.text }]} numberOfLines={2}>
                        {row.name}
                      </Text>
                      <Text style={[styles.listSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {formatCalendarDate(row.date)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.listValue,
                        { color: row.profit >= 0 ? colors.success : colors.error },
                      ]}
                    >
                      {formatCurrency(row.profit)}
                    </Text>
                  </View>
                ))}
                <View
                  style={[
                    styles.listRow,
                    styles.listTotalFooter,
                    { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listName, { color: colors.text, fontWeight: '700' }]}>Total</Text>
                  </View>
                  <Text
                    style={[
                      styles.listValue,
                      {
                        fontWeight: '700',
                        color: totals.totalEventProfits >= 0 ? colors.success : colors.error,
                      },
                    ]}
                  >
                    {formatCurrency(totals.totalEventProfits)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type RowColors = {
  text: string;
  textSecondary: string;
  success: string;
  error: string;
};

function Row({
  label,
  value,
  colors,
  valueColor,
  strong,
}: {
  label: string;
  value: string;
  colors: RowColors;
  valueColor?: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          { color: valueColor || colors.text, fontWeight: strong ? '700' : '600' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function CountInline({
  label,
  count,
  colors,
}: {
  label: string;
  count: number;
  colors: RowColors;
}) {
  return (
    <View style={styles.countInlineRow}>
      <Text style={[styles.countInlineLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.countInlineNum, { color: colors.text }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8, width: 40 },
  headerExportBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  chartCard: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 0,
    marginBottom: 4,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  chartIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCardHeaderText: { flex: 1 },
  chartCardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  chartCardSub: { fontSize: 13, lineHeight: 18 },
  chartInner: {
    paddingVertical: 6,
    paddingHorizontal: 0,
    marginBottom: 4,
  },
  legendSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 10,
  },
  legendBlock: { marginBottom: 14 },
  legendTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  card: { borderRadius: 10, padding: 14, borderWidth: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  legendLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  legendVal: { fontSize: 14, fontWeight: '700' },
  legendPct: { fontSize: 12, marginTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  countInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginTop: 2,
  },
  countInlineLabel: {
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
  },
  countInlineNum: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 24,
    textAlign: 'right',
  },
  summaryLabel: { fontSize: 15 },
  summaryValue: { fontSize: 15 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  listTotalFooter: { paddingTop: 4 },
  listName: { fontSize: 15, fontWeight: '600' },
  listSub: { fontSize: 12, marginTop: 2 },
  listValue: { fontSize: 15, fontWeight: '700' },
  muted: { fontSize: 15 },
});
