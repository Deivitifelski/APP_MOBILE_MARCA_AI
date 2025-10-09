import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ArtistInvite, cancelArtistInvite, getArtistInvitesSent } from '../services/supabase/artistInviteService';
import { getCurrentUser } from '../services/supabase/authService';

export default function ConvitesEnviadosScreen() {
  const { colors } = useTheme();
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
        return colors.warning;
      case 'accepted':
        return colors.success;
      case 'declined':
        return colors.error;
      default:
        return colors.textSecondary;
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
    <View style={[styles.inviteCard, { backgroundColor: colors.surface }]}>
      <View style={styles.inviteHeader}>
        <View style={styles.userInfo}>
          <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.userAvatarText}>
              {item.to_user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: colors.text }]}>{item.to_user?.name || 'Usuário'}</Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{item.to_user?.email || 'Email não disponível'}</Text>
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
        <Text style={[styles.artistName, { color: colors.text }]}>
          <Text style={[styles.label, { color: colors.primary }]}>Artista:</Text> {item.artist?.name || 'Artista não encontrado'}
        </Text>
        <Text style={[styles.inviteDate, { color: colors.text }]}>
          <Text style={[styles.label, { color: colors.primary }]}>Enviado em:</Text> {formatDate(item.created_at)}
        </Text>
        {item.responded_at && (
          <Text style={[styles.responseDate, { color: colors.text }]}>
            <Text style={[styles.label, { color: colors.primary }]}>Respondido em:</Text> {formatDate(item.responded_at)}
          </Text>
        )}
      </View>

      {item.status === 'pending' && (
        <View style={styles.inviteActions}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: colors.error + '20', borderColor: colors.error + '40' }]}
            onPress={() => handleCancelInvite(item.id, item.to_user?.name || 'Usuário')}
          >
            <Ionicons name="trash" size={16} color={colors.error} />
            <Text style={[styles.cancelButtonText, { color: colors.error }]}>Cancelar Convite</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const pendingInvites = invites.filter(invite => invite.status === 'pending');
  const processedInvites = invites.filter(invite => invite.status !== 'pending');

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Convites Enviados</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando convites...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Convites Enviados</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
      >

        {/* Convites Pendentes */}
        {pendingInvites.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Convites Pendentes</Text>
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Histórico</Text>
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
            <Ionicons name="mail-outline" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Nenhum convite enviado ainda
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
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
    fontSize: 20,
    fontWeight: 'bold',
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
    marginBottom: 12,
  },
  invitesList: {
    gap: 12,
  },
  inviteCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 12,
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
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
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
    marginBottom: 4,
  },
  inviteDate: {
    fontSize: 14,
    marginBottom: 4,
  },
  responseDate: {
    fontSize: 14,
  },
  label: {
    fontWeight: '600',
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
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
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
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
