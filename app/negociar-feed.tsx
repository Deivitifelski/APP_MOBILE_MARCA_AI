import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ARTIST_WORK_ROLE_PRESETS } from '../constants/artistProfileLists';
import { usePermissions } from '../contexts/PermissionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatEventLocationSlash } from '../lib/brazilGeo';
import { formatCalendarDate } from '../lib/dateUtils';
import {
  iniciarNegociacaoFeed,
  listarFeedMarketplace,
  type FeedAnuncio,
} from '../services/supabase/feedMarketplaceService';
import { useActiveArtist } from '../services/useActiveArtist';
import { formatCurrencyBRLFromAmount } from '../utils/currencyBRLInput';

function formatTime(t: string) {
  if (!t) return '';
  return String(t).slice(0, 5);
}

export default function NegociarFeedScreen() {
  const { colors } = useTheme();
  const { activeArtist } = useActiveArtist();
  const { canCreateEvents } = usePermissions();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const [anuncio, setAnuncio] = useState<FeedAnuncio | null>(null);
  const [loading, setLoading] = useState(true);
  const [funcao, setFuncao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [revealedCache, setRevealedCache] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!eventId) {
        setLoading(false);
        return;
      }
      const { anuncios, error } = await listarFeedMarketplace({
        filtro: 'todos',
        artistaAtualId: activeArtist?.id ?? null,
      });
      if (cancelled) return;
      if (error) {
        Alert.alert('Erro', error);
        setLoading(false);
        return;
      }
      const found = anuncios.find((a) => a.id === eventId) ?? null;
      setAnuncio(found);
      setLoading(false);
      if (!found) {
        Alert.alert('Anúncio', 'Este anúncio não está mais no feed.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      const proprio =
        found.is_mine ||
        (!!activeArtist?.id && found.artist_id === activeArtist.id);
      if (proprio) {
        Alert.alert('Seu anúncio', 'Você não pode iniciar negociação na sua própria publicação.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, activeArtist?.id]);

  const location = useMemo(
    () =>
      anuncio
        ? formatEventLocationSlash({ city: anuncio.city, state_uf: anuncio.state_uf })
        : '',
    [anuncio]
  );

  const submit = async () => {
    if (!anuncio || !activeArtist?.id) return;
    if (anuncio.is_mine || anuncio.artist_id === activeArtist.id) {
      Alert.alert('Seu anúncio', 'Você não pode negociar a própria publicação.');
      return;
    }
    if (!canCreateEvents) {
      Alert.alert('Sem permissão', 'Somente admin ou vendedor pode iniciar negociação.');
      return;
    }
    if (!funcao.trim()) {
      Alert.alert('Função', 'Informe a função da participação (ex.: Vocalista).');
      return;
    }
    setSending(true);
    const result = await iniciarNegociacaoFeed({
      eventoId: anuncio.id,
      artistaInteressadoId: activeArtist.id,
      funcaoParticipacao: funcao,
      mensagem,
    });
    setSending(false);
    if (!result.success) {
      Alert.alert('Erro', result.error || 'Não foi possível iniciar a negociação.');
      return;
    }
    setRevealedCache(result.cacheValor ?? null);
    const cacheTxt =
      result.cacheValor != null
        ? formatCurrencyBRLFromAmount(result.cacheValor)
        : 'definido no convite';
    const waitingOther = result.feedTipo === 'disponivel';
    Alert.alert(
      'Negociação iniciada',
      waitingOther
        ? `O cachê desta oferta é ${cacheTxt}. Quem publicou recebe o convite e precisa aceitar.`
        : `O cachê desta publicação é ${cacheTxt}. Confirme a proposta em Convites de participação para fechar.`,
      [
        {
          text: 'Ver convites',
          onPress: () => router.replace('/convites-participacao-evento'),
        },
        { text: 'OK', onPress: () => router.back() },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Negociação</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !anuncio ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>Anúncio indisponível.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.badge, { color: colors.primary }]}>
                {anuncio.feed_tipo === 'demanda' ? 'Procurando' : 'Oferta'}
              </Text>
              <Text style={[styles.name, { color: colors.text }]}>{anuncio.artist_name}</Text>
              <Text style={[styles.meta, { color: colors.text }]}>
                {formatCalendarDate(anuncio.event_date)} · {formatTime(anuncio.start_time)}–
                {formatTime(anuncio.end_time)}
              </Text>
              {location ? (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{location}</Text>
              ) : null}
              {anuncio.description ? (
                <Text style={[styles.notes, { color: colors.text }]}>{anuncio.description}</Text>
              ) : null}
              <View style={[styles.lockRow, { backgroundColor: `${colors.primary}12` }]}>
                <Ionicons
                  name={revealedCache != null ? 'lock-open' : 'lock-closed'}
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.lockText, { color: colors.textSecondary }]}>
                  {revealedCache != null
                    ? `Cachê da negociação: ${formatCurrencyBRLFromAmount(revealedCache)}`
                    : 'O cachê será revelado ao confirmar abaixo.'}
                </Text>
              </View>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Função da participação</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roles}>
              {ARTIST_WORK_ROLE_PRESETS.map((role) => {
                const active = funcao === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setFuncao(role)}
                  >
                    <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              value={funcao}
              onChangeText={setFuncao}
              placeholder="Ou escreva outra função"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
            />

            <Text style={[styles.label, { color: colors.text }]}>Mensagem (opcional)</Text>
            <TextInput
              value={mensagem}
              onChangeText={setMensagem}
              placeholder="Ex.: Posso nesse horário, confirmo rápido."
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[
                styles.input,
                styles.multiline,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
            />

            <TouchableOpacity
              style={[styles.submit, { backgroundColor: colors.primary, opacity: sending ? 0.7 : 1 }]}
              onPress={() => void submit()}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Iniciar negociação e ver cachê</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 6 },
  badge: { fontSize: 12, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800' },
  meta: { fontSize: 14 },
  notes: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  lockRow: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  lockText: { flex: 1, fontSize: 13, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 12 },
  roles: { gap: 8, paddingVertical: 4 },
  roleChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  submit: {
    marginTop: 18,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
