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
import { router } from 'expo-router';
import { getArtists } from '../../services/supabase/artistService';
import { getCurrentUser } from '../../services/supabase/authService';
import { getEventsByMonth } from '../../services/supabase/eventService';

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hasArtists, setHasArtists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentArtist, setCurrentArtist] = useState<{id: string, name: string, profile_url?: string} | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    checkArtists();
  }, []);

  useEffect(() => {
    if (hasArtists) {
      loadEvents();
    }
  }, [hasArtists, currentMonth, currentYear]);

  const checkArtists = async () => {
    try {
      // Obter o usuário atual
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        setHasArtists(false);
        return;
      }

      const { artists, error } = await getArtists(user.id);
      
      if (error) {
        console.error('Erro ao verificar artistas:', error);
        setHasArtists(false);
      } else {
        setHasArtists(artists && artists.length > 0);
        // Definir o primeiro artista como o atual
        if (artists && artists.length > 0) {
          setCurrentArtist({
            id: artists[0].id,
            name: artists[0].name,
            profile_url: artists[0].profile_url
          });
        }
      }
    } catch (error) {
      console.error('Erro ao verificar artistas:', error);
      setHasArtists(false);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      // Obter o usuário atual
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        console.error('Erro ao obter usuário:', userError);
        setEvents([]);
        return;
      }

      const result = await getEventsByMonth(user.id, currentYear, currentMonth);
      
      if (result.success) {
        setEvents(result.events || []);
      } else {
        console.error('Erro ao carregar eventos:', result.error);
        setEvents([]);
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
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
    const eventDate = new Date(item.event_date);
    const dayOfWeek = eventDate.toLocaleDateString('pt-BR', { weekday: 'short' });
    
    return (
      <View style={styles.showCard}>
        <View style={styles.showHeader}>
          <View style={styles.showDateContainer}>
            <Text style={styles.showDate}>{eventDate.getDate()}</Text>
            <Text style={styles.showDayOfWeek}>{dayOfWeek}</Text>
          </View>
          <View style={styles.showTimeContainer}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.showTime}>{item.start_time}</Text>
          </View>
        </View>
        
        <Text style={styles.showName}>{item.name}</Text>
        
        {item.city && (
          <View style={styles.showLocationContainer}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.showVenue}>{item.city}</Text>
          </View>
        )}
        
        {item.value && (
          <Text style={styles.showLocation}>R$ {item.value.toLocaleString('pt-BR')}</Text>
        )}
        
        <View style={styles.showActions}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="receipt-outline" size={16} color="#667eea" />
            <Text style={styles.actionButtonText}>Despesas</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={16} color="#667eea" />
            <Text style={styles.actionButtonText}>Compartilhar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* Header do Artista */}
        {currentArtist && (
          <View style={styles.artistHeader}>
            <View style={styles.artistInfo}>
              {currentArtist.profile_url ? (
                <Image source={{ uri: currentArtist.profile_url }} style={styles.artistAvatar} />
              ) : (
                <View style={styles.artistAvatarPlaceholder}>
                  <Ionicons name="musical-notes" size={24} color="#667eea" />
                </View>
              )}
              <View style={styles.artistDetails}>
                <Text style={styles.artistName}>{currentArtist.name}</Text>
                <Text style={styles.artistSubtitle}>Agenda de Shows</Text>
              </View>
            </View>
          </View>
        )}
        
        {!currentArtist && (
          <Text style={styles.title}>Agenda de Shows</Text>
        )}
        
        {/* Navegação do mês */}
        <View style={styles.monthNavigation}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth('prev')}
          >
            <Ionicons name="chevron-back" size={24} color="#667eea" />
          </TouchableOpacity>
          
          <Text style={styles.monthYear}>
            {months[currentMonth]} / {currentYear}
          </Text>
          
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => navigateMonth('next')}
          >
            <Ionicons name="chevron-forward" size={24} color="#667eea" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
        ) : !hasArtists ? (
          /* Estado vazio - sem artistas para gerenciar */
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="musical-notes" size={64} color="#ccc" />
            </View>
            <Text style={styles.emptyStateTitle}>
              Nenhum perfil para gerenciar
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              Você ainda não tem nenhum artista para gerenciar. Crie um perfil agora ou aguarde um convite.
            </Text>
            
            <View style={styles.emptyStateActions}>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateArtist}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Criar Agora</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.waitButton}
                onPress={handleWaitForInvite}
              >
                <Ionicons name="time" size={20} color="#667eea" />
                <Text style={styles.waitButtonText}>Aguardar Convite</Text>
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
                <Ionicons name="calendar-outline" size={48} color="#ccc" />
                <Text style={styles.noShowsText}>
                  Nenhum show agendado para este mês
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Botão flutuante para adicionar show - só aparece quando há artistas */}
      {hasArtists && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddShow}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
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
  artistName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  showHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  showDateContainer: {
    alignItems: 'center',
  },
  showDate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  showDayOfWeek: {
    fontSize: 12,
    color: '#666',
    textTransform: 'uppercase',
  },
  showTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showTime: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  showName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  showLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  showVenue: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    fontWeight: '500',
  },
  showLocation: {
    fontSize: 14,
    color: '#999',
    marginLeft: 20,
  },
  showActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#667eea',
    marginLeft: 4,
    fontWeight: '500',
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
});