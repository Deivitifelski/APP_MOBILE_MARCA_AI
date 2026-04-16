import React, { useState, useEffect, useMemo } from 'react';
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
  role: 'admin' | 'editor' | 'viewer';
  musical_style?: string;
  created_at: string;
  updated_at: string;
}

type RoleKey = 'admin' | 'editor' | 'viewer';

function hexWithAlpha(hex: string, alphaHex: string): string {
  if (hex.length === 7 && hex.startsWith('#')) {
    return `${hex}${alphaHex}`;
  }
  return hex;
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

      const { artists: userArtists, error: artistsError } = await getArtists(user.id);

      if (artistsError) {
        Alert.alert('Erro', 'Erro ao carregar artistas');
        return;
      }

      const artistsList = (userArtists || []) as ArtistCollaborator[];
      setArtists(artistsList);
    } catch {
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

  const roleMeta = useMemo(
    () =>
      (role: string) => {
        const r = role as RoleKey;
        switch (r) {
          case 'admin':
            return {
              label: 'Administrador',
              icon: 'shield-checkmark' as const,
              tint: colors.success,
            };
          case 'editor':
            return {
              label: 'Editor',
              icon: 'create' as const,
              tint: colors.primary,
            };
          case 'viewer':
            return {
              label: 'Visualizador',
              icon: 'eye' as const,
              tint: colors.textSecondary,
            };
          default:
            return {
              label: role,
              icon: 'person' as const,
              tint: colors.textSecondary,
            };
        }
      },
    [colors.success, colors.primary, colors.textSecondary],
  );

  const renderArtist = (artist: ArtistCollaborator) => {
    const isActive = activeArtist?.id === artist.id;
    const isBusy = switchingArtistId !== null;
    const meta = roleMeta(artist.role);
    const initial = (artist.name?.trim()?.charAt(0) || '?').toUpperCase();

    return (
      <TouchableOpacity
        key={artist.id}
        style={[
          styles.artistCard,
          {
            backgroundColor: colors.surface,
            borderColor: isActive ? colors.primary : colors.border,
            opacity: isBusy && switchingArtistId !== artist.id ? 0.55 : 1,
          },
          isActive && styles.artistCardActive,
        ]}
        onPress={() => handleSelectArtist(artist)}
        disabled={isActive || isBusy}
        activeOpacity={0.7}
      >
        <View style={styles.artistRow}>
          <View
            style={[
              styles.avatarWrap,
              {
                borderColor: isActive ? colors.primary : 'transparent',
                borderWidth: isActive ? 2 : 0,
              },
            ]}
          >
            {artist.profile_url && artist.profile_url.trim() !== '' ? (
              <Image
                source={{
                  uri: `${artist.profile_url}${artist.profile_url.includes('?') ? '&' : '?'}t=${Date.now()}`,
                  cache: 'reload',
                }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
          </View>

          <View style={styles.artistMain}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.artistName, { color: colors.text }]}
                numberOfLines={1}
              >
                {artist.name}
              </Text>
              {isActive && (
                <View style={[styles.currentPill, { backgroundColor: hexWithAlpha(colors.primary, '33') }]}>
                  <Text style={[styles.currentPillText, { color: colors.primary }]}>Atual</Text>
                </View>
              )}
            </View>
            {artist.musical_style ? (
              <Text style={[styles.styleLine, { color: colors.textSecondary }]} numberOfLines={1}>
                {artist.musical_style}
              </Text>
            ) : null}
            <View style={[styles.rolePill, { backgroundColor: hexWithAlpha(meta.tint, '22') }]}>
              <Ionicons name={meta.icon} size={14} color={meta.tint} />
              <Text style={[styles.rolePillText, { color: meta.tint }]}>{meta.label}</Text>
            </View>
          </View>

          <View style={styles.trailing}>
            {switchingArtistId === artist.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : isActive ? (
              <Ionicons name="checkmark-circle" size={26} color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const header = (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>Selecionar artista</Text>
      <View style={styles.headerRight} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {header}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View
          style={[
            styles.hintCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.hintIconCircle, { backgroundColor: hexWithAlpha(colors.primary, '22') }]}>
            <Ionicons name="people" size={22} color={colors.primary} />
          </View>
          <View style={styles.hintTextBlock}>
            <Text style={[styles.hintTitle, { color: colors.text }]}>Troque de perfil</Text>
            <Text style={[styles.hintSubtitle, { color: colors.textSecondary }]}>
              Escolha o artista que deseja usar na agenda e no restante do app.
            </Text>
          </View>
        </View>

        {artists.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: hexWithAlpha(colors.primary, '18') }]}>
              <Ionicons name="musical-notes-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum artista</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Quando você for convidado ou criar um artista, ele aparecerá aqui.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {artists.length === 1 ? '1 perfil' : `${artists.length} perfis`}
            </Text>
            <View style={styles.list}>{artists.map(renderArtist)}</View>
          </>
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
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    width: 44,
    alignItems: 'flex-start',
  },
  headerRight: {
    width: 44,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  hintIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTextBlock: {
    flex: 1,
    paddingTop: 2,
  },
  hintTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hintSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 2,
  },
  list: {
    gap: 10,
  },
  artistCard: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  artistCardActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 14,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  artistMain: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  artistName: {
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
  },
  currentPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  currentPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  styleLine: {
    fontSize: 13,
    marginBottom: 8,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  rolePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  trailing: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
