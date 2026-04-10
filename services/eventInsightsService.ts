import { BRAZIL_UFS, parseCityUf } from '../lib/brazilGeo';
import { getEventsByDateRange } from './supabase/eventService';
import type { Event } from './supabase/eventService';
import { getExpensesGroupedByEventIds, getStandaloneExpensesByArtistDateRange } from './supabase/expenseService';
import type { Expense } from './supabase/expenseService';

function eventCityAndUf(ev: Event): { cityLabel: string; uf: string | null } {
  const raw = ev.state_uf;
  if (raw != null && String(raw).trim()) {
    const uf = String(raw).trim().toUpperCase().slice(0, 2);
    if (BRAZIL_UFS.has(uf)) {
      return { cityLabel: (ev.city || '').trim(), uf };
    }
  }
  return parseCityUf(ev.city);
}

export type PeriodPreset = '30d' | '90d' | '180d' | '365d' | 'year' | 'custom';

export interface LocationBucket {
  key: string;
  label: string;
  eventCount: number;
  totalValue: number;
}

export interface CacheEventRow {
  id: string;
  name: string;
  event_date: string;
  value: number;
  city?: string | null;
}

export interface NamedAmountRow {
  label: string;
  value: number;
  sublabel?: string;
}

export interface EventInsightsResult {
  startDate: string;
  endDate: string;
  totalEvents: number;
  eventsWithCity: number;
  eventsWithUfParsed: number;
  topCitiesByCount: LocationBucket[];
  topCitiesByValue: LocationBucket[];
  topStatesByCount: LocationBucket[];
  topStatesByValue: LocationBucket[];
  highestCache: CacheEventRow[];
  lowestCache: CacheEventRow[];
  /** Soma dos cachês dos eventos no período. */
  revenueFromEvents: number;
  /** Soma das despesas (valor positivo) ligadas a esses eventos. */
  expensesLinkedToEvents: number;
  /** Receitas avulsas (lançamentos com valor negativo no banco). */
  standaloneIncomeTotal: number;
  /** Despesas avulsas (valores positivos). */
  standaloneExpenseTotal: number;
  eventLinkedExpenseEntryCount: number;
  standaloneIncomeEntryCount: number;
  standaloneExpenseEntryCount: number;
  topEventExpenses: NamedAmountRow[];
  topStandaloneIncome: NamedAmountRow[];
  topStandaloneExpenses: NamedAmountRow[];
}

function normalizeLocationKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function addBucket(
  map: Map<string, { label: string; eventCount: number; totalValue: number }>,
  key: string,
  label: string,
  value: number
): void {
  const cur = map.get(key);
  if (cur) {
    cur.eventCount += 1;
    cur.totalValue += value;
  } else {
    map.set(key, { label, eventCount: 1, totalValue: value });
  }
}

const TOP_N = 8;
const CACHE_RANK_N = 10;
const FINANCE_LIST_N = 10;

function expenseLineLabel(ex: Expense): string {
  return (ex.name || ex.description || 'Despesa').trim() || 'Despesa';
}

function standaloneLineLabel(ex: Expense): string {
  return (ex.description || ex.name || 'Lançamento').trim() || 'Lançamento';
}

function standaloneDate(ex: Expense): string {
  const d = ex.date || ex.created_at;
  return typeof d === 'string' ? d.split('T')[0] : '';
}

export function buildEventInsights(
  events: Event[],
  range: { start: string; end: string }
): EventInsightsResult {
  const cityMap = new Map<string, { label: string; eventCount: number; totalValue: number }>();
  const stateMap = new Map<string, { label: string; eventCount: number; totalValue: number }>();

  let eventsWithCity = 0;
  let eventsWithUfParsed = 0;

  const withValue: CacheEventRow[] = [];

  for (const ev of events) {
    const v = ev.value ?? 0;
    const { cityLabel, uf } = eventCityAndUf(ev);
    if (cityLabel) {
      eventsWithCity += 1;
      const ck = normalizeLocationKey(cityLabel);
      addBucket(cityMap, ck, cityLabel, v);
    }
    if (uf) {
      eventsWithUfParsed += 1;
      addBucket(stateMap, uf, uf, v);
    }
    if (ev.value != null && ev.value > 0) {
      withValue.push({
        id: ev.id,
        name: ev.name,
        event_date: ev.event_date,
        value: ev.value,
        city: ev.city ?? null,
      });
    }
  }

  const toSorted = (
    map: Map<string, { label: string; eventCount: number; totalValue: number }>,
    sort: 'count' | 'value'
  ): LocationBucket[] => {
    const rows: LocationBucket[] = [...map.entries()].map(([key, x]) => ({
      key,
      label: x.label,
      eventCount: x.eventCount,
      totalValue: x.totalValue,
    }));
    if (sort === 'count') {
      rows.sort((a, b) => b.eventCount - a.eventCount || b.totalValue - a.totalValue);
    } else {
      rows.sort((a, b) => b.totalValue - a.totalValue || b.eventCount - a.eventCount);
    }
    return rows.slice(0, TOP_N);
  };

  const highestCache = [...withValue].sort((a, b) => b.value - a.value).slice(0, CACHE_RANK_N);
  const lowestCache = [...withValue].sort((a, b) => a.value - b.value).slice(0, CACHE_RANK_N);

  const revenueFromEvents = events.reduce((s, e) => s + (e.value ?? 0), 0);

  return {
    startDate: range.start,
    endDate: range.end,
    totalEvents: events.length,
    eventsWithCity,
    eventsWithUfParsed,
    topCitiesByCount: toSorted(cityMap, 'count'),
    topCitiesByValue: toSorted(cityMap, 'value'),
    topStatesByCount: toSorted(stateMap, 'count'),
    topStatesByValue: toSorted(stateMap, 'value'),
    highestCache,
    lowestCache,
    revenueFromEvents,
    expensesLinkedToEvents: 0,
    standaloneIncomeTotal: 0,
    standaloneExpenseTotal: 0,
    eventLinkedExpenseEntryCount: 0,
    standaloneIncomeEntryCount: 0,
    standaloneExpenseEntryCount: 0,
    topEventExpenses: [],
    topStandaloneIncome: [],
    topStandaloneExpenses: [],
  };
}

/** Mês calendário (monthIndex 0–11), datas YYYY-MM-DD locais (igual `getEventsByMonth`). */
export function dateRangeForCalendarMonth(year: number, monthIndex: number): { start: string; end: string } {
  const startDate = new Date(year, monthIndex, 1).toISOString().split('T')[0];
  const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];
  return { start: startDate, end: endDate };
}

export function dateRangeForCalendarYear(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function dateRangeForPreset(
  preset: Exclude<PeriodPreset, 'custom'>,
  now: Date = new Date()
): { start: string; end: string } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endStr = end.toISOString().split('T')[0];

  if (preset === 'year') {
    const y = end.getFullYear();
    return { start: `${y}-01-01`, end: `${y}-12-31` };
  }

  const days = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 }[preset];
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const startStr = start.toISOString().split('T')[0];
  return { start: startStr, end: endStr };
}

export async function loadEventInsights(
  artistId: string,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; error: string | null; insights?: EventInsightsResult }> {
  const { success, error, events } = await getEventsByDateRange(artistId, startDate, endDate);
  if (!success || !events) {
    return { success: false, error: error || 'Falha ao carregar eventos' };
  }
  const insights = buildEventInsights(events, { start: startDate, end: endDate });

  const eventIds = events.map((e) => e.id);
  const eventById = Object.fromEntries(events.map((e) => [e.id, e])) as Record<string, Event>;

  const [groupedRes, standaloneRes] = await Promise.all([
    getExpensesGroupedByEventIds(eventIds),
    getStandaloneExpensesByArtistDateRange(artistId, startDate, endDate),
  ]);

  let expensesLinkedToEvents = 0;
  const flatEventExpenses: NamedAmountRow[] = [];
  if (groupedRes.success && groupedRes.byEventId) {
    for (const [eid, list] of Object.entries(groupedRes.byEventId)) {
      const ev = eventById[eid];
      const eventName = ev?.name || 'Evento';
      for (const ex of list) {
        const v = typeof ex.value === 'number' ? ex.value : 0;
        if (v <= 0) continue;
        expensesLinkedToEvents += v;
        flatEventExpenses.push({
          label: expenseLineLabel(ex),
          value: v,
          sublabel: eventName,
        });
      }
    }
  }
  flatEventExpenses.sort((a, b) => b.value - a.value);

  let standaloneIncomeTotal = 0;
  let standaloneExpenseTotal = 0;
  const incomeRows: NamedAmountRow[] = [];
  const expenseRows: NamedAmountRow[] = [];

  if (standaloneRes.success && standaloneRes.expenses) {
    for (const ex of standaloneRes.expenses) {
      const v = typeof ex.value === 'number' ? ex.value : 0;
      const dateStr = standaloneDate(ex);
      const sub = dateStr ? dateStr : undefined;
      if (v < 0) {
        const absV = Math.abs(v);
        standaloneIncomeTotal += absV;
        incomeRows.push({
          label: standaloneLineLabel(ex),
          value: absV,
          sublabel: sub,
        });
      } else if (v > 0) {
        standaloneExpenseTotal += v;
        expenseRows.push({
          label: standaloneLineLabel(ex),
          value: v,
          sublabel: sub,
        });
      }
    }
  }
  incomeRows.sort((a, b) => b.value - a.value);
  expenseRows.sort((a, b) => b.value - a.value);

  return {
    success: true,
    error: null,
    insights: {
      ...insights,
      expensesLinkedToEvents,
      standaloneIncomeTotal,
      standaloneExpenseTotal,
      eventLinkedExpenseEntryCount: flatEventExpenses.length,
      standaloneIncomeEntryCount: incomeRows.length,
      standaloneExpenseEntryCount: expenseRows.length,
      topEventExpenses: flatEventExpenses.slice(0, FINANCE_LIST_N),
      topStandaloneIncome: incomeRows.slice(0, FINANCE_LIST_N),
      topStandaloneExpenses: expenseRows.slice(0, FINANCE_LIST_N),
    },
  };
}
