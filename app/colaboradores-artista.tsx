import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import OptimizedImage from '../components/OptimizedImage';
import UpgradeModal from '../components/UpgradeModal';
import { checkPendingInvite, createArtistInvite } from '../services/supabase/artistInviteService';
import { getCurrentUser } from '../services/supabase/authService';
import { addCollaborator, Collaborator, getCollaborators, removeCollaborator, searchUsers, updateCollaboratorRole } from '../services/supabase/collaboratorService';
import { canExportData } from '../services/supabase/userService';
import { useActiveArtist } from '../services/useActiveArtist';

export default function ColaboradoresArtistaScreen() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canAddCollaborators, setCanAddCollaborators] = useState(false);
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
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
      
      // Verificar se é owner
      const isUserOwner = activeArtist.role === 'owner';
      setIsOwner(isUserOwner);

      // Buscar colaboradores
      const { collaborators, userRole, canManage, canAddCollaborators, error: collaboratorsError } = await getCollaborators(activeArtist.id);
      
      if (collaboratorsError) {
        Alert.alert('Erro', 'Erro ao carregar colaboradores');
        return;
      }

      setCollaborators(collaborators || []);
      setUserRole(userRole);
      setCanManage(canManage);
      setCanAddCollaborators(canAddCollaborators);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchUsers = async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const { users, error } = await searchUsers(term);
      
      if (error) {
        return;
      }

      // Filtrar usuários que já são colaboradores
      const existingCollaboratorIds = collaborators.map(c => c.user_id);
      const filteredUsers = users?.filter(user => !existingCollaboratorIds.includes(user.id)) || [];
      
      setSearchResults(filteredUsers);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchTerm(user.name);
    setShowAddModal(false);
    setTimeout(() => {
      setShowInviteModal(true);
    }, 100);
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

    // Verificar se o usuário pode convidar colaboradores (plano premium)
    const { canExport, error: canExportError } = await canExportData(currentUserId);
    
    if (canExportError) {
      Alert.alert('Erro', 'Erro ao verificar permissões: ' + canExportError);
      return;
    }

    if (!canExport) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      setIsInviting(true);

      // Obter o usuário atual para ser o remetente
      const { user: currentUser, error: userError } = await getCurrentUser();
      
      if (userError || !currentUser) {
        Alert.alert('Erro', 'Erro ao obter dados do usuário atual');
        return;
      }

      // Verificar se já existe convite pendente
      const { success: checkSuccess, invite: existingInvite } = await checkPendingInvite(
        activeArtist.id, 
        selectedUser.id
      );

      if (existingInvite) {
        Alert.alert(
          'Convite Já Enviado', 
          `Já existe um convite pendente para ${selectedUser.name}. Aguarde a resposta.`,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Criar convite na tabela artist_invites
      const { success, error, invite } = await createArtistInvite({
        artistId: activeArtist.id,
        toUserId: selectedUser.id,
        fromUserId: currentUser.id
      });

      if (success) {
        // Salvar dados do convite para mostrar no modal
        setInviteSentData({
          userName: selectedUser.name,
          userEmail: selectedUser.email,
          userImage: selectedUser.profile_url || '',
          role: newCollaboratorRole
        });
        
        setShowInviteModal(false);
        setShowAddModal(false);
        setShowInviteSentModal(true);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedUser(null);
        setNewCollaboratorRole('viewer');
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
        role: newCollaboratorRole
      });

      if (success) {
        Alert.alert('Sucesso', 'Colaborador adicionado com sucesso!');
        setShowAddModal(false);
        setSearchTerm('');
        setSearchResults([]);
        setSelectedUser(null);
        setNewCollaboratorRole('viewer');
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
        return '#FFD700'; // Dourado
      case 'admin':
        return '#FF6B35'; // Laranja
      case 'editor':
        return '#4ECDC4'; // Verde água
      case 'viewer':
        return '#95A5A6'; // Cinza
      default:
        return '#667eea';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Proprietário';
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

  const renderCollaborator = ({ item }: { item: Collaborator }) => (
    <View style={styles.collaboratorCard}>
      <View style={styles.collaboratorInfo}>
        <View style={styles.collaboratorAvatar}>
          <Text style={styles.avatarText}>
            {item.user.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.collaboratorDetails}>
          <Text style={styles.collaboratorName}>{item.user.name}</Text>
          <Text style={styles.collaboratorEmail}>{item.user.email}</Text>
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
      
      {canManage && item.role !== 'owner' && (
        <View style={styles.collaboratorActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateRole(item.user_id, item.role, item.user.name)}
          >
            <Ionicons name="swap-horizontal" size={20} color="#667eea" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleRemoveCollaborator(item.user_id, item.user.name)}
          >
            <Ionicons name="trash" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Colaboradores</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Carregando colaboradores...</Text>
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
        <Text style={styles.title}>Colaboradores</Text>
        <View style={styles.headerActions}>
          {canManage && (
            <>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push('/convites-enviados')}
              >
                <Ionicons name="mail" size={24} color="#667eea" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push('/selecionar-artista')}
              >
                <Ionicons name="swap-horizontal" size={24} color="#667eea" />
              </TouchableOpacity>
            </>
          )}
          {canAddCollaborators && (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={async () => {
                // Verificar se o usuário pode adicionar colaboradores (plano premium)
                if (!currentUserId) {
                  Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
                  return;
                }

                const { canExport, error: canExportError } = await canExportData(currentUserId);
                
                if (canExportError) {
                  Alert.alert('Erro', 'Erro ao verificar permissões: ' + canExportError);
                  return;
                }

                if (!canExport) {
                  setShowUpgradeModal(true);
                  return;
                }

                setShowAddModal(true);
              }}
            >
              <Ionicons name="add" size={24} color="#667eea" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* Informações do artista */}
        {activeArtist && (
          <View style={styles.artistInfo}>
            <Text style={styles.artistName}>{activeArtist.name}</Text>
            <Text style={styles.collaboratorCount}>
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
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowAddModal(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Buscar Usuário</Text>
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

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Buscar usuário</Text>
              <TextInput
                style={styles.input}
                value={searchTerm}
                onChangeText={(text) => {
                  setSearchTerm(text);
                  handleSearchUsers(text);
                }}
                placeholder="Digite o nome do usuário"
                autoCapitalize="none"
              />
              
              {/* Resultados da busca */}
              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.searchResultItem}
                      onPress={() => handleSelectUser(user)}
                    >
                      <OptimizedImage
                        imageUrl={user.profile_url || ''}
                        style={styles.userAvatarImage}
                        cacheKey={`user_search_${user.id}`}
                        fallbackIcon="person"
                        fallbackIconSize={20}
                        fallbackIconColor="#667eea"
                      />
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <Text style={styles.userEmail}>
                          {user.city && user.state 
                            ? `${user.city}, ${user.state}`
                            : user.city || user.state || 'Localização não informada'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {isSearching && (
                <View style={styles.searchLoading}>
                  <ActivityIndicator size="small" color="#667eea" />
                  <Text style={styles.searchLoadingText}>Buscando usuários...</Text>
                </View>
              )}
              
              {searchTerm.length >= 2 && searchResults.length === 0 && !isSearching && (
                <Text style={styles.noResultsText}>Nenhum usuário encontrado</Text>
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
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowInviteModal(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Enviar Convite</Text>
            <TouchableOpacity 
              onPress={handleConfirmInvite}
              style={styles.modalSaveButton}
              disabled={isInviting}
            >
              {isInviting ? (
                <ActivityIndicator size="small" color="#667eea" />
              ) : (
                <Text style={styles.modalSaveText}>Enviar</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.permissionSelection}>
              <Text style={styles.permissionTitle}>Enviar Convite de Colaboração</Text>
              
              <Text style={styles.permissionDescription}>
                Selecione a permissão para enviar o convite:
              </Text>
              
              {selectedUser && (
                <View style={styles.permissionUserCard}>
                  <View style={styles.permissionUserAvatar}>
                    <Text style={styles.permissionUserAvatarText}>
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.permissionUserInfo}>
                    <Text style={styles.permissionUserName}>{selectedUser.name}</Text>
                    <Text style={styles.permissionUserEmail}>{selectedUser.email}</Text>
                  </View>
                </View>
              )}
              
              <Text style={styles.permissionDetails}>
                <Text style={styles.permissionDetailsLabel}>Artista:</Text> {activeArtist?.name}
              </Text>
              
              <View style={styles.permissionOptions}>
                {[
                  { label: 'Proprietário', value: 'owner', description: 'Acesso total e controle completo' },
                  { label: 'Administrador', value: 'admin', description: 'Pode gerenciar colaboradores e editar tudo' },
                  { label: 'Editor', value: 'editor', description: 'Pode editar eventos e despesas' },
                  { label: 'Visualizador', value: 'viewer', description: 'Pode apenas visualizar' }
                ].map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.permissionOption,
                      newCollaboratorRole === role.value && styles.permissionOptionSelected
                    ]}
                    onPress={() => setNewCollaboratorRole(role.value as any)}
                  >
                    <View style={styles.permissionOptionContent}>
                      <Text style={[
                        styles.permissionOptionLabel,
                        newCollaboratorRole === role.value && styles.permissionOptionLabelSelected
                      ]}>
                        {role.label}
                      </Text>
                      <Text style={[
                        styles.permissionOptionDescription,
                        newCollaboratorRole === role.value && styles.permissionOptionDescriptionSelected
                      ]}>
                        {role.description}
                      </Text>
                    </View>
                    <View style={[
                      styles.permissionRadio,
                      newCollaboratorRole === role.value && styles.permissionRadioSelected
                    ]}>
                      {newCollaboratorRole === role.value && (
                        <View style={styles.permissionRadioInner} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.permissionWarning}>
                <Ionicons name="information-circle" size={20} color="#ff9800" />
                <Text style={styles.permissionWarningText}>
                  O usuário receberá uma notificação e poderá aceitar ou recusar o convite.
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de Upgrade */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Colaboradores Premium"
        message="
 Gerenciamento total dos colaboradores:
• Convites ilimitados e personalizados
• Controle de permissões
• Gestão em tempo real"
        feature="collaborators"
      />

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
                  <View style={styles.selectedCollaboratorAvatar}>
                    <Text style={styles.selectedCollaboratorAvatarText}>
                      {selectedCollaborator.user.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
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
              <Text style={styles.roleSelectionTitle}>Selecione a nova permissão</Text>
            </View>

            {/* Opções de Role */}
            <View style={styles.roleOptionsContainer}>
              {[
                { 
                  label: 'Proprietário', 
                  value: 'owner', 
                  icon: 'star',
                  color: '#FFD700',
                  description: 'Controle total do artista',
                  features: ['Gerenciar tudo', 'Transferir propriedade', 'Deletar artista']
                },
                { 
                  label: 'Administrador', 
                  value: 'admin', 
                  icon: 'shield-checkmark',
                  color: '#FF6B35',
                  description: 'Gerenciamento avançado',
                  features: ['Gerenciar membros', 'Editar eventos', 'Ver finanças']
                },
                { 
                  label: 'Editor', 
                  value: 'editor', 
                  icon: 'create',
                  color: '#4ECDC4',
                  description: 'Edição de conteúdo',
                  features: ['Criar eventos', 'Editar eventos', 'Ver finanças']
                },
                { 
                  label: 'Visualizador', 
                  value: 'viewer', 
                  icon: 'eye',
                  color: '#95A5A6',
                  description: 'Apenas visualização',
                  features: ['Ver eventos', 'Ver colaboradores', 'Sem edição']
                }
              ].map((role) => (
                <TouchableOpacity
                  key={role.value}
                  style={[
                    styles.roleOptionCard,
                    selectedRole === role.value && styles.roleOptionCardSelected
                  ]}
                  onPress={() => setSelectedRole(role.value as any)}
                >
                  <View style={styles.roleOptionHeader}>
                    <View style={[styles.roleIconCircle, { backgroundColor: role.color + '20' }]}>
                      <Ionicons name={role.icon as any} size={24} color={role.color} />
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
                        {role.description}
                      </Text>
                    </View>
                    <View style={[
                      styles.roleRadio,
                      selectedRole === role.value && styles.roleRadioSelected
                    ]}>
                      {selectedRole === role.value && (
                        <View style={[styles.roleRadioInner, { backgroundColor: role.color }]} />
                      )}
                    </View>
                  </View>
                  
                  {/* Features List */}
                  <View style={styles.roleFeaturesList}>
                    {role.features.map((feature, index) => (
                      <View key={index} style={styles.roleFeatureItem}>
                        <Ionicons name="checkmark-circle" size={16} color={role.color} />
                        <Text style={[
                          styles.roleFeatureText,
                          selectedRole === role.value && { color: role.color }
                        ]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Warning */}
            <View style={styles.roleWarning}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.roleWarningText}>
                A alteração de permissão será aplicada imediatamente e o usuário será notificado.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de Convite Enviado */}
      <Modal
        visible={showInviteSentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteSentModal(false)}
      >
        <View style={styles.inviteSentOverlay}>
          <View style={styles.inviteSentContainer}>
            {/* Header com ícone de sucesso */}
            <View style={styles.inviteSentHeader}>
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              </View>
              <Text style={styles.inviteSentTitle}>Convite Enviado!</Text>
              <Text style={styles.inviteSentSubtitle}>
                O colaborador receberá uma notificação
              </Text>
            </View>

            {/* Card do usuário convidado */}
            {inviteSentData && (
              <View style={styles.invitedUserCard}>
                <View style={styles.invitedUserHeader}>
                  <OptimizedImage
                    imageUrl={inviteSentData.userImage}
                    style={styles.invitedUserAvatar}
                    cacheKey={`invited_${inviteSentData.userEmail}`}
                    fallbackIcon="person"
                    fallbackIconSize={32}
                    fallbackIconColor="#667eea"
                  />
                  <View style={styles.invitedUserInfo}>
                    <Text style={styles.invitedUserName}>
                      {inviteSentData.userName}
                    </Text>
                    <Text style={styles.invitedUserEmail}>
                      {inviteSentData.userEmail}
                    </Text>
                  </View>
                </View>

                {/* Badge do cargo */}
                <View style={styles.invitedRoleSection}>
                  <Text style={styles.invitedRoleLabel}>Cargo atribuído:</Text>
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
                <View style={styles.pendingStatusSection}>
                  <View style={styles.pendingIcon}>
                    <Ionicons name="time-outline" size={20} color="#F59E0B" />
                  </View>
                  <View style={styles.pendingTextContainer}>
                    <Text style={styles.pendingStatusTitle}>
                      Aguardando aceitação
                    </Text>
                    <Text style={styles.pendingStatusDescription}>
                      {inviteSentData.userName} receberá uma notificação e poderá aceitar ou recusar o convite.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Informações adicionais */}
            <View style={styles.inviteSentInfo}>
              <View style={styles.infoItem}>
                <Ionicons name="mail-outline" size={20} color="#667eea" />
                <Text style={styles.infoText}>
                  Notificação enviada por e-mail
                </Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#667eea" />
                <Text style={styles.infoText}>
                  Convite válido por 7 dias
                </Text>
              </View>
            </View>

            {/* Botão de fechar */}
            <TouchableOpacity
              style={styles.inviteSentButton}
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
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  collaboratorDetails: {
    flex: 1,
  },
  collaboratorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
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
  searchResults: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
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
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
    alignItems: 'center',
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
  },
  permissionOptionDescriptionSelected: {
    color: '#667eea',
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
  },
  permissionRadioSelected: {
    borderColor: '#667eea',
  },
  permissionRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
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
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  roleOptionCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f8f9ff',
    shadowColor: '#667eea',
    shadowOpacity: 0.2,
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
  roleOptionLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  roleOptionLabelSelected: {
    color: '#667eea',
  },
  roleOptionDescription: {
    fontSize: 14,
    color: '#666',
  },
  roleOptionDescriptionSelected: {
    color: '#667eea',
  },
  roleFeaturesList: {
    gap: 10,
    paddingLeft: 8,
  },
  roleFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
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
});
