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
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification,
  Notification 
} from '../services/supabase/notificationService';
import { getCurrentUser } from '../services/supabase/authService';
import { 
  getArtistInvitesReceived, 
  acceptArtistInvite, 
  declineArtistInvite, 
  markInviteAsRead,
  ArtistInvite 
} from '../services/supabase/artistInviteService';

export default function NotificacoesScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [artistInvites, setArtistInvites] = useState<ArtistInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      
      const { user, error: userError } = await getCurrentUser();
      
      if (userError || !user) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        return;
      }

      setCurrentUserId(user.id);

      // Carregar notificações
      const { notifications, error } = await getUserNotifications(user.id);
      
      if (error) {
        Alert.alert('Erro', 'Erro ao carregar notificações');
        return;
      }

      setNotifications(notifications || []);

      // Carregar convites de artista recebidos
      const { success, invites, error: invitesError } = await getArtistInvitesReceived(user.id);
      
      if (success && invites) {
        setArtistInvites(invites);
      } else if (invitesError) {
        console.error('Erro ao carregar convites:', invitesError);
      }
      
      // Contar notificações não lidas + convites pendentes
      const unreadNotifications = (notifications || []).filter(n => !n.read).length;
      const pendingInvites = (invites || []).filter(invite => invite.status === 'pending').length;
      setUnreadCount(unreadNotifications + pendingInvites);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      Alert.alert('Erro', 'Erro ao carregar notificações');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Marcar como lida se não estiver lida
    if (!notification.read) {
      const { success, error } = await markNotificationAsRead(notification.id);
      
      if (success) {
        // Atualizar estado local
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }

    // Navegar baseado no tipo de notificação
    switch (notification.type) {
      case 'artist_invite':
        // Para convites de artista, navegar para a tela de convites recebidos
        router.push('/convites-recebidos');
        break;
      case 'collaborator_added':
      case 'collaborator_removed':
        router.push('/colaboradores-artista');
        break;
      case 'event_created':
      case 'event_updated':
        router.push('/(tabs)/agenda');
        break;
      default:
        // Não navegar para tipos desconhecidos
        break;
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { user } = await getCurrentUser();
      if (!user) return;

      // Marcar todas as notificações como lidas
      const { success, error } = await markAllNotificationsAsRead(user.id);
      
      if (success) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, read: true }))
        );
      } else {
        Alert.alert('Erro', 'Erro ao marcar notificações como lidas');
      }

      // Marcar todos os convites não lidos como lidos
      const unreadInvites = artistInvites.filter(invite => !invite.read);
      for (const invite of unreadInvites) {
        await markInviteAsRead(invite.id, user.id);
      }
      
      setArtistInvites(prev => 
        prev.map(invite => ({ ...invite, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const handleMarkInviteAsRead = async (inviteId: string) => {
    try {
      const { user } = await getCurrentUser();
      if (!user) return;

      const { success, error } = await markInviteAsRead(inviteId, user.id);
      
      if (success) {
        setArtistInvites(prev => 
          prev.map(invite => 
            invite.id === inviteId ? { ...invite, read: true } : invite
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        console.error('Erro ao marcar convite como lido:', error);
      }
    } catch (error) {
      console.error('Erro ao marcar convite como lido:', error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    Alert.alert(
      'Deletar Notificação',
      'Tem certeza que deseja deletar esta notificação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { success, error } = await deleteNotification(notificationId);
              
              if (success) {
                setNotifications(prev => prev.filter(n => n.id !== notificationId));
                // Recalcular contador de não lidas
                const newUnreadCount = notifications.filter(n => n.id !== notificationId && !n.read).length;
                setUnreadCount(newUnreadCount);
              } else {
                Alert.alert('Erro', 'Erro ao deletar notificação');
              }
            } catch (error) {
              console.error('Erro ao deletar notificação:', error);
            }
          }
        }
      ]
    );
  };

  const handleAcceptInvite = async (inviteId: string, artistName: string) => {
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
                // Mostrar modal com informações sobre as permissões
                setSuccessMessage(`Você foi adicionado como colaborador do artista "${artistName}" com permissões de visualização. Você pode visualizar informações do artista, mas não pode fazer alterações.`);
                setShowSuccessModal(true);
                // Recarregar dados
                await loadNotifications();
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
                // Recarregar dados
                await loadNotifications();
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'artist_invite':
        return 'mail';
      case 'collaborator_added':
        return 'person-add';
      case 'collaborator_removed':
        return 'person-remove';
      case 'event_created':
      case 'event_updated':
        return 'calendar';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'artist_invite':
        return '#3B82F6';
      case 'collaborator_added':
        return '#10B981';
      case 'collaborator_removed':
        return '#EF4444';
      case 'event_created':
      case 'event_updated':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    return date.toLocaleDateString('pt-BR');
  };

  const getInviteStatusColor = (status: string) => {
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

  const getInviteStatusText = (status: string) => {
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

  const isNotificationSentByUser = (notification: Notification) => {
    return currentUserId && notification.from_user_id === currentUserId;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notificações</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Carregando notificações...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notificações</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllText}>Marcar todas</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 && artistInvites.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
            <Text style={styles.emptySubtitle}>
              Você não possui notificações no momento.
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.unreadNotification
                ]}
                onPress={() => handleNotificationPress(notification)}
              >
                <View style={styles.notificationContent}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={getNotificationIcon(notification.type)}
                      size={24}
                      color={getNotificationColor(notification.type)}
                    />
                  </View>
                  
                  <View style={styles.notificationDetails}>
                    <View style={styles.notificationHeader}>
                      <Text style={[
                        styles.notificationTitle,
                        !notification.read && styles.unreadTitle
                      ]}>
                        {notification.title}
                      </Text>
                      <Text style={[
                        styles.notificationStatus,
                        isNotificationSentByUser(notification) ? styles.sentStatus : styles.receivedStatus
                      ]}>
                        {isNotificationSentByUser(notification) ? 'Enviada' : 'Recebida'}
                      </Text>
                    </View>
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatTimeAgo(notification.created_at)}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteNotification(notification.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                
                {!notification.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))}

            {/* Convites de Artista Recebidos */}
            {artistInvites.length > 0 && (
              <>
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionTitle}>Convites de Artista</Text>
                {artistInvites.map((invite) => (
                  <TouchableOpacity
                    key={invite.id}
                    style={styles.inviteCard}
                    onPress={() => !invite.read && handleMarkInviteAsRead(invite.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.inviteContent}>
                      <View style={styles.inviteHeader}>
                        <Ionicons
                          name="people"
                          size={20}
                          color="#3B82F6"
                        />
                        <Text style={styles.inviteTitle}>
                          {invite.artist?.name || 'Artista'}
                        </Text>
                        {!invite.read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.inviteMessage}>
                        {invite.from_user?.name || 'Alguém'} te convidou para colaborar
                      </Text>
                      <Text style={styles.inviteTime}>
                        {formatTimeAgo(invite.created_at)}
                      </Text>
                    </View>

                    {/* Ações para convites pendentes */}
                    {invite.status === 'pending' && (
                      <View style={styles.inviteActions}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => handleAcceptInvite(invite.id, invite.artist?.name || 'Artista')}
                        >
                          <Text style={styles.acceptButtonText}>Aceitar</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.declineButton}
                          onPress={() => handleDeclineInvite(invite.id, invite.artist?.name || 'Artista')}
                        >
                          <Text style={styles.declineButtonText}>Recusar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal de Sucesso */}
      {showSuccessModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              <Text style={styles.modalTitle}>Convite Aceito!</Text>
            </View>
            
            <Text style={styles.modalMessage}>
              {successMessage}
            </Text>
            
            <View style={styles.modalPermissions}>
              <Text style={styles.permissionsTitle}>Suas permissões:</Text>
              <View style={styles.permissionItem}>
                <Ionicons name="eye" size={16} color="#6B7280" />
                <Text style={styles.permissionText}>Visualizar informações do artista</Text>
              </View>
              <View style={styles.permissionItem}>
                <Ionicons name="calendar" size={16} color="#6B7280" />
                <Text style={styles.permissionText}>Ver agenda e eventos</Text>
              </View>
              <View style={styles.permissionItem}>
                <Ionicons name="people" size={16} color="#6B7280" />
                <Text style={styles.permissionText}>Ver outros colaboradores</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  markAllButton: {
    padding: 8,
  },
  markAllText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationsList: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    position: 'relative',
  },
  unreadNotification: {
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
  },
  iconContainer: {
    marginRight: 10,
    marginTop: 2,
  },
  notificationDetails: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadTitle: {
    fontWeight: 'bold',
  },
  notificationStatus: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  sentStatus: {
    backgroundColor: '#EFF6FF',
    color: '#3B82F6',
  },
  receivedStatus: {
    backgroundColor: '#F0FDF4',
    color: '#10B981',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#999',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#667eea',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e9ecef',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
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
  inviteActions: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  declineButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  inviteCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inviteContent: {
    padding: 12,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  inviteMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  inviteTime: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  modalPermissions: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  permissionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  modalButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
