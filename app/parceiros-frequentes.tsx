import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';
import OptimizedImage from '../components/OptimizedImage';
import { useTheme } from '../contexts/ThemeContext';
import { formatCalendarDate } from '../lib/dateUtils';
import {
  listarParceirosFrequentesParticipacao,
  type ParceiroFrequenteParticipacao,
} from '../services/supabase/conviteParticipacaoEventoService';
import { useActiveArtist } from '../services/useActiveArtist';

const SCREEN_W = Dimensions.get('window').width;
const MAX_ROWS_SHARE = 28;

/** Ouro: coroa · 2º: prata · 3º: bronze · demais: número. */
function PodiumRankVisual({
  index,
  compact,
}: {
  index: number;
  /** Layout mais estreito na imagem compartilhada. */
  compact?: boolean;
}) {
  const crownSize = compact ? 24 : 28;
  const medalSize = compact ? 22 : 26;
  if (index === 0) {
    return <MaterialCommunityIcons name="crown" size={crownSize} color="#CA8A04" />;
  }
  if (index === 1) {
    return <MaterialCommunityIcons name="medal" size={medalSize} color="#94A3B8" />;
  }
  if (index === 2) {
    return <MaterialCommunityIcons name="medal" size={medalSize} color="#B45309" />;
  }
  return (
    <Text
      style={{
        fontSize: compact ? 14 : 16,
        fontWeight: '700',
        color: '#6B7280',
        minWidth: compact ? 22 : 24,
        textAlign: 'center',
      }}
    >
      {index + 1}
    </Text>
  );
}

function partnerSubtitleForShare(item: ParceiroFrequenteParticipacao): string {
  const funcoes =
    item.funcoesParticipacao.length > 0
      ? item.funcoesParticipacao.join(' · ')
      : item.ultima_funcao != null
        ? item.ultima_funcao
        : null;
  const lines: string[] = [];
  if (funcoes) {
    lines.push(
      item.funcoesParticipacao.length > 1 ? `Funções: ${funcoes}` : `Função: ${funcoes}`
    );
  }
  if (item.participacao_data_evento) {
    lines.push(`Último show: ${formatCalendarDate(item.participacao_data_evento)}`);
  }
  return lines.join('\n');
}

function ParceirosFrequentesShareCapture({
  partners,
  artistName,
  totalInApp,
}: {
  partners: ParceiroFrequenteParticipacao[];
  artistName: string;
  totalInApp: number;
}) {
  const now = new Date();
  const footer = `Gerado em ${now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · Marca AI`;
  const omitted = totalInApp > partners.length ? totalInApp - partners.length : 0;

  return (
    <View style={shareStyles.sheet} collapsable={false}>
      <Text style={shareStyles.title}>Parceiros frequentes</Text>
      <Text style={shareStyles.subtitle}>Perfil: {artistName}</Text>
      <Text style={shareStyles.caption}>Convites de participação aceitos neste perfil.</Text>
      {omitted > 0 ? (
        <Text style={shareStyles.omitted}>Imagem com os primeiros {partners.length}; mais {omitted} no app.</Text>
      ) : null}

      {partners.map((item, index) => {
        const uri = (item.image_url || item.profile_url || '').trim();
        const sub = partnerSubtitleForShare(item);
        return (
          <View key={item.id} style={shareStyles.row}>
            <View style={shareStyles.rankIconWrap}>
              <PodiumRankVisual index={index} compact />
            </View>
            {uri ? (
              <Image source={{ uri }} style={shareStyles.avatar} contentFit="cover" />
            ) : (
              <View style={[shareStyles.avatar, shareStyles.avatarFallback]}>
                <Text style={shareStyles.avatarLetter}>{(item.name || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={shareStyles.rowBody}>
              <Text style={shareStyles.name} numberOfLines={2}>
                {item.name}
              </Text>
              {sub ? (
                <Text style={shareStyles.detail} numberOfLines={5}>
                  {sub}
                </Text>
              ) : null}
            </View>
            <View style={shareStyles.badge}>
              <Text style={shareStyles.badgeNum}>{item.totalParticipacoesAceitas}</Text>
              <Text style={shareStyles.badgeLbl}>
                {item.totalParticipacoesAceitas === 1 ? 'show' : 'shows'}
              </Text>
            </View>
          </View>
        );
      })}

      <Text style={shareStyles.footer}>{footer}</Text>
    </View>
  );
}

const shareStyles = StyleSheet.create({
  sheet: {
    width: SCREEN_W,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  caption: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  omitted: {
    fontSize: 11,
    color: '#7C3AED',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rankIconWrap: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7C3AED',
  },
  rowBody: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  detail: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
    lineHeight: 16,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    marginTop: 4,
  },
  badgeNum: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B21B6',
  },
  badgeLbl: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  footer: {
    marginTop: 16,
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default function ParceirosFrequentesScreen() {
  const { colors, isDarkMode } = useTheme();
  const { activeArtist } = useActiveArtist();
  const [partners, setPartners] = useState<ParceiroFrequenteParticipacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharingImage, setSharingImage] = useState(false);
  const shareCaptureRef = useRef<View>(null);

  const load = useCallback(async () => {
    if (!activeArtist?.id) {
      setPartners([]);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { partners: list, error: err } = await listarParceirosFrequentesParticipacao(activeArtist.id, 40);
    setError(err);
    setPartners(list);
    setLoading(false);
    setRefreshing(false);
  }, [activeArtist?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleShareImage = useCallback(async () => {
    if (!activeArtist?.name || partners.length === 0) {
      Alert.alert('Lista vazia', 'Não há parceiros para compartilhar.');
      return;
    }
    const node = shareCaptureRef.current;
    if (!node) {
      Alert.alert('Aguarde', 'Tente compartilhar novamente em instantes.');
      return;
    }
    try {
      setSharingImage(true);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => setTimeout(r, Platform.OS === 'android' ? 320 : 200));
      const uri = await captureRef(node, {
        format: 'png',
        quality: 0.92,
        result: 'tmpfile',
      });
      const ok = await Sharing.isAvailableAsync();
      if (!ok) {
        Alert.alert('Indisponível', 'Compartilhamento não está disponível neste dispositivo.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartilhar parceiros frequentes',
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar ou compartilhar a imagem.');
    } finally {
      setSharingImage(false);
    }
  }, [activeArtist?.name, partners.length]);

  const partnersForShare = partners.slice(0, MAX_ROWS_SHARE);

  const renderItem = ({ item, index }: { item: ParceiroFrequenteParticipacao; index: number }) => {
    const img = item.image_url || item.profile_url || '';
    const funcoes =
      item.funcoesParticipacao.length > 0
        ? item.funcoesParticipacao.join(' · ')
        : item.ultima_funcao != null
          ? item.ultima_funcao
          : null;
    const subLinhas: string[] = [];
    if (funcoes) {
      subLinhas.push(
        item.funcoesParticipacao.length > 1
          ? `Funções: ${funcoes}`
          : `Função: ${funcoes}`
      );
    }
    if (item.participacao_data_evento) {
      subLinhas.push(`Último show: ${formatCalendarDate(item.participacao_data_evento)}`);
    }
    const sub = subLinhas.length > 0 ? subLinhas.join('\n') : null;

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.rankPodium}>
          <PodiumRankVisual index={index} />
        </View>
        <View style={styles.cardLeft}>
          <OptimizedImage
            imageUrl={img}
            style={styles.avatar}
            cacheKey={`freq_partner_${item.id}`}
            fallbackText={item.name}
            fallbackIcon="person"
            fallbackIconSize={22}
            fallbackIconColor={colors.primary}
            showLoadingIndicator={false}
          />
          <View style={styles.cardText}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            {sub ? (
              <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={4}>
                {sub}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: isDarkMode ? '#2D2D3A' : '#EDE9FE' }]}>
          <Text style={[styles.badgeNum, { color: '#7C3AED' }]}>{item.totalParticipacoesAceitas}</Text>
          <Text style={[styles.badgeLbl, { color: colors.textSecondary }]}>
            {item.totalParticipacoesAceitas === 1 ? 'show' : 'shows'}
          </Text>
        </View>
      </View>
    );
  };

  const canShare = Boolean(activeArtist?.id && !loading && !error && partners.length > 0);

  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Parceiros frequentes</Text>
          {canShare ? (
            <TouchableOpacity
              onPress={() => void handleShareImage()}
              hitSlop={12}
              style={styles.shareBtn}
              disabled={sharingImage}
              accessibilityLabel="Compartilhar imagem da lista"
            >
              {sharingImage ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="share-outline" size={24} color={colors.primary} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Artistas que mais aceitaram participar em eventos do perfil atual ({activeArtist?.name ?? '—'}), com base em
          convites aceitos.
        </Text>

        {!activeArtist?.id ? (
          <View style={styles.center}>
            <Ionicons name="person-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Selecione um artista</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Em Configurações, use &quot;Selecionar Artista&quot; para ver os parceiros deste perfil.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: colors.error, textAlign: 'center', paddingHorizontal: 24 }}>{error}</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary, marginTop: 8 }]}>
              Confirme se a função listar_parceiros_frequentes_participacao foi aplicada no Supabase.
            </Text>
          </View>
        ) : (
          <FlatList
            data={partners}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={partners.length === 0 ? styles.emptyList : styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum parceiro ainda</Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                  Quando outros artistas aceitarem participação nos seus eventos, eles aparecerão aqui ordenados por
                  quantidade de shows juntos.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {activeArtist?.name && partnersForShare.length > 0 ? (
        <View
          ref={shareCaptureRef}
          collapsable={false}
          style={styles.shareCaptureHost}
          pointerEvents="none"
        >
          <ParceirosFrequentesShareCapture
            partners={partnersForShare}
            artistName={activeArtist.name}
            totalInApp={partners.length}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  /** Fora da tela, opaco, para o view-shot rasterizar o layout completo. */
  shareCaptureHost: {
    position: 'absolute',
    left: -10000,
    top: 0,
    opacity: 1,
    width: SCREEN_W,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8 },
  shareBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  list: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 12 },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  rankPodium: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  cardText: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 2 },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  badgeNum: { fontSize: 18, fontWeight: '700' },
  badgeLbl: { fontSize: 11, marginTop: 2 },
});
