import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OptimizedImage from '../components/OptimizedImage';
import { useTheme } from '../contexts/ThemeContext';
import { formatCalendarDate } from '../lib/dateUtils';
import {
  listarParceirosFrequentesParticipacao,
  type ParceiroFrequenteParticipacao,
} from '../services/supabase/conviteParticipacaoEventoService';
import { useActiveArtist } from '../services/useActiveArtist';

export default function ParceirosFrequentesScreen() {
  const { colors, isDarkMode } = useTheme();
  const { activeArtist } = useActiveArtist();
  const [partners, setPartners] = useState<ParceiroFrequenteParticipacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const renderItem = ({ item }: { item: ParceiroFrequenteParticipacao }) => {
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Parceiros frequentes</Text>
        <View style={{ width: 40 }} />
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
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
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
