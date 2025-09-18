import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { acceptArtistInvite, ArtistInvite, declineArtistInvite, getArtistInvitesReceived } from '../services/supabase/artistInviteService';
import { getCurrentUser } from '../services/supabase/authService';

export default function ConvitesRecebidosScreen() {
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

      // Buscar convites recebidos
      const { success, invites: receivedInvites, error } = await getArtistInvitesReceived(user.id);
      
      if (success && receivedInvites) {
        setInvites(receivedInvites);
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

  const handleAcceptInvite = async (inviteId: string, artistName: string, artistId: string) => {
    if (!currentUserId) return;

    Alert.alert(
      'Aceitar Convite',
      `Deseja aceitar o convite para colaborar com o artista "${artistName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceitar',
          style: 'default',
          onPress: async () => {
            try {
              const { success, error } = await acceptArtistInvite(inviteId, currentUserId);
              
              if (success) {
                // Perguntar se quer trocar para este artista
                Alert.alert(
                  'Trocar Artista Ativo?',
                  `Convite aceito com sucesso! Deseja trocar para o artista "${artistName}" como seu artista ativo?`,
                  [
                    {
                      text: 'Manter Atual',
                      style: 'cancel',
                      onPress: () => {
                        Alert.alert('Sucesso', 'Convite aceito! Você pode trocar de artista a qualquer momento nas configurações.');
                        loadData();
                      }
                    },
                    {
                      text: 'Trocar para Este',
                      style: 'default',
                      onPress: async () => {
                        try {
                          // Importar e usar o serviço de artista ativo
                          const { setActiveArtist } = await import('../services/artistContext');
                          
                          // Definir o novo artista ativo
                          await setActiveArtist({
                            id: artistId,
                            name: artistName,
                            role: 'viewer' // Role padrão para convites
                          });
                          
                          Alert.alert(
                            'Artista Alterado!', 
                            `Agora você está trabalhando com o artista "${artistName}".`,
                            [
                              {
                                text: 'OK',
                                onPress: () => {
                                  loadData();
                                  // Opcional: navegar para a agenda
                                  router.push('/(tabs)/agenda');
                                }
                              }
                            ]
                          );
                        } catch (error) {
                          console.error('Erro ao trocar artista:', error);
                          Alert.alert('Sucesso', 'Convite aceito! Erro ao trocar artista, mas você pode fazer isso manualmente nas configurações.');
                          loadData();
                        }
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('Erro', error || 'Erro ao aceitar convite');
              }
            } catch (error) {
              Alert.alert('Erro', 'Erro ao aceitar convite');
            }
          }
        }
      ]
    );
  };

  const handleDeclineInvite = async (inviteId: string, artistName: string) => {
    if (!currentUserId) return;

    Alert.alert(
      'Recusar Convite',
      `Deseja recusar o convite para colaborar com o artista "${artistName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recusar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { success, error } = await declineArtistInvite(inviteId, currentUserId);
              
              if (success) {
                Alert.alert('Convite Recusado', 'O convite foi recusado.');
                loadData(); // Recarregar dados
              } else {
                Alert.alert('Erro', error || 'Erro ao recusar convite');
              }
            } catch (error) {
              Alert.alert('Erro', 'Erro ao recusar convite');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'accepted':
        return '#10B981';
      case 'declined':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'accepted':
        return 'Aceito';
      case 'declined':
        return 'Recusado';
      default:
        return 'Desconhecido';
    }
  };

  const renderInvite = ({ item }: { item: ArtistInvite }) => (
    <View style={styles.inviteCard}>
      <View style={styles.inviteHeader}>
        <View style={styles.inviteInfo}>
          <Text style={styles.inviteTitle}>
            Convite de Colaboração
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.inviteDetails}>
        <Text style={styles.artistName}>
          <Text style={styles.label}>Artista:</Text> {item.artist?.name || 'Artista não encontrado'}
        </Text>
        <Text style={styles.fromUser}>
          <Text style={styles.label}>Convidado por:</Text> {item.from_user?.name || 'Usuário não encontrado'}
        </Text>
        <Text style={styles.inviteDate}>
          <Text style={styles.label}>Recebido em:</Text> {formatDate(item.created_at)}
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
            style={styles.acceptButton}
            onPress={() => handleAcceptInvite(item.id, item.artist?.name || 'Artista', item.artist_id)}
          >
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            <Text style={styles.acceptButtonText}>Aceitar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.declineButton}
            onPress={() => handleDeclineInvite(item.id, item.artist?.name || 'Artista')}
          >
            <Ionicons name="close" size={16} color="#FFFFFF" />
            <Text style={styles.declineButtonText}>Recusar</Text>
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
          <Text style={styles.title}>Convites Recebidos</Text>
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
        <Text style={styles.title}>Convites Recebidos</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {invites.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="mail-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Nenhum convite</Text>
            <Text style={styles.emptySubtitle}>
              Você não possui convites de colaboração no momento.
            </Text>
          </View>
        ) : (
          <View style={styles.invitesList}>
            {pendingInvites.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Convites Pendentes</Text>
                {pendingInvites.map((invite) => (
                  <View key={invite.id}>
                    {renderInvite({ item: invite })}
                  </View>
                ))}
              </>
            )}

            {processedInvites.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Convites Processados</Text>
                {processedInvites.map((invite) => (
                  <View key={invite.id}>
                    {renderInvite({ item: invite })}
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  invitesList: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inviteHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  inviteInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  inviteDetails: {
    padding: 16,
  },
  artistName: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  fromUser: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  inviteDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  responseDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  label: {
    fontWeight: '500',
    color: '#1F2937',
  },
  inviteActions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  declineButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
