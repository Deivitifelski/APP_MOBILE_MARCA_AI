import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { clearActiveArtist } from '../services/artistContext';
import { cacheService } from '../services/cacheService';
import { deleteArtist } from '../services/supabase/artistService';
import { getCurrentUser } from '../services/supabase/authService';
import { getCollaborators, leaveArtist } from '../services/supabase/collaboratorService';
import { LeaveArtistValidation, validateLeaveArtist } from '../services/supabase/leaveArtistValidation';
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
  const { colors } = useTheme();
  const { activeArtist, loadActiveArtist } = useActiveArtist();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [validation, setValidation] = useState<LeaveArtistValidation | null>(null);
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
      
      // Buscar usuário atual
      const { user } = await getCurrentUser();
      if (!user) {
        Alert.alert('Erro', 'Usuário não encontrado');
        return;
      }

      // Buscar todos os colaboradores do artista
      const { collaborators, error } = await getCollaborators(activeArtist.id);
      
      if (error) {
        Alert.alert('Erro', 'Erro ao carregar colaboradores');
        return;
      }

      setCollaborators((collaborators || []) as Collaborator[]);

      // ✅ Validar situação de saída do artista
      const { validation: validationResult, error: validationError } = await validateLeaveArtist(
        user.id,
        activeArtist.id
      );

      if (validationError) {
        console.error('Erro ao validar saída:', validationError);
      } else {
        setValidation(validationResult);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveArtist = async () => {
    if (!activeArtist || !validation) return;

    // ✅ Usar dados da validação carregada
    switch (validation.action) {
      case 'DELETE_ARTIST':
        // 🔴 ÚNICO COLABORADOR - Mostrar modal de deletar
        setShowDeleteConfirmModal(true);
        break;

      case 'TRANSFER_ADMIN':
        // 🟡 ÚNICO ADMIN - Mostrar modal de opções (transferir ou deletar)
        setShowOwnerOptionsModal(true);
        break;

      case 'LEAVE_NORMALLY':
        // 🟢 PODE SAIR NORMALMENTE - Mostrar modal de confirmação
        setShowLeaveConfirmModal(true);
        break;

      default:
        Alert.alert('Erro', 'Não foi possível determinar a ação apropriada');
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

      // Limpar TODOS os caches relacionados
      const { user } = await getCurrentUser();
      if (user) {
        console.log('🧹 Limpando todos os caches após deletar artista...');
        await cacheService.invalidateArtistData(activeArtist.id);
        await cacheService.invalidateUserData(user.id);
        
        // Limpar cache de lista de artistas (múltiplas chaves possíveis)
        await cacheService.remove(`artists_${user.id}`);
        await cacheService.remove(`user_${user.id}`);
        
        console.log('🧹 Cache limpo completamente');
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

      // ✅ Usar função leaveArtist que permite remover a si mesmo
      const { success, error } = await leaveArtist(activeArtist.id);
      
      if (!success) {
        Alert.alert('Erro', error || 'Erro ao sair do artista');
        return;
      }

      // Limpar TODOS os caches relacionados
      console.log('🧹 Limpando todos os caches...');
      clearPermissionsCache(user.id, activeArtist.id);
      await cacheService.invalidateArtistData(activeArtist.id);
      await cacheService.invalidateUserData(user.id);
      
      // Limpar cache de lista de artistas (múltiplas chaves possíveis)
      await cacheService.remove(`artists_${user.id}`);
      await cacheService.remove(`user_${user.id}`);
      
      // Limpar todo o cache para garantir
      console.log('🧹 Cache limpo completamente');

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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Sair do Artista</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando informações...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const adminCount = collaborators.filter(c => c.role === 'admin').length;
  const eligibleCollaborators = collaborators.filter(c => c.role !== 'admin');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sair do Artista</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.artistInfo, { backgroundColor: colors.surface }]}>
          <Ionicons name="musical-notes" size={48} color={colors.primary} />
          <Text style={[styles.artistName, { color: colors.text }]}>{activeArtist?.name}</Text>
          <Text style={[styles.artistDescription, { color: colors.textSecondary }]}>
            Você está prestes a sair deste artista
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.primary }]}>Informações do Artista</Text>
            <Text style={[styles.infoText, { color: colors.primary }]}>
              • Total de colaboradores: {validation?.totalCollaborators || collaborators.length}
            </Text>
            <Text style={[styles.infoText, { color: colors.primary }]}>
              • Administradores: {validation?.totalAdmins || adminCount}
            </Text>
            <Text style={[styles.infoText, { color: colors.primary }]}>
              • Permissão: {validation?.userRole || 'Carregando...'}
            </Text>
          </View>
        </View>

        {validation && (
          <View style={[
            styles.warningCard, 
            { backgroundColor: validation.action === 'DELETE_ARTIST' ? colors.error + '20' : colors.warning + '20' }
          ]}>
            <Ionicons 
              name={validation.action === 'DELETE_ARTIST' ? "alert-circle" : "warning"} 
              size={24} 
              color={validation.action === 'DELETE_ARTIST' ? colors.error : colors.warning} 
            />
            <View style={styles.warningContent}>
              <Text style={[
                styles.warningTitle, 
                { color: validation.action === 'DELETE_ARTIST' ? colors.error : colors.warning }
              ]}>
                {validation.title}
              </Text>
              <Text style={[
                styles.warningText, 
                { color: validation.action === 'DELETE_ARTIST' ? colors.error : colors.warning }
              ]}>
                {validation.message}
              </Text>
              {validation.warning.map((warning, index) => (
                <Text 
                  key={index}
                  style={[
                    styles.warningText, 
                    { color: validation.action === 'DELETE_ARTIST' ? colors.error : colors.warning, marginTop: 8 }
                  ]}
                >
                  • {warning}
                </Text>
              ))}
            </View>
          </View>
        )}

        {validation && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              validation.action === 'DELETE_ARTIST' 
                ? { backgroundColor: colors.error }
                : validation.action === 'TRANSFER_ADMIN'
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.textSecondary }
            ]}
            onPress={handleLeaveArtist}
            disabled={isProcessing || !validation}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons 
                  name={
                    validation.action === 'DELETE_ARTIST' 
                      ? "trash" 
                      : validation.action === 'TRANSFER_ADMIN'
                      ? "swap-horizontal"
                      : "log-out"
                  } 
                  size={20} 
                  color="#FFFFFF" 
                />
                <Text style={styles.actionButtonText}>
                  {validation.buttonText}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal: Opções para Admin Único com Colaboradores */}
      <Modal
        visible={showOwnerOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOwnerOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: colors.warning + '30' }]}>
                <Ionicons name="shield-checkmark" size={32} color={colors.warning} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Você é o Único Administrador</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Escolha uma das opções abaixo para continuar
              </Text>
            </View>

            <View style={styles.optionsContainer}>
              {/* Opção 1: Promover outro a Admin */}
              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => {
                  setShowOwnerOptionsModal(false);
                  router.push('/transferir-propriedade');
                }}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: colors.primary + '30' }]}>
                  <Ionicons name="swap-horizontal" size={24} color={colors.primary} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>Indicar Novo Administrador</Text>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    Escolha outro colaborador para ser administrador e depois você sai do artista.
                  </Text>
                  <View style={styles.optionSteps}>
                    <View style={styles.stepItem}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      <Text style={[styles.stepText, { color: colors.textSecondary }]}>Você mantém seus dados seguros</Text>
                    </View>
                    <View style={styles.stepItem}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      <Text style={[styles.stepText, { color: colors.textSecondary }]}>Outro colaborador assume como admin</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Opção 2: Deletar Artista */}
              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: colors.error + '15', borderColor: colors.error + '40' }]}
                onPress={() => {
                  setShowOwnerOptionsModal(false);
                  setShowDeleteConfirmModal(true);
                }}
              >
                <View style={[styles.optionIconCircle, { backgroundColor: colors.error + '30' }]}>
                  <Ionicons name="trash" size={24} color={colors.error} />
                </View>
                <View style={styles.optionContent}>
                  <Text style={[styles.optionTitle, { color: colors.error }]}>Deletar Artista</Text>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                    Deleta permanentemente o artista e TODOS os dados associados.
                  </Text>
                  <View style={styles.optionSteps}>
                    <View style={styles.stepItem}>
                      <Ionicons name="warning" size={16} color={colors.error} />
                      <Text style={[styles.stepText, { color: colors.error }]}>Remove todos os {collaborators.length} colaboradores</Text>
                    </View>
                    <View style={styles.stepItem}>
                      <Ionicons name="warning" size={16} color={colors.error} />
                      <Text style={[styles.stepText, { color: colors.error }]}>Deleta eventos e dados financeiros</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.modalCancelButton, { backgroundColor: colors.background }]}
              onPress={() => setShowOwnerOptionsModal(false)}
            >
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
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
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: colors.error + '30' }]}>
                <Ionicons name="warning" size={40} color={colors.error} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.error }]}>Deletar Artista</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Essa ação é permanente e não pode ser desfeita!
              </Text>
            </View>

            <View style={[styles.warningBox, { backgroundColor: colors.error + '15', borderColor: colors.error + '40' }]}>
              <Text style={[styles.warningBoxTitle, { color: colors.error }]}>⚠️ O que será deletado:</Text>
              <View style={styles.warningList}>
                <View style={styles.warningItem}>
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                  <Text style={[styles.warningItemText, { color: colors.error }]}>
                    Artista &quot;{activeArtist?.name}&quot;
                  </Text>
                </View>
                <View style={styles.warningItem}>
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                  <Text style={[styles.warningItemText, { color: colors.error }]}>
                    Todos os {collaborators.length} colaboradores serão removidos
                  </Text>
                </View>
                <View style={styles.warningItem}>
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                  <Text style={[styles.warningItemText, { color: colors.error }]}>
                    Todos os eventos e agenda
                  </Text>
                </View>
                <View style={styles.warningItem}>
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                  <Text style={[styles.warningItemText, { color: colors.error }]}>
                    Todos os dados financeiros
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButtonAlt, { backgroundColor: colors.background }]}
                onPress={() => setShowDeleteConfirmModal(false)}
              >
                <Text style={[styles.modalCancelTextAlt, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalDeleteButton, { backgroundColor: colors.error }]}
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
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: colors.primary + '30' }]}>
                <Ionicons name="log-out" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Sair do Artista</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Tem certeza que deseja sair de &quot;{activeArtist?.name}&quot;?
              </Text>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
              <Text style={[styles.infoBoxTitle, { color: colors.primary }]}>📋 O que acontecerá:</Text>
              <View style={styles.infoList}>
                <View style={styles.infoItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  <Text style={[styles.infoItemText, { color: colors.primary }]}>
                    Você será removido da lista de colaboradores
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  <Text style={[styles.infoItemText, { color: colors.primary }]}>
                    Perderá acesso a eventos e dados do artista
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  <Text style={[styles.infoItemText, { color: colors.primary }]}>
                    O artista continuará existindo para os outros colaboradores
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButtonAlt, { backgroundColor: colors.background }]}
                onPress={() => setShowLeaveConfirmModal(false)}
              >
                <Text style={[styles.modalCancelTextAlt, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalLeaveButton, { backgroundColor: colors.textSecondary }]}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
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
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  artistInfo: {
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
    marginTop: 16,
    textAlign: 'center',
  },
  artistDescription: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
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
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  warningCard: {
    flexDirection: 'row',
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
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
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
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
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
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
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
  },
  warningBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  warningBoxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
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
    flex: 1,
    lineHeight: 20,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  infoBoxTitle: {
    fontSize: 16,
    fontWeight: 'bold',
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
    flex: 1,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButtonAlt: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelTextAlt: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalDeleteButton: {
    flex: 1,
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
