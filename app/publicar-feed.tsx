import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrazilStatePickerModal, {
  BrazilStateFieldButton,
} from '../components/BrazilStatePickerModal';
import { usePermissions } from '../contexts/PermissionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatEventLocationSlash } from '../lib/brazilGeo';
import { formatCalendarDate } from '../lib/dateUtils';
import {
  getEventsByMonthWithRole,
  type EventWithRole,
} from '../services/supabase/eventService';
import { publicarFeed, type FeedTipo } from '../services/supabase/feedMarketplaceService';
import { useActiveArtist } from '../services/useActiveArtist';
import {
  extractNumericValueString,
  formatCurrencyBRLInput,
} from '../utils/currencyBRLInput';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toHm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

function todayYmd(): string {
  return toYmd(new Date());
}

function formatTime(t?: string | null) {
  if (!t) return '';
  return String(t).slice(0, 5);
}

export default function PublicarFeedScreen() {
  const { colors, isDarkMode } = useTheme();
  const { activeArtist } = useActiveArtist();
  const { canCreateEvents } = usePermissions();
  const { tipo: tipoParam } = useLocalSearchParams<{ tipo?: string }>();
  const tipo: FeedTipo = tipoParam === 'demanda' ? 'demanda' : 'disponivel';
  const isProcurar = tipo === 'demanda';

  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [inicio, setInicio] = useState(() => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    return d;
  });
  const [fim, setFim] = useState(() => {
    const d = new Date();
    d.setHours(23, 0, 0, 0);
    return d;
  });
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(true);
  const [events, setEvents] = useState<EventWithRole[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [dayModalEvents, setDayModalEvents] = useState<EventWithRole[] | null>(null);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);
  const [estadoUf, setEstadoUf] = useState('');
  const [cidade, setCidade] = useState('');
  const [showEstados, setShowEstados] = useState(false);
  const [cacheDraft, setCacheDraft] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const dayOffsetRef = useRef(0);

  const scrollAteODia = (delay = 50) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, dayOffsetRef.current - 16),
        animated: true,
      });
    }, delay);
  };

  const viewMonth = viewDate.getMonth();
  const viewYear = viewDate.getFullYear();
  const today = todayYmd();

  const cacheNumber = useMemo(() => {
    const raw = extractNumericValueString(cacheDraft);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [cacheDraft]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventWithRole[]> = {};
    events.forEach((event) => {
      if (!event.event_date) return;
      if (!map[event.event_date]) map[event.event_date] = [];
      map[event.event_date].push(event);
    });
    return map;
  }, [events]);

  const calendarMatrix = useMemo(() => {
    const firstWeekDay = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const weeks: ({ dayNumber: number; dateString: string } | null)[][] = [];
    let dayCounter = 1 - firstWeekDay;
    while (dayCounter <= totalDays) {
      const week: ({ dayNumber: number; dateString: string } | null)[] = [];
      for (let i = 0; i < 7; i++) {
        const currentDay = dayCounter + i;
        if (currentDay < 1 || currentDay > totalDays) {
          week.push(null);
        } else {
          week.push({
            dayNumber: currentDay,
            dateString: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`,
          });
        }
      }
      weeks.push(week);
      dayCounter += 7;
    }
    return weeks;
  }, [viewMonth, viewYear]);

  useEffect(() => {
    if (!activeArtist?.id) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoadingEvents(true);
    void getEventsByMonthWithRole(activeArtist.id, viewYear, viewMonth).then((result) => {
      if (cancelled) return;
      setEvents(result.success ? result.events || [] : []);
      setLoadingEvents(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeArtist?.id, viewMonth, viewYear]);

  const selecionarDia = (dateString: string, delay = 50) => {
    if (dateString < today) {
      Alert.alert('Data', 'Escolha um dia de hoje em diante.');
      return false;
    }
    setSelectedYmd(dateString);
    scrollAteODia(delay);
    return true;
  };

  const handleDayPress = (dateString: string) => {
    const dayEvents = eventsByDate[dateString] || [];
    if (dayEvents.length > 0) {
      setDayModalDate(dateString);
      setDayModalEvents(dayEvents);
      return;
    }
    selecionarDia(dateString);
  };

  const submit = async () => {
    if (!activeArtist?.id) {
      Alert.alert('Artista', 'Selecione um artista nas Configurações.');
      return;
    }
    if (!canCreateEvents) {
      Alert.alert('Sem permissão', 'Somente admin ou vendedor pode publicar no feed.');
      return;
    }
    if (!selectedYmd) {
      Alert.alert('Dia', 'Escolha um dia no calendário.');
      return;
    }
    if (toHm(fim) <= toHm(inicio)) {
      Alert.alert('Horário', 'O horário final precisa ser depois do início.');
      return;
    }
    setSaving(true);
    const { success, error } = await publicarFeed({
      artistaId: activeArtist.id,
      feedTipo: tipo,
      eventDate: selectedYmd,
      stateUf: estadoUf,
      cacheValor: cacheNumber,
      city: cidade,
      startTime: toHm(inicio),
      endTime: toHm(fim),
      observacao,
    });
    setSaving(false);
    if (!success) {
      Alert.alert('Erro', error || 'Não foi possível publicar.');
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isProcurar ? 'Procurar' : 'Oferecer'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.tipoHint,
              { backgroundColor: `${isProcurar ? '#4F46E5' : '#0F766E'}14` },
            ]}
          >
            <Ionicons
              name={isProcurar ? 'search' : 'briefcase-outline'}
              size={18}
              color={isProcurar ? '#4F46E5' : '#0F766E'}
            />
            <Text style={[styles.tipoHintText, { color: colors.text }]}>
              {isProcurar
                ? 'Veja as datas já fechadas e publique o dia em que está procurando.'
                : 'Veja as datas já fechadas e ofereça um dia aberto.'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.calendarToggle,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => setCalendarVisible((prev) => !prev)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={calendarVisible ? 'chevron-up' : 'calendar-outline'}
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.calendarToggleText, { color: colors.text }]}>
              {calendarVisible ? 'Ocultar calendário' : 'Mostrar calendário'}
            </Text>
          </TouchableOpacity>

          {calendarVisible ? (
            <View
              style={[
                styles.calendarBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.monthNav}>
                <TouchableOpacity
                  style={[styles.navBtn, { backgroundColor: colors.secondary }]}
                  onPress={() =>
                    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                >
                  <Ionicons name="chevron-back" size={20} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.monthTitle}>
                  <Text style={[styles.monthText, { color: colors.text }]}>
                    {MONTHS[viewMonth]} / {viewYear}
                  </Text>
                  {loadingEvents ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[styles.navBtn, { backgroundColor: colors.secondary }]}
                  onPress={() =>
                    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekHeader}>
                {WEEKDAYS.map((label) => (
                  <Text key={label} style={[styles.weekHeaderText, { color: colors.textSecondary }]}>
                    {label}
                  </Text>
                ))}
              </View>

              {calendarMatrix.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.weekRow}>
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.dayCell} />;
                    }
                    const dayEvents = eventsByDate[day.dateString] || [];
                    const fechado = dayEvents.length > 0;
                    const isToday = day.dateString === today;
                    const isSelected = day.dateString === selectedYmd;
                    const isPast = day.dateString < today && !fechado;
                    return (
                      <TouchableOpacity
                        key={day.dateString}
                        style={[
                          styles.dayCell,
                          isToday && { borderColor: colors.primary, borderWidth: 1.5 },
                          fechado && { backgroundColor: colors.secondary },
                          isSelected && { backgroundColor: `${colors.primary}28` },
                        ]}
                        onPress={() => handleDayPress(day.dateString)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            {
                              color: isPast
                                ? colors.border
                                : fechado || isSelected
                                  ? colors.text
                                  : colors.textSecondary,
                            },
                          ]}
                        >
                          {day.dayNumber}
                        </Text>
                        {fechado ? (
                          <View style={[styles.eventDot, { backgroundColor: colors.error }]} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.eventDot, { backgroundColor: colors.error }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Data fechada
                  </Text>
                </View>
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                  Toque no dia para selecionar ou ver os shows
                </Text>
              </View>

              {events.length > 0 ? (
                <View style={styles.monthEvents}>
                  <Text style={[styles.monthEventsTitle, { color: colors.text }]}>
                    Eventos deste mês
                  </Text>
                  {events.map((event) => (
                    <View
                      key={event.id}
                      style={[styles.eventRow, { borderColor: colors.border }]}
                    >
                      <Ionicons name="lock-closed" size={14} color={colors.error} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>
                          {event.name}
                        </Text>
                        <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>
                          {formatCalendarDate(event.event_date)}
                          {formatTime(event.start_time)
                            ? ` · ${formatTime(event.start_time)}–${formatTime(event.end_time)}`
                            : ''}
                          {formatEventLocationSlash({
                            city: event.city,
                            state_uf: event.state_uf,
                          })
                            ? ` · ${formatEventLocationSlash({
                                city: event.city,
                                state_uf: event.state_uf,
                              })}`
                            : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : !loadingEvents ? (
                <Text style={[styles.emptyMonth, { color: colors.textSecondary }]}>
                  Nenhum evento fechado neste mês.
                </Text>
              ) : null}
            </View>
          ) : null}

          <View
            onLayout={(e) => {
              dayOffsetRef.current = e.nativeEvent.layout.y;
            }}
          >
          <Text style={[styles.label, { color: colors.text }]}>Dia (obrigatório)</Text>
          <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="calendar" size={18} color={colors.primary} />
            <Text
              style={[
                styles.fieldText,
                { color: selectedYmd ? colors.text : colors.textSecondary },
              ]}
            >
              {selectedYmd ? formatCalendarDate(selectedYmd) : 'Toque em um dia no calendário'}
            </Text>
          </View>
          </View>

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.text }]}>Início (obrigatório)</Text>
              <TouchableOpacity
                style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setPicker('start')}
              >
                <Text style={[styles.fieldText, { color: colors.text }]}>{toHm(inicio)}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.text }]}>Fim (obrigatório)</Text>
              <TouchableOpacity
                style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setPicker('end')}
              >
                <Text style={[styles.fieldText, { color: colors.text }]}>{toHm(fim)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {picker ? (
            <View>
              <DateTimePicker
                value={picker === 'start' ? inicio : fim}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(ev, date) => {
                  if (Platform.OS === 'android') setPicker(null);
                  if (ev.type === 'dismissed' || !date) {
                    if (Platform.OS === 'ios' && ev.type === 'dismissed') setPicker(null);
                    return;
                  }
                  if (picker === 'start') setInicio(date);
                  if (picker === 'end') setFim(date);
                }}
                themeVariant={isDarkMode ? 'dark' : 'light'}
              />
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={[styles.okPicker, { backgroundColor: colors.primary }]}
                  onPress={() => setPicker(null)}
                >
                  <Text style={styles.okPickerText}>OK</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.text }]}>Cachê (opcional)</Text>
          <TextInput
            value={cacheDraft}
            onChangeText={(t) => setCacheDraft(formatCurrencyBRLInput(t))}
            keyboardType="number-pad"
            placeholder="R$ 0,00"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />
          <View style={[styles.lockHint, { backgroundColor: `${colors.primary}12` }]}>
            <Ionicons name="lock-closed" size={16} color={colors.primary} />
            <Text style={[styles.lockHintText, { color: colors.textSecondary }]}>
              Ninguém vê no feed. O valor só aparece quando alguém demonstrar interesse.
              Sem valor, fica “a combinar”.
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Estado (opcional)</Text>
          <BrazilStateFieldButton
            selectedUf={estadoUf}
            onPress={() => setShowEstados(true)}
            colors={colors}
          />

          <Text style={[styles.label, { color: colors.text }]}>Cidade (opcional)</Text>
          <TextInput
            value={cidade}
            onChangeText={setCidade}
            placeholder="Local, se quiser informar"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />

          <Text style={[styles.label, { color: colors.text }]}>Observações (opcional)</Text>
          <TextInput
            value={observacao}
            onChangeText={setObservacao}
            placeholder="Formato do show, região da cidade, etc."
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[
              styles.input,
              styles.multiline,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={() => void submit()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Publicar anúncio</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <BrazilStatePickerModal
        visible={showEstados}
        onClose={() => setShowEstados(false)}
        selectedUf={estadoUf}
        onSelect={(uf) => setEstadoUf(uf || '')}
      />

      <Modal
        visible={!!dayModalEvents}
        transparent
        animationType="fade"
        onRequestClose={() => setDayModalEvents(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDayModalEvents(null)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {dayModalDate ? formatCalendarDate(dayModalDate) : 'Data fechada'}
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Já existe show neste dia. Você pode adicionar outro.
            </Text>
            {(dayModalEvents || []).map((event) => (
              <View key={event.id} style={[styles.modalEvent, { borderColor: colors.border }]}>
                <Text style={[styles.eventName, { color: colors.text }]}>{event.name}</Text>
                <Text style={[styles.eventMeta, { color: colors.textSecondary }]}>
                  {formatTime(event.start_time)
                    ? `${formatTime(event.start_time)}–${formatTime(event.end_time)}`
                    : 'Horário não definido'}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.modalAdd, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (!dayModalDate) return;
                if (selecionarDia(dayModalDate, 280)) {
                  setDayModalEvents(null);
                  setDayModalDate(null);
                }
              }}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.okPickerText}>Adicionar novo show</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDayModalEvents(null)}>
              <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  tipoHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  tipoHintText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  calendarToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  calendarToggleText: { fontSize: 15, fontWeight: '600' },
  calendarBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: { alignItems: 'center', gap: 6 },
  monthText: { fontSize: 16, fontWeight: '800' },
  weekHeader: { flexDirection: 'row', marginBottom: 6 },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayText: { fontSize: 15, fontWeight: '700' },
  eventDot: { width: 6, height: 6, borderRadius: 3, marginTop: 3 },
  legend: {
    marginTop: 8,
    gap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12 },
  monthEvents: { marginTop: 12, gap: 8 },
  monthEventsTitle: { fontSize: 14, fontWeight: '800' },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
  },
  eventName: { fontSize: 14, fontWeight: '700' },
  eventMeta: { fontSize: 12, marginTop: 2 },
  emptyMonth: { fontSize: 13, textAlign: 'center', marginTop: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  fieldText: { fontSize: 16, fontWeight: '600', flex: 1 },
  timeRow: { flexDirection: 'row', gap: 10 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  lockHint: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    alignItems: 'flex-start',
  },
  lockHintText: { flex: 1, fontSize: 13, lineHeight: 18 },
  okPicker: {
    alignSelf: 'flex-end',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  okPickerText: { color: '#fff', fontWeight: '800' },
  submit: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalSub: { fontSize: 13, marginTop: 4, marginBottom: 12 },
  modalEvent: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  modalAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 6,
  },
  modalClose: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCloseText: { fontSize: 15, fontWeight: '700' },
});
