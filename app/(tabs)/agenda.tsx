import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
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
import { getEventsByMonthWithRole } from '../../services/supabase/eventService';
import { useNotifications } from '../../services/useNotifications';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
  const [availableArtists, setAvailableArtists] = useState<any[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);
  const params = useLocalSearchParams<{ showNewUserModal?: string }>();

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
  const todayString = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    refreshActiveArtist();
    loadUnreadCount();
  }, []);

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

  const loadEvents = async (isInitialLoad = true) => {
    if (!activeArtist) {
      setEvents([]);
      return;
    }
    
    try {
      // Verificar cache primeiro
      const cacheKey = `events_${activeArtist.id}_${currentYear}_${currentMonth}`;
      const cachedEvents = await cacheService.getEventsData<any[]>(activeArtist.id, currentYear, currentMonth);
      
      if (cachedEvents && !isInitialLoad) {
        // Usar dados do cache para atualizações silenciosas
        setEvents(cachedEvents);
        return;
      }
      
      // Carregar dados frescos do servidor COM FILTRAGEM POR ROLE
      const result = await getEventsByMonthWithRole(activeArtist.id, currentYear, currentMonth);
      
      if (result.success) {
        const eventsData = result.events || [];
        setEvents(eventsData);
        setLastUpdate(new Date());
        
        // Salvar no cache
        await cacheService.setEventsData(activeArtist.id, currentYear, currentMonth, eventsData);
      } else {
        // Verificar se é o erro de acesso negado (P0001)
        const isAccessDenied = 
          result.errorCode === 'P0001' || 
          (result.error && (
            result.error.includes('Usuário não tem acesso a este artista') ||
            result.error.includes('não tem acesso')
          ));
        
        if (isAccessDenied) {
          // Usuário foi removido, mostrar modal
          await handleUserRemovedFromArtist();
        } else {
          setEvents([]);
        }
      }
    } catch (error: any) {
      // Verificar se é erro do Supabase com código P0001
      const isAccessDenied = 
        error?.code === 'P0001' || 
        (error?.message && (
          error.message.includes('Usuário não tem acesso a este artista') ||
          error.message.includes('não tem acesso')
        ));
      
      if (isAccessDenied) {
        await handleUserRemovedFromArtist();
      } else {
        setEvents([]);
      }
    }
  };

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

  const renderShow = ({ item }: { item: any }) => {
    // Proteção: não renderizar se não houver artista ativo
    if (!activeArtist) {
      return null;
    }
    
    // Parse da data sem conversão de fuso horário
    const [year, month, day] = item.event_date.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    const dayOfWeek = eventDate.toLocaleDateString('pt-BR', { weekday: 'short' });
    
    return (
      <TouchableOpacity 
        style={[
          styles.showCard, 
          { 
            backgroundColor: colors.surface
          }
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
            <View style={styles.showHeaderRow}>
              <View style={styles.eventNameContainer}>
                <Text style={[styles.showName, { color: colors.text }]}>{item.name}</Text>
                {!hasFinancialAccess && (
                  <Ionicons name="lock-closed" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                )}
              </View>
              {item.tag && (
                <View style={[styles.tagContainer, { backgroundColor: getTagColor(item.tag) }]}>
                  <Ionicons name={getTagIcon(item.tag)} size={12} color="#fff" />
                  <Text style={styles.tagText}>{item.tag}</Text>
                </View>
              )}
            </View>
            
            <View style={styles.showDetailItem}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.showTime, { color: colors.textSecondary }]}>{item.start_time}</Text>
            </View>
            
            {item.city && (
              <View style={styles.showDetailItem}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.showLocation, { color: colors.textSecondary }]}>{item.city}</Text>
              </View>
            )}
            
            {item.value !== null && item.value !== undefined ? (
              <Text style={[styles.showValue, { color: colors.primary }]}>
                R$ {item.value.toLocaleString('pt-BR')}
              </Text>
            ) : (
              <View style={styles.lockedValueContainer}>
                <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
                <Text style={[styles.lockedValueText, { color: colors.textSecondary }]}>
                  Valor oculto
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.showArrowSection}>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  const formatDisplayDate = (dateString: string | null) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    });
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
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={[styles.dayEventTime, { color: colors.textSecondary }]}>
                    {event.start_time}
                  </Text>
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
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.1,
    shadowRadius: Platform.OS === 'android' ? 0 : 8,
    elevation: Platform.OS === 'android' ? 0 : 6,
    overflow: 'hidden',
  },
  showContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  showDateSection: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
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
    paddingRight: 12,
  },
  showHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  showName: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  tagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  tagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  showDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  showTime: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  showLocation: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  showValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  lockedValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
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
});