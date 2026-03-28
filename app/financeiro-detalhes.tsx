import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { supabase } from '../lib/supabase';
import { getEventsByMonth } from '../services/supabase/eventService';
import { getExpensesByEvent, getStandaloneExpensesByArtist } from '../services/supabase/expenseService';

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
    return {
      totalRevenue,
      standaloneIncomeTotal,
      totalRevenueWithIncome,
      totalExpenses,
      netProfit: totalRevenueWithIncome - totalExpenses,
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
        <View style={{ width: 40 }} />
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
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
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

            <View style={[styles.chartInner, { backgroundColor: colors.background }]}>
              <FinancialPieChart
                slices={pieSlices}
                size={260}
                variant="detailed"
                totalLabel={formatCurrency(pieTotal)}
                strokeColor={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}
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
                  <View style={[styles.legendTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.legendFill,
                        { width: `${Math.min(100, pct)}%`, backgroundColor: sl.color },
                      ]}
                    />
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
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Row label="Receita total" value={formatCurrency(totals.totalRevenueWithIncome)} colors={colors} strong />
            <Row label="Despesas totais" value={formatCurrency(totals.totalExpenses)} colors={colors} />
            <Row
              label="Lucro líquido"
              value={formatCurrency(totals.netProfit)}
              colors={colors}
              valueColor={totals.netProfit >= 0 ? colors.success : colors.error}
              strong
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22 }]}>
            Maiores despesas
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {topExpenses.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>Nenhuma despesa neste mês.</Text>
            ) : (
              topExpenses.map((row, i) => (
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
              ))
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22 }]}>
            Maiores lucros por evento
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 32 }]}>
            {topProfits.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>Nenhum evento neste mês.</Text>
            ) : (
              topProfits.map((row, i) => (
                <View
                  key={`${row.name}-${i}`}
                  style={[styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listName, { color: colors.text }]} numberOfLines={2}>
                      {row.name}
                    </Text>
                    <Text style={[styles.listSub, { color: colors.textSecondary }]} numberOfLines={1}>
                      {row.date}
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
              ))
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
  title: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  chartCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  chartIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCardHeaderText: { flex: 1 },
  chartCardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  chartCardSub: { fontSize: 13, lineHeight: 18 },
  chartInner: {
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 12,
    marginBottom: 8,
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
  card: { borderRadius: 14, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 2 },
  legendLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  legendVal: { fontSize: 14, fontWeight: '700' },
  legendTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  legendFill: {
    height: '100%',
    borderRadius: 3,
  },
  legendPct: { fontSize: 12, marginTop: 4 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: { fontSize: 15 },
  summaryValue: { fontSize: 15 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  listName: { fontSize: 15, fontWeight: '600' },
  listSub: { fontSize: 12, marginTop: 2 },
  listValue: { fontSize: 15, fontWeight: '700' },
  muted: { fontSize: 15 },
});
