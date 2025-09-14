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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getCollaborators } from '../services/supabase/collaboratorService';
import { getCurrentUser } from '../services/supabase/authService';
import { deleteArtist } from '../services/supabase/artistService';
import { useActiveArtist } from '../services/useActiveArtist';
import { clearActiveArtist } from '../services/artistContext';

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
      // Único owner com outros colaboradores - precisa transferir propriedade
      Alert.alert(
        'Transferir Propriedade',
        'Você é o único proprietário deste artista. Para sair, você precisa transferir a propriedade para outro colaborador.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Transferir Propriedade',
            onPress: () => {
              router.push('/transferir-propriedade');
            },
          },
        ]
      );
    } else if (isOwner && ownerCount === 1 && eligibleCollaborators.length === 0) {
      // Único owner sem outros colaboradores - pode deletar o artista
      Alert.alert(
        'Deletar Artista',
        `Você é o único colaborador do artista "${activeArtist.name}". Ao sair, o artista será deletado permanentemente.\n\nEsta ação não pode ser desfeita.`,
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Deletar Artista',
            style: 'destructive',
            onPress: () => {
              handleDeleteArtist();
            },
          },
        ]
      );
    } else {
      // Não é owner ou há outros owners - pode sair normalmente
      Alert.alert(
        'Sair do Artista',
        `Tem certeza que deseja sair do artista "${activeArtist.name}"?`,
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Sair',
            style: 'destructive',
            onPress: () => {
              handleLeaveNormally();
            },
          },
        ]
      );
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

      Alert.alert(
        'Artista Deletado',
        'O artista foi deletado com sucesso.',
        [
          {
            text: 'OK',
            onPress: () => {
              clearActiveArtist();
              router.replace('/(tabs)/configuracoes');
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

    try {
      setIsProcessing(true);

      // Implementar remoção do usuário do artista
      // Esta função será implementada no collaboratorService
      
      Alert.alert(
        'Saiu do Artista',
        'Você saiu do artista com sucesso.',
        [
          {
            text: 'OK',
            onPress: () => {
              clearActiveArtist();
              router.replace('/(tabs)/configuracoes');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao sair do artista:', error);
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
});
