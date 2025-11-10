import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearActiveArtist } from '../services/artistContext';
import { getCurrentUser } from '../services/supabase/authService';
import { Collaborator, getCollaborators, leaveArtist, updateCollaboratorRole } from '../services/supabase/collaboratorService';
import { useActiveArtist } from '../services/useActiveArtist';

export default function TransferirPropriedadeScreen() {
  const { activeArtist } = useActiveArtist();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArtist]);

  const loadData = async () => {
    if (!activeArtist) return;
    
    try {
      setIsLoading(true);
      
      // Buscar usuário atual
      const { user } = await getCurrentUser();
      if (!user) {
        Alert.alert('Erro', 'Usuário não encontrado');
        return;
      }

      // Buscar colaboradores
      const { collaborators, error } = await getCollaborators(activeArtist.id);
      
      if (error) {
        Alert.alert('Erro', 'Erro ao carregar colaboradores');
        return;
      }

      // Filtrar colaboradores: excluir admins e o próprio usuário atual
      const eligibleCollaborators = collaborators?.filter(
        (collaborator) => 
          collaborator.role !== 'admin' && // Não incluir quem já é admin
          collaborator.user_id !== user.id  // Não incluir o próprio usuário
      ) || [];

      setCollaborators(eligibleCollaborators);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTransferOwnership = async (newOwner: Collaborator) => {
    if (!activeArtist) return;

    Alert.alert(
      'Transferir Propriedade',
      `Tem certeza que deseja transferir a propriedade do artista "${activeArtist.name}" para ${newOwner.user.name}?\n\nEsta ação não pode ser desfeita.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Transferir',
          style: 'destructive',
          onPress: async () => {
            await performTransfer(newOwner);
          },
        },
      ]
    );
  };

  const performTransfer = async (newOwner: Collaborator) => {
    try {
      setIsTransferring(true);

      // Atualizar o novo owner
      const { success: updateSuccess, error: updateError } = await updateCollaboratorRole(
        newOwner.user_id,
        activeArtist!.id,
        'owner'
      );

      if (!updateSuccess || updateError) {
        Alert.alert('Erro', 'Erro ao transferir propriedade');
        return;
      }

      // Remover o usuário atual do artista usando leaveArtist
      const { success: removeSuccess, error: removeError } = await leaveArtist(
        activeArtist!.id
      );

      if (!removeSuccess || removeError) {
        Alert.alert('Erro', 'Erro ao remover usuário do artista');
        return;
      }

      Alert.alert(
        'Sucesso',
        'Propriedade transferida com sucesso! Você foi removido do artista.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Limpar artista ativo e voltar para seleção
              clearActiveArtist();
              router.replace('/(tabs)/configuracoes');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao transferir propriedade:', error);
      Alert.alert('Erro', 'Erro ao transferir propriedade');
    } finally {
      setIsTransferring(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
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
      case 'admin':
        return '#10B981';
      case 'editor':
        return '#3B82F6';
      case 'viewer':
        return '#6B7280';
      default:
        return '#9CA3AF';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Visualizador';
        case 'owner':
          return 'Gerente';
      default:
        return 'Colaborador';
    }
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
          <Text style={styles.headerTitle}>Transferir Propriedade</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Carregando colaboradores...</Text>
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
        <Text style={styles.headerTitle}>Transferir Propriedade</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <Text style={styles.infoText}>
            Selecione um colaborador para se tornar o novo gerente do artista &quot;{activeArtist?.name}&quot;.
          </Text>
        </View>

        {collaborators.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Nenhum colaborador disponível</Text>
            <Text style={styles.emptySubtitle}>
              Não há colaboradores elegíveis para receber a propriedade.
            </Text>
          </View>
        ) : (
          <View style={styles.collaboratorsList}>
            {collaborators.map((collaborator) => (
              <TouchableOpacity
                key={collaborator.user_id}
                style={styles.collaboratorCard}
                onPress={() => handleTransferOwnership(collaborator)}
                disabled={isTransferring}
              >
                <View style={styles.collaboratorInfo}>
                  <View style={styles.avatarContainer}>
                    {collaborator.user.profile_url ? (
                      <Image
                        source={{ uri: collaborator.user.profile_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                          {collaborator.user.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.collaboratorDetails}>
                    <Text style={styles.collaboratorName}>
                      {collaborator.user.name}
                    </Text>
                    <Text style={styles.collaboratorEmail}>
                      {collaborator.user.email}
                    </Text>
                    <View style={styles.roleContainer}>
                      <Ionicons
                        name={getRoleIcon(collaborator.role)}
                        size={16}
                        color={getRoleColor(collaborator.role)}
                      />
                      <Text style={[styles.roleText, { color: getRoleColor(collaborator.role) }]}>
                        {getRoleLabel(collaborator.role)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.transferButton}>
                  <Ionicons name="arrow-forward" size={20} color="#6366F1" />
                </View>
              </TouchableOpacity>
            ))}
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
  headerTitle: {
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
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
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
  collaboratorsList: {
    gap: 12,
  },
  collaboratorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  collaboratorInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  collaboratorDetails: {
    flex: 1,
  },
  collaboratorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  collaboratorEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  transferButton: {
    padding: 8,
  },
});
