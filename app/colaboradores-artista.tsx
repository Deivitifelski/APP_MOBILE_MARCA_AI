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

  // Debug: Monitorar mudanças no showInviteModal
  useEffect(() => {
    console.log('showInviteModal mudou para:', showInviteModal);
  }, [showInviteModal]);

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
        console.error('Erro ao buscar usuários:', error);
        return;
      }

      // Filtrar usuários que já são colaboradores
      const existingCollaboratorIds = collaborators.map(c => c.user_id);
      const filteredUsers = users?.filter(user => !existingCollaboratorIds.includes(user.id)) || [];
      
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (user: any) => {
    console.log('handleSelectUser chamado com:', user);
    setSelectedUser(user);
    setSearchResults([]);
    setSearchTerm(user.name);
    // Fechar modal de busca primeiro
    setShowAddModal(false);
    // Aguardar um pouco e depois abrir modal de convite
    setTimeout(() => {
      console.log('Abrindo modal de convite');
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
        Alert.alert(
          'Convite Enviado!', 
          `O convite foi enviado para ${selectedUser.name}. Eles receberão uma notificação e poderão aceitar ou recusar o convite.`,
          [{ text: 'OK', style: 'default' }]
        );
        setShowInviteModal(false);
        setShowAddModal(false);
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

    const roles = [
      { label: 'Proprietário', value: 'owner' },
      { label: 'Admin', value: 'admin' },
      { label: 'Editor', value: 'editor' },
      { label: 'Visualizador', value: 'viewer' }
    ];

    const currentRoleLabel = roles.find(r => r.value === currentRole)?.label || currentRole;

    Alert.alert(
      'Alterar Permissão',
      `Alterar permissão de ${userName} (atual: ${currentRoleLabel})`,
      roles.map(role => ({
        text: role.label,
        onPress: async () => {
          try {
            const { success, error } = await updateCollaboratorRole(userId, activeArtist.id, role.value as any);
            
            if (success) {
              Alert.alert('Sucesso', 'Permissão alterada com sucesso!');
              loadData(); // Recarregar dados
            } else {
              Alert.alert('Erro', error || 'Erro ao alterar permissão');
            }
          } catch (error) {
            Alert.alert('Erro', 'Erro ao alterar permissão');
          }
        }
      })).concat([{ text: 'Cancelar', onPress: async () => {} }])
    );
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
        <TouchableOpacity onPress={() => {
          console.log('Botão voltar pressionado');
          router.back();
        }} style={styles.backButton}>
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
                console.log('Botão adicionar pressionado');
                
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
                placeholder="Digite nome ou email do usuário"
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
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {user.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <Text style={styles.userEmail}>{user.email}</Text>
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
        onRequestClose={() => {
          console.log('Modal de convite fechado');
          setShowInviteModal(false);
        }}
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
});
