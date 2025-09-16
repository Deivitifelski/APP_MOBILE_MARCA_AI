import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { getEventsByMonth } from '../../services/supabase/eventService';
import { useActiveArtist } from '../../services/useActiveArtist';
import { useNotifications } from '../../services/useNotifications';
import { useTheme } from '../../contexts/ThemeContext';
import { getUserPermissions } from '../../services/supabase/permissionsService';
import { debugUserPermissions, debugUserArtists } from '../../services/supabase/debugPermissionsService';
import PermissionModal from '../../components/PermissionModal';
import { supabase } from '../../lib/supabase';

// Dados mockados de shows
const mockShows = [
  {
    id: '1',
    date: 15,
    dayOfWeek: 'Sábado',
    name: 'Rock in Rio 2025',
    venue: 'Parque Olímpico',
    location: 'Rio de Janeiro, RJ',
    time: '20:00',
  },
  {
    id: '2',
    date: 22,
    dayOfWeek: 'Sábado',
    name: 'Lollapalooza Brasil',
    venue: 'Interlagos',
    location: 'São Paulo, SP',
    time: '19:30',
  },
  {
    id: '3',
    date: 28,
    dayOfWeek: 'Sexta',
    name: 'Festival de Inverno',
    venue: 'Parque Ibirapuera',
    location: 'São Paulo, SP',
    time: '18:00',
  },
  {
    id: '4',
    date: 5,
    dayOfWeek: 'Domingo',
    name: 'Show Acústico',
    venue: 'Teatro Municipal',
    location: 'Belo Horizonte, MG',
    time: '20:30',
  },
];

const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function AgendaScreen() {
  const { colors, isDarkMode } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const { activeArtist, loadActiveArtist, isLoading } = useActiveArtist();
  const { unreadCount, loadUnreadCount } = useNotifications();

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    loadActiveArtist();
    loadUnreadCount();
  }, []);

  useEffect(() => {
    if (activeArtist) {
      loadEvents(true);
      loadUserPermissions();
    }
  }, [activeArtist, currentMonth, currentYear]);

  // Recarregar eventos quando a tela ganhar foco
  useFocusEffect(
    React.useCallback(() => {
      if (activeArtist) {
        loadEvents(false); // Recarregamento silencioso
      }
    }, [activeArtist, currentMonth, currentYear])
  );

  // Polling para atualizações em tempo real
  useEffect(() => {
    if (!activeArtist) return;

    const interval = setInterval(() => {
      loadEvents(false); // Atualização silenciosa a cada 30 segundos
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [activeArtist, currentMonth, currentYear]);

  const loadUserPermissions = async () => {
    if (!activeArtist) return;
    
    try {
      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ Nenhum usuário logado');
        return;
      }
      
      console.log('🔍 Carregando permissões para:', { userId: user.id, artistId: activeArtist.id });
      
      // Debug das permissões
      const debugResult = await debugUserPermissions(user.id, activeArtist.id);
      console.log('🔍 Debug resultado:', debugResult);
      
      // Listar todos os artistas do usuário
      const userArtists = await debugUserArtists(user.id);
      console.log('🎭 Artistas do usuário:', userArtists);
      
      const permissions = await getUserPermissions(user.id, activeArtist.id);
      console.log('🔐 Permissões carregadas:', permissions);
      console.log('🔐 Role do usuário:', permissions?.role);
      setUserPermissions(permissions);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
    }
  };

  const handleEventPress = (eventId: string) => {
    // Verificar se o usuário tem permissão para ver detalhes
    if (userPermissions?.role === 'viewer') {
      setShowPermissionModal(true);
      return;
    }
    
    // Se não for viewer, permitir acesso aos detalhes
    router.push(`/detalhes-evento?eventId=${eventId}`);
  };

  const loadEvents = async (isInitialLoad = true) => {
    if (!activeArtist) {
      console.log('loadEvents: Nenhum artista ativo');
      return;
    }
    
    if (isInitialLoad) {
      console.log('loadEvents: Carregando eventos para artista:', activeArtist.id, 'Mês:', currentMonth, 'Ano:', currentYear);
    }
    
    try {
      const result = await getEventsByMonth(activeArtist.id, currentYear, currentMonth);
      
      if (result.success) {
        setEvents(result.events || []);
        setLastUpdate(new Date());
        if (isInitialLoad) {
          console.log('loadEvents: Eventos carregados:', result.events?.length || 0);
        }
      } else {
        console.error('Erro ao carregar eventos:', result.error);
        if (isInitialLoad) {
          setEvents([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      if (isInitialLoad) {
        setEvents([]);
      }
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

  const handleAddShow = () => {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const selectedDate = new Date(currentYear, currentMonth, 1);
    
    router.push({
      pathname: '/adicionar-evento',
      params: { 
        selectedMonth: currentMonth,
        selectedYear: currentYear,
        selectedDate: selectedDate.toISOString()
      }
    });
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

  const renderShow = ({ item }: { item: any }) => {
    // Parse da data sem conversão de fuso horário
    const [year, month, day] = item.event_date.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);
    const dayOfWeek = eventDate.toLocaleDateString('pt-BR', { weekday: 'short' });
    
    return (
      <TouchableOpacity 
        style={[styles.showCard, { backgroundColor: colors.surface }]}
        onPress={() => handleEventPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.showContent}>
          <View style={[styles.showDateSection, { backgroundColor: colors.primary }]}>
            <Text style={styles.showDateNumber}>{day}</Text>
            <Text style={styles.showDateText}>{dayOfWeek}</Text>
          </View>
          
          <View style={styles.showInfoSection}>
            <Text style={[styles.showName, { color: colors.text }]}>{item.name}</Text>
            
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
            
            {item.value && userPermissions?.role !== 'viewer' && (
              <Text style={[styles.showValue, { color: colors.primary }]}>
                R$ {item.value.toLocaleString('pt-BR')}
              </Text>
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* Header do Artista */}
        {activeArtist && (
          <View style={styles.artistHeader}>
            <View style={styles.artistInfo}>
              <View style={[styles.artistAvatarPlaceholder, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Ionicons name="musical-notes" size={24} color={colors.primary} />
              </View>
              <View style={styles.artistDetails}>
                <View style={styles.artistNameRow}>
                  <Text style={[styles.artistName, { color: colors.text }]}>{activeArtist.name}</Text>
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

      <ScrollView style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando...</Text>
          </View>
        ) : !activeArtist ? (
          /* Estado vazio - sem artistas para gerenciar */
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="musical-notes" size={64} color={colors.textSecondary} />
            </View>
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
        message="Como visualizador, você não tem permissão para acessar os detalhes completos dos eventos. Entre em contato com um administrador para solicitar mais permissões."
        icon="eye-off"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
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
  },
  artistAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#e9ecef',
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
    color: '#333',
    flex: 1,
  },
  artistSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
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
    backgroundColor: '#f8f9fa',
  },
  monthYear: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  showsSection: {
    padding: 20,
  },
  showCard: {
    backgroundColor: '#fff',
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
  showName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  showDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  showTime: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  showLocation: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  showValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#667eea',
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
    color: '#999',
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
    color: '#666',
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
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStateActions: {
    width: '100%',
    gap: 12,
  },
  createButton: {
    backgroundColor: '#667eea',
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
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  waitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginLeft: 8,
  },
  noArtistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
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