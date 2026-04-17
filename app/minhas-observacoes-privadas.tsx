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
import { useTheme } from '../contexts/ThemeContext';
import {
  listarAvaliacoesPublicasArtistaParaConvite,
  type AvaliacaoPublicaArtistaConvite,
} from '../services/supabase/conviteParticipacaoEventoService';
import { useActiveArtist } from '../services/useActiveArtist';

export default function MinhasObservacoesPrivadasScreen() {
  const { colors } = useTheme();
  const { activeArtist } = useActiveArtist();
  const [itens, setItens] = useState<AvaliacaoPublicaArtistaConvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeArtist?.id) {
      setItens([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const { avaliacoes, error: err } = await listarAvaliacoesPublicasArtistaParaConvite(activeArtist.id, 80);
    setError(err);
    setItens(avaliacoes);
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

  if (!activeArtist) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Comentários recebidos</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>Selecione um artista em Configurações.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Comentários recebidos</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[styles.intro, { color: colors.textSecondary }]}>
        Comentários públicos que outros artistas deixaram sobre este perfil depois dos eventos.
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.error }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(item) => `${item.artista_avaliador_id}-${item.criado_em}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={itens.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="document-text-outline" size={44} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum comentário ainda</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Quando alguém avaliar este artista e escrever comentário público, ele aparecerá aqui.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <Text style={[styles.cardPartner, { color: colors.text }]} numberOfLines={1}>
                  {item.artista_avaliador_nome}
                </Text>
                <Text style={[styles.cardStars, { color: '#F59E0B' }]}>
                  {'★'.repeat(Math.max(1, Math.min(5, Math.round(item.nota_geral))))}
                </Text>
              </View>
              <Text style={[styles.cardEvent, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.nome_evento || 'Evento'}
              </Text>
              <Text style={[styles.cardNote, { color: colors.text }]}>{item.comentario_publico}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  intro: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  emptyList: { flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '700' },
  emptySub: { marginTop: 8, textAlign: 'center', maxWidth: 300, lineHeight: 20 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 4,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  cardPartner: { flex: 1, fontSize: 16, fontWeight: '800' },
  cardStars: { fontSize: 12, fontWeight: '800' },
  cardEvent: { fontSize: 12, marginBottom: 8 },
  cardNote: { fontSize: 14, lineHeight: 20 },
});
