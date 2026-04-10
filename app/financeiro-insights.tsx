import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveArtistContext } from '../contexts/ActiveArtistContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatCalendarDate } from '../lib/dateUtils';
import { supabase } from '../lib/supabase';
import {
  dateRangeForCalendarMonth,
  dateRangeForCalendarYear,
  dateRangeForPreset,
  loadEventInsights,
  type CacheEventRow,
  type EventInsightsResult,
  type NamedAmountRow,
  type PeriodPreset,
} from '../services/eventInsightsService';

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

type AgendaLink =
  | { scope: 'month'; year: number; month: number }
  | { scope: 'year'; year: number };

const PRESETS: { key: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '3 meses' },
  { key: '180d', label: '6 meses' },
  { key: '365d', label: '12 meses' },
  { key: 'year', label: 'Ano atual' },
];

function toYmd(d: Date): string {
  return d.toISOString().split('T')[0];
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

export default function FinanceiroInsightsScreen() {
  const { colors, isDarkMode } = useTheme();
  const receitaAzul = isDarkMode ? '#60a5fa' : '#2563eb';
  const { activeArtist } = useActiveArtistContext();
  const params = useLocalSearchParams<{ scope?: string; month?: string; year?: string }>();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [agendaLink, setAgendaLink] = useState<AgendaLink | null>(null);
  const [preset, setPreset] = useState<PeriodPreset>('90d');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d;
  });
  const [customEnd, setCustomEnd] = useState(() => new Date());
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<EventInsightsResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const scope = params.scope;
    const y = parseInt(String(params.year ?? ''), 10);
    const m = parseInt(String(params.month ?? ''), 10);
    if (scope === 'month' && Number.isFinite(y) && m >= 0 && m <= 11) {
      setAgendaLink({ scope: 'month', year: y, month: m });
      return;
    }
    if (scope === 'year' && Number.isFinite(y)) {
      setAgendaLink({ scope: 'year', year: y });
      return;
    }
    setAgendaLink(null);
  }, [params.scope, params.year, params.month]);

  const range = useMemo(() => {
    if (agendaLink) {
      if (agendaLink.scope === 'month') {
        return dateRangeForCalendarMonth(agendaLink.year, agendaLink.month);
      }
      return dateRangeForCalendarYear(agendaLink.year);
    }
    if (preset === 'custom') {
      let a = new Date(customStart.getFullYear(), customStart.getMonth(), customStart.getDate());
      let b = new Date(customEnd.getFullYear(), customEnd.getMonth(), customEnd.getDate());
      if (a > b) [a, b] = [b, a];
      return { start: toYmd(a), end: toYmd(b) };
    }
    return dateRangeForPreset(preset);
  }, [agendaLink, preset, customStart, customEnd]);

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

  const fetchInsights = useCallback(async () => {
    if (!activeArtist) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { success, error, insights: data } = await loadEventInsights(
        activeArtist.id,
        range.start,
        range.end
      );
      if (!success || !data) {
        setInsights(null);
        setLoadError(error || 'Não foi possível carregar.');
        return;
      }
      setInsights(data);
    } finally {
      setLoading(false);
    }
  }, [activeArtist, range.start, range.end]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  useEffect(() => {
    if (!activeArtist || hasAccess === null) return;
    void fetchInsights();
  }, [activeArtist, hasAccess, fetchInsights]);

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const periodTitle = useMemo(() => {
    if (agendaLink?.scope === 'month') {
      return `${MONTHS_PT[agendaLink.month]} de ${agendaLink.year}`;
    }
    if (agendaLink?.scope === 'year') {
      return `Ano de ${agendaLink.year}`;
    }
    const a = parseYmd(range.start);
    const b = parseYmd(range.end);
    if (!a || !b) return `${range.start} — ${range.end}`;
    return `${formatCalendarDate(range.start)} — ${formatCalendarDate(range.end)}`;
  }, [agendaLink, range.start, range.end]);

  const headerSubtitle = useMemo(() => {
    if (agendaLink?.scope === 'month') {
      return `${MONTHS_PT[agendaLink.month]}/${agendaLink.year}`;
    }
    if (agendaLink?.scope === 'year') {
      return String(agendaLink.year);
    }
    return '';
  }, [agendaLink]);

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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            Estatísticas
          </Text>
          {headerSubtitle ? (
            <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {agendaLink
            ? 'Período igual ao mês ou ano selecionado no Financeiro. Toque em outro filtro para comparar.'
            : 'Filtre por período. Estados contam quando você escolhe o estado ao criar o evento ou quando a cidade estiver como '}
          {!agendaLink ? (
            <>
              <Text style={{ fontWeight: '700' }}>Cidade, UF</Text> no texto (ex.: Curitiba, PR).
            </>
          ) : null}
        </Text>
        <Text style={[styles.rankingScopeNote, { color: colors.textSecondary }]}>
          Sem cidade e sem UF: não entram no top cidade nem no top estado.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {PRESETS.map((p) => {
            const selected = !agendaLink && preset === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                onPress={() => {
                  setAgendaLink(null);
                  setPreset(p.key);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary + '28' : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? colors.primary : colors.text },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => {
              setAgendaLink(null);
              setPreset('custom');
              setCustomModalOpen(true);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: !agendaLink && preset === 'custom' ? colors.primary + '28' : colors.surface,
                borderColor: !agendaLink && preset === 'custom' ? colors.primary : colors.border,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.chipText,
                { color: !agendaLink && preset === 'custom' ? colors.primary : colors.text },
              ]}
            >
              Personalizado
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={[styles.periodCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.periodMain, { color: colors.text }]}>{periodTitle}</Text>
          <Text style={[styles.periodRangeLine, { color: colors.textSecondary }]}>
            {formatCalendarDate(range.start)} — {formatCalendarDate(range.end)}
          </Text>
          <Text style={[styles.periodSub, { color: colors.textSecondary }]}>
            {insights?.totalEvents ?? '—'} evento(s) no período
            {insights != null && insights.eventsWithCity < insights.totalEvents ? (
              <> · {insights.eventsWithCity} com cidade</>
            ) : null}
            {!hasAccess && insights ? (
              <>
                {' · '}
                {insights.eventLinkedExpenseEntryCount}{' '}
                {insights.eventLinkedExpenseEntryCount === 1 ? 'despesa' : 'despesas'} em eventos
                {' · '}
                {insights.standaloneIncomeEntryCount}{' '}
                {insights.standaloneIncomeEntryCount === 1 ? 'receita' : 'receitas'} avulsas
                {' · '}
                {insights.standaloneExpenseEntryCount}{' '}
                {insights.standaloneExpenseEntryCount === 1 ? 'despesa' : 'despesas'} avulsas
              </>
            ) : null}
          </Text>
        </View>

        {loadError ? (
          <Text style={[styles.errorText, { color: colors.error }]}>{loadError}</Text>
        ) : null}

        {loading ? (
          <View style={styles.loaderPad}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : insights ? (
          <>
            {hasAccess ? (
              <>
                <SectionTitle colors={colors.text}>Resumo financeiro do período</SectionTitle>
                <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: 4 }]}>
                  <FinanceSummaryRow
                    label="Receitas de eventos (cachê)"
                    value={formatCurrency(insights.revenueFromEvents)}
                    colors={colors}
                    valueColor={receitaAzul}
                  />
                  <FinanceSummaryRow
                    label="Despesas em eventos"
                    value={formatCurrency(insights.expensesLinkedToEvents)}
                    colors={colors}
                    valueColor={colors.error}
                  />
                  <FinanceSummaryRow
                    label="Receitas avulsas"
                    value={formatCurrency(insights.standaloneIncomeTotal)}
                    colors={colors}
                    valueColor={receitaAzul}
                  />
                  <FinanceSummaryRow
                    label="Despesas avulsas"
                    value={formatCurrency(insights.standaloneExpenseTotal)}
                    colors={colors}
                    valueColor={colors.error}
                  />
                  <FinanceSummaryRow
                    label="Líquido (aprox.)"
                    value={formatCurrency(
                      insights.revenueFromEvents +
                        insights.standaloneIncomeTotal -
                        insights.expensesLinkedToEvents -
                        insights.standaloneExpenseTotal
                    )}
                    colors={colors}
                    valueColor={
                      insights.revenueFromEvents +
                        insights.standaloneIncomeTotal -
                        insights.expensesLinkedToEvents -
                        insights.standaloneExpenseTotal >=
                      0
                        ? colors.success
                        : colors.error
                    }
                    strong
                  />
                </View>
              </>
            ) : null}

            <SectionTitle colors={colors.text}>Top cidades (por eventos)</SectionTitle>
            <BucketCard
              rows={insights.topCitiesByCount}
              colors={colors}
              formatCurrency={formatCurrency}
              mode="count"
              showMoney={hasAccess}
              emptyHint="Nenhuma cidade cadastrada nos eventos deste período."
            />

            {hasAccess ? (
              <>
                <SectionTitle colors={colors.text}>Top cidades (por cachê total)</SectionTitle>
                <BucketCard
                  rows={insights.topCitiesByValue}
                  colors={colors}
                  formatCurrency={formatCurrency}
                  mode="value"
                  showMoney
                  emptyHint="Sem valores ou cidades no período."
                />
              </>
            ) : null}

            <SectionTitle colors={colors.text}>Top estados (UF)</SectionTitle>
            {insights.eventsWithUfParsed === 0 ? (
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                  Nenhum evento com UF reconhecida. Inclua a sigla no campo cidade (ex.: Porto Alegre, RS).
                </Text>
              </View>
            ) : (
              <>
                <SectionSubtitle colors={colors.textSecondary}>Por quantidade de eventos</SectionSubtitle>
                <BucketCard
                  rows={insights.topStatesByCount}
                  colors={colors}
                  formatCurrency={formatCurrency}
                  mode="count"
                  showMoney={hasAccess}
                  emptyHint="—"
                />
                {hasAccess ? (
                  <>
                    <SectionSubtitle colors={colors.textSecondary}>Por cachê total</SectionSubtitle>
                    <BucketCard
                      rows={insights.topStatesByValue}
                      colors={colors}
                      formatCurrency={formatCurrency}
                      mode="value"
                      showMoney
                      emptyHint="—"
                    />
                  </>
                ) : null}
              </>
            )}

            {hasAccess ? (
              <>
                <SectionTitle colors={colors.text}>Maiores cachês</SectionTitle>
                <EventValueList
                  rows={insights.highestCache}
                  colors={colors}
                  formatCurrency={formatCurrency}
                  variant="high"
                  emptyHint="Nenhum evento com cachê maior que zero no período."
                />

                <SectionTitle colors={colors.text}>Menores cachês</SectionTitle>
                <EventValueList
                  rows={insights.lowestCache}
                  colors={colors}
                  formatCurrency={formatCurrency}
                  variant="low"
                  emptyHint="Nenhum evento com cachê maior que zero no período."
                />

                <SectionTitle colors={colors.text}>Maiores despesas em eventos</SectionTitle>
                <NamedAmountList
                  rows={insights.topEventExpenses}
                  colors={colors}
                  formatCurrency={formatCurrency}
                  valueColor={colors.error}
                  emptyHint="Nenhuma despesa registrada nos eventos deste período."
                />

                <SectionTitle colors={colors.text}>Receitas avulsas</SectionTitle>
                <NamedAmountList
                  rows={insights.topStandaloneIncome}
                  colors={colors}
                  formatCurrency={formatCurrency}
                  valueColor={receitaAzul}
                  emptyHint="Nenhuma receita avulsa neste período."
                />

                <SectionTitle colors={colors.text}>Despesas avulsas</SectionTitle>
                <NamedAmountList
                  rows={insights.topStandaloneExpenses}
                  colors={colors}
                  formatCurrency={formatCurrency}
                  valueColor={colors.error}
                  emptyHint="Nenhuma despesa avulsa neste período."
                  marginBottom
                />
              </>
            ) : (
              <View style={[styles.lockNote, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
                <Text style={[styles.lockNoteText, { color: colors.textSecondary }]}>
                  Valores de cachê, resumo financeiro, rankings por valor e listas de despesas/receitas ficam visíveis
                  para gerentes e editores.
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={customModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCustomModalOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Período personalizado</Text>
            <TouchableOpacity
              style={[styles.dateRow, { borderColor: colors.border }]}
              onPress={() => setPickerTarget('start')}
            >
              <Text style={{ color: colors.textSecondary }}>Início</Text>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {formatCalendarDate(toYmd(customStart))}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateRow, { borderColor: colors.border }]}
              onPress={() => setPickerTarget('end')}
            >
              <Text style={{ color: colors.textSecondary }}>Fim</Text>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {formatCalendarDate(toYmd(customEnd))}
              </Text>
            </TouchableOpacity>

            {pickerTarget && (
              <DateTimePicker
                value={pickerTarget === 'start' ? customStart : customEnd}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(ev, date) => {
                  if (Platform.OS === 'android') {
                    setPickerTarget(null);
                  }
                  if (ev.type === 'dismissed' || !date) {
                    if (Platform.OS === 'ios') setPickerTarget(null);
                    return;
                  }
                  if (pickerTarget === 'start') setCustomStart(date);
                  else setCustomEnd(date);
                }}
                themeVariant={isDarkMode ? 'dark' : 'light'}
              />
            )}

            {Platform.OS === 'ios' && pickerTarget ? (
              <TouchableOpacity
                style={[styles.modalOk, { backgroundColor: colors.primary }]}
                onPress={() => setPickerTarget(null)}
              >
                <Text style={styles.modalOkText}>OK</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.modalCloseBtn, { borderColor: colors.primary }]}
              onPress={() => {
                setPickerTarget(null);
                setCustomModalOpen(false);
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Aplicar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ children, colors }: { children: string; colors: string }) {
  return <Text style={[styles.sectionTitle, { color: colors }]}>{children}</Text>;
}

function SectionSubtitle({ children, colors }: { children: string; colors: string }) {
  return (
    <Text style={[styles.sectionSubtitle, { color: colors }]}>{children}</Text>
  );
}

function BucketCard({
  rows,
  colors,
  formatCurrency,
  mode,
  showMoney,
  emptyHint,
}: {
  rows: { label: string; eventCount: number; totalValue: number }[];
  colors: ReturnType<typeof useTheme>['colors'];
  formatCurrency: (n: number) => string;
  mode: 'count' | 'value';
  showMoney: boolean;
  emptyHint: string;
}) {
  if (rows.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.textSecondary }}>{emptyHint}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {rows.map((row, i) => (
        <View
          key={`${row.label}-${i}`}
          style={[
            styles.listRow,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.listName, { color: colors.text }]} numberOfLines={2}>
              {row.label}
            </Text>
            <Text style={[styles.listSub, { color: colors.textSecondary }]}>
              {row.eventCount} {row.eventCount === 1 ? 'evento' : 'eventos'}
              {showMoney && mode === 'value' ? ` · total ${formatCurrency(row.totalValue)}` : ''}
            </Text>
          </View>
          {mode === 'count' ? (
            <Text style={[styles.rankBadge, { color: colors.primary, backgroundColor: colors.primary + '22' }]}>
              {row.eventCount}
            </Text>
          ) : showMoney ? (
            <Text style={[styles.listValue, { color: colors.text }]}>{formatCurrency(row.totalValue)}</Text>
          ) : (
            <Text style={[styles.rankBadge, { color: colors.primary, backgroundColor: colors.primary + '22' }]}>
              {row.eventCount}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function FinanceSummaryRow({
  label,
  value,
  colors,
  valueColor,
  strong,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  valueColor: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.financeSummaryRow}>
      <Text
        style={[styles.financeSummaryLabel, { color: colors.textSecondary }]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.financeSummaryValue,
          { color: valueColor, fontWeight: strong ? '800' : '700' },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function NamedAmountList({
  rows,
  colors,
  formatCurrency,
  valueColor,
  emptyHint,
  marginBottom,
}: {
  rows: NamedAmountRow[];
  colors: ReturnType<typeof useTheme>['colors'];
  formatCurrency: (n: number) => string;
  valueColor: string;
  emptyHint: string;
  marginBottom?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: marginBottom ? 28 : 0 }]}>
        <Text style={{ color: colors.textSecondary }}>{emptyHint}</Text>
      </View>
    );
  }
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, marginBottom: marginBottom ? 28 : 4 },
      ]}
    >
      {rows.map((row, i) => (
        <View
          key={`${row.label}-${row.sublabel ?? ''}-${i}`}
          style={[
            styles.listRow,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.listName, { color: colors.text }]} numberOfLines={2}>
              {row.label}
            </Text>
            {row.sublabel ? (
              <Text style={[styles.listSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {/^\d{4}-\d{2}-\d{2}$/.test(row.sublabel)
                  ? formatCalendarDate(row.sublabel)
                  : row.sublabel}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.listValue, { color: valueColor }]}>{formatCurrency(row.value)}</Text>
        </View>
      ))}
    </View>
  );
}

function EventValueList({
  rows,
  colors,
  formatCurrency,
  variant,
  emptyHint,
}: {
  rows: CacheEventRow[];
  colors: ReturnType<typeof useTheme>['colors'];
  formatCurrency: (n: number) => string;
  variant: 'high' | 'low';
  emptyHint: string;
}) {
  const valueColor = variant === 'high' ? colors.success : colors.text;
  if (rows.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.textSecondary }}>{emptyHint}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, marginBottom: 28 }]}>
      {rows.map((row, i) => (
        <View
          key={`${row.id}-${i}`}
          style={[
            styles.listRow,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.listName, { color: colors.text }]} numberOfLines={2}>
              {row.name}
            </Text>
            <Text style={[styles.listSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {formatCalendarDate(row.event_date)}
              {row.city ? ` · ${row.city}` : ''}
            </Text>
          </View>
          <Text style={[styles.listValue, { color: valueColor }]}>{formatCurrency(row.value)}</Text>
        </View>
      ))}
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
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  headerSub: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  rankingScopeNote: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: -8,
    marginBottom: 10,
  },
  chipsRow: { flexDirection: 'row', gap: 8, paddingBottom: 14, flexWrap: 'nowrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  periodCard: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  periodMain: { fontSize: 15, fontWeight: '700' },
  periodRangeLine: { fontSize: 13, marginTop: 4 },
  periodSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  financeSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  financeSummaryLabel: { fontSize: 14, flex: 1, paddingRight: 8 },
  financeSummaryValue: { fontSize: 15, fontVariant: ['tabular-nums'] },
  errorText: { marginBottom: 12, fontSize: 14 },
  loaderPad: { paddingVertical: 32 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8, marginTop: 6 },
  sectionSubtitle: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 4, textTransform: 'uppercase' },
  card: { borderRadius: 10, padding: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  listName: { fontSize: 15, fontWeight: '600' },
  listSub: { fontSize: 12, marginTop: 2 },
  listValue: { fontSize: 15, fontWeight: '700' },
  rankBadge: {
    minWidth: 36,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    marginBottom: 24,
  },
  lockNoteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    borderRadius: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  modalOk: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalOkText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalCloseBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
});
