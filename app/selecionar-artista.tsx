import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getCurrentUser } from '../services/supabase/authService';
import { getArtists } from '../services/supabase/artistService';
import { useActiveArtistContext } from '../contexts/ActiveArtistContext';
import { useTheme } from '../contexts/ThemeContext';

interface ArtistCollaborator {
  id: string;
  name: string;
  profile_url?: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  musical_style?: string;
  created_at: string;
  updated_at: string;
}

export default function SelecionarArtistaScreen() {
  const [artists, setArtists] = useState<ArtistCollaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [switchingArtistId, setSwitchingArtistId] = useState<string | null>(null);
  const { activeArtist, setActiveArtist } = useActiveArtistContext();
  const { colors } = useTheme();

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

      const artistsList = (userArtists || []) as ArtistCollaborator[];
      setArtists(artistsList);
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

  const handleSelectArtist = async (artist: ArtistCollaborator) => {
    try {
      setSwitchingArtistId(artist.id);
      await setActiveArtist({
        id: artist.id,
        name: artist.name,
        role: artist.role,
        profile_url: artist.profile_url,
        musical_style: artist.musical_style,
        created_at: artist.created_at,
      });
      router.replace({ pathname: '/(tabs)/agenda', params: { artistChangedToast: '1' } });
    } catch {
      Alert.alert('Erro', 'Não foi possível alterar o artista. Tente novamente.');
    } finally {
      setSwitchingArtistId(null);
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

  const renderArtist = (artist: ArtistCollaborator) => {
    const isActive = activeArtist?.id === artist.id;
    
    return (
      <TouchableOpacity
        key={artist.id}
        style={[
          styles.artistCard,
          { 
            backgroundColor: colors.surface,
            borderColor: isActive ? colors.primary : colors.border 
          },
          isActive && styles.artistCardActive
        ]}
        onPress={() => handleSelectArtist(artist)}
        disabled={isActive || switchingArtistId !== null}
      >
        <View style={styles.artistInfo}>
          <View style={[styles.artistAvatar, isActive && { borderColor: colors.primary, borderWidth: 2 }]}>
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
                <Ionicons name="musical-notes" size={28} color="#fff" />
              </View>
            )}
            {isActive && (
              <View style={styles.activeCheckBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              </View>
            )}
          </View>
          <View style={styles.artistDetails}>
            <View style={styles.artistNameContainer}>
              <Text style={[styles.artistName, { color: colors.text }, isActive && { color: colors.primary }]}>
                {artist.name}
              </Text>
              {isActive && (
                <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.activeBadgeText}>ATIVO</Text>
                </View>
              )}
            </View>
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
        {switchingArtistId === artist.id ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : isActive ? (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando artistas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }] }>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Selecionar Artista</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={[styles.introSection, { backgroundColor: colors.surface }] }>
          <Text style={[styles.introTitle, { color: colors.text }]}>Seus Artistas</Text>
          <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
            Selecione um artista para alternar entre suas colaborações
          </Text>
        </View>

        {artists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum artista encontrado</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }] }>
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
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
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
  introTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  artistsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  artistCard: {
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
    borderWidth: 1,
  },
  artistCardActive: {
    borderWidth: 2,
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
    overflow: 'visible',
    position: 'relative',
  },
  activeCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: Platform.OS === 'android' ? 0 : 0.3,
    shadowRadius: Platform.OS === 'android' ? 0 : 4,
    elevation: Platform.OS === 'android' ? 0 : 3,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  artistDetails: {
    flex: 1,
  },
  artistNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  artistName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
