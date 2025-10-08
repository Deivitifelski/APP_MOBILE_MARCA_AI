import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { clearActiveArtist } from '../services/artistContext';
import { cacheService } from '../services/cacheService';
import { deleteArtist } from '../services/supabase/artistService';
import { getCurrentUser } from '../services/supabase/authService';
import { getCollaborators, removeCollaborator } from '../services/supabase/collaboratorService';
import { clearPermissionsCache } from '../services/supabase/permissionsService';
import { useActiveArtist } from '../services/useActiveArtist';

interface Collaborator {
  user_id: string;
  artist_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string;
    email: string;
    profile_url?: string;
  };
}

export default function SairArtistaScreen() {
  const { activeArtist, loadActiveArtist } = useActiveArtist();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOwnerOptionsModal, setShowOwnerOptionsModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeArtist]);

  const loadData = async () => {
    if (!activeArtist) return;
    
    try {
      setIsLoading(true);
      
      // Buscar todos os colaboradores do artista
      const { collaborators, error } = await getCollaborators(activeArtist.id);
      
      if (error) {
        Alert.alert('Erro', 'Erro ao carregar colaboradores');
        return;
      }

      setCollaborators((collaborators || []) as Collaborator[]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveArtist = async () => {
    if (!activeArtist) return;

    // Verificar se o usuário atual é owner
    const { user } = await getCurrentUser();
    if (!user) return;

    const currentUserCollaborator = collaborators.find(c => c.user_id === user.id);
    const isOwner = currentUserCollaborator?.role === 'owner';

    // Contar quantos owners existem
    const ownerCount = collaborators.filter(c => c.role === 'owner').length;
    const eligibleCollaborators = collaborators.filter(c => c.role !== 'owner');

    if (isOwner && ownerCount === 1 && eligibleCollaborators.length > 0) {
      // Único owner com outros colaboradores - mostrar modal de opções
      setShowOwnerOptionsModal(true);
    } else if (isOwner && ownerCount === 1 && eligibleCollaborators.length === 0) {
      // Único owner sem outros colaboradores - modal de deletar
      setShowDeleteConfirmModal(true);
    } else {
      // Não é owner ou há outros owners - modal de sair normalmente
      setShowLeaveConfirmModal(true);
    }
  };

  const handleDeleteArtist = async () => {
    if (!activeArtist) return;

    try {
      setIsProcessing(true);

      const { success, error } = await deleteArtist(activeArtist.id);

      if (!success) {
        Alert.alert('Erro', error || 'Erro ao deletar artista');
        return;
      }

      // Limpar cache de dados do artista
      const { user } = await getCurrentUser();
      if (user) {
        await cacheService.invalidateArtistData(user.id);
        await cacheService.invalidateUserData(user.id);
      }

      Alert.alert(
        'Artista Deletado',
        'O artista foi deletado com sucesso.',
        [
          {
            text: 'OK',
            onPress: () => {
              clearActiveArtist();
              router.replace('/(tabs)/agenda');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao deletar artista:', error);
      Alert.alert('Erro', 'Erro ao deletar artista');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLeaveNormally = async () => {
    if (!activeArtist) return;

    const { user } = await getCurrentUser();
    if (!user) {
      Alert.alert('Erro', 'Usuário não encontrado');
      return;
    }

    try {
      setIsProcessing(true);

      // ✅ Remover usuário da tabela artist_members
      const { success, error } = await removeCollaborator(user.id, activeArtist.id);
      
      if (!success) {
        Alert.alert('Erro', error || 'Erro ao sair do artista');
        return;
      }

      // Limpar cache de permissões e dados do artista
      clearPermissionsCache(user.id, activeArtist.id);
      await cacheService.invalidateArtistData(user.id);
      await cacheService.invalidateUserData(user.id);

      Alert.alert(
        'Saiu do Artista',
        `Você saiu do artista "${activeArtist.name}" com sucesso.`,
        [
          {
            text: 'OK',
            onPress: () => {
              clearActiveArtist();
              router.replace('/(tabs)/agenda');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erro', 'Erro ao sair do artista');
    } finally {
      setIsProcessing(false);
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
          <Text style={styles.headerTitle}>Sair do Artista</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Carregando informações...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ownerCount = collaborators.filter(c => c.role === 'owner').length;
  const eligibleCollaborators = collaborators.filter(c => c.role !== 'owner');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sair do Artista</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.artistInfo}>
          <Ionicons name="musical-notes" size={48} color="#6366F1" />
          <Text style={styles.artistName}>{activeArtist?.name}</Text>
          <Text style={styles.artistDescription}>
            Você está prestes a sair deste artista
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Informações do Artista</Text>
            <Text style={styles.infoText}>
              • Total de colaboradores: {collaborators.length}
            </Text>
            <Text style={styles.infoText}>
              • Proprietários: {ownerCount}
            </Text>
            <Text style={styles.infoText}>
              • Outros colaboradores: {eligibleCollaborators.length}
            </Text>
          </View>
        </View>

        <View style={styles.warningCard}>
          <Ionicons name="warning" size={24} color="#F59E0B" />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Atenção</Text>
            {ownerCount === 1 && eligibleCollaborators.length > 0 ? (
              <Text style={styles.warningText}>
                Você é o único proprietário. Para sair, você deve transferir a propriedade para outro colaborador.
              </Text>
            ) : ownerCount === 1 && eligibleCollaborators.length === 0 ? (
              <Text style={styles.warningText}>
                Você é o único colaborador. Ao sair, o artista será deletado permanentemente.
              </Text>
            ) : (
              <Text style={styles.warningText}>
                Ao sair, você perderá acesso a todos os dados e funcionalidades deste artista.
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.actionButton,
            ownerCount === 1 && eligibleCollaborators.length > 0 
              ? styles.transferButton 
              : ownerCount === 1 && eligibleCollaborators.length === 0
              ? styles.deleteButton
              : styles.leaveButton
          ]}
          onPress={handleLeaveArtist}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons 
                name={
                  ownerCount === 1 && eligibleCollaborators.length > 0 
                    ? "swap-horizontal" 
                    : ownerCount === 1 && eligibleCollaborators.length === 0
                    ? "trash"
                    : "log-out"
                } 
                size={20} 
                color="#FFFFFF" 
              />
              <Text style={styles.actionButtonText}>
                {ownerCount === 1 && eligibleCollaborators.length > 0 
                  ? "Transferir Propriedade" 
                  : ownerCount === 1 && eligibleCollaborators.length === 0
                  ? "Deletar Artista"
                  : "Sair do Artista"
                }
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Modal: Opções para Owner Único com Colaboradores */}
      <Modal
        visible={showOwnerOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOwnerOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="shield-checkmark" size={32} color="#F59E0B" />
              </View>
              <Text style={styles.modalTitle}>Você é o Único Proprietário</Text>
              <Text style={styles.modalSubtitle}>
                Escolha uma das opções abaixo para continuar
              </Text>
            </View>

            <View style={styles.optionsContainer}>
              {/* Opção 1: Transferir Propriedade */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={() => {
                  setShowOwnerOptionsModal(false);
                  router.push('/transferir-propriedade');
                }}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="swap-horizontal" size={24} color="#3B82F6" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>Transferir Propriedade</Text>
                  <Text style={styles.optionDescription}>
                    Escolha outro colaborador para ser o novo proprietário e depois você sai do artista.
                  </Text>
                  <View style={styles.optionSteps}>
                    <View style={styles.stepItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                      <Text style={styles.stepText}>Você mantém seus dados seguros</Text>
                    </View>
                    <View style={styles.stepItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                      <Text style={styles.stepText}>Outro colaborador assume o controle</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>

              {/* Opção 2: Deletar Artista */}
              <TouchableOpacity
                style={[styles.optionCard, styles.dangerOption]}
                onPress={() => {
                  setShowOwnerOptionsModal(false);
                  setShowDeleteConfirmModal(true);
                }}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="trash" size={24} color="#EF4444" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { color: '#EF4444' }]}>Deletar Artista</Text>
                  <Text style={styles.optionDescription}>
                    Deleta permanentemente o artista e TODOS os dados associados.
                  </Text>
                  <View style={styles.optionSteps}>
                    <View style={styles.stepItem}>
                      <Ionicons name="warning" size={16} color="#EF4444" />
                      <Text style={[styles.stepText, { color: '#EF4444' }]}>Remove todos os {collaborators.length} colaboradores</Text>
                    </View>
                    <View style={styles.stepItem}>
                      <Ionicons name="warning" size={16} color="#EF4444" />
                      <Text style={[styles.stepText, { color: '#EF4444' }]}>Deleta eventos e dados financeiros</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowOwnerOptionsModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Confirmar Deleção Total */}
      <Modal
        visible={showDeleteConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="warning" size={40} color="#EF4444" />
              </View>
              <Text style={[styles.modalTitle, { color: '#EF4444' }]}>Deletar Artista</Text>
              <Text style={styles.modalSubtitle}>
                Essa ação é permanente e não pode ser desfeita!
              </Text>
            </View>

            <View style={styles.warningBox}>
              <Text style={styles.warningBoxTitle}>⚠️ O que será deletado:</Text>
              <View style={styles.warningList}>
                <View style={styles.warningItem}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={styles.warningItemText}>
                    Artista "{activeArtist?.name}"
                  </Text>
                </View>
                <View style={styles.warningItem}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={styles.warningItemText}>
                    Todos os {collaborators.length} colaboradores serão removidos
                  </Text>
                </View>
                <View style={styles.warningItem}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={styles.warningItemText}>
                    Todos os eventos e agenda
                  </Text>
                </View>
                <View style={styles.warningItem}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                  <Text style={styles.warningItemText}>
                    Todos os dados financeiros
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButtonAlt}
                onPress={() => setShowDeleteConfirmModal(false)}
              >
                <Text style={styles.modalCancelTextAlt}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={() => {
                  setShowDeleteConfirmModal(false);
                  handleDeleteArtist();
                }}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash" size={20} color="#fff" />
                    <Text style={styles.modalDeleteText}>Deletar Artista</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Confirmar Saída Normal */}
      <Modal
        visible={showLeaveConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLeaveConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="log-out" size={32} color="#6366F1" />
              </View>
              <Text style={styles.modalTitle}>Sair do Artista</Text>
              <Text style={styles.modalSubtitle}>
                Tem certeza que deseja sair de "{activeArtist?.name}"?
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoBoxTitle}>📋 O que acontecerá:</Text>
              <View style={styles.infoList}>
                <View style={styles.infoItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#6366F1" />
                  <Text style={styles.infoItemText}>
                    Você será removido da lista de colaboradores
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#6366F1" />
                  <Text style={styles.infoItemText}>
                    Perderá acesso a eventos e dados do artista
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#6366F1" />
                  <Text style={styles.infoItemText}>
                    O artista continuará existindo para os outros colaboradores
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButtonAlt}
                onPress={() => setShowLeaveConfirmModal(false)}
              >
                <Text style={styles.modalCancelTextAlt}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalLeaveButton}
                onPress={() => {
                  setShowLeaveConfirmModal(false);
                  handleLeaveNormally();
                }}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="log-out" size={20} color="#fff" />
                    <Text style={styles.modalLeaveText}>Sair do Artista</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  artistInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  artistName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    textAlign: 'center',
  },
  artistDescription: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 4,
    lineHeight: 20,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    alignItems: 'flex-start',
  },
  warningContent: {
    flex: 1,
    marginLeft: 12,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  transferButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  leaveButton: {
    backgroundColor: '#6B7280',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  dangerOption: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  optionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  optionSteps: {
    gap: 6,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepText: {
    fontSize: 13,
    color: '#6B7280',
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  warningBoxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991B1B',
    marginBottom: 12,
  },
  warningList: {
    gap: 10,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  warningItemText: {
    fontSize: 14,
    color: '#991B1B',
    flex: 1,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 12,
  },
  infoList: {
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoItemText: {
    fontSize: 14,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButtonAlt: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelTextAlt: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  modalDeleteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalLeaveButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  modalLeaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
