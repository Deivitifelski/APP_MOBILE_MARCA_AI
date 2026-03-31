import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import * as Linking from 'expo-linking';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OptimizedImage from '../../components/OptimizedImage';
import PermissionModal from '../../components/PermissionModal';
import { useActiveArtistContext } from '../../contexts/ActiveArtistContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { setAppIconBadge } from '../../services/appIconBadge';
import { artistImageUpdateService } from '../../services/artistImageUpdateService';
import { cacheService } from '../../services/cacheService';
import { getArtists } from '../../services/supabase/artistService';
import { getCurrentUser } from '../../services/supabase/authService';
import { cancelarParticipacaoAceita } from '../../services/supabase/conviteParticipacaoEventoService';
import { getEventById, getEventsByMonthWithRole } from '../../services/supabase/eventService';
import { useNotifications } from '../../services/useNotifications';
import { buildWhatsAppUrl } from '../../utils/brazilPhone';
import { isLikelyNetworkFailure } from '../../utils/isLikelyNetworkFailure';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Máximo de fotos no card (organizador + convidados); excedente não aparece no card — o modal da badge lista todos. */
const MAX_COLLAB_AVATARS_ON_CARD = 10;

/** No modal de participantes (toque na badge), lista colapsada mostra só os primeiros N. */
const PARTICIPANTS_COLLAPSED_PREVIEW = 4;

type AgendaParticipantRow = {
  id: string;
  name: string;
  profile_url: string | null;
  isHost: boolean;
};

export default function AgendaScreen() {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { activeArtist, refreshActiveArtist, isLoading, setActiveArtist, clearArtist } = useActiveArtistContext();
  const [artistImageUpdated, setArtistImageUpdated] = useState<boolean>(false);
  const { unreadCount, loadUnreadCount } = useNotifications();
  const [hasAnyArtist, setHasAnyArtist] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [showRemovedModal, setShowRemovedModal] = useState(false);
  const [showDeletedEventModal, setShowDeletedEventModal] = useState(false);
  const [availableArtists, setAvailableArtists] = useState<any[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [showArtistPickerModal, setShowArtistPickerModal] = useState(false);
  const [artistPickerList, setArtistPickerList] = useState<any[]>([]);
  const [artistPickerSearch, setArtistPickerSearch] = useState('');
  const [isLoadingArtistPicker, setIsLoadingArtistPicker] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);
  const params = useLocalSearchParams<{ showNewUserModal?: string }>();
  const [showNoConnectionModal, setShowNoConnectionModal] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [showInviteEventInfoModal, setShowInviteEventInfoModal] = useState(false);
  const [selectedInviteEventInfo, setSelectedInviteEventInfo] = useState<any | null>(null);
  const [inviteCancelReason, setInviteCancelReason] = useState('');
  const [isCancellingInviteParticipation, setIsCancellingInviteParticipation] = useState(false);
  const [invitePartnerByConviteId, setInvitePartnerByConviteId] = useState<Record<string, { name: string; profile_url: string | null }>>({});
  const [selectedInviteFunction, setSelectedInviteFunction] = useState<string | null>(null);
  const [conviteIdByEventId, setConviteIdByEventId] = useState<Record<string, string>>({});
  /** Organizador + convidados por evento (lista completa; o card só mostra os primeiros). */
  const [participantAvatarsByEventId, setParticipantAvatarsByEventId] = useState<
    Record<string, AgendaParticipantRow[]>
  >({});
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantsModalTitle, setParticipantsModalTitle] = useState('');
  const [participantsModalList, setParticipantsModalList] = useState<AgendaParticipantRow[]>([]);
  const [participantsModalExpanded, setParticipantsModalExpanded] = useState(false);

  const retryAgendaConnectionRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (params.showNewUserModal === '1') {
      setShowNewUserModal(true);
      setWelcomeStep(0);
    }
  }, [params.showNewUserModal]);

  // Bloquear segundo toque: por tempo (debounce) e por ref até sair da tela
  const isNavigatingToEventRef = useRef(false);
  const lastEventPressAtRef = useRef(0);
  const DEBOUNCE_MS = 800;

  // Ao entrar na tela Agenda, zerar o badge do ícone do app; ao sair, liberar toque de novo
  useFocusEffect(
    React.useCallback(() => {
      setAppIconBadge(0);
      return () => {
        isNavigatingToEventRef.current = false;
      };
    }, [])
  );

  const WELCOME_STEPS = [
    {
      title: 'Conta criada com sucesso!',
      subtitle: 'Bem-vindo ao Marca AI. Veja em poucos passos como aproveitar o app.',
      image: true,
      icon: null as string | null,
    },
    {
      title: 'Crie seu perfil artista',
      subtitle: 'Configure seu nome artístico, foto e informações. Você pode gerenciar vários artistas ou bandas.',
      image: false,
      icon: 'person-outline' as const,
    },
    {
      title: 'Gerencie seus eventos',
      subtitle: 'Organize shows, ensaios e compromissos na agenda. Crie eventos, defina datas e convide sua equipe.',
      image: false,
      icon: 'calendar-outline' as const,
    },
    {
      title: 'Controle financeiro',
      subtitle: 'Acompanhe receitas, despesas e lucros por evento. Relatórios simples para você tomar melhores decisões.',
      image: false,
      icon: 'wallet-outline' as const,
    },
    {
      title: 'Pronto para começar',
      subtitle: 'Para gerenciar um artista, crie um perfil de artista ou aguarde um convite de outro usuário.',
      image: false,
      icon: 'rocket-outline' as const,
    },
  ];
  const totalWelcomeSteps = WELCOME_STEPS.length;

  const closeDayModal = () => {
    setShowDayModal(false);
    setSelectedDay(null);
    setSelectedDayEvents([]);
  };
  
  // ✅ VERIFICAR ROLE DIRETAMENTE NO BANCO
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [hasFinancialAccess, setHasFinancialAccess] = useState(false);
  
  // Verificar se usuário tem artistas disponíveis
  useEffect(() => {
    checkIfUserHasArtists();
  }, []);

  const checkIfUserHasArtists = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('artist_members')
        .select('artist_id')
        .eq('user_id', user.id)
        .limit(1);

      setHasAnyArtist(!error && data && data.length > 0);
    } catch (error) {
      // Erro ao verificar artistas
    }
  };

  // Verificar role quando artista mudar
  useEffect(() => {
    // Limpar eventos imediatamente quando artista muda
    setEvents([]);
    checkUserRole();
    
    // Carregar eventos do novo artista
    if (activeArtist) {
      loadEvents(true);
    }
  }, [activeArtist]);

  const checkUserRole = async () => {
    if (!activeArtist) {
      setCurrentUserRole(null);
      setHasFinancialAccess(false);
      setEvents([]); // Limpar eventos quando não há artista
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentUserRole(null);
        setHasFinancialAccess(false);
        return;
      }

      const { data: memberData, error } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('artist_id', activeArtist.id)
        .single();

      if (error || !memberData) {
        setCurrentUserRole(null);
        setHasFinancialAccess(false);
        return;
      }

      const userRole = memberData.role;

      // ✅ Apenas viewer NÃO pode ver valores financeiros
      const isViewer = userRole === 'viewer';
      const canViewFinancials = !isViewer;

      setCurrentUserRole(userRole);
      setHasFinancialAccess(canViewFinancials);
    } catch (error) {
      // Erro ao verificar role
      setCurrentUserRole(null);
      setHasFinancialAccess(false);
    }
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const todayFormatted = (() => {
    const d = new Date();
    const s = d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();
  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    events.forEach(event => {
      if (!event.event_date) {
        return;
      }
      if (!map[event.event_date]) {
        map[event.event_date] = [];
      }
      map[event.event_date].push(event);
    });
    return map;
  }, [events]);
  const calendarMatrix = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstWeekDay = firstDayOfMonth.getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const weeks: ({ dayNumber: number; dateString: string } | null)[][] = [];

    let dayCounter = 1 - firstWeekDay;
    while (dayCounter <= totalDays) {
      const week: ({ dayNumber: number; dateString: string } | null)[] = [];
      for (let i = 0; i < 7; i++) {
        const currentDay = dayCounter + i;
        if (currentDay < 1 || currentDay > totalDays) {
          week.push(null);
        } else {
          const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
          week.push({ dayNumber: currentDay, dateString });
        }
      }
      weeks.push(week);
      dayCounter += 7;
    }

    return weeks;
  }, [currentMonth, currentYear]);

  const toHHMM = (t: any): string => {
    if (!t) return '';
    if (typeof t === 'string') return t.slice(0, 5);
    return String(t).slice(0, 5);
  };

  const hasDefinedTime = (start: any, end: any) => {
    const s = toHHMM(start) || '00:00';
    const e = toHHMM(end) || '00:00';
    // 00:00/00:00 = "não definido"
    return !(s === '00:00' && e === '00:00');
  };

  const formatDisplayDate = (dateString: string | null) => {
    if (!dateString) return '';
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
  };

  const todayString = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    refreshActiveArtist();
    loadUnreadCount();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadConviteIdsByEvent = async () => {
      const eventIds = events.map((e) => e?.id).filter((v): v is string => typeof v === 'string' && v.length > 0);
      if (eventIds.length === 0) {
        if (!cancelled) setConviteIdByEventId({});
        return;
      }

      const { data } = await supabase
        .from('events')
        .select('id, convite_participacao_id')
        .in('id', eventIds);

      const map: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        if (row?.id && row?.convite_participacao_id) {
          map[row.id] = row.convite_participacao_id;
        }
      });
      if (!cancelled) setConviteIdByEventId(map);
    };
    void loadConviteIdsByEvent();
    return () => {
      cancelled = true;
    };
  }, [events]);

  useEffect(() => {
    let cancelled = false;
    const loadInvitePartners = async () => {
      const conviteIds = Array.from(
        new Set(
          events
            .map((e) => e?.convite_participacao_id || conviteIdByEventId[e?.id])
            .filter((v): v is string => typeof v === 'string' && v.length > 0)
        )
      );
      if (conviteIds.length === 0) {
        if (!cancelled) setInvitePartnerByConviteId({});
        return;
      }

      const { data: convites, error: convErr } = await supabase
        .from('convite_participacao_evento')
        .select('id, artista_que_convidou_id')
        .in('id', conviteIds);

      if (convErr || !convites?.length) return;

      const artistIds = Array.from(
        new Set(
          convites
            .map((c: any) => c.artista_que_convidou_id)
            .filter((v: any): v is string => typeof v === 'string' && v.length > 0)
        )
      );
      if (artistIds.length === 0) return;

      const { data: artists } = await supabase
        .from('artists')
        .select('id, name, profile_url')
        .in('id', artistIds);

      const artistMap: Record<string, { name: string; profile_url: string | null }> = {};
      (artists || []).forEach((a: any) => {
        artistMap[a.id] = { name: a.name || 'Artista', profile_url: a.profile_url ?? null };
      });

      const nextMap: Record<string, { name: string; profile_url: string | null }> = {};
      (convites || []).forEach((c: any) => {
        const inviter = artistMap[c.artista_que_convidou_id];
        if (inviter) nextMap[c.id] = inviter;
      });

      if (!cancelled) setInvitePartnerByConviteId(nextMap);
    };

    void loadInvitePartners();
    return () => {
      cancelled = true;
    };
  }, [events, conviteIdByEventId]);

  // Avatares dos artistas convidados (até MAX_COLLAB): mesma lista no evento de origem e no evento espelhado do convidado
  useEffect(() => {
    let cancelled = false;
    const loadParticipantAvatars = async () => {
      if (!activeArtist?.id) {
        if (!cancelled) setParticipantAvatarsByEventId({});
        return;
      }

      const originEventIds = Array.from(
        new Set(
          events
            .filter(
              (e) =>
                e?.artist_id === activeArtist.id &&
                !e?.convite_participacao_id &&
                typeof e?.id === 'string'
            )
            .map((e) => e.id as string)
        )
      );

      const guestEventRows = events
        .map((e) => {
          const cid = e?.convite_participacao_id || conviteIdByEventId[e?.id];
          if (!cid || typeof e?.id !== 'string') return null;
          return { eventId: e.id as string, conviteId: cid as string };
        })
        .filter((v): v is { eventId: string; conviteId: string } => v != null);

      const guestEventIdToOrigin: Record<string, string> = {};
      const guestConviteIds = Array.from(new Set(guestEventRows.map((g) => g.conviteId)));
      if (guestConviteIds.length > 0) {
        const { data: conviteMeta } = await supabase
          .from('convite_participacao_evento')
          .select('id, evento_origem_id')
          .in('id', guestConviteIds);
        const conviteIdToOrigin: Record<string, string> = {};
        (conviteMeta || []).forEach((r: { id: string; evento_origem_id: string }) => {
          if (r?.id && r?.evento_origem_id) conviteIdToOrigin[r.id] = r.evento_origem_id;
        });
        for (const g of guestEventRows) {
          const eo = conviteIdToOrigin[g.conviteId];
          if (eo) guestEventIdToOrigin[g.eventId] = eo;
        }
      }

      const allOriginIds = Array.from(
        new Set([...originEventIds, ...Object.values(guestEventIdToOrigin)])
      );

      if (allOriginIds.length === 0) {
        if (!cancelled) setParticipantAvatarsByEventId({});
        return;
      }

      type ConviteAvatarRow = {
        evento_origem_id: string;
        artista_que_convidou_id: string;
        artista_convidado_id: string;
        criado_em: string;
      };

      const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_app_convites_agenda_avatars', {
        p_event_ids: allOriginIds,
      });

      let convites: ConviteAvatarRow[] = [];
      if (!rpcError && Array.isArray(rpcData)) {
        convites = rpcData as ConviteAvatarRow[];
      } else {
        const { data: direct, error } = await supabase
          .from('convite_participacao_evento')
          .select('evento_origem_id, artista_que_convidou_id, artista_convidado_id, criado_em')
          .in('evento_origem_id', allOriginIds)
          .in('status', ['pendente', 'aceito']);
        if (error) {
          if (!cancelled) setParticipantAvatarsByEventId({});
          return;
        }
        convites = (direct || []) as ConviteAvatarRow[];
      }

      const sorted = [...convites].sort(
        (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
      );

      const byEvent: Record<string, string[]> = {};
      for (const row of sorted) {
        const oid = row.evento_origem_id;
        const inv = row.artista_que_convidou_id;
        const conv = row.artista_convidado_id;
        if (!oid || !inv || !conv) continue;
        if (!byEvent[oid]) byEvent[oid] = [];
        const list = byEvent[oid];
        if (!list.includes(inv)) {
          list.unshift(inv);
        }
        if (!list.includes(conv)) {
          list.push(conv);
        }
      }

      const allArtistIds = Array.from(new Set(Object.values(byEvent).flat()));

      const profileById: Record<string, string | null> = {};
      const nameById: Record<string, string> = {};
      if (allArtistIds.length > 0) {
        const { data: artists } = await supabase
          .from('artists')
          .select('id, name, profile_url')
          .in('id', allArtistIds);

        (artists || []).forEach((a: { id: string; name: string | null; profile_url: string | null }) => {
          profileById[a.id] = a.profile_url ?? null;
          nameById[a.id] = (a.name && String(a.name).trim()) || 'Artista';
        });
      }

      const avatarListsByOriginId: Record<string, AgendaParticipantRow[]> = {};
      for (const [oid, ids] of Object.entries(byEvent)) {
        avatarListsByOriginId[oid] = ids.map((id, index) => ({
          id,
          name: nameById[id] ?? 'Artista',
          profile_url: profileById[id] ?? null,
          isHost: index === 0,
        }));
      }

      const next: Record<string, AgendaParticipantRow[]> = { ...avatarListsByOriginId };
      for (const [guestEventId, eo] of Object.entries(guestEventIdToOrigin)) {
        const list = avatarListsByOriginId[eo];
        if (list && list.length > 0) {
          next[guestEventId] = list;
        }
      }

      if (!cancelled) setParticipantAvatarsByEventId(next);
    };

    void loadParticipantAvatars();
    return () => {
      cancelled = true;
    };
  }, [events, activeArtist?.id, conviteIdByEventId]);

  // Escutar notificações de atualização da imagem do artista
  useEffect(() => {
    const handleArtistImageUpdated = (data: { artistId: string; newImageUrl: string }) => {
      if (activeArtist && data.artistId === activeArtist.id) {
        setArtistImageUpdated(true);
        setImageLoadError(false); // Reset error state
      }
    };

    artistImageUpdateService.onArtistImageUpdated(handleArtistImageUpdated);

    return () => {
      artistImageUpdateService.removeArtistImageUpdatedListener(handleArtistImageUpdated);
    };
  }, [activeArtist]);

  useEffect(() => {
    if (activeArtist) {
      loadEvents(true);
      setImageLoadError(false); // Reset image error state when artist changes
    } else {
      setEvents([]); // Limpar eventos se não houver artista
    }
  }, [activeArtist, currentMonth, currentYear]);

  // Reset image error when artist profile_url changes
  useEffect(() => {
    setImageLoadError(false);
  }, [activeArtist?.profile_url]);

  // Realtime: escutar mudanças na tabela events do artista e atualizar agenda
  useEffect(() => {
    if (!activeArtist) return;

    const artistId = activeArtist.id;
    const refreshAgenda = () => {
      cacheService.invalidateEventsCache(artistId, currentMonth, currentYear);
      loadEvents(true);
    };

    const channel = supabase
      .channel(`events-realtime:${artistId}:${currentYear}-${currentMonth}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `artist_id=eq.${artistId}`,
        },
        refreshAgenda
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('📡 Realtime events: inscrito');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('📡 Realtime events: erro - verifique se executou habilitar-realtime-events.sql');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeArtist?.id, currentMonth, currentYear]);

  // Recarregar eventos quando a tela receber foco (ex: voltar de adicionar/editar evento)
  useFocusEffect(
    React.useCallback(() => {
      // Apenas invalidar cache e recarregar eventos se houver artista
      if (activeArtist) {
        cacheService.invalidateEventsCache(activeArtist.id, currentYear, currentMonth);
        loadEvents(true);
      } else {
        // Verificar se criou novos artistas
        checkIfUserHasArtists();
      }
      loadUnreadCount();
    }, [activeArtist, currentMonth, currentYear])
  );

  // Recarregar artista ativo apenas se a imagem foi atualizada via notificação
  useEffect(() => {
    if (artistImageUpdated && activeArtist) {
      setArtistImageUpdated(false);
      refreshActiveArtist();
    }
  }, [artistImageUpdated]);

  const handleEventPress = async (eventId: string) => {
    const now = Date.now();
    if (now - lastEventPressAtRef.current < DEBOUNCE_MS) return;
    if (isNavigatingToEventRef.current) return;
    lastEventPressAtRef.current = now;
    isNavigatingToEventRef.current = true;

    if (!activeArtist) {
      isNavigatingToEventRef.current = false;
      Alert.alert('Erro', 'Nenhum artista selecionado.');
      return;
    }

    try {
      const { user } = await getCurrentUser();
      if (!user) {
        isNavigatingToEventRef.current = false;
        Alert.alert('Erro', 'Usuário não encontrado');
        return;
      }

      const { data: memberData, error: roleError } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('artist_id', activeArtist.id)
        .single();

      if (roleError || !memberData) {
        isNavigatingToEventRef.current = false;
        Alert.alert('Erro', 'Você não tem acesso a este artista');
        return;
      }

      const userRole = memberData.role;
      const allowedRoles = ['editor', 'admin', 'owner'];
      const canViewDetails = allowedRoles.includes(userRole);

      if (!canViewDetails) {
        isNavigatingToEventRef.current = false;
        setShowPermissionModal(true);
        return;
      }

      const eventResult = await getEventById(eventId);
      if (!eventResult.success || !eventResult.event) {
        isNavigatingToEventRef.current = false;
        setShowDeletedEventModal(true);
        cacheService.invalidateEventsCache(activeArtist.id, currentYear, currentMonth);
        loadEvents(true);
        return;
      }

      if (eventResult.event.convite_participacao_id) {
        setSelectedInviteEventInfo(eventResult.event);
        setInviteCancelReason('');
        setShowInviteEventInfoModal(true);
        isNavigatingToEventRef.current = false;
        return;
      }

      router.push(`/detalhes-evento?eventId=${eventId}`);
    } catch (error) {
      isNavigatingToEventRef.current = false;
      Alert.alert('Erro', 'Erro ao verificar permissões');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadEvents(true),
      checkUserRole()
    ]);
    setRefreshing(false);
  };

  const loadEvents = async (isInitialLoad = true): Promise<boolean> => {
    if (!activeArtist) {
      setEvents([]);
      return true;
    }

    const cacheKeyArtist = activeArtist.id;
    try {
      const cachedEvents = await cacheService.getEventsData<any[]>(
        cacheKeyArtist,
        currentYear,
        currentMonth
      );

      if (cachedEvents && !isInitialLoad) {
        setEvents(cachedEvents);
        return true;
      }

      const result = await getEventsByMonthWithRole(
        activeArtist.id,
        currentYear,
        currentMonth
      );

      if (result.success) {
        const eventsData = result.events || [];
        setEvents(eventsData);
        setLastUpdate(new Date());
        await cacheService.setEventsData(
          activeArtist.id,
          currentYear,
          currentMonth,
          eventsData
        );
        setShowNoConnectionModal(false);
        return true;
      }

      const isAccessDenied =
        result.errorCode === 'P0001' ||
        (result.error &&
          (result.error.includes('Usuário não tem acesso a este artista') ||
            result.error.includes('não tem acesso')));

      if (isAccessDenied) {
        await handleUserRemovedFromArtist();
        return true;
      }

      if (isLikelyNetworkFailure(null, result.error)) {
        if (cachedEvents) {
          setEvents(cachedEvents);
        } else {
          setEvents([]);
        }
        setShowNoConnectionModal(true);
        return false;
      }

      setEvents([]);
      return true;
    } catch (error: any) {
      const isAccessDenied =
        error?.code === 'P0001' ||
        (error?.message &&
          (error.message.includes('Usuário não tem acesso a este artista') ||
            error.message.includes('não tem acesso')));

      if (isAccessDenied) {
        await handleUserRemovedFromArtist();
        return true;
      }

      if (isLikelyNetworkFailure(error)) {
        const cachedEvents = await cacheService.getEventsData<any[]>(
          cacheKeyArtist,
          currentYear,
          currentMonth
        );
        if (cachedEvents) {
          setEvents(cachedEvents);
        } else {
          setEvents([]);
        }
        setShowNoConnectionModal(true);
        return false;
      }

      setEvents([]);
      return true;
    }
  };

  const retryAgendaConnection = async () => {
    setIsRetryingConnection(true);
    try {
      await refreshActiveArtist();
      await loadUnreadCount();
      await checkIfUserHasArtists();
      if (activeArtist) {
        await checkUserRole();
        const ok = await loadEvents(true);
        if (ok) {
          setShowNoConnectionModal(false);
        }
      } else {
        setShowNoConnectionModal(false);
      }
    } finally {
      setIsRetryingConnection(false);
    }
  };

  useEffect(() => {
    retryAgendaConnectionRef.current = retryAgendaConnection;
  });

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const offline =
        state.isConnected === false || state.isInternetReachable === false;
      if (offline) {
        setShowNoConnectionModal(true);
        return;
      }
      const online =
        state.isConnected === true && state.isInternetReachable !== false;
      if (online) {
        setShowNoConnectionModal((open) => {
          if (open) {
            setTimeout(() => void retryAgendaConnectionRef.current(), 0);
          }
          return open;
        });
      }
    });
    return () => unsub();
  }, []);

  const handleUserRemovedFromArtist = async () => {
    try {
      setIsLoadingArtists(true);
      
      // Buscar usuário atual
      const { user } = await getCurrentUser();
      if (!user) {
        setEvents([]);
        return;
      }

      // Buscar todos os artistas do usuário
      const { artists, error } = await getArtists(user.id);
      
      if (error) {
        // Se der erro, limpar artista ativo e mostrar modal sem opções
        await clearArtist();
        setAvailableArtists([]);
        setShowRemovedModal(true);
        setIsLoadingArtists(false);
        return;
      }

      // Filtrar artistas diferentes do atual (que foi removido)
      const otherArtists = (artists || []).filter(artist => artist.id !== activeArtist?.id);
      setAvailableArtists(otherArtists);

      // Limpar artista atual
      await clearArtist();
      setEvents([]);

      // Mostrar modal
      setShowRemovedModal(true);
    } catch (error) {
      console.error('Erro ao verificar artistas:', error);
      await clearArtist();
      setAvailableArtists([]);
      setShowRemovedModal(true);
    } finally {
      setIsLoadingArtists(false);
    }
  };

  const handleSelectOtherArtist = async (artist: any) => {
    try {
      // Definir novo artista ativo
      await setActiveArtist({
        id: artist.id,
        name: artist.name,
        role: artist.role || 'viewer',
        profile_url: artist.profile_url,
        musical_style: artist.musical_style,
        created_at: artist.created_at
      });

      // Fechar modal
      setShowRemovedModal(false);
      setAvailableArtists([]);

      // Recarregar eventos do novo artista
      // O useEffect vai detectar a mudança do activeArtist e carregar automaticamente
    } catch (error) {
      console.error('Erro ao selecionar artista:', error);
      Alert.alert('Erro', 'Não foi possível alterar o artista. Tente novamente.');
    }
  };

  const handleCreateNewArtist = () => {
    setShowRemovedModal(false);
    setAvailableArtists([]);
    router.push('/cadastro-artista');
  };

  const openArtistPickerModal = async () => {
    setShowArtistPickerModal(true);
    setArtistPickerSearch('');
    setIsLoadingArtistPicker(true);
    try {
      const { user, error: userError } = await getCurrentUser();
      if (userError || !user) {
        setArtistPickerList([]);
        return;
      }
      const { artists, error } = await getArtists(user.id);
      setArtistPickerList(error || !artists ? [] : artists);
    } catch {
      setArtistPickerList([]);
    } finally {
      setIsLoadingArtistPicker(false);
    }
  };

  const closeArtistPickerModal = () => {
    setShowArtistPickerModal(false);
    setArtistPickerSearch('');
    setArtistPickerList([]);
  };

  const handleSelectArtistFromPicker = async (artist: any) => {
    try {
      await setActiveArtist({
        id: artist.id,
        name: artist.name,
        role: artist.role || 'viewer',
        profile_url: artist.profile_url,
        musical_style: artist.musical_style,
        created_at: artist.created_at
      });
      closeArtistPickerModal();
    } catch (error) {
      console.error('Erro ao selecionar artista:', error);
      Alert.alert('Erro', 'Não foi possível alterar o artista. Tente novamente.');
    }
  };

  const handleCreateArtistFromPicker = () => {
    closeArtistPickerModal();
    router.push('/cadastro-artista');
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'Gerente';
      case 'admin': return 'Administrador';
      case 'editor': return 'Editor';
      case 'viewer': return 'Visualizador';
      default: return role;
    }
  };

  const filteredArtistPickerList = useMemo(() => {
    const q = artistPickerSearch.trim().toLowerCase();
    if (!q) return artistPickerList;
    return artistPickerList.filter((a) => (a.name || '').toLowerCase().includes(q));
  }, [artistPickerList, artistPickerSearch]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentMonth - 1);
    } else {
      newDate.setMonth(currentMonth + 1);
    }
    setCurrentDate(newDate);
  };

  const handleAddShow = async () => {
    if (!activeArtist) {
      Alert.alert('Erro', 'Nenhum artista selecionado.');
      return;
    }

    // ✅ VERIFICAR PERMISSÃO ATUALIZADA DO BANCO (sempre que clicar)
    try {
      const { user } = await getCurrentUser();
      if (!user) {
        Alert.alert('Erro', 'Usuário não encontrado');
        return;
      }

      // Buscar role atual do usuário DIRETO DO BANCO
      const { data: memberData, error: roleError } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('artist_id', activeArtist.id)
        .single();

      if (roleError || !memberData) {
        Alert.alert('Erro', 'Você não tem acesso a este artista');
        return;
      }

      const userRole = memberData.role;

      // Verificar se pode criar eventos (admin, editor, owner)
      const allowedRoles = ['admin', 'editor', 'owner'];
      const canCreate = allowedRoles.includes(userRole);
      
      if (!canCreate) {
        setShowPermissionModal(true);
        return;
      }

      // Se tem permissão, navegar para tela de adicionar evento
      const selectedDate = new Date(currentYear, currentMonth, 1);
      
      router.push({
        pathname: '/adicionar-evento',
        params: { 
          selectedMonth: currentMonth,
          selectedYear: currentYear,
          selectedDate: selectedDate.toISOString()
        }
      });
    } catch (error) {
      Alert.alert('Erro', 'Erro ao verificar permissões');
    }
  };

  const handleCreateArtist = () => {
    router.push('/cadastro-artista');
  };

  const handleWaitForInvite = () => {
    Alert.alert(
      'Aguardar Convite',
      'Você será notificado quando receber um convite para gerenciar um artista.',
      [{ text: 'OK' }]
    );
  };

  const handleCancelInviteParticipation = async () => {
    if (!selectedInviteEventInfo?.convite_participacao_id) return;
    const motivo = inviteCancelReason.trim();
    if (!motivo) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo para cancelar a participação.');
      return;
    }
    try {
      setIsCancellingInviteParticipation(true);
      const { user } = await getCurrentUser();
      const { success, error } = await cancelarParticipacaoAceita(
        selectedInviteEventInfo.convite_participacao_id,
        motivo,
        user?.id ?? null
      );
      if (!success) {
        Alert.alert('Erro', error || 'Não foi possível cancelar a participação.');
        return;
      }
      setShowInviteEventInfoModal(false);
      setSelectedInviteEventInfo(null);
      setInviteCancelReason('');
      if (activeArtist) {
        cacheService.invalidateEventsCache(activeArtist.id, currentYear, currentMonth);
        loadEvents(true);
      }
      Alert.alert('Participação cancelada', 'Seu cancelamento foi enviado para quem convidou.');
    } finally {
      setIsCancellingInviteParticipation(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!showInviteEventInfoModal) {
      setSelectedInviteFunction(null);
      return;
    }
    const loadInviteModalFunction = async () => {
      const conviteId = selectedInviteEventInfo?.convite_participacao_id;
      if (!conviteId) {
        if (!cancelled) setSelectedInviteFunction(null);
        return;
      }
      const { data: convite } = await supabase
        .from('convite_participacao_evento')
        .select('funcao_participacao')
        .eq('id', conviteId)
        .maybeSingle();
      const suggestedFunction = convite?.funcao_participacao?.trim() || null;
      if (!cancelled) setSelectedInviteFunction(suggestedFunction);
    };
    void loadInviteModalFunction();
    return () => {
      cancelled = true;
    };
  }, [showInviteEventInfoModal, selectedInviteEventInfo?.convite_participacao_id]);

  useEffect(() => {
    if (showParticipantsModal) {
      setParticipantsModalExpanded(false);
    }
  }, [showParticipantsModal, participantsModalTitle]);

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

  const formatEventValueBRL = (value: number | string) => {
    const n = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (Number.isNaN(n)) return 'R$ 0,00';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleOpenParticipantsModal = (item: any) => {
    const full = participantAvatarsByEventId[item.id];
    if (full && full.length > 0) {
      setParticipantsModalList(full);
      setParticipantsModalTitle(String(item.name || 'Participantes'));
      setShowParticipantsModal(true);
      return;
    }
    const conviteIdForCard = item.convite_participacao_id || conviteIdByEventId[item.id];
    const inviter = conviteIdForCard ? invitePartnerByConviteId[conviteIdForCard] : null;
    if (inviter) {
      setParticipantsModalList([
        {
          id: conviteIdForCard || 'invite',
          name: inviter.name,
          profile_url: inviter.profile_url,
          isHost: true,
        },
      ]);
      setParticipantsModalTitle(String(item.name || 'Participantes'));
      setShowParticipantsModal(true);
    }
  };

  const renderShow = ({ item }: { item: any }) => {
    // Proteção: não renderizar se não houver artista ativo
    if (!activeArtist) {
      return null;
    }
    
    // Parse da data sem conversão de fuso horário
    const [year, month, day] = item.event_date.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    const dayOfWeek = eventDate.toLocaleDateString('pt-BR', { weekday: 'short' });

    const conviteIdForCard = item.convite_participacao_id || conviteIdByEventId[item.id];
    const isInvitedEvent = !!conviteIdForCard;
    const inviterForCard = conviteIdForCard ? invitePartnerByConviteId[conviteIdForCard] : null;
    const fromParticipantMap = participantAvatarsByEventId[item.id] || [];
    const collabAvatars: { profile_url: string | null }[] =
      fromParticipantMap.length > 0
        ? fromParticipantMap.slice(0, MAX_COLLAB_AVATARS_ON_CARD).map((p) => ({ profile_url: p.profile_url }))
        : isInvitedEvent && inviterForCard
          ? [{ profile_url: inviterForCard.profile_url }]
          : [];
    
    const timeRange =
      hasDefinedTime(item.start_time, item.end_time)
        ? `${toHHMM(item.start_time)}${
            toHHMM(item.end_time) && toHHMM(item.end_time) !== toHHMM(item.start_time) ? ` – ${toHHMM(item.end_time)}` : ''
          }`
        : '';
    const metaLineParts: string[] = [];
    if (timeRange) metaLineParts.push(timeRange);
    if (item.city?.trim()) metaLineParts.push(item.city.trim());
    const metaLine = metaLineParts.join(' · ');

    return (
      <TouchableOpacity
        style={[
          styles.showCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        onPress={() => handleEventPress(item.id)}
        activeOpacity={hasFinancialAccess ? 0.7 : 1}
      >
        <View style={styles.showContent}>
          <View style={[styles.showDateSection, { backgroundColor: colors.primary }]}>
            <Text style={styles.showDateNumber}>{day}</Text>
            <Text style={styles.showDateText}>{dayOfWeek}</Text>
          </View>

          <View style={styles.showInfoSection}>
              <View style={styles.eventNameContainer}>
                <Text
                  style={[styles.showName, { color: colors.text }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {item.name}
                </Text>
                {!hasFinancialAccess && (
                  <Ionicons name="lock-closed" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                )}
              </View>

              {item.tag ? (
                <View style={styles.glLabelsRow}>
                  <View style={[styles.glLabelPill, { borderColor: `${getTagColor(item.tag)}55`, backgroundColor: `${getTagColor(item.tag)}18` }]}>
                    <Ionicons name={getTagIcon(item.tag)} size={11} color={getTagColor(item.tag)} />
                    <Text style={[styles.glLabelText, { color: colors.text }]} numberOfLines={1}>
                      {item.tag}
                    </Text>
                  </View>
                </View>
              ) : null}

              {metaLine ? (
                <Text style={[styles.glMetaLine, { color: colors.textSecondary }]} numberOfLines={2}>
                  {metaLine}
                </Text>
              ) : null}

              <View style={[styles.showFooterRow, { borderTopColor: colors.border }]}>
                <View style={styles.showValueLeft}>
                  {item.value !== null && item.value !== undefined ? (
                    <Text style={[styles.showValue, { color: colors.primary }]} numberOfLines={1}>
                      {formatEventValueBRL(item.value)}
                    </Text>
                  ) : (
                    <View style={styles.lockedValueContainer}>
                      <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
                      <Text style={[styles.lockedValueText, { color: colors.textSecondary }]}>Valor oculto</Text>
                    </View>
                  )}
                </View>
                <View style={styles.showFooterRight}>
                  {collabAvatars.length > 0 ? (
                    <TouchableOpacity
                      style={[styles.collabFooterBadge, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}28` }]}
                      onPress={() => handleOpenParticipantsModal(item)}
                      activeOpacity={0.75}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                    >
                      <View style={styles.collabAvatarStack}>
                        {collabAvatars.map((a, idx) => (
                          <View
                            key={`${item.id}_collab_${idx}`}
                            style={[
                              styles.collabStackAvatarWrapper,
                              ...(idx > 0 ? [styles.collabStackAvatarOverlap] : []),
                              { borderColor: colors.surface, zIndex: idx, backgroundColor: colors.secondary },
                            ]}
                          >
                            <OptimizedImage
                              imageUrl={a.profile_url || ''}
                              style={styles.collabStackAvatarInner}
                              cacheKey={`collab_stack_${item.id}_${idx}_${a.profile_url || 'none'}`}
                              fallbackIcon="person"
                              fallbackIconSize={9}
                              fallbackIconColor="#FFFFFF"
                              showLoadingIndicator={false}
                            />
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  ) : null}
                  <View style={styles.showArrowSection}>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </View>
                </View>
              </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  const handleDayPress = async (dateString: string | null) => {
    if (!dateString) return;
    const dayEvents = eventsByDate[dateString];
    
    // Se houver eventos, mostrar modal com os eventos
    if (dayEvents && dayEvents.length > 0) {
      setSelectedDay(dateString);
      setSelectedDayEvents(dayEvents);
      setShowDayModal(true);
      return;
    }

    // Se não houver eventos, navegar para criar evento com a data setada
    if (!activeArtist) {
      Alert.alert('Erro', 'Nenhum artista selecionado.');
      return;
    }

    // Verificar permissão para criar eventos
    try {
      const { user } = await getCurrentUser();
      if (!user) {
        Alert.alert('Erro', 'Usuário não encontrado');
        return;
      }

      // Buscar role atual do usuário DIRETO DO BANCO
      const { data: memberData, error: roleError } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('artist_id', activeArtist.id)
        .single();

      if (roleError || !memberData) {
        Alert.alert('Erro', 'Você não tem acesso a este artista');
        return;
      }

      const userRole = memberData.role;

      // Verificar se pode criar eventos (admin, editor, owner)
      const allowedRoles = ['admin', 'editor', 'owner'];
      const canCreate = allowedRoles.includes(userRole);
      
      if (!canCreate) {
        setShowPermissionModal(true);
        return;
      }

      // Parse da data do dateString (formato: YYYY-MM-DD)
      const [year, month, day] = dateString.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);

      // Navegar para tela de adicionar evento com a data setada
      router.push({
        pathname: '/adicionar-evento',
        params: { 
          selectedMonth: month - 1, // month é 0-indexed
          selectedYear: year,
          selectedDate: selectedDate.toISOString()
        }
      });
    } catch (error) {
      Alert.alert('Erro', 'Erro ao verificar permissões');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { 
        backgroundColor: colors.surface, 
        borderBottomColor: colors.border,
        paddingTop: insets.top + 20
      }]}>
        {/* Header do Artista */}
        {activeArtist && (
          <View style={styles.artistHeader}>
            <View style={styles.artistInfo}>
              <TouchableOpacity onPress={openArtistPickerModal} activeOpacity={0.8}>
                <OptimizedImage
                  imageUrl={activeArtist.profile_url || ''}
                  style={[styles.artistAvatar, { borderColor: colors.border }]}
                  cacheKey={`artist_${activeArtist.id}`}
                  fallbackIcon="musical-notes"
                  fallbackIconSize={24}
                  fallbackIconColor={colors.primary}
                  showLoadingIndicator={false}
                  onLoadSuccess={() => {
                    setImageLoadError(false);
                  }}
                  onLoadError={(error) => {
                    setImageLoadError(true);
                  }}
                />
              </TouchableOpacity>
              <View style={styles.artistDetails}>
                <View style={styles.artistNameRow}>
                  <Text style={[styles.artistName, { color: colors.text }]}>{activeArtist.name}</Text>
                  <View style={styles.headerActions}>
                    {/* Ícone de Notificações */}
                    <TouchableOpacity
                      style={styles.notificationButton}
                      onPress={() => router.push('/notificacoes')}
                    >
                      <Ionicons name="notifications-outline" size={24} color={colors.primary} />
                      {unreadCount > 0 && (
                        <View style={styles.notificationBadge}>
                          <Text style={styles.badgeText}>
                            {unreadCount > 99 ? '99+' : unreadCount.toString()}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.artistSubtitle, { color: colors.textSecondary }]}>Agenda de Shows</Text>
              </View>
            </View>
          </View>
        )}
        
        {!activeArtist && (
          <View style={styles.noArtistHeader}>
            <Text style={[styles.title, { color: colors.text }]}>Agenda de Shows</Text>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/notificacoes')}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.primary} />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount.toString()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {/* Navegação do mês */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.secondary }]}
            onPress={() => navigateMonth('prev')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          
          <Text style={[styles.monthYear, { color: colors.text }]}>
            {months[currentMonth]} / {currentYear}
          </Text>
          
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.secondary }]}
            onPress={() => navigateMonth('next')}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.todayRow, { backgroundColor: colors.secondary + '55' }]}>
          <Ionicons name="today-outline" size={17} color={colors.primary} />
          <Text style={[styles.todayText, { color: colors.textSecondary }]} numberOfLines={2}>
            Hoje · {todayFormatted}
          </Text>
        </View>
      </View>

      <ScrollView 
        style={[styles.content, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando...</Text>
          </View>
        ) : !activeArtist ? (
          /* Estado vazio - sem artista selecionado */
          <View style={[styles.emptyStateContainer, { backgroundColor: colors.background }]}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="musical-notes" size={64} color={colors.textSecondary} />
            </View>
            
            {hasAnyArtist ? (
              /* Usuário tem artistas mas nenhum selecionado */
              <>
                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                  Selecione um Artista
                </Text>
                <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
                  Você precisa selecionar um artista para acessar a agenda de shows.
                </Text>
                
                <View style={styles.emptyStateActions}>
                  <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: colors.primary }]}
                    onPress={() => router.push('/selecionar-artista')}
                  >
                    <Ionicons name="list" size={20} color="#fff" />
                    <Text style={styles.createButtonText}>Selecionar Artista</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Usuário não tem artistas */
              <>
                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                  Nenhum perfil para gerenciar
                </Text>
                <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
                  Você ainda não tem nenhum artista para gerenciar. Crie um perfil agora ou aguarde um convite.
                </Text>
                
                <View style={styles.emptyStateActions}>
                  <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: colors.primary }]}
                    onPress={handleCreateArtist}
                  >
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.createButtonText}>Criar Agora</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.waitButton, { backgroundColor: colors.secondary }]}
                    onPress={handleWaitForInvite}
                  >
                    <Ionicons name="time" size={20} color={colors.primary} />
                    <Text style={[styles.waitButtonText, { color: colors.primary }]}>Aguardar Convite</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.calendarToggleButton,
                { backgroundColor: colors.surface, borderColor: colors.border }
              ]}
              onPress={() => setIsCalendarVisible(prev => !prev)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isCalendarVisible ? 'chevron-up' : 'calendar-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.calendarToggleText, { color: colors.text }]}>
                {isCalendarVisible ? 'Ocultar calendário' : 'Mostrar calendário'}
              </Text>
            </TouchableOpacity>

            {isCalendarVisible && (
              <View style={[
                styles.calendarContainer,
                { backgroundColor: colors.surface, borderColor: colors.border }
              ]}>
                <View style={styles.calendarHeaderRow}>
                  {weekdayLabels.map(label => (
                    <Text
                      key={label}
                      style={[styles.calendarHeaderText, { color: colors.textSecondary }]}
                    >
                      {label}
                    </Text>
                  ))}
                </View>

                {calendarMatrix.map((week, weekIndex) => (
                  <View key={`week-${weekIndex}`} style={styles.calendarWeekRow}>
                    {week.map((day, dayIndex) => {
                      if (!day) {
                        return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.calendarDayCell} />;
                      }

                      const dayEvents = eventsByDate[day.dateString] || [];
                      const hasEvents = dayEvents.length > 0;
                      const isToday = day.dateString === todayString;

                      return (
                        <TouchableOpacity
                          key={day.dateString}
                          style={[
                            styles.calendarDayCell,
                            isToday && { borderColor: colors.primary, borderWidth: 1.5 },
                            hasEvents && { backgroundColor: colors.secondary }
                          ]}
                          onPress={() => handleDayPress(day.dateString)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              { color: hasEvents ? colors.text : colors.textSecondary },
                              isToday && styles.calendarDayTodayText
                            ]}
                          >
                            {day.dayNumber}
                          </Text>
                          {hasEvents && (
                            <View
                              style={[
                                styles.eventIndicator,
                                { backgroundColor: colors.primary }
                              ]}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.showsSection}>
              {events.length > 0 ? (
                <FlatList
                  data={events}
                  renderItem={renderShow}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              ) : (
                <View style={styles.noShowsContainer}>
                  <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.noShowsText, { color: colors.textSecondary }]}>
                    Nenhum show agendado para este mês
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Botão flutuante para adicionar show - só aparece quando há artistas */}
      {activeArtist && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={handleAddShow}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal de Permissão */}
      <Modal
        visible={showDayModal}
        transparent
        animationType="fade"
        onRequestClose={closeDayModal}
      >
        <View style={styles.dayModalOverlay}>
          <TouchableWithoutFeedback onPress={closeDayModal}>
            <View style={styles.dayModalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={[styles.dayModalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={styles.dayModalCloseButton}
              onPress={closeDayModal}
              activeOpacity={0.7}
              hitSlop={{ top: 24, bottom: 24, left: 24, right: 24 }}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={[styles.dayModalTitle, { color: colors.text }]}>
              {formatDisplayDate(selectedDay)}
            </Text>

            {selectedDayEvents.map(event => (
              <TouchableOpacity
                key={event.id}
                style={[styles.dayEventCard, { borderColor: colors.border }]}
                activeOpacity={0.8}
                onPress={() => {
                  closeDayModal();
                  handleEventPress(event.id);
                }}
              >
                <View style={styles.dayEventHeader}>
                  <Ionicons
                    name="musical-notes"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={[styles.dayEventName, { color: colors.text }]}>
                    {event.name}
                  </Text>
                </View>
                <View style={styles.dayEventMeta}>
                  {hasDefinedTime(event.start_time, event.end_time) ? (
                    <>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={colors.textSecondary}
                      />
                      <Text style={[styles.dayEventTime, { color: colors.textSecondary }]}>
                        {toHHMM(event.start_time)}
                        {toHHMM(event.end_time) && toHHMM(event.end_time) !== toHHMM(event.start_time) ? ` - ${toHHMM(event.end_time)}` : ''}
                      </Text>
                    </>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}

            {selectedDayEvents.length === 0 && (
              <Text style={[styles.dayEventEmptyText, { color: colors.textSecondary }]}>
                Nenhum evento para este dia.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showNoConnectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoConnectionModal(false)}
      >
        <View style={styles.removedModalOverlay}>
          <View style={[styles.removedModalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.removedModalIcon, { backgroundColor: `${colors.primary}22` }]}>
              <Ionicons name="cloud-offline-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.removedModalTitle, { color: colors.text }]}>
              Sem conexão com a internet
            </Text>
            <Text style={[styles.removedModalMessage, { color: colors.textSecondary }]}>
              Não foi possível carregar as informações da agenda. Verifique sua rede e tente novamente.
            </Text>
            <TouchableOpacity
              style={[
                styles.deletedEventModalButton,
                {
                  backgroundColor: colors.primary,
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 48,
                },
              ]}
              onPress={() => void retryAgendaConnection()}
              disabled={isRetryingConnection}
              activeOpacity={0.85}
            >
              {isRetryingConnection ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.deletedEventModalButtonText}>Tentar novamente</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showInviteEventInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowInviteEventInfoModal(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.deletedEventModalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
              <View style={[styles.deletedEventModalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, maxWidth: 360 }]}>
                <Text style={[styles.deletedEventModalTitle, { color: colors.text }]}>Evento de participação</Text>
                {selectedInviteEventInfo ? (
                  <ScrollView
                    style={{ width: '100%' }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={[styles.inviteInfoLine, { color: colors.text }]}>Evento: {selectedInviteEventInfo.name}</Text>
                    <Text style={[styles.inviteInfoLine, { color: colors.textSecondary }]}>
                      Horário: {selectedInviteEventInfo.start_time?.slice(0, 5)}–{selectedInviteEventInfo.end_time?.slice(0, 5)}
                    </Text>
                    {selectedInviteEventInfo.city ? (
                      <Text style={[styles.inviteInfoLine, { color: colors.textSecondary }]}>Local: {selectedInviteEventInfo.city}</Text>
                    ) : null}
                    {selectedInviteEventInfo.value != null ? (
                      <Text style={[styles.inviteInfoLine, { color: colors.textSecondary }]}>
                        Cachê: {formatEventValueBRL(selectedInviteEventInfo.value)}
                      </Text>
                    ) : null}
                    {selectedInviteEventInfo.contractor_phone ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Text style={[styles.inviteInfoLine, { color: colors.textSecondary, flex: 1, marginBottom: 0 }]}>
                          WhatsApp: {selectedInviteEventInfo.contractor_phone}
                        </Text>
                        {buildWhatsAppUrl(selectedInviteEventInfo.contractor_phone) ? (
                          <TouchableOpacity
                            onPress={() => {
                              const url = buildWhatsAppUrl(selectedInviteEventInfo.contractor_phone);
                              if (url) void Linking.openURL(url);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Abrir WhatsApp"
                          >
                            <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                    {selectedInviteFunction ? (
                      <Text style={[styles.inviteInfoLine, { color: colors.textSecondary }]}>
                        Função sugerida: {selectedInviteFunction}
                      </Text>
                    ) : null}
                    {selectedInviteEventInfo.description ? (
                      <Text style={[styles.inviteInfoLine, { color: colors.textSecondary }]}>
                        Observações: {selectedInviteEventInfo.description}
                      </Text>
                    ) : null}
                    <TextInput
                      value={inviteCancelReason}
                      onChangeText={setInviteCancelReason}
                      placeholder="Motivo do cancelamento (obrigatório)"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      style={[styles.inviteCancelReasonInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                  </ScrollView>
                ) : null}
                <View style={styles.inviteModalActions}>
                  <TouchableOpacity
                    style={[
                      styles.deletedEventModalButton,
                      styles.inviteBtnSecondary,
                      { borderColor: colors.border, marginTop: 16, flex: 1 },
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowInviteEventInfoModal(false);
                    }}
                  >
                    <Text style={[styles.deletedEventModalButtonText, styles.inviteModalButtonText, { color: colors.textSecondary }]}>Fechar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.deletedEventModalButton,
                      styles.inviteBtnPrimary,
                      { backgroundColor: colors.error, marginTop: 16, opacity: isCancellingInviteParticipation ? 0.7 : 1, flex: 1 },
                    ]}
                    onPress={() => void handleCancelInviteParticipation()}
                    disabled={isCancellingInviteParticipation}
                  >
                    <Text style={[styles.deletedEventModalButtonText, styles.inviteModalButtonText]}>
                      {isCancellingInviteParticipation ? 'Cancelando...' : 'Cancelar participação'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showParticipantsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowParticipantsModal(false)}
      >
        <View style={styles.dayModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowParticipantsModal(false)}>
            <View style={styles.dayModalBackdrop} />
          </TouchableWithoutFeedback>
          <View
            style={[
              styles.dayModalContent,
              {
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                maxHeight: '82%',
              },
            ]}
          >
            {(() => {
              const list = participantsModalList;
              const expandable = list.length > PARTICIPANTS_COLLAPSED_PREVIEW;
              const headerDisabled = !expandable;
              const listToShow =
                participantsModalExpanded || !expandable
                  ? list
                  : list.slice(0, PARTICIPANTS_COLLAPSED_PREVIEW);
              const participantRow = (p: AgendaParticipantRow, suffix: string) => (
                <View
                  key={`${p.id}_${p.isHost ? 'h' : 'g'}_${suffix}`}
                  style={[styles.inviterRow, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}
                >
                  <OptimizedImage
                    imageUrl={p.profile_url || ''}
                    style={styles.inviterAvatar}
                    cacheKey={`participants_modal_${p.id}_${p.profile_url || 'none'}`}
                    fallbackIcon="person"
                    fallbackIconSize={18}
                    fallbackIconColor="#FFFFFF"
                    showLoadingIndicator={false}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inviterLabel, { color: colors.textSecondary }]}>
                      {p.isHost ? 'Organizador' : 'Convidado'}
                    </Text>
                    <Text style={[styles.inviterName, { color: colors.text }]}>{p.name}</Text>
                  </View>
                </View>
              );
              return (
                <>
                  <TouchableOpacity
                    style={[styles.participantsSectionHeader, { marginBottom: 4 }]}
                    onPress={() => {
                      if (!headerDisabled) {
                        setParticipantsModalExpanded((v) => !v);
                      }
                    }}
                    disabled={headerDisabled}
                    activeOpacity={headerDisabled ? 1 : 0.65}
                  >
                    <Text
                      style={[
                        styles.deletedEventModalTitle,
                        { color: colors.text, alignSelf: 'stretch', textAlign: 'left', marginBottom: 0, flex: 1 },
                      ]}
                    >
                      Participantes
                      {list.length > 0 ? ` (${list.length})` : ''}
                    </Text>
                    {expandable ? (
                      <Ionicons
                        name={participantsModalExpanded ? 'chevron-up' : 'chevron-down'}
                        size={22}
                        color={colors.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                  {participantsModalTitle ? (
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 10, alignSelf: 'stretch' }}
                      numberOfLines={2}
                    >
                      {participantsModalTitle}
                    </Text>
                  ) : null}
                  {expandable && !participantsModalExpanded ? (
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginBottom: 10,
                        alignSelf: 'stretch',
                      }}
                    >
                      Toque no título para ver todos
                    </Text>
                  ) : null}
                  {expandable && participantsModalExpanded ? (
                    <ScrollView
                      style={{ alignSelf: 'stretch', maxHeight: 420 }}
                      contentContainerStyle={{ paddingBottom: 8 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                      keyboardShouldPersistTaps="handled"
                    >
                      {list.map((p) => participantRow(p, 'exp'))}
                    </ScrollView>
                  ) : (
                    <ScrollView
                      style={{ alignSelf: 'stretch', maxHeight: 360 }}
                      contentContainerStyle={{ paddingBottom: 8 }}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      {listToShow.map((p) => participantRow(p, 'col'))}
                    </ScrollView>
                  )}
                </>
              );
            })()}
            <TouchableOpacity
              style={[styles.deletedEventModalButton, { backgroundColor: colors.primary, marginTop: 16, alignSelf: 'stretch' }]}
              onPress={() => setShowParticipantsModal(false)}
            >
              <Text style={styles.deletedEventModalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Boas-vindas passo a passo (Apple/Google) */}
      <Modal
        visible={showNewUserModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewUserModal(false)}
      >
        <View style={styles.removedModalOverlay}>
          <View style={[styles.welcomeModalContent, { backgroundColor: colors.surface }]}>
            {/* Conteúdo do step atual */}
            <ScrollView
              style={styles.welcomeModalScroll}
              contentContainerStyle={styles.welcomeModalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {WELCOME_STEPS[welcomeStep].image ? (
                <View style={styles.welcomeModalImageWrap}>
                  <Image
                    source={require('../../assets/images/icone_app.png')}
                    style={styles.welcomeModalImage}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View style={[styles.welcomeModalIconWrap, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons
                    name={WELCOME_STEPS[welcomeStep].icon as any}
                    size={56}
                    color={colors.primary}
                  />
                </View>
              )}
              <Text style={[styles.welcomeModalStepTitle, { color: colors.text }]}>
                {WELCOME_STEPS[welcomeStep].title}
              </Text>
              <Text style={[styles.welcomeModalStepSubtitle, { color: colors.textSecondary }]}>
                {WELCOME_STEPS[welcomeStep].subtitle}
              </Text>
            </ScrollView>

            {/* Indicadores de passo */}
            <View style={styles.welcomeModalDots}>
              {WELCOME_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.welcomeModalDot,
                    { backgroundColor: i === welcomeStep ? colors.primary : colors.border },
                  ]}
                />
              ))}
            </View>

            {/* Botões: navegação ou ações finais */}
            {welcomeStep < totalWelcomeSteps - 1 ? (
              <View style={styles.welcomeModalNavButtons}>
                {welcomeStep > 0 ? (
                  <TouchableOpacity
                    style={[styles.welcomeModalNavButtonSecondary, { borderColor: colors.border }]}
                    onPress={() => setWelcomeStep((s) => s - 1)}
                  >
                    <Ionicons name="arrow-back" size={20} color={colors.text} />
                    <Text style={[styles.welcomeModalNavButtonSecondaryText, { color: colors.text }]}>Voltar</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.welcomeModalNavButtonPrimary,
                    { backgroundColor: colors.primary },
                    welcomeStep === 0 ? styles.welcomeModalNavButtonFull : null,
                  ]}
                  onPress={() => setWelcomeStep((s) => s + 1)}
                >
                  <Text style={styles.welcomeModalNavButtonPrimaryText}>Próximo</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.welcomeModalButtonDone, { backgroundColor: colors.primary }]}
                onPress={() => setShowNewUserModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.welcomeModalButtonDoneText}>Pronto</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acesso Restrito"
        message="Apenas gerentes e editores podem criar e visualizar detalhes e valores financeiros dos eventos. Entre em contato com um gerente para solicitar mais permissões."
        icon="lock-closed"
      />

      {/* Modal: Evento não encontrado (deletado) */}
      <Modal
        visible={showDeletedEventModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeletedEventModal(false)}
      >
        <View style={styles.deletedEventModalOverlay}>
          <View style={[styles.deletedEventModalContent, { backgroundColor: colors.surface }]}>
            <Ionicons name="trash-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 16 }} />
            <Text style={[styles.deletedEventModalTitle, { color: colors.text }]}>
              Evento não encontrado
            </Text>
            <Text style={[styles.deletedEventModalMessage, { color: colors.textSecondary }]}>
              Este evento pode já ter sido deletado. A agenda foi atualizada.
            </Text>
            <TouchableOpacity
              style={[styles.deletedEventModalButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowDeletedEventModal(false)}
            >
              <Text style={styles.deletedEventModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Usuário Removido do Artista */}
      <Modal
        visible={showRemovedModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.removedModalOverlay}>
          <View style={[styles.removedModalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.removedModalIcon, { backgroundColor: colors.error + '20' }]}>
              <Ionicons name="alert-circle" size={48} color={colors.error} />
            </View>

            <Text style={[styles.removedModalTitle, { color: colors.text }]}>
              Você foi removido deste artista
            </Text>

            <Text style={[styles.removedModalMessage, { color: colors.textSecondary }]}>
              Parece que você foi removido como colaborador deste artista. Escolha uma das opções abaixo para continuar.
            </Text>

            {isLoadingArtists ? (
              <View style={styles.removedModalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.removedModalLoadingText, { color: colors.textSecondary }]}>
                  Carregando seus artistas...
                </Text>
              </View>
            ) : availableArtists.length > 0 ? (
              <ScrollView style={styles.removedModalArtistsList} showsVerticalScrollIndicator={false}>
                <Text style={[styles.removedModalSubtitle, { color: colors.text }]}>
                  Seus outros artistas:
                </Text>
                {availableArtists.map((artist) => (
                  <TouchableOpacity
                    key={artist.id}
                    style={[styles.removedModalArtistCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => handleSelectOtherArtist(artist)}
                  >
                    <View style={styles.removedModalArtistInfo}>
                      {artist.profile_url ? (
                        <OptimizedImage
                          imageUrl={artist.profile_url}
                          style={styles.removedModalArtistAvatar}
                          cacheKey={`artist_${artist.id}`}
                          fallbackIcon="musical-notes"
                          fallbackIconSize={20}
                          fallbackIconColor={colors.primary}
                        />
                      ) : (
                        <View style={[styles.removedModalArtistAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                          <Ionicons name="musical-notes" size={20} color="#fff" />
                        </View>
                      )}
                      <View style={styles.removedModalArtistDetails}>
                        <Text style={[styles.removedModalArtistName, { color: colors.text }]}>
                          {artist.name}
                        </Text>
                        <Text style={[styles.removedModalArtistRole, { color: colors.textSecondary }]}>
                          {artist.role === 'owner' ? 'Gerente' : 
                           artist.role === 'admin' ? 'Administrador' :
                           artist.role === 'editor' ? 'Editor' : 'Visualizador'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.removedModalNoArtists}>
                <Ionicons name="musical-notes-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.removedModalNoArtistsText, { color: colors.textSecondary }]}>
                  Você não está vinculado a nenhum outro artista.
                </Text>
              </View>
            )}

            <View style={styles.removedModalActions}>
              {availableArtists.length > 0 && (
                <TouchableOpacity
                  style={[styles.removedModalButton, styles.removedModalButtonSecondary, { borderColor: colors.border }]}
                  onPress={handleCreateNewArtist}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  <Text style={[styles.removedModalButtonTextSecondary, { color: colors.primary }]}>
                    Criar Novo Artista
                  </Text>
                </TouchableOpacity>
              )}
              
              {availableArtists.length === 0 && (
                <TouchableOpacity
                  style={[styles.removedModalButton, styles.removedModalButtonPrimary, { backgroundColor: colors.primary }]}
                  onPress={handleCreateNewArtist}
                >
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.removedModalButtonTextPrimary}>
                    Criar Novo Artista
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Selecionar Artista (ao clicar na imagem do artista) */}
      <Modal
        visible={showArtistPickerModal}
        transparent
        animationType="slide"
        onRequestClose={closeArtistPickerModal}
      >
        <View style={styles.artistPickerOverlay}>
          <TouchableWithoutFeedback onPress={closeArtistPickerModal}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={[styles.artistPickerContent, { backgroundColor: colors.surface }]}>
                <View style={[styles.artistPickerHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.artistPickerTitle, { color: colors.text }]}>Selecionar artista</Text>
                  <TouchableOpacity onPress={closeArtistPickerModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="close" size={28} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.artistPickerSearchWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="search" size={20} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.artistPickerSearchInput, { color: colors.text }]}
                    placeholder="Buscar artista..."
                    placeholderTextColor={colors.textSecondary}
                    value={artistPickerSearch}
                    onChangeText={setArtistPickerSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {artistPickerSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setArtistPickerSearch('')}>
                      <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {isLoadingArtistPicker ? (
                  <View style={styles.artistPickerLoading}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.artistPickerLoadingText, { color: colors.textSecondary }]}>Carregando artistas...</Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.artistPickerList}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredArtistPickerList.length === 0 ? (
                      <View style={styles.artistPickerEmpty}>
                        <Ionicons name="musical-notes-outline" size={48} color={colors.textSecondary} />
                        <Text style={[styles.artistPickerEmptyText, { color: colors.textSecondary }]}>
                          {artistPickerSearch.trim() ? 'Nenhum artista encontrado.' : 'Você ainda não tem artistas.'}
                        </Text>
                      </View>
                    ) : (
                      filteredArtistPickerList.map((artist) => {
                        const isActive = activeArtist?.id === artist.id;
                        return (
                          <TouchableOpacity
                            key={artist.id}
                            style={[
                              styles.artistPickerCard,
                              { backgroundColor: colors.background, borderColor: isActive ? colors.primary : colors.border },
                              isActive && { borderWidth: 2 }
                            ]}
                            onPress={() => !isActive && handleSelectArtistFromPicker(artist)}
                            disabled={isActive}
                          >
                            <View style={styles.artistPickerCardInner}>
                              {artist.profile_url ? (
                                <OptimizedImage
                                  imageUrl={artist.profile_url}
                                  style={[styles.artistPickerAvatar, { borderColor: colors.border }]}
                                  cacheKey={`artist_${artist.id}`}
                                  fallbackIcon="musical-notes"
                                  fallbackIconSize={20}
                                  fallbackIconColor={colors.primary}
                                />
                              ) : (
                                <View style={[styles.artistPickerAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                                  <Ionicons name="musical-notes" size={20} color="#fff" />
                                </View>
                              )}
                              <View style={styles.artistPickerCardDetails}>
                                <Text style={[styles.artistPickerCardName, { color: colors.text }, isActive && { color: colors.primary }]}>
                                  {artist.name}
                                </Text>
                                <Text style={[styles.artistPickerCardRole, { color: colors.textSecondary }]}>
                                  {getRoleLabel(artist.role || 'viewer')}
                                </Text>
                              </View>
                            </View>
                            {isActive ? (
                              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                            ) : (
                              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                            )}
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                )}

                <View style={[styles.artistPickerFooter, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.artistPickerCreateButton, { backgroundColor: colors.primary }]}
                    onPress={handleCreateArtistFromPicker}
                  >
                    <Ionicons name="add-circle" size={22} color="#fff" />
                    <Text style={styles.artistPickerCreateButtonText}>Criar artista</Text>
                  </TouchableOpacity>
                </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  artistHeader: {
    marginBottom: 15,
  },
  artistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artistAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
  },
  artistAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
  },
  artistDetails: {
    flex: 1,
  },
  artistNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  artistName: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  artistSubtitle: {
    fontSize: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
  },
  monthYear: {
    fontSize: 18,
    fontWeight: '600',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  todayText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  showsSection: {
    padding: 20,
  },
  calendarContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.08,
    shadowRadius: Platform.OS === 'android' ? 0 : 6,
    elevation: Platform.OS === 'android' ? 0 : 4,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  calendarHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calendarDayCell: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  calendarDayTodayText: {
    fontWeight: '700',
  },
  eventIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  showCard: {
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.08,
    shadowRadius: Platform.OS === 'android' ? 0 : 6,
    elevation: Platform.OS === 'android' ? 0 : 4,
    overflow: 'hidden',
  },
  showContent: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    minWidth: 0,
  },
  showDateSection: {
    width: 54,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  showDateNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  showDateText: {
    fontSize: 10,
    color: '#fff',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: 2,
  },
  showInfoSection: {
    flex: 1,
    minWidth: 0,
    paddingRight: 0,
  },
  eventNameContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  showName: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 21,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  glLabelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  glLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  glLabelText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  glMetaLine: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  showValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  showFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  showFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
  },
  collabFooterBadge: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 2,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  showValueLeft: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  lockedValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockedValueText: {
    fontSize: 12,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  showArrowSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noShowsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noShowsText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.3,
    shadowRadius: Platform.OS === 'android' ? 0 : 4.65,
    elevation: Platform.OS === 'android' ? 0 : 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateIcon: {
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStateActions: {
    width: '100%',
    gap: 12,
  },
  createButton: {
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  waitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  waitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  noArtistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  calendarToggleButton: {
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.05,
    shadowRadius: Platform.OS === 'android' ? 0 : 4,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  calendarToggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dayModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dayModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  dayModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.2,
    shadowRadius: Platform.OS === 'android' ? 0 : 12,
    elevation: Platform.OS === 'android' ? 0 : 12,
  },
  dayModalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dayModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'capitalize',
    marginBottom: 20,
    paddingRight: 32,
  },
  dayEventCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  dayEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dayEventName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  dayEventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayEventTime: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayEventEmptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  // Modal: Evento não encontrado (deletado)
  deletedEventModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deletedEventModalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  deletedEventModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  deletedEventModalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deletedEventModalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletedEventModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteInfoLine: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  inviteCancelReasonInput: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 88,
    textAlignVertical: 'top',
    padding: 12,
    marginTop: 10,
  },
  inviteModalActions: {
    width: '100%',
    gap: 8,
    flexDirection: 'row',
  },
  inviteModalButtonText: {
    fontSize: 14,
  },
  inviteBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  inviteBtnPrimary: {
    borderWidth: 0,
  },
  participantsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
    gap: 8,
  },
  inviterRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviterAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  inviterLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inviterName: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  collabAvatarStack: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  collabStackAvatarWrapper: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  collabStackAvatarInner: {
    width: '100%',
    height: '100%',
  },
  collabStackAvatarOverlap: {
    marginLeft: -8,
  },
  // Estilos do Modal de Remoção
  removedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  removedModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.3,
    shadowRadius: Platform.OS === 'android' ? 0 : 20,
    elevation: Platform.OS === 'android' ? 0 : 10,
  },
  removedModalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  removedModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  removedModalMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  welcomeModalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.3,
    shadowRadius: Platform.OS === 'android' ? 0 : 20,
    elevation: Platform.OS === 'android' ? 0 : 10,
  },
  welcomeModalScroll: {
    maxHeight: 340,
  },
  welcomeModalScrollContent: {
    paddingBottom: 16,
    alignItems: 'center',
  },
  welcomeModalImageWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  welcomeModalImage: {
    width: '100%',
    height: '100%',
  },
  welcomeModalIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeModalStepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  welcomeModalStepSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  welcomeModalDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },
  welcomeModalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  welcomeModalNavButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  welcomeModalNavButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  welcomeModalNavButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  welcomeModalNavButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  welcomeModalNavButtonFull: {
    flex: 1,
  },
  welcomeModalNavButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  welcomeModalButtonDone: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeModalButtonDoneText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  newUserModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  newUserModalButtonSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  newUserModalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  newUserModalButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  newUserModalButtonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  removedModalLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  removedModalLoadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  removedModalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  removedModalArtistsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  removedModalArtistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  removedModalArtistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  removedModalArtistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  removedModalArtistAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  removedModalArtistDetails: {
    flex: 1,
  },
  removedModalArtistName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  removedModalArtistRole: {
    fontSize: 13,
  },
  removedModalNoArtists: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 20,
  },
  removedModalNoArtistsText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  removedModalActions: {
    gap: 12,
  },
  removedModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  removedModalButtonPrimary: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.1,
    shadowRadius: Platform.OS === 'android' ? 0 : 4,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  removedModalButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  removedModalButtonTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  removedModalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal: Selecionar Artista (ao clicar na imagem)
  artistPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  artistPickerContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  artistPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  artistPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  artistPickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  artistPickerSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  artistPickerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  artistPickerLoadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  artistPickerList: {
    maxHeight: 320,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  artistPickerEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  artistPickerEmptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  artistPickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  artistPickerCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  artistPickerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 1,
  },
  artistPickerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistPickerCardDetails: {
    flex: 1,
  },
  artistPickerCardName: {
    fontSize: 16,
    fontWeight: '600',
  },
  artistPickerCardRole: {
    fontSize: 13,
    marginTop: 2,
  },
  artistPickerFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  artistPickerCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  artistPickerCreateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});