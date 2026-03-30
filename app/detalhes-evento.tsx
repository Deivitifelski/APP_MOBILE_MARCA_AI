import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PermissionModal from '../components/PermissionModal';
import OptimizedImage from '../components/OptimizedImage';
import { useTheme } from '../contexts/ThemeContext';
import { formatCalendarDate } from '../lib/dateUtils';
import { supabase } from '../lib/supabase';
import { getEventAuditLog, type EventAuditLogRow } from '../services/supabase/eventAuditService';
import { getEventCreatorName } from '../services/supabase/eventCreatorService';
import {
    Event,
    UpdateEventData,
    createEventWithPermissions,
    deleteEvent,
    getEventById,
    getEventByIdWithPermissions,
    updateEvent,
} from '../services/supabase/eventService';
import { removeEventContractByUrl, uploadEventContractFile } from '../services/supabase/eventContractUploadService';
import {
    buscarArtistasParaConvite,
    cancelarConviteParticipacao,
    enviarConviteParticipacao,
    listarConvitesDoEvento,
    obterConvitePorId,
    obterNomeArtista,
    type ArtistaBuscaConvite,
    type ConviteParticipacaoEventoRow,
} from '../services/supabase/conviteParticipacaoEventoService';
import { getExpensesByEvent, getTotalExpensesByEvent } from '../services/supabase/expenseService';
import { useActiveArtist } from '../services/useActiveArtist';
import { extractNumericValueString, formatCurrencyBRLInput } from '../utils/currencyBRLInput';
import { promptAndShareEvent } from '../utils/eventShare';

function parseEventDateToLocalDate(eventDate: string): Date {
    const [y, m, d] = eventDate.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatLocalDateToISO(d: Date): string {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
}

const CLONE_MONTH_NAMES = [
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
const CLONE_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function CloneEventMonthCalendar({
  selectedDate,
  onSelectDate,
  colors,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  colors: ThemeColors;
}) {
  const [viewYear, setViewYear] = useState(() => selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDate.getMonth());

  useEffect(() => {
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [selectedDate.getTime()]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells: { day: number | null }[] = [];
  for (let i = 0; i < firstDayWeekday; i++) {
    cells.push({ day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d });
  }

  const isDaySelected = (day: number) =>
    selectedDate.getFullYear() === viewYear &&
    selectedDate.getMonth() === viewMonth &&
    selectedDate.getDate() === day;

  return (
    <View style={styles.cloneCalendarWrap}>
      <View style={styles.cloneMonthNav}>
        <TouchableOpacity onPress={goPrevMonth} hitSlop={12} style={styles.cloneMonthNavBtn} accessibilityLabel="Mês anterior">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.cloneMonthNavTitle, { color: colors.text }]}>
          {CLONE_MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={goNextMonth} hitSlop={12} style={styles.cloneMonthNavBtn} accessibilityLabel="Próximo mês">
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.cloneWeekdayRow}>
        {CLONE_WEEKDAYS.map((w) => (
          <Text key={w} style={[styles.cloneWeekdayCell, { color: colors.textSecondary }]}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.cloneDaysGrid}>
        {cells.map((cell, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.cloneDayCell,
              { backgroundColor: colors.background },
              cell.day && isDaySelected(cell.day) ? { backgroundColor: colors.primary } : null,
              !cell.day ? styles.cloneDayCellEmpty : null,
            ]}
            disabled={!cell.day}
            onPress={() => {
              if (cell.day) {
                onSelectDate(new Date(viewYear, viewMonth, cell.day));
              }
            }}
            activeOpacity={0.7}
          >
            {cell.day ? (
              <Text
                style={[
                  styles.cloneDayCellText,
                  { color: colors.text },
                  isDaySelected(cell.day) && styles.cloneDayCellTextSelected,
                ]}
              >
                {cell.day}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function DetalhesEventoScreen() {
  const { colors, isDarkMode } = useTheme();
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneTargetDate, setCloneTargetDate] = useState(() => new Date());
  const [isCloning, setIsCloning] = useState(false);
  const [openingContract, setOpeningContract] = useState(false);
  const [isSavingContract, setIsSavingContract] = useState(false);
  const [pickedContractName, setPickedContractName] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<EventAuditLogRow[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const { activeArtist } = useActiveArtist();
  
  // Estados para controle de acesso
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [canCreateEventsPermission, setCanCreateEventsPermission] = useState(false);

  const [participationFromInviteBanner, setParticipationFromInviteBanner] = useState<string | null>(null);

  const [participationInvites, setParticipationInvites] = useState<ConviteParticipacaoEventoRow[]>([]);
  const [participationInviteeNames, setParticipationInviteeNames] = useState<Record<string, string>>({});
  const [participationInviteeProfiles, setParticipationInviteeProfiles] = useState<Record<string, string>>({});
  const [showParticipationModal, setShowParticipationModal] = useState(false);
  const [participationSearch, setParticipationSearch] = useState('');
  const [participationSearchResults, setParticipationSearchResults] = useState<ArtistaBuscaConvite[]>([]);
  const [participationSearchLoading, setParticipationSearchLoading] = useState(false);
  const [participationSearchError, setParticipationSearchError] = useState<string | null>(null);
  const [inviteMessageDraft, setInviteMessageDraft] = useState('');
  const [inviteCacheDraft, setInviteCacheDraft] = useState('R$ 0,00');
  const [inviteWhatsappDraft, setInviteWhatsappDraft] = useState('');
  const [inviteFunctionDraft, setInviteFunctionDraft] = useState('');
  const [selectedArtistToInvite, setSelectedArtistToInvite] = useState<{ id: string; name: string } | null>(null);
  const [sendingParticipationInvite, setSendingParticipationInvite] = useState(false);

  // Obter usuário atual
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Verificar permissões quando o artista ativo mudar
  useEffect(() => {
    checkUserAccess();
  }, [activeArtist, currentUserId]);

  const checkUserAccess = async () => {
    if (!activeArtist || !currentUserId) {
      setHasAccess(null);
      setIsCheckingAccess(false);
      setCanCreateEventsPermission(false);
      return;
    }

    try {
      setIsCheckingAccess(true);

      // Buscar role diretamente na tabela artist_members
      const { data: memberData, error } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', currentUserId)
        .eq('artist_id', activeArtist.id)
        .single();

      if (error) {
        setHasAccess(false);
        setIsCheckingAccess(false);
        setCanCreateEventsPermission(false);
        return;
      }

      const userRole = memberData?.role;

      // ✅ Ocultar valores APENAS para viewers
      const isViewer = userRole === 'viewer';
      const hasPermission = !isViewer; // Todos menos viewer têm acesso
      const canCreate = ['owner', 'admin', 'editor'].includes(userRole);
      
      setHasAccess(hasPermission);
      setCanCreateEventsPermission(canCreate);
      setIsCheckingAccess(false);
    } catch (error) {
      setHasAccess(false);
      setCanCreateEventsPermission(false);
      setIsCheckingAccess(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!event?.convite_participacao_id) {
        setParticipationFromInviteBanner(null);
        return;
      }
      const { convite } = await obterConvitePorId(event.convite_participacao_id);
      if (cancelled || !convite) return;
      const n = await obterNomeArtista(convite.artista_que_convidou_id);
      if (!cancelled) setParticipationFromInviteBanner(n || 'outro artista');
    })();
    return () => {
      cancelled = true;
    };
  }, [event?.convite_participacao_id]);

  const loadParticipationInvites = React.useCallback(async (origemEventId: string) => {
    const { convites, error } = await listarConvitesDoEvento(origemEventId);
    if (error) {
      setParticipationInvites([]);
      return;
    }
    setParticipationInvites(convites);
    const map: Record<string, string> = {};
    const profiles: Record<string, string> = {};
    for (const c of convites) {
      if (!map[c.artista_convidado_id]) {
        const n = await obterNomeArtista(c.artista_convidado_id);
        if (n) map[c.artista_convidado_id] = n;
        const { data: artistData } = await supabase
          .from('artists')
          .select('profile_url')
          .eq('id', c.artista_convidado_id)
          .maybeSingle();
        if (artistData?.profile_url) profiles[c.artista_convidado_id] = artistData.profile_url;
      }
    }
    setParticipationInviteeNames(map);
    setParticipationInviteeProfiles(profiles);
  }, []);

  useEffect(() => {
    if (!event?.id || !activeArtist?.id) return;
    if (event.artist_id !== activeArtist.id) {
      setParticipationInvites([]);
      return;
    }
    void loadParticipationInvites(event.id);
  }, [event?.id, event?.artist_id, activeArtist?.id, loadParticipationInvites]);

  useEffect(() => {
    if (!showParticipationModal || !event?.artist_id) return;
    const t = setTimeout(() => {
      void (async () => {
        setParticipationSearchLoading(true);
        setParticipationSearchError(null);
        const { artists, error } = await buscarArtistasParaConvite(participationSearch, event.artist_id);
        const convidadosBloqueados = new Set(
          participationInvites
            .filter((c) => c.status === 'pendente' || c.status === 'aceito')
            .map((c) => c.artista_convidado_id)
        );
        setParticipationSearchResults(artists.filter((a) => !convidadosBloqueados.has(a.id)));
        setParticipationSearchError(error);
        setParticipationSearchLoading(false);
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [participationSearch, showParticipationModal, event?.artist_id, participationInvites]);

  const labelConviteParticipacaoStatus = (s: string) => {
    switch (s) {
      case 'pendente':
        return 'Pendente';
      case 'aceito':
        return 'Aceito';
      case 'recusado':
        return 'Recusado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return s;
    }
  };

  const getConviteStatusDateLabel = (c: ConviteParticipacaoEventoRow): string | null => {
    const iso = c.status === 'pendente' ? c.criado_em : c.respondido_em;
    if (!iso) return null;
    const prefixo = c.status === 'pendente' ? 'Enviado em' : 'Respondido em';
    return `${prefixo}: ${formatAuditDateTime(iso)}`;
  };

  const submitParticipationInvite = async () => {
    if (!event || !activeArtist || !selectedArtistToInvite || !currentUserId) return;
    const cacheDigits = extractNumericValueString(inviteCacheDraft);
    const cacheNumerico = cacheDigits ? Number(cacheDigits) : NaN;
    const funcaoLimpa = inviteFunctionDraft.trim();
    if (!inviteCacheDraft.trim() || Number.isNaN(cacheNumerico) || cacheNumerico <= 0) {
      Alert.alert('Cachê obrigatório', 'Informe um valor de cachê válido para enviar o convite.');
      return;
    }
    if (!funcaoLimpa) {
      Alert.alert('Função obrigatória', 'Informe a função do participante para enviar o convite.');
      return;
    }
    if (event.artist_id !== activeArtist.id) return;
    setSendingParticipationInvite(true);
    const { success, error } = await enviarConviteParticipacao({
      eventoOrigemId: event.id,
      artistaQueConvidaId: activeArtist.id,
      artistaConvidadoId: selectedArtistToInvite.id,
      usuarioQueEnviaId: currentUserId,
      mensagem: inviteMessageDraft.trim() || null,
      funcaoParticipacao: funcaoLimpa,
      nomeEvento: event.name,
      dataEvento: event.event_date,
      horaInicio: event.start_time,
      horaFim: event.end_time,
      cacheValor: cacheNumerico,
      cidade: event.city ?? null,
      telefoneContratante: inviteWhatsappDraft.trim() || null,
      descricao: event.description ?? null,
    });
    setSendingParticipationInvite(false);
    if (success) {
      Alert.alert('Enviado', 'O convite foi enviado.');
      setShowParticipationModal(false);
      setSelectedArtistToInvite(null);
      setInviteMessageDraft('');
      setInviteCacheDraft('R$ 0,00');
      setInviteWhatsappDraft('');
      setInviteFunctionDraft('');
      void loadParticipationInvites(event.id);
    } else {
      Alert.alert('Erro', error || 'Não foi possível enviar.');
    }
  };

  const cancelParticipationInviteRow = (c: ConviteParticipacaoEventoRow) => {
    Alert.alert('Cancelar convite', 'Remover o convite pendente para este artista?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim',
        style: 'destructive',
        onPress: async () => {
          const { success, error } = await cancelarConviteParticipacao(c.id);
          if (success && event) void loadParticipationInvites(event.id);
          else Alert.alert('Erro', error || 'Não foi possível cancelar.');
        },
      },
    ]);
  };

  const handleConvidarColaborador = () => {
    if (!handleRestrictedAction('convidar colaborador')) return;
    if (!canCreateEventsPermission || !event || event.artist_id !== activeArtist?.id) {
      setShowPermissionModal(true);
      return;
    }
    setShowParticipationModal(true);
    setSelectedArtistToInvite(null);
    setParticipationSearch('');
    setInviteMessageDraft('');
    setInviteCacheDraft('R$ 0,00');
    setInviteWhatsappDraft(event?.contractor_phone ?? '');
    setInviteFunctionDraft('');
    setParticipationSearchError(null);
  };

  const loadEventData = async (isInitialLoad = true) => {
    if (isInitialLoad) {
      setIsLoading(true);
    }
    
    try {
      // Primeiro, sempre tentar carregar o evento sem permissões para obter todos os dados
      const [eventResult, expensesResult] = await Promise.all([
        getEventById(eventId),
        getTotalExpensesByEvent(eventId)
      ]);

      if (eventResult.success && eventResult.event) {
        let finalEvent = eventResult.event;
        
        // Se temos um usuário logado, verificar permissões
        if (currentUserId) {
          // Verificar se o usuário tem permissão para visualizar este evento
          const permissionResult = await getEventByIdWithPermissions(eventId, currentUserId);
          
          if (permissionResult.error) {
            Alert.alert('Erro', permissionResult.error);
            return;
          }
          
          // Se o usuário não tem permissão para ver valores financeiros, remover o valor
          if (permissionResult.event && !permissionResult.event.value) {
            finalEvent = { ...finalEvent, value: undefined };
          }
        }
        
        setEvent(finalEvent);

        // Histórico de alterações (não bloqueia a tela se falhar)
        try {
          const audit = await getEventAuditLog(eventId, 40);
          if (!audit.error) setAuditLogs(audit.logs.filter((l) => l.action !== 'create'));
        } catch {
          // ignorar
        }
        
        // Buscar nome do criador do evento
        if (finalEvent.created_by) {
          const creatorResult = await getEventCreatorName(finalEvent.created_by);
          if (creatorResult.name) {
            setCreatorName(creatorResult.name);
          }
        }
      } else {
        setShowDeletedModal(true);
      }

      if (expensesResult.success) {
        setTotalExpenses(expensesResult.total || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do evento:', error);
      Alert.alert('Erro', 'Erro ao carregar dados do evento');
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadEventData(true); // Carregamento inicial
  }, [eventId, currentUserId]);

  // Recarregar dados quando a tela receber foco (ex: voltar da tela de editar)
  useFocusEffect(
    React.useCallback(() => {
      loadEventData(false); // Reload silencioso
    }, [eventId])
  );


  const formatDate = (dateString: string) => formatCalendarDate(dateString);

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // HH:MM
  };

  const formatAuditDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fieldLabel: Record<string, string> = {
    name: 'Nome',
    description: 'Descrição',
    value: 'Valor',
    event_date: 'Data',
    start_time: 'Horário',
    end_time: 'Horário',
    city: 'Cidade',
    contractor_phone: 'Telefone',
    confirmed: 'Status',
    tag: 'Tipo',
    contract_url: 'Contrato',
    contract_file_name: 'Contrato',
    ativo: 'Ativo',
  };

  const formatAuditChangeLines = (log: EventAuditLogRow): string[] => {
    if (log.action === 'create') return [];
    if (!log.changed_fields?.length) return ['Atualização'];

    // Agrupar mudanças de horário (start/end) para não poluir
    const changed = new Set(log.changed_fields);

    const toHHMM = (v: any) => {
      if (v == null) return '';
      const s = String(v).trim();
      if (!s) return '';
      return s.slice(0, 5);
    };

    const formatTimeRange = (start: any, end: any) => {
      const s = toHHMM(start);
      const e = toHHMM(end);
      if (s && e) return `${s} - ${e}`;
      if (s) return s;
      if (e) return e;
      return '—';
    };

    // Despesas (registradas via triggers em event_expenses)
    if (log.action === 'expense_add') {
      const name = (log.new_data as any)?.expense_name || 'Despesa';
      const value = (log.new_data as any)?.expense_value;
      const valueTxt = value != null ? formatCurrency(value) : '';
      return [`Despesa adicionada: ${name}${valueTxt ? ` (${valueTxt})` : ''}`];
    }
    if (log.action === 'expense_update') {
      const oldName = (log.old_data as any)?.expense_name || 'Despesa';
      const newName = (log.new_data as any)?.expense_name || 'Despesa';
      const oldVal = (log.old_data as any)?.expense_value;
      const newVal = (log.new_data as any)?.expense_value;
      const nameChanged = oldName !== newName;
      const valChanged = oldVal !== newVal;
      const lines: string[] = ['Despesa editada'];
      if (nameChanged) lines.push(`Nome: ${oldName} → ${newName}`);
      if (valChanged) {
        const o = oldVal != null ? formatCurrency(oldVal) : '—';
        const n = newVal != null ? formatCurrency(newVal) : '—';
        lines.push(`Valor: ${o} → ${n}`);
      }
      return lines;
    }
    if (log.action === 'expense_delete') {
      const name = (log.old_data as any)?.expense_name || 'Despesa';
      const value = (log.old_data as any)?.expense_value;
      const valueTxt = value != null ? formatCurrency(value) : '';
      return [`Despesa removida: ${name}${valueTxt ? ` (${valueTxt})` : ''}`];
    }

    // Contrato: mensagem específica (anexado/substituído/excluído)
    const contractChanged = changed.has('contract_url') || changed.has('contract_file_name');
    if (contractChanged) {
      const oldUrl = (log.old_data as any)?.contract_url;
      const newUrl = (log.new_data as any)?.contract_url;
      const newName = (log.new_data as any)?.contract_file_name;

      if (!newUrl) return ['Contrato excluído'];
      if (!oldUrl) return [`Contrato anexado: ${newName || 'arquivo'}`];
      if (oldUrl && newUrl && oldUrl !== newUrl) {
        if (newName) return [`Contrato substituído: ${newName}`];
        return ['Contrato substituído'];
      }
    }

    const parts: string[] = [];

    if (changed.has('start_time') || changed.has('end_time')) {
      const oldStart = (log.old_data as any)?.start_time;
      const oldEnd = (log.old_data as any)?.end_time;
      const newStart = (log.new_data as any)?.start_time;
      const newEnd = (log.new_data as any)?.end_time;
      const oldTxt = formatTimeRange(oldStart, oldEnd);
      const newTxt = formatTimeRange(newStart, newEnd);
      parts.push(`Horário: ${oldTxt} → ${newTxt}`);
    }

    for (const f of log.changed_fields) {
      if (f === 'start_time' || f === 'end_time' || f === 'contract_url' || f === 'contract_file_name') continue;
      const label = fieldLabel[f] || f;
      const oldV = (log.old_data as any)?.[f];
      const newV = (log.new_data as any)?.[f];

      if (f === 'value') {
        const oldTxt = oldV != null ? formatCurrency(oldV) : '—';
        const newTxt = newV != null ? formatCurrency(newV) : '—';
        parts.push(`${label}: ${oldTxt} → ${newTxt}`);
      } else if (f === 'event_date') {
        const oldTxt = oldV ? formatDate(String(oldV)) : '—';
        const newTxt = newV ? formatDate(String(newV)) : '—';
        parts.push(`${label}: ${oldTxt} → ${newTxt}`);
      } else if (f === 'confirmed') {
        const oldTxt = oldV ? 'Confirmado' : 'A Confirmar';
        const newTxt = newV ? 'Confirmado' : 'A Confirmar';
        parts.push(`${label}: ${oldTxt} → ${newTxt}`);
      } else {
        const oldTxt = oldV == null || oldV === '' ? '—' : String(oldV);
        const newTxt = newV == null || newV === '' ? '—' : String(newV);
        parts.push(`${label}: ${oldTxt} → ${newTxt}`);
      }
    }
    return parts;
  };

  const formatCurrency = (value: number | string) => {
    // Se for string, trata como centavos (para compatibilidade com eventos)
    if (typeof value === 'string') {
      const numericValue = value.replace(/\D/g, '');
      if (!numericValue) return '';
      const number = parseInt(numericValue, 10);
      return `R$ ${(number / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    
    // Se for number, trata como reais (para despesas)
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const extractNumericValue = (formattedValue: string) => {
    const numericValue = formattedValue.replace(/\D/g, '');
    return numericValue ? parseInt(numericValue, 10) / 100 : 0;
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'ensaio':
        return '#10B981'; // Verde
      case 'evento':
        return '#667eea'; // Azul
      case 'reunião':
        return '#F59E0B'; // Laranja
      default:
        return '#667eea'; // Azul padrão
    }
  };

  const getTagIcon = (tag: string) => {
    switch (tag) {
      case 'ensaio':
        return 'musical-notes';
      case 'evento':
        return 'mic';
      case 'reunião':
        return 'people';
      default:
        return 'mic';
    }
  };

  const handleRestrictedAction = (actionName: string) => {
    if (!hasAccess) {
      setShowPermissionModal(true);
      return false;
    }
    return true;
  };

  const addOrReplaceContract = async () => {
    if (!event || !currentUserId) return;
    if (!handleRestrictedAction('gerenciar contrato')) return;

    try {
      const oldUrl = event.contract_url ?? null;
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      setPickedContractName(asset.name ?? 'documento');
      setIsSavingContract(true);
      const upload = await uploadEventContractFile(asset.uri, {
        fileName: asset.name,
        mimeType: asset.mimeType ?? null,
      });

      if (!upload.success || !upload.url) {
        Alert.alert('Erro', upload.error || 'Não foi possível enviar o contrato.');
        return;
      }

      const updateData: UpdateEventData = { contract_url: upload.url, contract_file_name: asset.name ?? null };
      const result = await updateEvent(event.id, updateData, currentUserId);
      if (!result.success) {
        Alert.alert('Erro', result.error || 'Não foi possível salvar o contrato no evento.');
        return;
      }

      await loadEventData(false);
      if (oldUrl) {
        const removed = await removeEventContractByUrl(oldUrl);
        if (!removed.success) {
          Alert.alert(
            'Aviso',
            `Contrato atualizado, mas não foi possível remover o arquivo antigo do Storage.${removed.error ? ` Detalhes: ${removed.error}` : ''}`
          );
        }
      }
      Alert.alert(
        'Sucesso',
        `${event.contract_url ? 'Contrato substituído' : 'Contrato anexado'}: ${asset.name ?? 'arquivo'}`
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo.');
    } finally {
      setIsSavingContract(false);
      setPickedContractName(null);
    }
  };

  const getContractDisplayName = (url: string) => {
    const last = url.split('?')[0]?.split('#')[0]?.split('/').pop() || 'contrato';
    const decoded = (() => {
      try {
        return decodeURIComponent(last);
      } catch {
        return last;
      }
    })();

    // Padrão atual: <ts>_<base>_<rand>.<ext>
    const m = decoded.match(/^\d+_([^_]+)_[a-z0-9]{6,}\.([a-z0-9]{1,8})$/i);
    if (m) return `${m[1]}.${m[2]}`;
    return decoded;
  };

  const removeContract = async () => {
    if (!event || !currentUserId || !event.contract_url) return;
    if (!handleRestrictedAction('gerenciar contrato')) return;

    Alert.alert(
      'Remover contrato',
      'Deseja remover o contrato deste evento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              const oldUrl = event.contract_url ?? null;
              setIsSavingContract(true);
              const updateData: UpdateEventData = { contract_url: null, contract_file_name: null };
              const result = await updateEvent(event.id, updateData, currentUserId);
              if (!result.success) {
                Alert.alert('Erro', result.error || 'Não foi possível remover o contrato.');
                return;
              }
              if (oldUrl) {
                const removed = await removeEventContractByUrl(oldUrl);
                if (!removed.success) {
                  Alert.alert(
                    'Aviso',
                    `Contrato removido do evento, mas não foi possível remover o arquivo do Storage.${removed.error ? ` Detalhes: ${removed.error}` : ''}`
                  );
                }
              }
              await loadEventData(false);
            } finally {
              setIsSavingContract(false);
            }
          },
        },
      ]
    );
  };

  const handleEditEvent = () => {
    if (!handleRestrictedAction('editar')) return;
    if (event?.convite_participacao_id) {
      Alert.alert(
        'Edição bloqueada',
        'Este evento foi criado a partir de um convite de participação e não pode ser alterado após o aceite.'
      );
      return;
    }
    router.push({
      pathname: '/editar-evento',
      params: { eventId: event?.id }
    });
  };

  const handleManageExpenses = () => {
    if (!handleRestrictedAction('gerenciar despesas')) return;
    router.push({
      pathname: '/despesas-evento',
      params: { 
        eventId: event?.id, 
        eventName: event?.name 
      }
    });
  };

  const handleAddExpense = () => {
    if (!handleRestrictedAction('adicionar despesa')) return;
    router.push({
      pathname: '/adicionar-despesa',
      params: { 
        eventId: event?.id, 
        eventName: event?.name 
      }
    });
  };

  const handleDeleteEvent = () => {
    if (!handleRestrictedAction('deletar')) return;
    
    Alert.alert(
      'Deletar Evento',
      `Tem certeza que deseja deletar o evento "${event?.name}"?\n\nEsta ação não pode ser desfeita e todas as despesas relacionadas também serão removidas.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: confirmDeleteEvent
        }
      ]
    );
  };

  const confirmDeleteEvent = async () => {
    if (!event || !currentUserId) return;
    
    setIsDeleting(true);
    
    try {
      const result = await deleteEvent(event.id, currentUserId);
      
      if (result.success) {
        Alert.alert(
          'Evento Deletado',
          'O evento foi deletado com sucesso.',
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
      } else {
        Alert.alert('Erro', result.error || 'Erro ao deletar evento');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao deletar evento');
    } finally {
      setIsDeleting(false);
    }
  };

  const openCloneModal = () => {
    if (!canCreateEventsPermission) return;
    if (!event) return;
    setCloneTargetDate(parseEventDateToLocalDate(event.event_date));
    setShowCloneModal(true);
  };

  const confirmCloneEvent = async () => {
    if (!canCreateEventsPermission || !event || !currentUserId) return;
    setIsCloning(true);
    try {
      const expensesRes = await getExpensesByEvent(event.id);
      const expenses =
        expensesRes.success && expensesRes.expenses?.length
          ? expensesRes.expenses.map((e) => ({
              name: e.name?.trim() ? e.name : 'Despesa',
              value: Number(e.value) || 0,
              receipt_url: e.receipt_url || undefined,
            }))
          : undefined;

      const newDateStr = formatLocalDateToISO(cloneTargetDate);

      const result = await createEventWithPermissions(
        {
          artist_id: event.artist_id,
          user_id: currentUserId,
          name: event.name,
          description: event.description,
          event_date: newDateStr,
          start_time: event.start_time,
          end_time: event.end_time,
          value: event.value,
          city: event.city,
          contractor_phone: event.contractor_phone,
          confirmed: event.confirmed,
          tag: event.tag,
          contract_url: event.contract_url ?? null,
          expenses,
        },
        currentUserId
      );

      if (result.success && result.event) {
        setShowCloneModal(false);
        Alert.alert('Evento duplicado', 'As mesmas informações foram salvas na nova data.', [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/agenda'),
          },
        ]);
      } else {
        Alert.alert('Erro', result.error || 'Não foi possível duplicar o evento.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível duplicar o evento.');
    } finally {
      setIsCloning(false);
    }
  };

  const cloneDateLabel = formatDate(formatLocalDateToISO(cloneTargetDate));

  const handleCompartilharEvento = () => {
    if (!event) return;
    promptAndShareEvent(event, {
      hasFinancialAccess: hasAccess === true,
      artistDisplayName: activeArtist?.name,
    });
  };


  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Detalhes do Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando evento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Detalhes do Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Evento não encontrado</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            O evento solicitado não foi encontrado ou foi removido.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const profit = (event.value || 0) - totalExpenses;

  const openContractFile = async () => {
    if (!event.contract_url) return;
    try {
      setOpeningContract(true);
      const rawName = event.contract_url.split('/').pop() || 'contrato';
      const safeName = decodeURIComponent(rawName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'contrato';
      const baseDir = FileSystem.cacheDirectory ?? '';
      const localUri = `${baseDir}${safeName}`;
      const { uri } = await FileSystem.downloadAsync(event.contract_url, localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      } else {
        await Linking.openURL(event.contract_url);
      }
    } catch {
      try {
        await Linking.openURL(event.contract_url);
      } catch {
        Alert.alert('Erro', 'Não foi possível abrir o arquivo.');
      }
    } finally {
      setOpeningContract(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Detalhes do Evento</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 20 : 10 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Informações do Evento */}
        <View style={[styles.eventCard, { backgroundColor: colors.surface }]}>
          <View style={styles.eventHeader}>
            <Text style={[styles.eventName, { color: colors.text }]}>{event.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: event.confirmed ? colors.success : colors.warning }]}>
              <Ionicons 
                name={event.confirmed ? 'checkmark-circle' : 'time'} 
                size={16} 
                color="#fff" 
              />
              <Text style={styles.statusText}>{event.confirmed ? 'Confirmado' : 'A Confirmar'}</Text>
            </View>
          </View>

          <View style={styles.eventDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.text }]}>{formatDate(event.event_date)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time" size={20} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.text }]}>
                {formatTime(event.start_time)} - {formatTime(event.end_time)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.text }]}>{event.city || 'Não informado'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.text }]}>{event.contractor_phone || 'Não informado'}</Text>
            </View>

            {event.contract_url ? (
              <View style={styles.contractSection}>
                <TouchableOpacity
                  style={styles.contractRow}
                  onPress={() => void openContractFile()}
                  disabled={openingContract}
                  activeOpacity={0.75}
                >
                  <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.detailText, { color: colors.text, marginLeft: 0 }]}>Contrato</Text>
                    <Text style={[styles.contractHint, { color: colors.textSecondary }]}>
                      {isSavingContract && pickedContractName
                        ? `Selecionado: ${pickedContractName}`
                        : `Arquivo: ${event.contract_file_name || getContractDisplayName(event.contract_url)}`}
                    </Text>
                  </View>
                  {openingContract ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="download-outline" size={22} color={colors.text} />
                  )}
                </TouchableOpacity>

                {hasAccess ? (
                  <View style={styles.contractActionsRow}>
                    <TouchableOpacity
                      style={[styles.contractActionBtn, { borderColor: colors.border }]}
                      onPress={() => void addOrReplaceContract()}
                      disabled={isSavingContract}
                    >
                      <Ionicons name="refresh-outline" size={16} color={colors.text} />
                      <Text style={[styles.contractActionText, { color: colors.text }]}>Substituir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.contractActionBtn, { borderColor: colors.error }]}
                      onPress={() => void removeContract()}
                      disabled={isSavingContract}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                      <Text style={[styles.contractActionText, { color: colors.error }]}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.contractSection}>
                <View style={styles.contractRow}>
                  <Ionicons name="document-attach-outline" size={20} color={colors.textSecondary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.detailText, { color: colors.textSecondary, marginLeft: 0 }]}>Contrato</Text>
                    <Text style={[styles.contractHint, { color: colors.textSecondary }]}>Nenhum contrato anexado</Text>
                </View>
                </View>
                {hasAccess ? (
                  <TouchableOpacity
                    style={[styles.contractActionBtn, { borderColor: colors.border, alignSelf: 'flex-start' }]}
                    onPress={() => void addOrReplaceContract()}
                    disabled={isSavingContract}
                  >
                    {isSavingContract ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                    )}
                    <Text style={[styles.contractActionText, { color: colors.primary }]}>Adicionar contrato</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {event.tag && (
              <View style={styles.detailRow}>
                <Ionicons name={getTagIcon(event.tag)} size={20} color={getTagColor(event.tag)} />
                <View style={styles.tagContainer}>
                  <View style={[styles.tagBadge, { backgroundColor: getTagColor(event.tag) }]}>
                    <Text style={styles.tagText}>{event.tag}</Text>
                  </View>
                </View>
              </View>
            )}

            {creatorName && (
              <View style={styles.detailRow}>
                <Ionicons name="person" size={20} color={colors.primary} />
                <Text style={[styles.detailText, { color: colors.text }]}>Criado por: {creatorName}</Text>
              </View>
            )}

            {event.description && (
              <View style={styles.descriptionContainer}>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text" size={20} color={colors.primary} />
                  <Text style={[styles.detailLabel, { color: colors.text }]}>Descrição:</Text>
                </View>
                <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{event.description}</Text>
              </View>
            )}
          </View>
        </View>

        {event?.convite_participacao_id && participationFromInviteBanner ? (
          <View
            style={[
              styles.financialCard,
              { backgroundColor: colors.primary + '14', borderWidth: 1, borderColor: colors.primary + '44' },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="link-outline" size={22} color={colors.primary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.financialTitle, { color: colors.text, marginBottom: 4 }]}>
                  Participação convidada
                </Text>
                <Text style={[styles.detailText, { color: colors.textSecondary, marginLeft: 0 }]}>
                  Este evento foi criado ao aceitar um convite de participação do artista{' '}
                  <Text style={{ fontWeight: '700', color: colors.text }}>{participationFromInviteBanner}</Text>.
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Resumo Financeiro */}
        <View style={[styles.financialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.financialTitle, { color: colors.text }]}>Resumo Financeiro</Text>
          
          {hasAccess ? (
            <>
              <View style={[styles.financialItemCard, { borderColor: colors.border }]}>
                <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>Valor do Evento:</Text>
                <Text style={[styles.financialValue, { color: colors.success }]}>{formatCurrency(event.value || 0)}</Text>
              </View>
              </View>

              <View style={[styles.financialItemCard, { borderColor: colors.border }]}>
                <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>Total de Despesas:</Text>
                <Text style={[styles.financialValue, { color: colors.error }]}>
                  -{formatCurrency(totalExpenses)}
                </Text>
              </View>
              </View>

              <View style={[styles.financialItemCard, styles.financialTotalCard, { borderColor: colors.border }]}>
                <View style={styles.financialRow}>
                <Text style={[styles.financialTotalLabel, { color: colors.text }]}>Lucro Líquido:</Text>
                <Text style={[
                  styles.financialTotalValue,
                  { color: profit >= 0 ? colors.success : colors.error }
                ]}>
                  {formatCurrency(profit)}
                </Text>
              </View>
              </View>
            </>
          ) : (
            <View style={styles.lockedFinancialContainer}>
              <Ionicons name="lock-closed" size={32} color={colors.textSecondary} />
              <Text style={[styles.lockedFinancialText, { color: colors.textSecondary }]}>
                Valores financeiros ocultos
              </Text>
              <Text style={[styles.lockedFinancialSubtext, { color: colors.textSecondary }]}>
                Apenas gerentes e editores podem visualizar dados financeiros
              </Text>
            </View>
          )}
        </View>

        {/* Histórico de edições */}
        <View style={[styles.financialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setShowAudit((v) => !v)}
            activeOpacity={0.8}
            style={styles.auditHeaderRow}
          >
            <Text style={[styles.financialTitle, { color: colors.text, marginBottom: 0 }]}>Histórico de edições</Text>
            <View style={styles.auditHeaderRight}>
              <Text style={[styles.contractHint, { color: colors.textSecondary }]}>
                {hasAccess ? (auditLogs.length > 0 ? `${auditLogs.length} alterações` : 'sem alterações') : 'restrito'}
              </Text>
              <Ionicons name={showAudit ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {showAudit ? (
            !hasAccess ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
                <Text style={[styles.contractHint, { color: colors.textSecondary }]}>
                  O histórico é visível apenas para gerentes e editores.
                </Text>
              </View>
            ) : auditLogs.length === 0 ? (
              <Text style={[styles.detailText, { color: colors.textSecondary, marginLeft: 0, marginTop: 10 }]}>
                Nenhuma alteração registrada ainda.
              </Text>
            ) : (
              <View style={{ gap: 10, marginTop: 10 }}>
                {auditLogs.map((log) => (
                  <View
                    key={log.id}
                    style={[styles.auditItemCard, { borderColor: colors.border }]}
                  >
                    <View style={styles.auditRow}>
                      <OptimizedImage
                        imageUrl={log.actor_profile_url || ''}
                        style={styles.auditAvatar}
                        cacheKey={`audit_${log.actor_user_id || log.id}`}
                        fallbackIcon="person"
                        fallbackIconSize={14}
                        fallbackIconColor="#FFFFFF"
                        showLoadingIndicator={false}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.detailText, { color: colors.text, marginLeft: 0, fontWeight: '600' }]}>
                          {(log.actor_name || 'Usuário') + ' • ' + formatAuditDateTime(log.created_at)}
                        </Text>
                        {formatAuditChangeLines(log).map((line, idx) => (
                          <Text key={`${log.id}_${idx}`} style={[styles.contractHint, { color: colors.textSecondary }]}>
                            * {line}
                          </Text>
                        ))}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : null}
        </View>

        {participationInvites.some((c) => c.status === 'aceito' || c.status === 'recusado' || c.status === 'cancelado' || c.status === 'pendente') ? (
          <View style={[styles.financialCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setShowParticipants((v) => !v)}
              activeOpacity={0.8}
              style={styles.auditHeaderRow}
            >
              <Text style={[styles.financialTitle, { color: colors.text, marginBottom: 0 }]}>Artistas convidados</Text>
              <View style={styles.auditHeaderRight}>
                <Text style={[styles.contractHint, { color: colors.textSecondary }]}>
                  {participationInvites.filter((c) => c.status === 'aceito' || c.status === 'recusado' || c.status === 'cancelado' || c.status === 'pendente').length}{' '}
                  participantes
                </Text>
                <Ionicons name={showParticipants ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
            {showParticipants ? (
              <View style={{ gap: 10, marginTop: 10 }}>
                {participationInvites
                  .filter((c) => c.status === 'aceito' || c.status === 'recusado' || c.status === 'cancelado' || c.status === 'pendente')
                  .map((c) => {
                    const nome = participationInviteeNames[c.artista_convidado_id] || 'Artista';
                    const funcao = c.funcao_participacao?.trim() || 'Participante';
                    const statusColor =
                      c.status === 'aceito'
                        ? colors.success
                        : c.status === 'cancelado'
                          ? colors.warning
                          : c.status === 'pendente'
                            ? colors.primary
                            : colors.error;
                    return (
                      <View key={c.id} style={[styles.participantCard, { borderColor: colors.border }]}>
                        <OptimizedImage
                          imageUrl={participationInviteeProfiles[c.artista_convidado_id] || ''}
                          style={styles.participantAvatar}
                          cacheKey={`participant_${c.artista_convidado_id}`}
                          fallbackIcon="person"
                          fallbackIconSize={16}
                          fallbackIconColor="#FFFFFF"
                          showLoadingIndicator={false}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.participantLine, { color: colors.textSecondary }]}>
                            {nome} - {funcao}
                          </Text>
                          <Text style={[styles.participantStatus, { color: statusColor }]}>
                            {labelConviteParticipacaoStatus(c.status)}
                          </Text>
                          {getConviteStatusDateLabel(c) ? (
                            <Text style={[styles.participantReason, { color: colors.textSecondary }]}>
                              {getConviteStatusDateLabel(c)}
                            </Text>
                          ) : null}
                          {c.status === 'cancelado' && c.motivo_cancelamento ? (
                            <Text style={[styles.participantReason, { color: colors.textSecondary }]}>
                              Motivo: {c.motivo_cancelamento}
                            </Text>
                          ) : null}
                          {c.status === 'recusado' && c.mensagem ? (
                            <Text style={[styles.participantReason, { color: colors.textSecondary }]}>
                              Motivo: {c.mensagem}
                            </Text>
                          ) : null}
                          {c.status === 'pendente' ? (
                            <TouchableOpacity onPress={() => cancelParticipationInviteRow(c)} style={{ marginTop: 6 }}>
                              <Text style={{ color: colors.error, fontSize: 13, fontWeight: '600' }}>Cancelar convite</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Ações */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleCompartilharEvento}
          >
            <Ionicons name="share-outline" size={24} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Compartilhar</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleEditEvent}
          >
            <Ionicons name="create" size={24} color={colors.warning} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Editar Evento</Text>
            {!hasAccess && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>

          {canCreateEventsPermission ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={openCloneModal}
            >
              <Ionicons name="copy-outline" size={24} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Duplicar evento</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleManageExpenses}
          >
            <Ionicons name="receipt" size={24} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Gerenciar Despesas</Text>
            {!hasAccess && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>

          {canCreateEventsPermission && event?.artist_id === activeArtist?.id ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleConvidarColaborador}
            >
              <Ionicons name="people-outline" size={24} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Convidar colaborador</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleAddExpense}
          >
            <Ionicons name="add-circle" size={24} color={colors.success} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Adicionar Despesa</Text>
            {!hasAccess && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleDeleteEvent}
            disabled={isDeleting}
          >
            <Ionicons name="trash" size={24} color={colors.error} />
            <Text style={[styles.actionButtonText, styles.deleteButtonText, { color: colors.error }]}>
              {isDeleting ? 'Deletando...' : 'Deletar Evento'}
            </Text>
            {!hasAccess && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Duplicar evento: escolher nova data */}
      <Modal
        visible={showCloneModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isCloning) setShowCloneModal(false);
        }}
      >
        <View style={styles.deletedModalOverlay}>
          <View style={[styles.cloneModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView
              style={styles.cloneModalScroll}
              contentContainerStyle={styles.cloneModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.cloneModalIcon, { backgroundColor: `${colors.primary}22` }]}>
                <Ionicons name="calendar-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.cloneModalTitle, { color: colors.text }]}>Duplicar evento</Text>
              <Text style={[styles.cloneModalSubtitle, { color: colors.textSecondary }]}>
                Navegue pelos meses e toque no dia desejado. Serão copiados nome, horários, local, descrição, tag, status e as despesas cadastradas (valores e comprovantes).
              </Text>

              <Text style={[styles.cloneSelectedDateLabel, { color: colors.textSecondary }]}>Data selecionada</Text>
              <Text style={[styles.cloneDatePreview, { color: colors.text }]}>{cloneDateLabel}</Text>

              <CloneEventMonthCalendar
                selectedDate={cloneTargetDate}
                onSelectDate={setCloneTargetDate}
                colors={colors}
              />
            </ScrollView>

            <View style={styles.cloneModalActions}>
              <TouchableOpacity
                style={[styles.cloneModalBtnSecondary, { borderColor: colors.border }]}
                onPress={() => !isCloning && setShowCloneModal(false)}
                disabled={isCloning}
              >
                <Text style={[styles.cloneModalBtnSecondaryText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cloneModalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={() => void confirmCloneEvent()}
                disabled={isCloning}
                activeOpacity={0.85}
              >
                {isCloning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.cloneModalBtnPrimaryText}>Duplicar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showParticipationModal}
        transparent
        animationType="fade"
        onRequestClose={() => !sendingParticipationInvite && setShowParticipationModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.participationInviteModalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.participationInviteModalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.participationInviteModalTitle, { color: colors.text }]}>Convidar colaborador</Text>
            <Text style={[styles.participationInviteModalSub, { color: colors.textSecondary }]}>
              Busque pelo nome do perfil artístico (mín. 2 letras). É necessário ter conta no Marca AI.
            </Text>
            {participationInvites.some((c) => c.status === 'pendente') ? (
              <ScrollView
                style={styles.participationInviteList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {participationInvites
                  .filter((c) => c.status === 'pendente')
                  .map((c) => (
                  <View
                    key={c.id}
                    style={[styles.participationInviteRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.participationInviteName, { color: colors.text }]}>
                      {participationInviteeNames[c.artista_convidado_id] || 'Artista'}
                    </Text>
                    <Text style={[styles.participationInviteStatus, { color: colors.textSecondary }]}>
                      {labelConviteParticipacaoStatus(c.status)}
                    </Text>
                    {getConviteStatusDateLabel(c) ? (
                      <Text style={[styles.participationInviteStatus, { color: colors.textSecondary }]}>
                        {getConviteStatusDateLabel(c)}
                      </Text>
                    ) : null}
                    {c.status === 'aceito' ? (
                      <Text style={[styles.participationInviteStatus, { color: colors.textSecondary }]}>
                        Função: {c.funcao_participacao?.trim() || 'Participante'}
                      </Text>
                    ) : null}
                    {c.status === 'cancelado' && c.motivo_cancelamento ? (
                      <Text style={[styles.participationInviteStatus, { color: colors.textSecondary }]}>
                        Motivo: {c.motivo_cancelamento}
                      </Text>
                    ) : null}
                    {c.status === 'pendente' ? (
                      <TouchableOpacity onPress={() => cancelParticipationInviteRow(c)}>
                        <Text style={{ color: colors.error, fontSize: 13, marginTop: 4 }}>Cancelar convite</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <TextInput
              style={[
                styles.participationInviteSearchInput,
                { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
              ]}
              placeholder="Nome do artista..."
              placeholderTextColor={colors.textSecondary}
              value={participationSearch}
              onChangeText={setParticipationSearch}
            />
            {participationSearchLoading ? (
              <ActivityIndicator style={{ marginVertical: 12 }} color={colors.primary} />
            ) : (
              <FlatList
                style={{ maxHeight: 200 }}
                data={participationSearchResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text
                    style={{
                      color: participationSearchError ? colors.error : colors.textSecondary,
                      paddingVertical: 12,
                      textAlign: 'center',
                    }}
                  >
                    {participationSearchError
                      ? participationSearchError
                      : participationSearch.trim().length < 2
                        ? 'Digite pelo menos 2 letras'
                        : 'Nenhum artista encontrado. A busca usa o nome do perfil artístico ou o nome da conta; confira a grafia.'}
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.participationInviteSearchHit, { borderBottomColor: colors.border }]}
                    onPress={() => setSelectedArtistToInvite({ id: item.id, name: item.name })}
                  >
                    <View style={styles.participationInviteSearchHitRow}>
                      <OptimizedImage
                        imageUrl={item.image_url ?? item.profile_url ?? ''}
                        style={styles.participationInviteSearchAvatar}
                        fallbackIcon="person"
                        fallbackIconSize={22}
                        fallbackIconColor={colors.primary}
                        showLoadingIndicator={false}
                      />
                      <Text style={[styles.participationInviteSearchHitName, { color: colors.text }]}>{item.name}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
            {selectedArtistToInvite ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>
                  Convidando: {selectedArtistToInvite.name}
                </Text>

                <TextInput
                  style={[
                    styles.participationInviteSearchInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      marginBottom: 8,
                    },
                  ]}
                  placeholder="Cachê (obrigatório)"
                  placeholderTextColor={colors.textSecondary}
                  value={inviteCacheDraft}
                  onChangeText={(text) => setInviteCacheDraft(formatCurrencyBRLInput(text))}
                  keyboardType="numeric"
                />
                <Text style={[styles.participationInviteFieldHelp, { color: colors.textSecondary }]}>
                  Cachê é o valor de proposta para o participante.
                </Text>
                <TextInput
                  style={[
                    styles.participationInviteSearchInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      marginBottom: 8,
                    },
                  ]}
                  placeholder="WhatsApp (opcional)"
                  placeholderTextColor={colors.textSecondary}
                  value={inviteWhatsappDraft}
                  onChangeText={setInviteWhatsappDraft}
                  keyboardType="phone-pad"
                />
                <Text style={[styles.participationInviteFieldHelp, { color: colors.textSecondary }]}>
                  WhatsApp é o número para contato e alinhamento da participação.
                </Text>
                <TextInput
                  style={[
                    styles.participationInviteSearchInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      marginBottom: 8,
                    },
                  ]}
                  placeholder="Função do participante (obrigatório)"
                  placeholderTextColor={colors.textSecondary}
                  value={inviteFunctionDraft}
                  onChangeText={setInviteFunctionDraft}
                />
                <Text style={[styles.participationInviteFieldHelp, { color: colors.textSecondary }]}>
                  Exemplo: Violão, Voz, Percussão.
                </Text>
                <TextInput
                  style={[
                    styles.participationInviteSearchInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      minHeight: 72,
                    },
                  ]}
                  placeholder="Mensagem (opcional)"
                  placeholderTextColor={colors.textSecondary}
                  value={inviteMessageDraft}
                  onChangeText={setInviteMessageDraft}
                  multiline
                />
                <Text style={[styles.participationInviteFieldHelp, { color: colors.textSecondary }]}>
                  Mensagem serve para adicionar mais detalhes sobre o evento.
                </Text>
              </View>
            ) : null}
            <View style={styles.participationInviteModalActions}>
              <TouchableOpacity
                style={[styles.participationInviteModalBtnSec, { borderColor: colors.border }]}
                onPress={() => !sendingParticipationInvite && setShowParticipationModal(false)}
                disabled={sendingParticipationInvite}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.participationInviteModalBtnPri,
                  { backgroundColor: colors.primary, opacity: selectedArtistToInvite ? 1 : 0.45 },
                ]}
                onPress={() => void submitParticipationInvite()}
                disabled={!selectedArtistToInvite || sendingParticipationInvite}
              >
                {sendingParticipationInvite ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.participationInviteModalBtnPriText}>Enviar convite</Text>
                )}
              </TouchableOpacity>
            </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal de Permissão */}
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acesso Restrito"
        message="Apenas gerentes e editores podem editar eventos, gerenciar despesas, convidar colaboradores e visualizar valores financeiros. Entre em contato com um gerente para solicitar mais permissões."
        icon="lock-closed"
      />

      {/* Modal quando evento foi deletado */}
      <Modal
        visible={showDeletedModal}
        transparent
        animationType="fade"
      >
        <View style={styles.deletedModalOverlay}>
          <View style={[styles.deletedModalContent, { backgroundColor: colors.card }]}>
            <Ionicons name="trash-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 16 }} />
            <Text style={[styles.deletedModalTitle, { color: colors.text }]}>
              Evento não encontrado
            </Text>
            <Text style={[styles.deletedModalMessage, { color: colors.textSecondary }]}>
              Este evento pode já ter sido deletado. A agenda será atualizada.
            </Text>
            <TouchableOpacity
              style={[styles.deletedModalButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowDeletedModal(false);
                router.back();
              }}
            >
              <Text style={styles.deletedModalButtonText}>OK</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eventName: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  eventDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contractRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  contractSection: {
    gap: 10,
  },
  contractActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 32,
  },
  contractActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  contractActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  contractHint: {
    fontSize: 12,
    marginTop: 2,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  auditAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#667eea',
    marginTop: 2,
  },
  auditHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  auditHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 16,
    marginLeft: 12,
  },
  financialCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  financialTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  financialItemCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(127,127,127,0.06)',
  },
  financialTotalCard: {
    marginTop: 2,
  },
  participantLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  participantStatus: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  participantReason: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  participantCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(127,127,127,0.06)',
  },
  participantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#667eea',
    marginRight: 10,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  financialLabel: {
    fontSize: 16,
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  financialTotal: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
  },
  financialTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  financialTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 40,
  },
  actionButton: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  auditItemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(127,127,127,0.06)',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  deleteButton: {
    borderColor: '#ff4444',
    backgroundColor: '#fff5f5',
  },
  deleteButtonText: {
    color: '#ff4444',
  },
  descriptionContainer: {
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 4,
    marginLeft: 28,
    fontStyle: 'italic',
  },
  tagContainer: {
    marginLeft: 12,
  },
  tagBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  lockedFinancialContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  lockedFinancialText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  lockedFinancialSubtext: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 16,
  },
  deletedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deletedModalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  deletedModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  deletedModalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deletedModalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  deletedModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cloneModalContent: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: '88%',
    borderWidth: 1,
    alignItems: 'stretch',
  },
  cloneModalScroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  cloneModalScrollContent: {
    paddingBottom: 8,
    alignItems: 'stretch',
  },
  cloneModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cloneModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  cloneModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
  },
  cloneSelectedDateLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cloneDatePreview: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  cloneCalendarWrap: {
    width: '100%',
  },
  cloneMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  cloneMonthNavBtn: {
    padding: 8,
    borderRadius: 8,
  },
  cloneMonthNavTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  cloneWeekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  cloneWeekdayCell: {
    width: '14.28%',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  cloneDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  cloneDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    marginBottom: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloneDayCellEmpty: {
    backgroundColor: 'transparent',
  },
  cloneDayCellText: {
    fontSize: 15,
    fontWeight: '500',
  },
  cloneDayCellTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  cloneModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 4,
  },
  cloneModalBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloneModalBtnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cloneModalBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cloneModalBtnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  participationInviteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  participationInviteModalCard: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  participationInviteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  participationInviteModalSub: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  participationInviteList: {
    marginBottom: 12,
    maxHeight: 140,
  },
  participationInviteRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  participationInviteName: {
    fontSize: 15,
    fontWeight: '600',
  },
  participationInviteStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  participationInviteSearchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 8,
  },
  participationInviteSearchHit: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  participationInviteSearchHitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participationInviteSearchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  participationInviteSearchHitName: {
    flex: 1,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 12,
  },
  participationInviteFieldHelp: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -2,
    marginBottom: 8,
  },
  participationInviteModalActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  participationInviteModalBtnSec: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginRight: 6,
  },
  participationInviteModalBtnPri: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    marginLeft: 6,
  },
  participationInviteModalBtnPriText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
