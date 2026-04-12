import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OptimizedImage from '../components/OptimizedImage';
import { useTheme } from '../contexts/ThemeContext';
import { checkPendingInvite, createArtistInvite } from '../services/supabase/artistInviteService';
import { getCurrentUser } from '../services/supabase/authService';
import { addCollaborator, Collaborator, getCollaborators, removeCollaborator, searchUsersForCollaboratorInvite, updateCollaboratorRole } from '../services/supabase/collaboratorService';
import { deletePendingInviteNotifications } from '../services/supabase/notificationService';
import { useActiveArtist } from '../services/useActiveArtist';

type CollaboratorInviteRole = 'owner' | 'admin' | 'editor' | 'viewer';

/** Textos alinhados às regras reais (agenda, finanças, colaboradores, perfil). */
const COLLABORATOR_ROLES_CONFIG: {
  value: CollaboratorInviteRole;
  label: string;
  summary: string;
  powers: string[];
  limitations?: string[];
  modalIcon: React.ComponentProps<typeof Ionicons>['name'];
  modalColor: string;
}[] = [
  {
    value: 'admin',
    label: 'Administrador',
    summary: 'Acesso total ao artista: finanças, agenda, equipe e perfil.',
    powers: [
      'Ver, criar, editar e excluir eventos e despesas (com valores)',
      'Convidar colaboradores e mudar permissões',
      'Editar perfil do artista, excluir o artista e gerenciar convites',
    ],
    modalIcon: 'shield-checkmark',
    modalColor: '#FF6B35',
  },
  {
    value: 'owner',
    label: 'Gerente',
    summary: 'Igual ao admin na agenda e finanças; na equipe, não mexe em administradores.',
    powers: [
      'Agenda, finanças e perfil como administrador',
      'Convidar e gerenciar Editor e Visualizador',
    ],
    limitations: ['Não altera nem remove um Administrador'],
    modalIcon: 'star',
    modalColor: '#FFD700',
  },
  {
    value: 'editor',
    label: 'Editor',
    summary: 'Cuida da agenda e do dinheiro; não apaga eventos nem gerencia a equipe.',
    powers: [
      'Ver e editar eventos e despesas (com valores) e exportar finanças',
      'Ver colaboradores (sem mudar permissões)',
    ],
    limitations: [
      'Não exclui eventos',
      'Não convida/remove colaboradores nem edita perfil do artista',
    ],
    modalIcon: 'create',
    modalColor: '#4ECDC4',
  },
  {
    value: 'viewer',
    label: 'Visualizador',
    summary: 'Só leitura: vê agenda e equipe, sem valores e sem editar.',
    powers: ['Ver eventos e dados do artista (sem valores em dinheiro)', 'Ver colaboradores e notificações'],
    limitations: ['Sem acesso a cachês/receitas/despesas', 'Não cria nem edita nada'],
    modalIcon: 'eye',
    modalColor: '#95A5A6',
  },
];

/** Convite e troca de papel: não exibimos Gerente (owner); quem já é gerente continua no sistema. */
const COLLABORATOR_ROLES_FOR_PICKER = COLLABORATOR_ROLES_CONFIG.filter((r) => r.value !== 'owner');

function roleForNewInviteOrAdd(role: CollaboratorInviteRole): Exclude<CollaboratorInviteRole, 'owner'> {
  return role === 'owner' ? 'admin' : role;
}

/** Cidade/UF vindos do cadastro do usuário (`users`), quando a RPC os retorna. */
function formatBuscaColaboradorLocalizacao(u: { city?: string | null; state?: string | null }): string {
  const city = u.city?.trim() || '';
  const state = u.state?.trim() || '';
  if (!city && !state) return 'Local não informado';
  if (city && state) return `${city} — ${state}`;
  return city || state;
}

export default function ColaboradoresArtistaScreen() {
  const { colors } = useTheme();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canAddCollaborators, setCanAddCollaborators] = useState(false);
  const [collaboratorPlanBlockedMessage, setCollaboratorPlanBlockedMessage] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { activeArtist, loadActiveArtist } = useActiveArtist();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newCollaboratorRole, setNewCollaboratorRole] = useState<'owner' | 'admin' | 'editor' | 'viewer'>('viewer');
  const [isAdding, setIsAdding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'admin' | 'editor' | 'viewer'>('viewer');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [showInviteSentModal, setShowInviteSentModal] = useState(false);
  const [inviteSentData, setInviteSentData] = useState<{
    userName: string;
    userEmail: string;
    userImage: string;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
  } | null>(null);
  const [existingInviteIdToDelete, setExistingInviteIdToDelete] = useState<string | null>(null); // ID da notificação antiga para deletar ao reenviar
  const [showPendingInviteModal, setShowPendingInviteModal] = useState(false);
  const [pendingInviteData, setPendingInviteData] = useState<{
    userName: string;
    role: string;
    createdAt: string;
  } | null>(null);

  useEffect(() => {
    loadActiveArtist();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    const { user } = await getCurrentUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  useEffect(() => {
    if (activeArtist) {
      loadData();
    }
  }, [activeArtist]);


  const loadData = async () => {
    if (!activeArtist) return;
    
    try {
      setIsLoading(true);
      
      // Garantir que temos o currentUserId
      if (!currentUserId) {
        const { user } = await getCurrentUser();
        if (user) {
          setCurrentUserId(user.id);
        }
      }
      
      // Verificar se é owner
      const isUserOwner = activeArtist.role === 'owner';
      setIsOwner(isUserOwner);

      // Buscar colaboradores
      const {
        collaborators,
        userRole,
        canManage,
        canAddCollaborators,
        collaboratorPlanBlockedMessage: planMsg,
        error: collaboratorsError,
      } = await getCollaborators(activeArtist.id);
      
      console.log('📊 Dados carregados:', {
        userRole,
        canManage,
        canAddCollaborators,
        currentUserId,
        totalColaboradores: collaborators?.length || 0
      });
      
      if (collaboratorsError) {
        Alert.alert('Erro', 'Erro ao carregar colaboradores');
        return;
      }

      setCollaborators(collaborators || []);
      setUserRole(userRole);
      setCanManage(canManage);
      setCanAddCollaborators(canAddCollaborators);
      setCollaboratorPlanBlockedMessage(planMsg || null);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  /** Limpa busca e seleção ao abrir o modal ou ao cancelar/fechar sem convidar. */
  const resetBuscarColaboradorModal = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedUser(null);
    setIsSearching(false);
  };

  const closeBuscarColaboradorModal = () => {
    resetBuscarColaboradorModal();
    setShowAddModal(false);
  };

  const handleSearchUsers = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    if (!activeArtist?.id) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const { users, error } = await searchUsersForCollaboratorInvite(term, activeArtist.id);

      if (error) {
        setSearchResults([]);
        Alert.alert('Erro na busca', error);
        return;
      }

      setSearchResults(users || []);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = async (user: any) => {
    if (!activeArtist || !currentUserId) {
      Alert.alert('Erro', 'Dados insuficientes');
      return;
    }

    // ✅ VERIFICAR PRIMEIRO se já existe convite pendente ANTES de definir o usuário
    try {
      console.log('🔍 Verificando convite pendente para:', { artistId: activeArtist.id, userId: user.id });
      const { success: checkSuccess, invite: existingInvite } = await checkPendingInvite(
        activeArtist.id, 
        user.id
      );

      console.log('📋 Resultado da verificação:', { success: checkSuccess, hasInvite: !!existingInvite });

      if (existingInvite) {
        console.log('⚠️ Convite pendente encontrado! Bloqueando ação.');
        console.log('📋 Detalhes do convite pendente:', {
          id: existingInvite.id,
          artistId: existingInvite.artist_id,
          toUserId: existingInvite.to_user_id,
          role: existingInvite.role,
          status: existingInvite.status,
          createdAt: existingInvite.created_at
        });
        
        // Formatar data do convite
        const formatDate = (dateString: string) => {
          const date = new Date(dateString);
          return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
          });
        };

        // Formatar role para exibição
        const formatRole = (role: string) => {
          const roles: Record<string, string> = {
            'viewer': 'Visualizador',
            'editor': 'Editor',
            'admin': 'Administrador',
            'owner': 'Proprietário'
          };
          return roles[role] || role;
        };

        // Fechar modal de busca primeiro
        setShowAddModal(false);
        setSearchResults([]);
        setSearchTerm('');
        
        // Mostrar modal customizado com informações do convite pendente
        setPendingInviteData({
          userName: user.name,
          role: formatRole(existingInvite.role || 'viewer'),
          createdAt: formatDate(existingInvite.created_at)
        });
        setSelectedUser(user);
        setExistingInviteIdToDelete(existingInvite.id);
        setNewCollaboratorRole(roleForNewInviteOrAdd((existingInvite.role || 'viewer') as CollaboratorInviteRole));
        
        // Abrir modal de convite pendente
        console.log('🔔 Abrindo modal de convite pendente');
        setShowPendingInviteModal(true);
        
        // ✅ NÃO definir o usuário selecionado se já existe convite pendente (só se clicar em Reenviar)
        return;
      }

      // ✅ Só definir o usuário e abrir modal se NÃO existe convite pendente
      setSelectedUser(user);
      setSearchResults([]);
      setSearchTerm(user.name);
      setShowAddModal(false);
      
      setTimeout(() => {
        setShowInviteModal(true);
      }, 100);
    } catch (error) {
      // Em caso de erro na verificação, permitir prosseguir
      setSelectedUser(user);
      setSearchResults([]);
      setSearchTerm(user.name);
      setShowAddModal(false);
      
      setTimeout(() => {
        setShowInviteModal(true);
      }, 100);
    }
  };

  const handleInviteCollaborator = () => {
    if (!selectedUser) {
      Alert.alert('Erro', 'Selecione um usuário');
      return;
    }
    // Abrir modal de seleção de permissão
    setShowInviteModal(true);
  };

  const handleConfirmInvite = async () => {
    if (!selectedUser || !activeArtist || !currentUserId) return;

    try {
      setIsInviting(true);

      // Obter o usuário atual para ser o remetente
      const { user: currentUser, error: userError } = await getCurrentUser();
      
      if (userError || !currentUser) {
        Alert.alert('Erro', 'Erro ao obter dados do usuário atual');
        return;
      }

      // Se há uma notificação pendente para deletar (reenvio), deletar ela antes de criar a nova
      if (existingInviteIdToDelete) {
        console.log('🗑️ Deletando notificação pendente:', existingInviteIdToDelete);
        
        // Deletar a notificação pendente encontrada
        const { success: deleteSuccess, error: deleteError } = await deletePendingInviteNotifications(
          activeArtist.id,
          selectedUser.id
        );
        
        if (!deleteSuccess) {
          console.error('❌ Erro ao deletar notificação pendente:', deleteError);
          Alert.alert('Erro', deleteError || 'Erro ao remover convite antigo');
          setIsInviting(false);
          setExistingInviteIdToDelete(null);
          return;
        }
        
        console.log('✅ Notificação pendente deletada');
        setExistingInviteIdToDelete(null);
      }

      // Criar convite (primeira vez ou reenvio)
      const inviteRole = roleForNewInviteOrAdd(newCollaboratorRole);

      console.log('📝 Criando novo convite:', {
        artistId: activeArtist.id,
        toUserId: selectedUser.id,
        fromUserId: currentUser.id,
        role: inviteRole
      });
      
      const { success, error, invite } = await createArtistInvite({
        artistId: activeArtist.id,
        toUserId: selectedUser.id,
        fromUserId: currentUser.id,
        role: inviteRole
      });

      if (success) {
        // Salvar dados do convite para mostrar no modal
        setInviteSentData({
          userName: selectedUser.name,
          userEmail: selectedUser.email,
          userImage: selectedUser.profile_url || '',
          role: inviteRole
        });
        
        setShowInviteModal(false);
        setShowAddModal(false);
        setShowInviteSentModal(true);
                    setSearchTerm('');
                    setSearchResults([]);
                    setSelectedUser(null);
                    setNewCollaboratorRole('viewer');
                    setExistingInviteIdToDelete(null); // Limpar o ID da notificação antiga
      } else {
        Alert.alert('Erro', error || 'Erro ao enviar convite');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao enviar convite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedUser) {
      Alert.alert('Erro', 'Selecione um usuário');
      return;
    }

    if (!activeArtist) return;

    try {
      setIsAdding(true);

      const { success, error } = await addCollaborator(activeArtist.id, {
        userId: selectedUser.id,
        role: roleForNewInviteOrAdd(newCollaboratorRole)
      });

      if (success) {
        Alert.alert('Sucesso', 'Colaborador adicionado com sucesso!');
        setShowAddModal(false);
                    setSearchTerm('');
                    setSearchResults([]);
                    setSelectedUser(null);
                    setNewCollaboratorRole('viewer');
                    setExistingInviteIdToDelete(null); // Limpar o ID da notificação antiga
        loadData(); // Recarregar dados
      } else {
        Alert.alert('Erro', error || 'Erro ao adicionar colaborador');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao adicionar colaborador');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveCollaborator = (userId: string, userName: string) => {
    if (!activeArtist) return;

    // ✅ Ninguém pode se remover (deve usar "Sair do Artista")
    if (userId === currentUserId) {
      Alert.alert(
        'Ação Não Permitida',
        'Você não pode se remover desta forma. Use a opção "Sair do Artista" nas configurações.',
        [{ text: 'OK' }]
      );
      return;
    }

    // ✅ Se você é OWNER, não pode remover ADMIN
    const collaborator = collaborators.find(c => c.user_id === userId);
    if (userRole === 'owner' && collaborator?.role === 'admin') {
      Alert.alert(
        'Ação Não Permitida',
        'Gerentes não podem remover administradores.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Remover Colaborador',
      `Tem certeza que deseja remover ${userName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              const { success, error } = await removeCollaborator(userId, activeArtist.id);
              
              if (success) {
                Alert.alert('Sucesso', 'Colaborador removido com sucesso!');
                loadData(); // Recarregar dados
              } else {
                Alert.alert('Erro', error || 'Erro ao remover colaborador');
              }
            } catch (error) {
              Alert.alert('Erro', 'Erro ao remover colaborador');
            }
          }
        }
      ]
    );
  };

  const handleUpdateRole = (userId: string, currentRole: string, userName: string) => {
    if (!activeArtist) return;
    
    // ✅ Ninguém pode alterar suas próprias permissões
    if (userId === currentUserId) {
      Alert.alert(
        'Ação Não Permitida',
        'Você não pode alterar suas próprias permissões.',
        [{ text: 'OK' }]
      );
      return;
    }

    // ✅ Se você é OWNER, não pode alterar permissões de ADMIN
    if (userRole === 'owner' && currentRole === 'admin') {
      Alert.alert(
        'Ação Não Permitida',
        'Gerentes não podem alterar permissões de administradores.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const collaborator = collaborators.find(c => c.user_id === userId);
    if (!collaborator) return;
    
    setSelectedCollaborator(collaborator);
    setSelectedRole(currentRole as any);
    setShowRoleModal(true);
  };
  
  const handleConfirmRoleUpdate = async () => {
    if (!selectedCollaborator || !activeArtist) return;
    
    try {
      setIsUpdatingRole(true);
      
      const { success, error } = await updateCollaboratorRole(
        selectedCollaborator.user_id, 
        activeArtist.id, 
        selectedRole
      );
      
      if (success) {
        Alert.alert('Sucesso', 'Permissão alterada com sucesso!');
        setShowRoleModal(false);
        setSelectedCollaborator(null);
        loadData(); // Recarregar dados
      } else {
        Alert.alert('Erro', error || 'Erro ao alterar permissão');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao alterar permissão');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return 'star';
      case 'admin':
        return 'shield-checkmark';
      case 'editor':
        return 'create';
      case 'viewer':
        return 'eye';
      default:
        return 'person';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return '#FFD700'; // Dourado - mantém fixo
      case 'admin':
        return '#FF6B35'; // Laranja - mantém fixo
      case 'editor':
        return colors.success; // Verde
      case 'viewer':
        return colors.textSecondary; // Cinza
      default:
        return colors.primary;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Gerente';
      case 'admin':
        return 'Administrador';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Visualizador';
      default:
        return role;
    }
  };

  const renderCollaborator = ({ item }: { item: Collaborator }) => {
    const isCurrentUser = item.user_id === currentUserId;
    
    // ✅ Determinar se pode alterar/remover baseado nas regras:
    // - ADMIN: pode alterar TODOS (incluindo owner) - hierarquia mais alta
    // - OWNER: pode alterar todos EXCETO admin (e exceto ele mesmo)
    let canChangeThisRole = false;
    let canRemoveThis = false;
    
    console.log('👥 Renderizando colaborador:', {
      nome: item.user.name,
      colaboradorRole: item.role,
      meuRole: userRole,
      isCurrentUser,
      currentUserId,
      itemUserId: item.user_id
    });
    
    if (!isCurrentUser) {
      if (userRole === 'admin') {
        // ✅ ADMIN pode alterar/remover TODOS (owner, admin, editor, viewer) - menos ele mesmo
        canChangeThisRole = true;
        canRemoveThis = true;
        console.log('✅ EU SOU ADMIN - posso alterar:', item.user.name, 'que é', item.role);
      } else if (userRole === 'owner') {
        // ✅ OWNER pode alterar/remover todos EXCETO admin (e exceto ele mesmo)
        canChangeThisRole = item.role !== 'admin';
        canRemoveThis = item.role !== 'admin';
        console.log('✅ EU SOU OWNER - posso alterar?', { 
          nome: item.user.name, 
          roleColaborador: item.role,
          pode: item.role !== 'admin' 
        });
      } else {
        console.log('⚠️ Meu role não é admin nem owner:', userRole);
      }
    } else {
      console.log('❌ Não pode alterar:', { 
        motivo: 'É você mesmo'
      });
    }
    
    console.log('🔧 Resultado final dos botões:', { 
      colaborador: item.user.name,
      canChangeThisRole, 
      canRemoveThis,
      meuRole: userRole,
      colaboradorRole: item.role
    });
    
    return (
      <View style={[styles.collaboratorCard, { backgroundColor: colors.surface }]}>
        <View style={styles.collaboratorInfo}>
          <OptimizedImage
            imageUrl={item.user.profile_url || ''}
            style={styles.collaboratorAvatar}
            cacheKey={`collaborator_${item.user_id}`}
            fallbackText={item.user.name || 'Usuário'}
            fallbackIcon="person"
            fallbackIconSize={24}
            fallbackIconColor="#FFFFFF"
          />
          <View style={styles.collaboratorDetails}>
            <View style={styles.nameRow}>
              <Text style={[styles.collaboratorName, { color: colors.text }]}>{item.user.name}</Text>
              {isCurrentUser && (
                <View style={[styles.youBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.youBadgeText}>VOCÊ</Text>
                </View>
              )}
            </View>
            <Text style={[styles.collaboratorEmail, { color: colors.textSecondary }]}>{item.user.email}</Text>
            <View style={styles.roleContainer}>
              <Ionicons 
                name={getRoleIcon(item.role) as any} 
                size={16} 
                color={getRoleColor(item.role)} 
              />
              <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
                {getRoleLabel(item.role)}
              </Text>
            </View>
          </View>
        </View>
        
        {(canChangeThisRole || canRemoveThis) && (
          <View style={styles.collaboratorActions}>
            {canChangeThisRole && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleUpdateRole(item.user_id, item.role, item.user.name)}
              >
                <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
            {canRemoveThis && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleRemoveCollaborator(item.user_id, item.user.name)}
              >
                <Ionicons name="trash" size={20} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Colaboradores</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando colaboradores...</Text>
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
        <Text style={[styles.title, { color: colors.text }]}>Colaboradores</Text>
        <View style={styles.headerActions}>
          {canManage && (
            <>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push('/convites-enviados')}
              >
                <Ionicons name="mail" size={24} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push('/selecionar-artista')}
              >
                <Ionicons name="swap-horizontal" size={24} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
          {canAddCollaborators && (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => {
                if (!currentUserId) {
                  Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
                  return;
                }
                resetBuscarColaboradorModal();
                setShowAddModal(true);
              }}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {canManage && collaboratorPlanBlockedMessage ? (
          <View
            style={[
              styles.planLimitBanner,
              { backgroundColor: `${colors.warning}22`, borderColor: colors.warning },
            ]}
          >
            <Text style={[styles.planLimitBannerText, { color: colors.text }]}>{collaboratorPlanBlockedMessage}</Text>
            <TouchableOpacity onPress={() => router.push('/assine-premium')} style={styles.planLimitBannerBtn}>
              <Text style={[styles.planLimitBannerBtnText, { color: colors.primary }]}>Ver Premium</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {/* Informações do artista */}
        {activeArtist && (
          <View style={[styles.artistInfo, { backgroundColor: colors.surface }]}>
            <Text style={[styles.artistName, { color: colors.text }]}>{activeArtist.name}</Text>
            <Text style={[styles.collaboratorCount, { color: colors.textSecondary }]}>
              {collaborators.length} colaborador{collaborators.length !== 1 ? 'es' : ''}
            </Text>
          </View>
        )}

        {/* Lista de colaboradores */}
        {collaborators.length > 0 ? (
          <FlatList
            data={collaborators}
            renderItem={renderCollaborator}
            keyExtractor={(item) => `${item.user_id}-${item.artist_id}`}
            scrollEnabled={false}
            style={styles.collaboratorsList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              Nenhum colaborador encontrado
            </Text>
            {canAddCollaborators && (
              <Text style={styles.emptySubtext}>
                Toque no botão + para adicionar colaboradores
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal para adicionar colaborador */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeBuscarColaboradorModal}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity 
              onPress={closeBuscarColaboradorModal}
              style={styles.modalCloseButton}
            >
              <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Buscar Usuário</Text>
            <TouchableOpacity 
              onPress={handleInviteCollaborator}
              style={[styles.modalSaveButton, !selectedUser && styles.disabledButton]}
              disabled={!selectedUser}
            >
              <Text style={[styles.modalSaveText, !selectedUser && styles.disabledButtonText]}>
                Convidar {selectedUser ? '(Ativo)' : '(Inativo)'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Buscar usuário</Text>
              <Text style={[styles.collaboratorSearchHint, { color: colors.textSecondary }]}>
                Só aparecem contas que já têm perfil de artista no app e ainda não são colaboradoras deste artista. Busca pelo nome (início de cada palavra). Nome e localização (cidade/UF) quando existir.
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={searchTerm}
                onChangeText={(text) => {
                  setSearchTerm(text);
                  handleSearchUsers(text);
                }}
                placeholder="Nome"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
              
              {searchResults.length > 0 && (
                <View style={styles.collaboratorSearchResultsList}>
                  {searchResults.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      activeOpacity={0.75}
                      style={[
                        styles.collaboratorInviteCard,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      onPress={() => handleSelectUser(user)}
                    >
                      <View style={styles.collaboratorInviteCardHeader}>
                        <OptimizedImage
                          imageUrl={user.profile_url || ''}
                          style={styles.collaboratorInviteCardAvatar}
                          cacheKey={`user_search_${user.id}`}
                          fallbackText={user.name || 'Usuário'}
                          fallbackIcon="person"
                          fallbackIconSize={22}
                          fallbackIconColor="#667eea"
                        />
                        <View style={styles.collaboratorInviteCardHeaderText}>
                          <Text style={[styles.collaboratorInviteCardName, { color: colors.text }]} numberOfLines={1}>
                            {user.name}
                          </Text>
                          <View style={styles.collaboratorInviteLocationRow}>
                            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                            <Text style={[styles.collaboratorInviteCardEmail, { color: colors.textSecondary, flex: 1 }]} numberOfLines={2}>
                              {formatBuscaColaboradorLocalizacao(user)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {isSearching && (
                <View style={styles.searchLoading}>
                  <ActivityIndicator size="small" color="#667eea" />
                  <Text style={[styles.searchLoadingText, { color: colors.textSecondary }]}>Buscando usuários...</Text>
                </View>
              )}
              
              {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
                <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>Nenhum usuário encontrado</Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de confirmação de convite */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }] }>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }] }>
            <TouchableOpacity 
              onPress={() => setShowInviteModal(false)}
              style={styles.modalCloseButton}
            >
              <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Enviar Convite</Text>
            <TouchableOpacity 
              onPress={handleConfirmInvite}
              style={styles.modalSaveButton}
              disabled={isInviting}
            >
              {isInviting ? (
                <ActivityIndicator size="small" color="#667eea" />
              ) : (
                <Text style={[styles.modalSaveText, { color: colors.primary }]}>Enviar</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }] }>
            <View style={styles.permissionSelection}>
              <Text style={[styles.permissionTitle, { color: colors.text }]}>Enviar Convite de Colaboração</Text>
              
              <Text style={[styles.permissionDescription, { color: colors.textSecondary }] }>
                Escolha o nível de acesso. Abaixo, um resumo do que a pessoa pode e não pode fazer.
              </Text>
              
              {selectedUser && (
                <View style={[styles.permissionUserCard, { backgroundColor: colors.surface, borderColor: colors.border }] }>
                  <OptimizedImage
                    imageUrl={selectedUser.profile_url || ''}
                    style={styles.permissionUserAvatar}
                    cacheKey={`permission_${selectedUser.id}`}
                    fallbackText={selectedUser.name || 'Usuário'}
                    fallbackIcon="person"
                    fallbackIconSize={24}
                    fallbackIconColor="#FFFFFF"
                  />
                  <View style={styles.permissionUserInfo}>
                    <Text style={[styles.permissionUserName, { color: colors.text }]}>{selectedUser.name}</Text>
                    <View style={styles.permissionUserLocationRow}>
                      <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.permissionUserEmail, { color: colors.textSecondary, flex: 1 }]}>
                        {formatBuscaColaboradorLocalizacao(selectedUser)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              
              <Text style={[styles.permissionDetails, { color: colors.textSecondary }]}>
                <Text style={[styles.permissionDetailsLabel, { color: colors.primary }]}>Artista:</Text> {activeArtist?.name}
              </Text>
              
              <View style={styles.permissionOptions}>
                {COLLABORATOR_ROLES_FOR_PICKER.map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.permissionOption,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      newCollaboratorRole === role.value && [styles.permissionOptionSelected, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]
                    ]}
                    onPress={() => setNewCollaboratorRole(role.value)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.permissionOptionContent}>
                      <Text style={[
                        styles.permissionOptionLabel,
                        { color: colors.text },
                        newCollaboratorRole === role.value && [styles.permissionOptionLabelSelected, { color: colors.primary }]
                      ]}>
                        {role.label}
                      </Text>
                      <Text style={[
                        styles.permissionOptionDescription,
                        { color: colors.textSecondary },
                        newCollaboratorRole === role.value && styles.permissionOptionDescriptionSelected
                      ]}>
                        {role.summary}
                      </Text>
                      <Text style={[styles.permissionPowersHeading, { color: colors.textSecondary }]}>
                        Pode
                      </Text>
                      {role.powers.map((line) => (
                        <View key={line} style={styles.permissionPowerRow}>
                          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                          <Text style={[styles.permissionPowerText, { color: colors.text }]}>{line}</Text>
                        </View>
                      ))}
                      {role.limitations?.length ? (
                        <>
                          <Text style={[styles.permissionPowersHeading, { color: colors.textSecondary, marginTop: 8 }]}>
                            Não pode
                          </Text>
                          {role.limitations.map((line) => (
                            <View key={line} style={styles.permissionPowerRow}>
                              <Ionicons name="close-circle" size={16} color={colors.warning ?? '#f59e0b'} />
                              <Text style={[styles.permissionPowerText, { color: colors.textSecondary }]}>{line}</Text>
                            </View>
                          ))}
                        </>
                      ) : null}
                    </View>
                    <View style={[
                      styles.permissionRadio,
                      { borderColor: colors.border },
                      newCollaboratorRole === role.value && [styles.permissionRadioSelected, { borderColor: colors.primary }]
                    ]}>
                      {newCollaboratorRole === role.value && (
                        <View style={[styles.permissionRadioInner, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={[styles.permissionWarning, { backgroundColor: colors.secondary, borderColor: colors.border }] }>
                <Ionicons name="information-circle" size={20} color="#ff9800" />
                <Text style={[styles.permissionWarningText, { color: colors.textSecondary }] }>
                  A pessoa recebe uma notificação e pode aceitar ou recusar.
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de Alteração de Permissão */}
      <Modal
        visible={showRoleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <SafeAreaView style={styles.roleModalContainer}>
          <View style={styles.roleModalHeader}>
            <TouchableOpacity 
              onPress={() => setShowRoleModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.roleModalTitle}>Alterar Permissão</Text>
            <TouchableOpacity 
              onPress={handleConfirmRoleUpdate}
              style={styles.modalSaveButton}
              disabled={isUpdatingRole}
            >
              {isUpdatingRole ? (
                <ActivityIndicator size="small" color="#667eea" />
              ) : (
                <Ionicons name="checkmark" size={24} color="#667eea" />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.roleModalContent}>
            {/* Card do Colaborador */}
            {selectedCollaborator && (
              <View style={styles.selectedCollaboratorCard}>
                <View style={styles.selectedCollaboratorHeader}>
                  <OptimizedImage
                    imageUrl={selectedCollaborator.user.profile_url || ''}
                    style={styles.selectedCollaboratorAvatar}
                    cacheKey={`selected_${selectedCollaborator.user_id}`}
                    fallbackText={selectedCollaborator.user.name || 'Usuário'}
                    fallbackIcon="person"
                    fallbackIconSize={28}
                    fallbackIconColor="#FFFFFF"
                  />
                  <View style={styles.selectedCollaboratorInfo}>
                    <Text style={styles.selectedCollaboratorName}>
                      {selectedCollaborator.user.name}
                    </Text>
                    <Text style={styles.selectedCollaboratorEmail}>
                      {selectedCollaborator.user.email}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.currentRoleBadge}>
                  <Ionicons 
                    name={getRoleIcon(selectedCollaborator.role) as any} 
                    size={16} 
                    color={getRoleColor(selectedCollaborator.role)} 
                  />
                  <Text style={[styles.currentRoleText, { color: getRoleColor(selectedCollaborator.role) }]}>
                    Atual: {getRoleLabel(selectedCollaborator.role)}
                  </Text>
                </View>
              </View>
            )}

            {/* Título de Seleção */}
            <View style={styles.roleSelectionHeader}>
              <Ionicons name="shield-checkmark" size={24} color="#667eea" />
              <Text style={styles.roleSelectionTitle}>Nova permissão</Text>
            </View>

            {/* Opções de Role */}
            <View style={styles.roleOptionsContainer}>
              {COLLABORATOR_ROLES_FOR_PICKER.map((role) => (
                <TouchableOpacity
                  key={role.value}
                  style={[
                    styles.roleOptionCard,
                    selectedRole === role.value && styles.roleOptionCardSelected
                  ]}
                  onPress={() => setSelectedRole(role.value)}
                  activeOpacity={0.85}
                >
                  <View style={styles.roleOptionHeader}>
                    <View style={[styles.roleIconCircle, { backgroundColor: role.modalColor + '20' }]}>
                      <Ionicons name={role.modalIcon} size={24} color={role.modalColor} />
                    </View>
                    <View style={styles.roleLabelContainer}>
                      <Text style={[
                        styles.roleOptionLabel,
                        selectedRole === role.value && styles.roleOptionLabelSelected
                      ]}>
                        {role.label}
                      </Text>
                      <Text style={[
                        styles.roleOptionDescription,
                        selectedRole === role.value && styles.roleOptionDescriptionSelected
                      ]}>
                        {role.summary}
                      </Text>
                    </View>
                    <View style={[
                      styles.roleRadio,
                      selectedRole === role.value && styles.roleRadioSelected
                    ]}>
                      {selectedRole === role.value && (
                        <View style={[styles.roleRadioInner, { backgroundColor: role.modalColor }]} />
                      )}
                    </View>
                  </View>

                  <Text style={styles.rolePowersSectionTitle}>Pode</Text>
                  <View style={styles.roleFeaturesList}>
                    {role.powers.map((feature) => (
                      <View key={feature} style={styles.roleFeatureItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={[
                          styles.roleFeatureText,
                          selectedRole === role.value && { color: role.modalColor }
                        ]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {role.limitations?.length ? (
                    <>
                      <Text style={[styles.rolePowersSectionTitle, { marginTop: 10 }]}>Não pode</Text>
                      <View style={styles.roleFeaturesList}>
                        {role.limitations.map((line) => (
                          <View key={line} style={styles.roleFeatureItem}>
                            <Ionicons name="close-circle" size={16} color="#F59E0B" />
                            <Text style={[styles.roleFeatureText, { color: '#64748b' }]}>
                              {line}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>

            {/* Warning */}
            <View style={styles.roleWarning}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.roleWarningText}>
                A alteração vale na hora; a pessoa é avisada.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de Convite Pendente */}
      <Modal
        visible={showPendingInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPendingInviteModal(false)}
      >
        <View style={styles.inviteSentOverlay}>
          <View style={[styles.inviteSentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.inviteSentHeader}>
              <Ionicons name="time" size={48} color={colors.warning} />
              <Text style={[styles.inviteSentTitle, { color: colors.text }]}>Convite Já Enviado</Text>
            </View>

            {/* Informações do convite */}
            {pendingInviteData && (
              <View style={styles.pendingInviteContent}>
                <Text style={[styles.pendingInviteUserName, { color: colors.text }]}>
                  {pendingInviteData.userName}
                </Text>
                
                <View style={[styles.pendingInviteInfoRow, { borderBottomColor: colors.border }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                  <Text style={[styles.pendingInviteLabel, { color: colors.textSecondary }]}>Permissão: </Text>
                  <Text style={[styles.pendingInviteValue, { color: colors.text }]}>{pendingInviteData.role}</Text>
                </View>

                <View style={styles.pendingInviteInfoRow}>
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={[styles.pendingInviteLabel, { color: colors.textSecondary }]}>Enviado em: </Text>
                  <Text style={[styles.pendingInviteValue, { color: colors.text }]}>{pendingInviteData.createdAt}</Text>
                </View>
              </View>
            )}

            {/* Botões */}
            <View style={styles.pendingInviteActions}>
              <TouchableOpacity
                style={[styles.pendingInviteCancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setShowPendingInviteModal(false);
                  setPendingInviteData(null);
                  setSelectedUser(null);
                  setExistingInviteIdToDelete(null);
                }}
              >
                <Text style={[styles.pendingInviteCancelText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pendingInviteResendButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setShowPendingInviteModal(false);
                  setSearchResults([]);
                  setSearchTerm(pendingInviteData?.userName || '');
                  setShowAddModal(false);
                  setTimeout(() => {
                    setShowInviteModal(true);
                  }, 100);
                }}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.pendingInviteResendText}>Reenviar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Convite Enviado */}
      <Modal
        visible={showInviteSentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteSentModal(false)}
      >
        <View style={styles.inviteSentOverlay}>
          <View style={[styles.inviteSentContainer, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }] }>
            {/* Header com ícone de sucesso */}
            <View style={styles.inviteSentHeader}>
              <View style={[styles.successIconCircle, { backgroundColor: colors.primary + '20' }] }>
                <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
              </View>
              <Text style={[styles.inviteSentTitle, { color: colors.primary }]}>Convite Enviado!</Text>
              <Text style={[styles.inviteSentSubtitle, { color: colors.textSecondary }] }>
                O colaborador receberá uma notificação
              </Text>
            </View>

            {/* Card do usuário convidado */}
            {inviteSentData && (
              <View style={[styles.invitedUserCard, { backgroundColor: colors.surface, borderColor: colors.border }] }>
                <View style={styles.invitedUserHeader}>
                  <OptimizedImage
                    imageUrl={inviteSentData.userImage}
                    style={styles.invitedUserAvatar}
                    cacheKey={`invited_${inviteSentData.userEmail}`}
                    fallbackText={inviteSentData.userName || 'Usuário'}
                    fallbackIcon="person"
                    fallbackIconSize={32}
                    fallbackIconColor={colors.primary}
                  />
                  <View style={styles.invitedUserInfo}>
                    <Text style={[styles.invitedUserName, { color: colors.text }]}>
                      {inviteSentData.userName}
                    </Text>
                    <Text style={[styles.invitedUserEmail, { color: colors.textSecondary }] }>
                      {inviteSentData.userEmail}
                    </Text>
                  </View>
                </View>

                {/* Badge do cargo */}
                <View style={styles.invitedRoleSection}>
                  <Text style={[styles.invitedRoleLabel, { color: colors.textSecondary }]}>Cargo atribuído:</Text>
                  <View style={[
                    styles.invitedRoleBadge,
                    { backgroundColor: getRoleColor(inviteSentData.role) + '15' }
                  ]}>
                    <Ionicons 
                      name={getRoleIcon(inviteSentData.role) as any}
                      size={20}
                      color={getRoleColor(inviteSentData.role)}
                    />
                    <Text style={[
                      styles.invitedRoleText,
                      { color: getRoleColor(inviteSentData.role) }
                    ]}>
                      {getRoleLabel(inviteSentData.role)}
                    </Text>
                  </View>
                </View>

                {/* Status pendente */}
                <View style={[styles.pendingStatusSection, { backgroundColor: colors.secondary || colors.surface, borderColor: colors.border }] }>
                  <View style={[styles.pendingIcon, { backgroundColor: colors.surface }]}>
                    <Ionicons name="time-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.pendingTextContainer}>
                    <Text style={[styles.pendingStatusTitle, { color: colors.text }] }>
                      Aguardando aceitação
                    </Text>
                    <Text style={[styles.pendingStatusDescription, { color: colors.textSecondary }] }>
                      {inviteSentData.userName} receberá uma notificação e poderá aceitar ou recusar o convite.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Informações adicionais */}
            <View style={[styles.inviteSentInfo, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }] }>
              <View style={styles.infoItem}>
                <Ionicons name="mail-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.text }] }>
                  Notificação enviada
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.text }] }>
                  Convite válido
                </Text>
              </View>
            </View>

            {/* Botão de fechar */}
            <TouchableOpacity
              style={[styles.inviteSentButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowInviteSentModal(false)}
            >
              <Text style={styles.inviteSentButtonText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  addButton: {
    padding: 8,
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
  artistInfo: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.1,
    shadowRadius: Platform.OS === 'android' ? 0 : 3.84,
    elevation: Platform.OS === 'android' ? 0 : 5,
  },
  artistName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  collaboratorCount: {
    fontSize: 14,
    color: '#666',
  },
  collaboratorsList: {
    paddingHorizontal: 20,
  },
  collaboratorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.1,
    shadowRadius: Platform.OS === 'android' ? 0 : 3.84,
    elevation: Platform.OS === 'android' ? 0 : 5,
  },
  collaboratorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collaboratorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  collaboratorDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  collaboratorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  youBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  collaboratorEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  collaboratorActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 70,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalHeaderSpacer: {
    width: 60, // Espaço para manter o layout centralizado
  },
  disabledButtonText: {
    color: '#ccc',
  },
  disabledButton: {
    opacity: 0.5,
  },
  modalSaveButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#666',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  collaboratorSearchHint: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
    marginTop: 2,
  },
  collaboratorSearchResultsList: {
    marginTop: 12,
    gap: 12,
  },
  collaboratorInviteCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  collaboratorInviteCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  collaboratorInviteLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  collaboratorInviteCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    overflow: 'hidden',
  },
  collaboratorInviteCardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  collaboratorInviteCardName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  collaboratorInviteCardEmail: {
    fontSize: 13,
  },
  collaboratorInviteArtistTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  collaboratorInviteRolesBlock: {
    marginBottom: 8,
  },
  collaboratorInviteSectionLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  collaboratorInviteChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  collaboratorInviteChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: '100%',
  },
  collaboratorInviteChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  collaboratorInviteMuted: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  collaboratorInviteMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
  },
  collaboratorInviteMetaText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    overflow: 'hidden',
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userInfo: {
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
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  searchLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  noResultsText: {
    textAlign: 'center',
    padding: 16,
    fontSize: 14,
    color: '#999',
  },
  roleOptions: {
    gap: 12,
  },
  roleOption: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleOptionSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f8f9ff',
  },
  roleOptionContent: {
    flex: 1,
  },
  roleOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  roleOptionLabelSelected: {
    color: '#667eea',
  },
  roleOptionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  roleOptionDescriptionSelected: {
    color: '#667eea',
  },
  roleRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  roleRadioSelected: {
    borderColor: '#667eea',
  },
  roleRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
  inviteConfirmation: {
    alignItems: 'center',
    padding: 20,
  },
  inviteIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  inviteDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  inviteUserCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.1,
    shadowRadius: Platform.OS === 'android' ? 0 : 3.84,
    elevation: Platform.OS === 'android' ? 0 : 5,
    width: '100%',
  },
  inviteUserAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inviteUserAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  inviteUserInfo: {
    flex: 1,
  },
  inviteUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  inviteUserEmail: {
    fontSize: 14,
    color: '#666',
  },
  inviteDetails: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    alignSelf: 'flex-start',
    width: '100%',
  },
  inviteDetailsLabel: {
    fontWeight: '600',
    color: '#667eea',
  },
  inviteMessage: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    width: '100%',
  },
  inviteMessageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inviteMessageText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  inviteWarning: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  inviteWarningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  permissionSelection: {
    alignItems: 'center',
    padding: 20,
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    textAlign: 'left',
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  permissionUserCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.1,
    shadowRadius: Platform.OS === 'android' ? 0 : 3.84,
    elevation: Platform.OS === 'android' ? 0 : 5,
    width: '100%',
  },
  permissionUserAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  permissionUserAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  permissionUserInfo: {
    flex: 1,
  },
  permissionUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  permissionUserEmail: {
    fontSize: 14,
    color: '#666',
  },
  permissionUserLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  permissionDetails: {
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
    alignSelf: 'flex-start',
    width: '100%',
  },
  permissionDetailsLabel: {
    fontWeight: '600',
    color: '#667eea',
  },
  permissionOptions: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  permissionOption: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  permissionOptionSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f8f9ff',
  },
  permissionOptionContent: {
    flex: 1,
  },
  permissionOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  permissionOptionLabelSelected: {
    color: '#667eea',
  },
  permissionOptionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  permissionOptionDescriptionSelected: {
    color: '#667eea',
  },
  permissionPowersHeading: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  permissionPowerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
    paddingRight: 4,
  },
  permissionPowerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  permissionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 4,
    alignSelf: 'center',
  },
  permissionRadioSelected: {
    borderColor: '#667eea',
  },
  permissionRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  permissionWarning: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  roleModalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  roleModalHeader: {
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
  roleModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  roleModalContent: {
    flex: 1,
    padding: 20,
  },
  selectedCollaboratorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.1,
    shadowRadius: Platform.OS === 'android' ? 0 : 8,
    elevation: Platform.OS === 'android' ? 0 : 5,
  },
  selectedCollaboratorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedCollaboratorAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  selectedCollaboratorAvatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  selectedCollaboratorInfo: {
    flex: 1,
  },
  selectedCollaboratorName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  selectedCollaboratorEmail: {
    fontSize: 14,
    color: '#666',
  },
  currentRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  currentRoleText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  roleSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e9ecef',
  },
  roleSelectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  roleOptionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  roleOptionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.05,
    shadowRadius: Platform.OS === 'android' ? 0 : 8,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  roleOptionCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f8f9ff',
    shadowColor: '#667eea',
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.2,
  },
  roleOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  roleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleLabelContainer: {
    flex: 1,
  },
  rolePowersSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    marginTop: 4,
  },
  roleFeaturesList: {
    gap: 10,
    paddingLeft: 8,
  },
  roleFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  roleFeatureText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  roleWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  roleWarningText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  // Estilos do Modal de Convite Enviado
  inviteSentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  inviteSentContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.3,
    shadowRadius: Platform.OS === 'android' ? 0 : 20,
    elevation: Platform.OS === 'android' ? 0 : 10,
  },
  inviteSentHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconCircle: {
    marginBottom: 16,
  },
  inviteSentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
    textAlign: 'center',
    marginBottom: 8,
  },
  inviteSentSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  invitedUserCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  invitedUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  invitedUserAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  invitedUserInfo: {
    flex: 1,
  },
  invitedUserName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  invitedUserEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  invitedRoleSection: {
    marginBottom: 16,
  },
  invitedRoleLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  invitedRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  invitedRoleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pendingStatusSection: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 12,
  },
  pendingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingTextContainer: {
    flex: 1,
  },
  pendingStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  pendingStatusDescription: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  inviteSentInfo: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    flex: 1,
  },
  invitedUserAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  pendingInviteActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  pendingInviteCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingInviteCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  pendingInviteResendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  pendingInviteResendText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingInviteContent: {
    marginVertical: 20,
  },
  pendingInviteUserName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  pendingInviteInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  pendingInviteLabel: {
    fontSize: 14,
  },
  pendingInviteValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  inviteSentButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  inviteSentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  planLimitBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  planLimitBannerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  planLimitBannerBtn: {
    alignSelf: 'flex-start',
  },
  planLimitBannerBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
