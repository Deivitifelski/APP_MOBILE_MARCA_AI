import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { useActiveArtist } from '../../services/useActiveArtist';
import { useNotifications } from '../../services/useNotifications';

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function AgendaScreen() {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { activeArtist, loadActiveArtist, isLoading } = useActiveArtist();
  const [artistImageUpdated, setArtistImageUpdated] = useState<boolean>(false);
  const { unreadCount, loadUnreadCount } = useNotifications();
  const [hasAnyArtist, setHasAnyArtist] = useState(false);
  
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

  useEffect(() => {
    loadActiveArtist();
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
      loadActiveArtist();
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
          /* Lista de shows do mês */
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
});