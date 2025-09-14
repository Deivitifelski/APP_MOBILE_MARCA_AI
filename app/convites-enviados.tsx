import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getCurrentUser } from '../services/supabase/authService';
import { getArtistInvitesSent, cancelArtistInvite, ArtistInvite } from '../services/supabase/artistInviteService';

export default function ConvitesEnviadosScreen() {
  const [invites, setInvites] = useState<ArtistInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        router.back();
        return;
      }

      setCurrentUserId(user.id);

      // Buscar convites enviados
      const { success, invites: sentInvites, error } = await getArtistInvitesSent(user.id);
      
      if (success && sentInvites) {
        setInvites(sentInvites);
      } else {
        Alert.alert('Erro', error || 'Erro ao carregar convites');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleCancelInvite = (inviteId: string, userName: string) => {
    if (!currentUserId) return;

    Alert.alert(
      'Cancelar Convite',
      `Tem certeza que deseja cancelar o convite para ${userName}?`,
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { success, error } = await cancelArtistInvite(inviteId, currentUserId);
              
              if (success) {
                Alert.alert('Sucesso', 'Convite cancelado com sucesso!');
                loadData(); // Recarregar dados
              } else {
                Alert.alert('Erro', error || 'Erro ao cancelar convite');
              }
            } catch (error) {
              Alert.alert('Erro', 'Erro ao cancelar convite');
            }
          }
        }
      ]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'time';
      case 'accepted':
        return 'checkmark-circle';
      case 'declined':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FFA500'; // Laranja
      case 'accepted':
        return '#4CAF50'; // Verde
      case 'declined':
        return '#F44336'; // Vermelho
      default:
        return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'accepted':
        return 'Aceito';
      case 'declined':
        return 'Recusado';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    // Se a string não tem timezone, assumir que é UTC
    let date;
    if (dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-')) {
      date = new Date(dateString);
    } else {
      // Se não tem timezone, assumir UTC
      date = new Date(dateString + 'Z');
    }
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  };

  const renderInvite = ({ item }: { item: ArtistInvite }) => (
    <View style={styles.inviteCard}>
      <View style={styles.inviteHeader}>
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {item.to_user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.to_user?.name || 'Usuário'}</Text>
            <Text style={styles.userEmail}>{item.to_user?.email || 'Email não disponível'}</Text>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <Ionicons 
            name={getStatusIcon(item.status) as any} 
            size={20} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.inviteDetails}>
        <Text style={styles.artistName}>
          <Text style={styles.label}>Artista:</Text> {item.artist?.name || 'Artista não encontrado'}
        </Text>
        <Text style={styles.inviteDate}>
          <Text style={styles.label}>Enviado em:</Text> {formatDate(item.created_at)}
        </Text>
        {item.responded_at && (
          <Text style={styles.responseDate}>
            <Text style={styles.label}>Respondido em:</Text> {formatDate(item.responded_at)}
          </Text>
        )}
      </View>

      {item.status === 'pending' && (
        <View style={styles.inviteActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelInvite(item.id, item.to_user?.name || 'Usuário')}
          >
            <Ionicons name="trash" size={16} color="#F44336" />
            <Text style={styles.cancelButtonText}>Cancelar Convite</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const pendingInvites = invites.filter(invite => invite.status === 'pending');
  const processedInvites = invites.filter(invite => invite.status !== 'pending');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Convites Enviados</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Carregando convites...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Convites Enviados</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >

        {/* Convites Pendentes */}
        {pendingInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Convites Pendentes</Text>
            <FlatList
              data={pendingInvites}
              renderItem={renderInvite}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              style={styles.invitesList}
            />
          </View>
        )}

        {/* Convites Processados */}
        {processedInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Histórico</Text>
            <FlatList
              data={processedInvites}
              renderItem={renderInvite}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              style={styles.invitesList}
            />
          </View>
        )}

        {/* Estado vazio */}
        {invites.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="mail-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              Nenhum convite enviado ainda
            </Text>
            <Text style={styles.emptySubtext}>
              Os convites que você enviar aparecerão aqui
            </Text>
          </View>
        )}
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  invitesList: {
    gap: 12,
  },
  inviteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  inviteDetails: {
    marginBottom: 12,
  },
  artistName: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  inviteDate: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  responseDate: {
    fontSize: 14,
    color: '#333',
  },
  label: {
    fontWeight: '600',
    color: '#667eea',
  },
  inviteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7d7',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#F44336',
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});
