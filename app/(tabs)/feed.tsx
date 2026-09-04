import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OptimizedImage from '../../components/OptimizedImage';
import PermissionModal from '../../components/PermissionModal';
import BrazilStatePickerModal from '../../components/BrazilStatePickerModal';
import { usePermissions } from '../../contexts/PermissionsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { formatEventLocationSlash } from '../../lib/brazilGeo';
import { formatCalendarDate } from '../../lib/dateUtils';
import {
  encerrarAnuncioFeed,
  listarFeedMarketplace,
  type FeedAnuncio,
  type FeedFiltro,
} from '../../services/supabase/feedMarketplaceService';
import { useActiveArtist } from '../../services/useActiveArtist';

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
  const { activeArtist } = useActiveArtist();
  const { canCreateEvents } = usePermissions();
  const [filtro, setFiltro] = useState<FeedFiltro>('todos');
  const [estadoUf, setEstadoUf] = useState('');
  const [cidade, setCidade] = useState('');
  const [showEstados, setShowEstados] = useState(false);
  const [anuncios, setAnuncios] = useState<FeedAnuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showPublicarOpcoes, setShowPublicarOpcoes] = useState(false);

  const load = useCallback(async () => {
    const { anuncios: list, error: err } = await listarFeedMarketplace({
      filtro,
      estadoUf,
      cidade,
      artistaAtualId: activeArtist?.id ?? null,
    });
    setAnuncios(list);
    setError(err);
    setLoading(false);
    setRefreshing(false);
  }, [filtro, estadoUf, cidade, activeArtist?.id]);

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
    return 'Ainda não há publicações no feed.';
  }, [filtro]);

  const handlePublicar = () => {
    if (!activeArtist) {
      Alert.alert('Artista', 'Selecione um artista nas Configurações para publicar.');
      return;
    }
    setShowPublicarOpcoes(true);
  };

  const handleEscolherPublicacao = (
    destino: '/publicar-midia-feed' | '/publicar-feed',
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
    router.push('/publicar-midia-feed');
  };

  const isMeuAnuncio = (item: FeedAnuncio) =>
    item.is_mine || (!!activeArtist?.id && item.artist_id === activeArtist.id);

  const handleNegociar = (item: FeedAnuncio) => {
    if (isMeuAnuncio(item)) {
      Alert.alert('Seu anúncio', 'Você não pode iniciar negociação na sua própria publicação.');
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

  const renderItem = ({ item }: { item: FeedAnuncio }) => {
    const isDemanda = item.feed_tipo === 'demanda';
    const meuAnuncio = isMeuAnuncio(item);
    const badgeColor = isDemanda ? '#C2410C' : '#0F766E';
    const location = formatEventLocationSlash({
      city: item.city,
      state_uf: item.state_uf,
    });
    const cacheTxt =
      item.meu_cache_valor != null
        ? Number(item.meu_cache_valor).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })
        : null;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: `${badgeColor}18` }]}>
            <Ionicons
              name={isDemanda ? 'search' : 'calendar-outline'}
              size={14}
              color={badgeColor}
            />
            <Text style={[styles.badgeText, { color: badgeColor }]}>
              {isDemanda ? 'Procurando' : 'Oferta'}
            </Text>
          </View>
          {meuAnuncio ? (
            <Text style={[styles.mineTag, { color: colors.primary }]}>Seu anúncio</Text>
          ) : null}
        </View>

        <View style={styles.artistRow}>
          <View style={[styles.avatarWrap, { backgroundColor: colors.secondary }]}>
            {item.artist_image ? (
              <OptimizedImage
                imageUrl={item.artist_image}
                style={styles.avatar}
                fallbackIcon="person"
                fallbackIconSize={22}
              />
            ) : (
              <Ionicons name="person" size={22} color={colors.primary} />
            )}
          </View>
          <View style={styles.artistInfo}>
            <Text style={[styles.artistName, { color: colors.text }]} numberOfLines={1}>
              {item.artist_name}
            </Text>
            {item.musical_style ? (
              <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.musical_style}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={[styles.dateText, { color: colors.text }]}>
          {formatCalendarDate(item.event_date)}
          {item.start_time ? ` · ${formatTime(item.start_time)}–${formatTime(item.end_time)}` : ''}
        </Text>
        {location ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{location}</Text>
        ) : null}
        {item.description ? (
          <Text style={[styles.notes, { color: colors.text }]} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}

        <View style={[styles.lockRow, { backgroundColor: `${colors.primary}10` }]}>
          <Ionicons
            name={meuAnuncio && cacheTxt ? 'eye-outline' : item.tem_cache ? 'lock-closed' : 'chatbubble-ellipses-outline'}
            size={14}
            color={colors.primary}
          />
          <Text style={[styles.lockText, { color: colors.textSecondary }]}>
            {meuAnuncio
              ? cacheTxt
                ? `Seu cachê (só você vê): ${cacheTxt}`
                : 'Você não informou cachê. Para os outros aparece “a combinar”.'
              : item.tem_cache
                ? 'Cachê oculto. Aparece quando alguém iniciar a conversa.'
                : 'Cachê a combinar'}
          </Text>
        </View>

        {meuAnuncio ? (
          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: colors.error }]}
            onPress={() => handleEncerrar(item)}
          >
            <Text style={[styles.btnOutlineText, { color: colors.error }]}>Encerrar anúncio</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
            onPress={() => handleNegociar(item)}
          >
            <Text style={styles.btnPrimaryText}>
              {isDemanda ? 'Quero me candidatar' : 'Tenho interesse'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Feed</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {FILTROS.find((item) => item.id === filtro)?.descricao}
        </Text>
      </View>

      <View style={styles.filters}>
        <FlatList
          horizontal
          data={FILTROS}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => {
            const active = filtro === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFiltro(item.id)}
              >
                <Text style={[styles.chipText, { color: active ? '#fff' : colors.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
        <View style={styles.geoBlock}>
          <View style={styles.geoRow}>
            <View style={styles.geoCol}>
              <Text style={[styles.geoLabel, { color: colors.textSecondary }]}>Estado</Text>
              <TouchableOpacity
                style={[
                  styles.geoField,
                  {
                    backgroundColor: colors.surface,
                    borderColor: estadoUf ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setShowEstados(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="map-outline" size={16} color={colors.primary} />
                <Text
                  style={[
                    styles.geoFieldText,
                    { color: estadoUf ? colors.text : colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {estadoUf || 'UF'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.geoColWide}>
              <Text style={[styles.geoLabel, { color: colors.textSecondary }]}>Cidade</Text>
              <View
                style={[
                  styles.geoField,
                  {
                    backgroundColor: colors.surface,
                    borderColor: cidade.trim() ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <TextInput
                  value={cidade}
                  onChangeText={setCidade}
                  placeholder="Todas"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.geoInput, { color: colors.text }]}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {cidade.trim() ? (
                  <TouchableOpacity onPress={() => setCidade('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
          {estadoUf || cidade.trim() ? (
            <TouchableOpacity
              style={styles.geoClear}
              onPress={() => {
                setEstadoUf('');
                setCidade('');
              }}
            >
              <Ionicons name="close" size={14} color={colors.primary} />
              <Text style={[styles.geoClearText, { color: colors.primary }]}>Limpar local</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {!activeArtist ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={42} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Selecione um artista</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            O feed usa o artista ativo nas Configurações.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={42} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Não foi possível carregar</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{error}</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Se ainda não rodou o SQL do feed no Supabase, execute database/FEED_MARKETPLACE.sql.
          </Text>
          <TouchableOpacity onPress={() => void load()}>
            <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 12 }}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={anuncios}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={anuncios.length === 0 ? styles.emptyList : styles.list}
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
              <Ionicons name="newspaper-outline" size={46} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Feed vazio</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{emptyCopy}</Text>
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
              onPress={() => handleEscolherPublicacao('/publicar-midia-feed')}
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
              <View style={[styles.optionIcon, { backgroundColor: '#C2410C18' }]}>
                <Ionicons name="search" size={22} color="#C2410C" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  filters: { paddingBottom: 8 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  geoBlock: {
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  geoRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  geoCol: { width: 108 },
  geoColWide: { flex: 1 },
  geoLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 2,
  },
  geoField: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  geoFieldText: { flex: 1, fontSize: 15, fontWeight: '700' },
  geoInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
    minWidth: 0,
  },
  geoClear: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  geoClearText: { fontSize: 12, fontWeight: '700' },
  list: { padding: 16, paddingBottom: 96 },
  emptyList: { flexGrow: 1, padding: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  mineTag: { fontSize: 12, fontWeight: '700' },
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
  artistInfo: { flex: 1 },
  artistName: { fontSize: 16, fontWeight: '700' },
  dateText: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13 },
  notes: { fontSize: 14, lineHeight: 20 },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  lockText: { flex: 1, fontSize: 12, lineHeight: 16 },
  btnPrimary: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnOutline: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
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
