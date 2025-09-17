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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getCurrentUser } from '../services/supabase/authService';
import { getArtists } from '../services/supabase/artistService';
import { setActiveArtist } from '../services/artistContext';

interface ArtistCollaborator {
  id: string;
  name: string;
  profile_url?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
}

export default function SelecionarArtistaScreen() {
  const [artists, setArtists] = useState<ArtistCollaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

      // Buscar artistas do usuário
      const { artists: userArtists, error: artistsError } = await getArtists(user.id);
      
      if (artistsError) {
        Alert.alert('Erro', 'Erro ao carregar artistas');
        return;
      }

      setArtists((userArtists || []) as ArtistCollaborator[]);
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

  const handleSelectArtist = (artist: ArtistCollaborator) => {
    Alert.alert(
      'Alterar Artista',
      `Deseja alternar para o artista: ${artist.name}?\n\nRole: ${getRoleLabel(artist.role)}`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Alternar',
          onPress: async () => {
            try {
              // Definir o artista como ativo
              await setActiveArtist({
                id: artist.id,
                name: artist.name,
                role: artist.role
              });
              
              Alert.alert('Sucesso', `Agora você está usando o artista: ${artist.name}`);
              // Recarregar a tela anterior para atualizar com o novo artista
              router.replace('/(tabs)/agenda');
            } catch (error) {
              Alert.alert('Erro', 'Erro ao alterar artista');
            }
          }
        }
      ]
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
        return '#4CAF50'; // Verde
      case 'editor':
        return '#2196F3'; // Azul
      case 'viewer':
        return '#9E9E9E'; // Cinza
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

  const renderArtist = (artist: ArtistCollaborator) => (
    <TouchableOpacity
      key={artist.id}
      style={styles.artistCard}
      onPress={() => handleSelectArtist(artist)}
    >
      <View style={styles.artistInfo}>
        <View style={styles.artistAvatar}>
          {artist.profile_url && artist.profile_url.trim() !== '' ? (
            <Image
              source={{
                uri: `${artist.profile_url}${artist.profile_url.includes('?') ? '&' : '?'}t=${Date.now()}`,
                cache: 'reload'
              }}
              style={styles.artistAvatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.artistAvatarPlaceholder}>
              <Ionicons name="musical-notes" size={24} color="#667eea" />
            </View>
          )}
        </View>
        <View style={styles.artistDetails}>
          <Text style={styles.artistName}>{artist.name}</Text>
          <View style={styles.roleContainer}>
            <Ionicons 
              name={getRoleIcon(artist.role) as any} 
              size={16} 
              color={getRoleColor(artist.role)} 
            />
            <Text style={[styles.roleText, { color: getRoleColor(artist.role) }]}>
              {getRoleLabel(artist.role)}
            </Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Carregando artistas...</Text>
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
        <Text style={styles.title}>Selecionar Artista</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.introSection}>
          <Text style={styles.introTitle}>Seus Artistas</Text>
          <Text style={styles.introSubtitle}>
            Selecione um artista para alternar entre suas colaborações
          </Text>
        </View>

        {artists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>Nenhum artista encontrado</Text>
            <Text style={styles.emptySubtitle}>
              Você ainda não é colaborador de nenhum artista
            </Text>
          </View>
        ) : (
          <View style={styles.artistsList}>
            {artists.map(renderArtist)}
          </View>
        )}
      </ScrollView>
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
  introSection: {
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
  introTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  artistsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  artistCard: {
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
  artistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  artistAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    overflow: 'hidden',
  },
  artistAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  artistAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  artistDetails: {
    flex: 1,
  },
  artistName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
    textTransform: 'uppercase',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
