import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OptimizedImage from '../../components/OptimizedImage';
import PermissionModal from '../../components/PermissionModal';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { artistImageUpdateService } from '../../services/artistImageUpdateService';
import { cacheService } from '../../services/cacheService';
import { getCurrentUser } from '../../services/supabase/authService';
import { getEventsByMonthWithRole } from '../../services/supabase/eventService';
import { useActiveArtistContext } from '../../contexts/ActiveArtistContext';
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
  const { activeArtist, refreshActiveArtist, isLoading } = useActiveArtistContext();
  const [artistImageUpdated, setArtistImageUpdated] = useState<boolean>(false);
  const { unreadCount, loadUnreadCount } = useNotifications();
  const [hasAnyArtist, setHasAnyArtist] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  
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
    const weeks: Array<Array<{ dayNumber: number; dateString: string } | null>> = [];

    let dayCounter = 1 - firstWeekDay;
    while (dayCounter <= totalDays) {
      const week: Array<{ dayNumber: number; dateString: string } | null> = [];
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

      // Viewer não pode ver detalhes (apenas editor, admin, owner)
      const allowedRoles = ['editor', 'admin', 'owner'];
      const canViewDetails = allowedRoles.includes(userRole);
      
      if (!canViewDetails) {
        setShowPermissionModal(true);
        return;
      }
      
      router.push(`/detalhes-evento?eventId=${eventId}`);
    } catch (error) {
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
        setEvents([]);
      }
    } catch (error) {
      setEvents([]);
    }
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
  const handleDayPress = (dateString: string | null) => {
    if (!dateString) return;
    const dayEvents = eventsByDate[dateString];
    if (!dayEvents || dayEvents.length === 0) {
      return;
    }
    setSelectedDay(dateString);
    setSelectedDayEvents(dayEvents);
    setShowDayModal(true);
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
                        activeOpacity={hasEvents ? 0.8 : 1}
                        disabled={!hasEvents}
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
        onRequestClose={() => setShowDayModal(false)}
      >
        <View style={styles.dayModalOverlay}>
          <View style={[styles.dayModalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={styles.dayModalCloseButton}
              onPress={() => setShowDayModal(false)}
            >
              <Ionicons name="close" size={22} color={colors.text} />
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
                  setShowDayModal(false);
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

      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acesso Restrito"
        message="Apenas gerentes e editores podem criar e visualizar detalhes e valores financeiros dos eventos. Entre em contato com um gerente para solicitar mais permissões."
        icon="lock-closed"
      />
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
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
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
  dayModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dayModalContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  dayModalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    borderRadius: 999,
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
});