import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import PermissionModal from '../components/PermissionModal';
import { useTheme } from '../contexts/ThemeContext';
import {
    acceptArtistInvite,
    ArtistInvite,
    declineArtistInvite,
    getArtistInvitesReceived,
    markInviteAsRead
} from '../services/supabase/artistInviteService';
import { getCurrentUser } from '../services/supabase/authService';
import { getEventById } from '../services/supabase/eventService';
import {
    deleteNotification,
    getUserNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    Notification
} from '../services/supabase/notificationService';
import { hasPermission } from '../services/supabase/permissionsService';

export default function NotificacoesScreen() {
  const { colors, isDarkMode } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [artistInvites, setArtistInvites] = useState<ArtistInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPermissionModal, setShowPermissionModal] = useState(false);

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
        // Se a notificação tem event_id, verificar permissões antes de navegar
        if (notification.event_id) {
          await handleEventNotificationPress(notification.event_id);
        } else {
          // Fallback para a agenda se não houver event_id
          router.push('/(tabs)/agenda');
        }
        break;
      default:
        // Não navegar para tipos desconhecidos
        break;
    }
  };

  const handleEventNotificationPress = async (eventId: string) => {
    try {
      // Se não temos usuário logado, navegar para agenda
      if (!currentUserId) {
        router.push('/(tabs)/agenda');
        return;
      }

      // Buscar o evento para obter o artist_id
      const eventResult = await getEventById(eventId);
      
      if (!eventResult.success || !eventResult.event) {
        Alert.alert('Erro', 'Evento não encontrado');
        return;
      }

      // Verificar se o usuário tem permissão para ver detalhes do evento
      // Apenas editor, admin e owner podem ver detalhes dos eventos
      const canEditEvents = await hasPermission(currentUserId, eventResult.event.artist_id, 'canEditEvents');
      
      if (!canEditEvents) {
        setShowPermissionModal(true);
        return;
      }

      // Se tem permissão, navegar para os detalhes do evento
      router.push({
        pathname: '/detalhes-evento',
        params: { eventId: eventId }
      });

    } catch (error) {
      console.error('Erro ao verificar permissões do evento:', error);
      Alert.alert('Erro', 'Erro ao verificar permissões. Redirecionando para a agenda.');
      router.push('/(tabs)/agenda');
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
                        setSuccessMessage(`Convite aceito! Você foi adicionado como colaborador do artista "${artistName}" com permissões de visualização. Você pode trocar de artista a qualquer momento nas configurações.`);
                        setShowSuccessModal(true);
                        loadNotifications();
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
                          
                          setSuccessMessage(`Artista alterado! Agora você está trabalhando com o artista "${artistName}". Você foi adicionado como colaborador com permissões de visualização.`);
                          setShowSuccessModal(true);
                          loadNotifications();
                        } catch (error) {
                          console.error('Erro ao trocar artista:', error);
                          setSuccessMessage(`Convite aceito! Erro ao trocar artista, mas você foi adicionado como colaborador do artista "${artistName}". Você pode trocar manualmente nas configurações.`);
                          setShowSuccessModal(true);
                          loadNotifications();
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

  const formatNotificationTitle = (title: string, type: string) => {
    if (type === 'event_created' && title.includes('adicionado')) {
      return title.replace('adicionado', '').trim();
    }
    return title;
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

  // Estilos dinâmicos baseados no modo escuro
  const dynamicStyles = createDynamicStyles(isDarkMode, colors);

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity
          style={dynamicStyles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Notificações</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={dynamicStyles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={dynamicStyles.markAllText}>Marcar todas</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={[dynamicStyles.content, { paddingHorizontal: 0 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 && artistInvites.length === 0 ? (
          <View style={dynamicStyles.emptyState}>
            <Ionicons name="notifications-outline" size={64} color={colors.textSecondary} />
            <Text style={dynamicStyles.emptyTitle}>Nenhuma notificação</Text>
            <Text style={dynamicStyles.emptySubtitle}>
              Você não possui notificações no momento.
            </Text>
          </View>
        ) : (
          <View style={dynamicStyles.content}>
            {notifications.map((notification) => (
              <View
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.unreadNotification
                ]}
              >
                <TouchableOpacity
                  style={styles.notificationContent}
                  onPress={() => handleNotificationPress(notification)}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationLeft}>
                    {/* Imagem do usuário com ícone de notificação */}
                    {notification.from_user && (
                      <View style={styles.userAvatarContainer}>
                        {notification.from_user.profile_url && notification.from_user.profile_url.trim() !== '' ? (
                          <View style={styles.userAvatarWithIcon}>
                            <Image
                              source={{
                                uri: `${notification.from_user.profile_url}${notification.from_user.profile_url.includes('?') ? '&' : '?'}t=${Date.now()}`,
                                cache: 'reload'
                              }}
                              style={styles.userAvatar}
                              resizeMode="cover"
                              onError={() => {
                                // Fallback para placeholder em caso de erro
                              }}
                            />
                            <View style={[
                              styles.notificationIconBadge,
                              { backgroundColor: getNotificationColor(notification.type) }
                            ]}>
                              <Ionicons
                                name={getNotificationIcon(notification.type)}
                                size={12}
                                color="#FFFFFF"
                              />
                            </View>
                          </View>
                        ) : (
                          <View style={styles.userAvatarPlaceholder}>
                            <Ionicons name="person" size={18} color="#667eea" />
                            <View style={[
                              styles.notificationIconBadge,
                              { backgroundColor: getNotificationColor(notification.type) }
                            ]}>
                              <Ionicons
                                name={getNotificationIcon(notification.type)}
                                size={12}
                                color="#FFFFFF"
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                    
                    <View style={styles.notificationDetails}>
                      <View style={styles.notificationHeader}>
                        <Text style={[
                          styles.notificationTitle,
                          !notification.read && styles.unreadTitle
                        ]}>
                          {formatNotificationTitle(notification.title, notification.type)}
                        </Text>
                      </View>
                      
                      <Text style={styles.notificationMessage}>
                        {notification.message}
                      </Text>
                      
                      <View style={styles.notificationFooter}>
                        <View style={styles.footerLeft}>
                          <Text style={styles.notificationTime}>
                            {formatTimeAgo(notification.created_at)}
                          </Text>
                        </View>
                        
                        {notification.from_user && (
                          <View style={styles.footerRight}>
                            <Text style={styles.footerLabel}>por</Text>
                            <Text style={styles.userName}>
                              {notification.from_user.name}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.notificationRight}>
                    {!notification.read && <View style={styles.unreadDot} />}
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteNotification(notification.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </View>
            ))}

            {/* Convites de Artista Recebidos */}
            {artistInvites.length > 0 && (
              <>
                <View style={styles.sectionDivider} />
                <Text style={styles.sectionTitle}>Convites de Artista</Text>
                {artistInvites.map((invite) => (
                  <View
                    key={invite.id}
                    style={[
                      styles.inviteCard,
                      !invite.read && styles.unreadNotification
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.inviteContent}
                      onPress={() => !invite.read && handleMarkInviteAsRead(invite.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.inviteLeft}>
                        <View style={[styles.inviteIconContainer, { backgroundColor: '#3B82F615' }]}>
                          <Ionicons
                            name="people"
                            size={18}
                            color="#3B82F6"
                          />
                        </View>
                        
                        <View style={styles.inviteDetails}>
                          <Text style={styles.inviteTitle}>
                            {invite.artist?.name || 'Artista'}
                          </Text>
                          <Text style={styles.inviteMessage}>
                            {invite.from_user?.name || 'Alguém'} te convidou para colaborar
                          </Text>
                          <Text style={styles.inviteTime}>
                            {formatTimeAgo(invite.created_at)}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.inviteRight}>
                        {!invite.read && <View style={styles.unreadDot} />}
                      </View>
                    </TouchableOpacity>

                    {/* Ações para convites pendentes */}
                    {invite.status === 'pending' && (
                      <View style={styles.inviteActions}>
                        <TouchableOpacity
                          style={styles.acceptButton}
                          onPress={() => handleAcceptInvite(invite.id, invite.artist?.name || 'Artista', invite.artist_id)}
                        >
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          <Text style={styles.acceptButtonText}>Aceitar</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.declineButton}
                          onPress={() => handleDeclineInvite(invite.id, invite.artist?.name || 'Artista')}
                        >
                          <Ionicons name="close" size={16} color="#FFFFFF" />
                          <Text style={styles.declineButtonText}>Recusar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal de Permissão */}
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Sem Permissão"
        message="Você não tem permissão para visualizar detalhes deste evento. Apenas colaboradores com permissão de edição podem acessar os detalhes."
        icon="lock-closed"
      />

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

// Função para criar estilos dinâmicos baseados no modo escuro
const createDynamicStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  markAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  notificationCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.secondary,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  deleteButtonText: {
    color: '#fff',
  },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteContent: {
    padding: 12,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 8,
    flex: 1,
  },
  inviteMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  inviteTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  inviteActions: {
    padding: 12,
    gap: 8,
  },
  acceptButton: {
    backgroundColor: colors.success,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  declineButton: {
    backgroundColor: colors.error,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  declineButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: '90%',
    shadowColor: colors.shadow,
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
    color: colors.text,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalPermissions: {
    backgroundColor: colors.secondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  permissionsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  permissionText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  modalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

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
    paddingHorizontal: 0,
    paddingTop: 20,
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    backgroundColor: '#FAFBFC',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  notificationRight: {
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  userAvatarContainer: {
    marginRight: 12,
  },
  userAvatarWithIcon: {
    position: 'relative',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  notificationIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  notificationDetails: {
    flex: 1,
  },
  notificationHeader: {
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 22,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 10,
    marginTop: 2,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  footerLeft: {
    flex: 1,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  footerLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '400',
    marginRight: 4,
  },
  userName: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#667eea',
    marginBottom: 8,
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 24,
    marginHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    marginTop: 8,
    marginHorizontal: 12,
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
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    gap: 6,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    gap: 6,
  },
  declineButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  inviteCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  inviteContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
  },
  inviteLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  inviteIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  inviteRight: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  inviteDetails: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  inviteMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  inviteTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
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
