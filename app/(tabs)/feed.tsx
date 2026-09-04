import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SocialPostCard from '../../components/feed/social/SocialPostCard';
import SocialCommentsModal from '../../components/feed/social/SocialCommentsModal';
import OptimizedImage from '../../components/OptimizedImage';
import PermissionModal from '../../components/PermissionModal';
import PropostaEnviadaModal from '../../components/PropostaEnviadaModal';
import BrazilStatePickerModal from '../../components/BrazilStatePickerModal';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useActiveArtistContext } from '../../contexts/ActiveArtistContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatEventLocationSlash } from '../../lib/brazilGeo';
import { formatCalendarDate, weekdayFromCalendarDate } from '../../lib/dateUtils';
import {
  desfazerPropostaFeed,
  encerrarAnuncioFeed,
  listarFeedMarketplace,
  listarPropostasFeedMarketplace,
  type FeedAnuncio,
  type FeedFiltro,
  type FeedProposta,
} from '../../services/supabase/feedMarketplaceService';
import {
  listarFeedSocial,
  type SocialPost,
} from '../../services/supabase/socialFeedService';

type FeedEntry =
  | { kind: 'marketplace'; created_at: string; data: FeedAnuncio }
  | { kind: 'social'; created_at: string; data: SocialPost };

function formatTime(t: string) {
  if (!t) return '';
  return String(t).slice(0, 5);
}

const FILTROS: { id: FeedFiltro; label: string; descricao: string }[] = [
  { id: 'todos', label: 'Todos', descricao: 'Todas as publicações' },
  {
    id: 'disponivel',
    label: 'Ofertas',
    descricao: 'Quem está oferecendo artista, banda, músico, serviço, parceria etc.',
  },
  {
    id: 'demanda',
    label: 'Procurando',
    descricao: 'Quem está buscando artista, músico, banda, serviço, parceria etc.',
  },
];

export default function FeedScreen() {
  const { colors } = useTheme();
  const { activeArtist } = useActiveArtistContext();
  const { canCreateEvents } = usePermissions();
  const [filtro, setFiltro] = useState<FeedFiltro>('todos');
  const [verMinhas, setVerMinhas] = useState(false);
  const [estadoUf, setEstadoUf] = useState('');
  const [cidade, setCidade] = useState('');
  const [showEstados, setShowEstados] = useState(false);
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [propostasPorEvento, setPropostasPorEvento] = useState<Record<string, FeedProposta[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showPublicarOpcoes, setShowPublicarOpcoes] = useState(false);
  const [showPropostaEnviada, setShowPropostaEnviada] = useState(false);
  const [anuncioProposta, setAnuncioProposta] = useState<FeedAnuncio | null>(null);
  const [desfazendoProposta, setDesfazendoProposta] = useState(false);
  const [activeSocialPostId, setActiveSocialPostId] = useState<string | null>(null);
  const [commentsPost, setCommentsPost] = useState<SocialPost | null>(null);

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 65 }),
    []
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const socialVisible = viewableItems.find(
        (token) =>
          token.isViewable &&
          token.item &&
          typeof token.item === 'object' &&
          'kind' in (token.item as FeedEntry) &&
          (token.item as FeedEntry).kind === 'social'
      );
      const nextId =
        socialVisible && socialVisible.item && typeof socialVisible.item === 'object'
          ? (socialVisible.item as FeedEntry).kind === 'social'
            ? (socialVisible.item as Extract<FeedEntry, { kind: 'social' }>).data.id
            : null
          : null;
      setActiveSocialPostId(nextId);
    }
  );
  const loadGenerationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    const artistId = activeArtist?.id ?? null;
    const includeSocial = verMinhas || filtro === 'todos';
    const [marketplaceRes, socialRes] = await Promise.all([
      listarFeedMarketplace({
        filtro: verMinhas ? 'meus' : filtro,
        estadoUf: verMinhas ? '' : estadoUf,
        cidade: verMinhas ? '' : cidade,
        artistaAtualId: artistId,
      }),
      includeSocial
        ? listarFeedSocial({
            artistaAtualId: artistId,
            somenteMeus: verMinhas,
          })
        : Promise.resolve({ posts: [] as SocialPost[], error: null as string | null }),
    ]);

    if (generation !== loadGenerationRef.current) return;

    const marketplaceErr = marketplaceRes.error;
    const socialErr = includeSocial ? socialRes.error : null;

    const visiveis =
      !marketplaceRes.error && verMinhas && artistId
        ? marketplaceRes.anuncios.filter((item) => item.artist_id === artistId)
        : !marketplaceRes.error
          ? marketplaceRes.anuncios
          : [];

    const merged: FeedEntry[] = [
      ...visiveis.map((item) => ({
        kind: 'marketplace' as const,
        created_at: item.created_at,
        data: item,
      })),
      ...(includeSocial && !socialRes.error
        ? socialRes.posts.map((post) => ({
            kind: 'social' as const,
            created_at: post.created_at,
            data: post,
          }))
        : []),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (generation !== loadGenerationRef.current) return;

    setEntries(merged);
    setError(
      merged.length === 0
        ? marketplaceErr || socialErr
        : marketplaceErr
    );
    if (artistId) {
      const { propostas } = await listarPropostasFeedMarketplace(artistId);
      if (generation !== loadGenerationRef.current) return;

      const meusIds = new Set(
        visiveis.filter((item) => item.artist_id === artistId).map((item) => item.id)
      );
      const grouped: Record<string, FeedProposta[]> = {};
      propostas.forEach((proposta) => {
        if (!meusIds.has(proposta.evento_id)) return;
        if (!grouped[proposta.evento_id]) grouped[proposta.evento_id] = [];
        grouped[proposta.evento_id].push(proposta);
      });
      setPropostasPorEvento(grouped);
    } else {
      setPropostasPorEvento({});
    }
    setLoading(false);
    setRefreshing(false);
  }, [filtro, verMinhas, estadoUf, cidade, activeArtist?.id]);

  useEffect(() => {
    setEntries([]);
    setPropostasPorEvento({});
    setActiveSocialPostId(null);
    setLoading(true);
    void load();
  }, [activeArtist?.id, load]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const emptyCopy = useMemo(() => {
    if (filtro === 'disponivel') {
      return 'Nenhuma oferta neste filtro.';
    }
    if (filtro === 'demanda') {
      return 'Ninguém está procurando neste filtro.';
    }
    if (verMinhas) {
      return 'Você ainda não publicou no feed.';
    }
    return 'Ainda não há publicações no feed.';
  }, [filtro, verMinhas]);

  const handlePublicar = () => {
    if (!activeArtist) {
      Alert.alert('Artista', 'Selecione um artista nas Configurações para publicar.');
      return;
    }
    setShowPublicarOpcoes(true);
  };

  const handleEscolherPublicacao = (
    destino: '/feed/publicar-midia' | '/publicar-feed',
    tipo?: 'disponivel' | 'demanda'
  ) => {
    if (!canCreateEvents) {
      setShowPublicarOpcoes(false);
      setShowPermissionModal(true);
      return;
    }
    setShowPublicarOpcoes(false);
    if (destino === '/publicar-feed') {
      router.push({ pathname: '/publicar-feed', params: { tipo: tipo ?? 'disponivel' } });
      return;
    }
    router.push('/feed/publicar-midia');
  };

  const isMeuAnuncio = (item: FeedAnuncio) =>
    !!activeArtist?.id && item.artist_id === activeArtist.id;

  const handleNegociar = (item: FeedAnuncio) => {
    if (isMeuAnuncio(item)) {
      Alert.alert('Seu anúncio', 'Você não pode iniciar negociação na sua própria publicação.');
      return;
    }
    if (item.ja_proposei) {
      setAnuncioProposta(item);
      setShowPropostaEnviada(true);
      return;
    }
    if (!activeArtist) {
      Alert.alert('Artista', 'Selecione um artista nas Configurações para negociar.');
      return;
    }
    if (!canCreateEvents) {
      setShowPermissionModal(true);
      return;
    }
    router.push({ pathname: '/negociar-feed', params: { eventId: item.id } });
  };

  const handleEncerrar = (item: FeedAnuncio) => {
    Alert.alert(
      'Encerrar anúncio',
      'Ele sai do feed. A agenda e o financeiro não são alterados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const { success, error: err } = await encerrarAnuncioFeed(item.id);
              if (!success) {
                Alert.alert('Erro', err || 'Não foi possível encerrar.');
                return;
              }
              void load();
            })();
          },
        },
      ]
    );
  };

  const handlePostRemoved = (postId: string) => {
    setEntries((prev) =>
      prev.filter((entry) => !(entry.kind === 'social' && entry.data.id === postId))
    );
  };

  const handleOpenComments = (post: SocialPost) => {
    setCommentsPost(post);
  };

  const handleCommentsCountChange = (postId: string, count: number) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.kind === 'social' && entry.data.id === postId
          ? {
              ...entry,
              data: {
                ...entry.data,
                comments_count: count,
              },
            }
          : entry
      )
    );
    setCommentsPost((current) =>
      current?.id === postId ? { ...current, comments_count: count } : current
    );
  };

  const renderMarketplaceItem = (item: FeedAnuncio) => {
    const meuAnuncio = isMeuAnuncio(item);
    const isDemanda = item.feed_tipo === 'demanda';
    const badgeColor = isDemanda ? '#4F46E5' : '#0F766E';
    const location = formatEventLocationSlash({
      city: item.city,
      state_uf: item.state_uf,
    });
    const weekday = weekdayFromCalendarDate(item.event_date);
    const dateLabel = weekday
      ? `${weekday}, ${formatCalendarDate(item.event_date)}`
      : formatCalendarDate(item.event_date);
    const cacheTxt =
      item.meu_cache_valor != null
        ? Number(item.meu_cache_valor).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })
        : null;
    const propostas = meuAnuncio ? propostasPorEvento[item.id] || [] : [];
    const avatarUrls = (
      item.propostas_avatars.length
        ? item.propostas_avatars
        : propostas.map((proposta) => proposta.artista_image).filter((url): url is string => !!url)
    ).slice(0, 3);
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.typeBanner, { backgroundColor: `${badgeColor}12` }]}>
          <View style={[styles.typeIconWrap, { backgroundColor: `${badgeColor}22` }]}>
            <Ionicons
              name={isDemanda ? 'search' : 'briefcase'}
              size={16}
              color={badgeColor}
            />
          </View>
          <View style={styles.typeCopy}>
            <Text style={[styles.typeTitle, { color: badgeColor }]}>
              {isDemanda ? 'Procurando' : 'Oferta'}
            </Text>
            <Text style={[styles.typeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              {isDemanda
                ? 'Quem publicou está buscando artista, músico ou serviço nesta data'
                : 'Quem publicou está oferecendo data, show ou disponibilidade'}
            </Text>
          </View>
        </View>

        <View style={styles.artistRow}>
          <View style={[styles.avatarWrap, { backgroundColor: colors.secondary }]}>
            {item.artist_image ? (
              <OptimizedImage
                imageUrl={item.artist_image}
                style={styles.avatar}
                fallbackIcon="person"
                fallbackIconSize={20}
              />
            ) : (
              <Ionicons name="person" size={20} color={colors.primary} />
            )}
          </View>
          <View style={styles.artistInfo}>
            <Text style={[styles.artistName, { color: colors.text }]} numberOfLines={1}>
              {meuAnuncio ? 'Sua publicação' : item.artist_name}
            </Text>
          </View>
        </View>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.meta, { color: colors.text }]} numberOfLines={1}>
              {dateLabel}
            </Text>
          </View>
          {item.start_time ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.meta, { color: colors.text }]} numberOfLines={1}>
                {formatTime(item.start_time)}–{formatTime(item.end_time)}
              </Text>
            </View>
          ) : null}
          {location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.meta, { color: colors.text }]} numberOfLines={1}>
                {location}
              </Text>
            </View>
          ) : null}
          {meuAnuncio ? (
            <View style={styles.metaRow}>
              <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                {cacheTxt ? `Cachê ${cacheTxt}` : 'Cachê a combinar'}
              </Text>
            </View>
          ) : null}
        </View>

        {item.description ? (
          <Text style={[styles.notes, { color: colors.text }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        {item.propostas_count > 0 || meuAnuncio ? (
          <View style={styles.propostasResumo}>
            <View style={styles.avatarStack}>
              {avatarUrls.length
                ? avatarUrls.map((url, index) => (
                    <View
                      key={`${url}-${index}`}
                      style={[
                        styles.stackAvatar,
                        {
                          marginLeft: index === 0 ? 0 : -7,
                          zIndex: 10 - index,
                          backgroundColor: colors.secondary,
                          borderColor: colors.surface,
                        },
                      ]}
                    >
                      <OptimizedImage
                        imageUrl={url}
                        style={styles.stackAvatarImg}
                        fallbackIcon="person"
                        fallbackIconSize={10}
                      />
                    </View>
                  ))
                : item.propostas_count > 0
                  ? Array.from({ length: Math.min(item.propostas_count, 3) }).map((_, index) => (
                      <View
                        key={`ph-${index}`}
                        style={[
                          styles.stackAvatar,
                          {
                            marginLeft: index === 0 ? 0 : -7,
                            zIndex: 10 - index,
                            backgroundColor: colors.secondary,
                            borderColor: colors.surface,
                          },
                        ]}
                      >
                        <Ionicons name="person" size={10} color={colors.primary} />
                      </View>
                    ))
                  : null}
            </View>
            <Text style={[styles.countPillText, { color: colors.textSecondary }]}>
              {item.propostas_count === 0
                ? 'Nenhuma proposta'
                : item.propostas_count === 1
                  ? '1 proposta'
                  : `${item.propostas_count} propostas`}
            </Text>
          </View>
        ) : null}

        {meuAnuncio && propostas.length > 0 ? (
          <View style={[styles.propostasBox, { borderColor: colors.border }]}>
            {propostas.map((proposta) => (
              <TouchableOpacity
                key={proposta.convite_id}
                style={styles.propostaRow}
                onPress={() => router.push('/convites-participacao-evento')}
                activeOpacity={0.8}
              >
                <View style={[styles.propostaAvatar, { backgroundColor: colors.secondary }]}>
                  {proposta.artista_image ? (
                    <OptimizedImage
                      imageUrl={proposta.artista_image}
                      style={styles.propostaAvatarImg}
                      fallbackIcon="person"
                      fallbackIconSize={16}
                    />
                  ) : (
                    <Ionicons name="person" size={16} color={colors.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.propostaNome, { color: colors.text }]} numberOfLines={1}>
                    {proposta.artista_nome}
                  </Text>
                  <Text style={[styles.propostaMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    {proposta.status === 'aceito' ? 'Aceita' : 'Pendente'}
                    {proposta.funcao && proposta.funcao !== 'Interesse'
                      ? ` · ${proposta.funcao}`
                      : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {meuAnuncio ? (
          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: colors.border }]}
            onPress={() => handleEncerrar(item)}
          >
            <Text style={[styles.btnOutlineText, { color: colors.textSecondary }]}>Encerrar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={
              item.ja_proposei
                ? [styles.btnOutline, { borderColor: colors.primary }]
                : [styles.btnPrimary, { backgroundColor: colors.primary }]
            }
            onPress={() => handleNegociar(item)}
          >
            <Text
              style={
                item.ja_proposei
                  ? [styles.btnOutlineText, { color: colors.primary }]
                  : styles.btnPrimaryText
              }
            >
              {item.ja_proposei
                ? 'Proposta enviada'
                : isDemanda
                  ? 'Quero me candidatar'
                  : 'Tenho interesse'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderItem = ({ item: entry }: { item: FeedEntry }) => {
    if (entry.kind === 'social') {
      return (
        <SocialPostCard
          post={entry.data}
          activeArtistId={activeArtist?.id ?? null}
          isMediaActive={activeSocialPostId === entry.data.id}
          onOpenComments={handleOpenComments}
          onPostRemoved={handlePostRemoved}
        />
      );
    }
    return renderMarketplaceItem(entry.data);
  };

  const artistAvatarUrl = activeArtist?.profile_url?.trim() || '';
  const artistInitial = activeArtist?.name?.trim().charAt(0).toUpperCase() || '?';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Feed</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {[{ id: 'perfil' as const, label: 'Perfil' }, ...FILTROS].map((item) => {
            const active = item.id === 'perfil' ? verMinhas : !verMinhas && filtro === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.chip,
                  item.id === 'perfil' && styles.chipPerfil,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  if (item.id === 'perfil') {
                    setVerMinhas(true);
                    return;
                  }
                  setVerMinhas(false);
                  setFiltro(item.id);
                }}
              >
                {item.id === 'perfil' ? (
                  <View
                    style={[
                      styles.chipAvatarWrap,
                      {
                        borderColor: active ? '#fff' : colors.border,
                        backgroundColor: active ? 'rgba(255,255,255,0.18)' : colors.secondary,
                      },
                    ]}
                  >
                    {artistAvatarUrl ? (
                      <Image
                        key={`${activeArtist?.id ?? 'sem-artista'}-${artistAvatarUrl}`}
                        source={{ uri: artistAvatarUrl }}
                        style={styles.chipAvatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={styles.chipAvatarFallback}>
                        {activeArtist ? (
                          <Text
                            style={[
                              styles.chipAvatarInitial,
                              { color: active ? '#fff' : colors.primary },
                            ]}
                          >
                            {artistInitial}
                          </Text>
                        ) : (
                          <Ionicons
                            name="person"
                            size={12}
                            color={active ? '#fff' : colors.textSecondary}
                          />
                        )}
                      </View>
                    )}
                  </View>
                ) : null}
                <Text style={[styles.chipText, { color: active ? '#fff' : colors.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {!verMinhas ? (
          <View style={styles.geoRow}>
            <TouchableOpacity
              style={[
                styles.geoField,
                styles.geoUf,
                {
                  backgroundColor: colors.surface,
                  borderColor: estadoUf ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setShowEstados(true)}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.geoFieldText, { color: estadoUf ? colors.text : colors.textSecondary }]}
                numberOfLines={1}
              >
                {estadoUf || 'UF'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
            <View
              style={[
                styles.geoField,
                styles.geoCity,
                {
                  backgroundColor: colors.surface,
                  borderColor: cidade.trim() ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons name="location-outline" size={15} color={colors.textSecondary} />
              <TextInput
                value={cidade}
                onChangeText={setCidade}
                placeholder="Cidade"
                placeholderTextColor={colors.textSecondary}
                style={[styles.geoInput, { color: colors.text }]}
                returnKeyType="search"
                autoCorrect={false}
              />
              {cidade.trim() ? (
                <TouchableOpacity onPress={() => setCidade('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={15} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

      {error ? (
        <TouchableOpacity
          style={[styles.errorBanner, { backgroundColor: `${colors.primary}12` }]}
          onPress={() => void load()}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={[styles.errorBannerText, { color: colors.text }]} numberOfLines={2}>
            Não deu para atualizar. Toque para tentar de novo.
          </Text>
        </TouchableOpacity>
      ) : null}

      {!activeArtist ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={42} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Selecione um artista</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            O feed usa o artista ativo nas Configurações.
          </Text>
        </View>
      ) : loading && entries.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          key={activeArtist?.id ?? 'sem-artista'}
          data={entries}
          keyExtractor={(entry) =>
            entry.kind === 'social' ? `social-${entry.data.id}` : entry.data.id
          }
          renderItem={renderItem}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig}
          contentContainerStyle={entries.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="newspaper-outline" size={42} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {error ? 'Nada por aqui agora' : 'Feed vazio'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                {error ? 'Puxe para atualizar ou toque no aviso acima.' : emptyCopy}
              </Text>
            </View>
          }
        />
      )}

      {activeArtist ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={handlePublicar}
          accessibilityLabel="Publicar no feed"
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      ) : null}

      <BrazilStatePickerModal
        visible={showEstados}
        onClose={() => setShowEstados(false)}
        selectedUf={estadoUf}
        onSelect={(uf) => setEstadoUf(uf || '')}
      />
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Sem permissão"
        message="Somente admin ou vendedor pode publicar e iniciar negociação no feed."
      />
      <PropostaEnviadaModal
        visible={showPropostaEnviada}
        isDemanda={anuncioProposta?.feed_tipo === 'demanda'}
        podeDesfazer={!!anuncioProposta?.pode_desfazer}
        desfazendo={desfazendoProposta}
        onClose={() => {
          setShowPropostaEnviada(false);
          setAnuncioProposta(null);
        }}
        onVerConvites={() => {
          setShowPropostaEnviada(false);
          setAnuncioProposta(null);
          router.push('/convites-participacao-evento');
        }}
        onDesfazer={() => {
          if (!anuncioProposta || !activeArtist?.id || desfazendoProposta) return;
          void (async () => {
            setDesfazendoProposta(true);
            const { success, error: err } = await desfazerPropostaFeed({
              eventoId: anuncioProposta.id,
              artistaInteressadoId: activeArtist.id,
            });
            setDesfazendoProposta(false);
            if (!success) {
              Alert.alert('Desfazer', err || 'Não foi possível desfazer a proposta.');
              return;
            }
            setShowPropostaEnviada(false);
            setAnuncioProposta(null);
            void load();
          })();
        }}
      />
      <Modal
        visible={showPublicarOpcoes}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPublicarOpcoes(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setShowPublicarOpcoes(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Publicar no feed</Text>
            <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>
              Escolha o tipo de publicação
            </Text>

            <TouchableOpacity
              style={[styles.optionCard, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => handleEscolherPublicacao('/feed/publicar-midia')}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIcon, { backgroundColor: `${colors.primary}18` }]}>
                <Ionicons name="images-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Foto ou vídeo</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                  Publique uma foto ou um vídeo normal no feed.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => handleEscolherPublicacao('/publicar-feed', 'disponivel')}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#0F766E18' }]}>
                <Ionicons name="briefcase-outline" size={22} color="#0F766E" />
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Oferecer</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                  Oferecendo artista, banda, músico, serviço, parceria etc.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={() => handleEscolherPublicacao('/publicar-feed', 'demanda')}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIcon, { backgroundColor: '#4F46E518' }]}>
                <Ionicons name="search" size={22} color="#4F46E5" />
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Procurar</Text>
                <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                  Buscando artista, músico, banda, serviço, parceria etc.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowPublicarOpcoes(false)}>
              <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <SocialCommentsModal
        visible={!!commentsPost}
        post={commentsPost}
        onClose={() => setCommentsPost(null)}
        onCommentsCountChange={handleCommentsCountChange}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', paddingHorizontal: 16, marginBottom: 10 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  chipPerfil: {
    paddingLeft: 6,
    gap: 6,
  },
  chipAvatarWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  chipAvatar: {
    width: '100%',
    height: '100%',
  },
  chipAvatarFallback: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarInitial: {
    fontSize: 11,
    fontWeight: '800',
  },
  geoRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  geoField: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  geoUf: { width: 78 },
  geoCity: { flex: 1 },
  geoFieldText: { flex: 1, fontSize: 14, fontWeight: '700' },
  geoInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
    minWidth: 0,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 96 },
  emptyList: { flexGrow: 1, padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 10,
    overflow: 'hidden',
  },
  typeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 10,
    marginBottom: 2,
  },
  typeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCopy: { flex: 1, minWidth: 0 },
  typeTitle: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  typeDesc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  propostasResumo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stackAvatarImg: { width: 20, height: 20, borderRadius: 10 },
  countPillText: { fontSize: 12, fontWeight: '600' },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  artistInfo: { flex: 1, minWidth: 0 },
  artistName: { fontSize: 16, fontWeight: '800' },
  metaBlock: { gap: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flex: 1, fontSize: 13, fontWeight: '600' },
  notes: { fontSize: 14, lineHeight: 20 },
  mediaKind: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  mediaPreview: {
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 220,
  },
  mediaImage: { width: '100%', height: 280 },
  mediaVideoBox: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  mediaVideoText: { fontSize: 15, fontWeight: '700' },
  propostasBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 8,
  },
  propostaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  propostaAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  propostaAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  propostaNome: { fontSize: 14, fontWeight: '700' },
  propostaMeta: { fontSize: 12, marginTop: 1 },
  btnPrimary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnOutline: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnOutlineText: { fontWeight: '800', fontSize: 14 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  sheetSub: { fontSize: 14, marginTop: 4, marginBottom: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '800' },
  optionDesc: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  sheetCancel: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  sheetCancelText: { fontSize: 15, fontWeight: '700' },
});
