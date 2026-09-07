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
import PropostaEnviadaModal from '../components/PropostaEnviadaModal';
import { ARTIST_WORK_ROLE_PRESETS } from '../constants/artistProfileLists';
import { usePermissions } from '../contexts/PermissionsContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatEventLocationSlash } from '../lib/brazilGeo';
import { formatCalendarDate } from '../lib/dateUtils';
import {
  desfazerPropostaFeed,
  iniciarNegociacaoFeed,
  isErroPropostaDuplicada,
  listarFeedMarketplace,
  type FeedAnuncio,
} from '../services/supabase/feedMarketplaceService';
import { useActiveArtist } from '../services/useActiveArtist';
import { buildWhatsAppUrl, openWhatsAppConversation } from '../utils/brazilPhone';

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
  const [showPropostaEnviada, setShowPropostaEnviada] = useState(false);
  const [desfazendoProposta, setDesfazendoProposta] = useState(false);

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
        eventoDetalheId: eventId,
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
      const proprio = !!activeArtist?.id && found.artist_id === activeArtist.id;
      if (proprio) {
        Alert.alert('Seu anúncio', 'Você não pode iniciar negociação na sua própria publicação.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      if (found.ja_proposei) {
        setShowPropostaEnviada(true);
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

  const whatsappUrl = useMemo(
    () => buildWhatsAppUrl(anuncio?.artist_whatsapp),
    [anuncio?.artist_whatsapp]
  );

  const submit = async () => {
    if (!anuncio || !activeArtist?.id) return;
    if (anuncio.artist_id === activeArtist.id) {
      Alert.alert('Seu anúncio', 'Você não pode negociar a própria publicação.');
      return;
    }
    if (!canCreateEvents) {
      Alert.alert('Sem permissão', 'Somente admin ou vendedor pode iniciar negociação.');
      return;
    }
    const estaOferecendo = anuncio.feed_tipo === 'demanda';
    if (estaOferecendo && !funcao.trim()) {
      Alert.alert('Função', 'Informe a função que você está oferecendo (ex.: Vocalista).');
      return;
    }
    setSending(true);
    const result = await iniciarNegociacaoFeed({
      eventoId: anuncio.id,
      artistaInteressadoId: activeArtist.id,
      funcaoParticipacao: estaOferecendo ? funcao : 'Interesse',
      mensagem,
    });
    setSending(false);
    if (!result.success) {
      if (isErroPropostaDuplicada(result.error)) {
        setShowPropostaEnviada(true);
        return;
      }
      Alert.alert('Erro', result.error || 'Não foi possível enviar o interesse.');
      return;
    }
    router.back();
  };

  const fecharPropostaEnviada = () => {
    setShowPropostaEnviada(false);
    router.back();
  };

  const handleDesfazerProposta = async () => {
    if (!anuncio || !activeArtist?.id || desfazendoProposta) return;
    setDesfazendoProposta(true);
    const { success, error } = await desfazerPropostaFeed({
      eventoId: anuncio.id,
      artistaInteressadoId: activeArtist.id,
    });
    setDesfazendoProposta(false);
    if (!success) {
      Alert.alert('Desfazer', error || 'Não foi possível desfazer a proposta.');
      return;
    }
    setShowPropostaEnviada(false);
    router.back();
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
              {anuncio.feed_funcoes.length > 0 ? (
                <View style={styles.funcoesWrap}>
                  {anuncio.feed_funcoes.map((funcao) => (
                    <View
                      key={funcao}
                      style={[styles.funcaoChip, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}33` }]}
                    >
                      <Text style={[styles.funcaoChipText, { color: colors.primary }]}>{funcao}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {anuncio.description ? (
                <Text style={[styles.notes, { color: colors.text }]}>{anuncio.description}</Text>
              ) : null}
              <View style={[styles.lockRow, { backgroundColor: `${colors.primary}12` }]}>
                <Ionicons name="cash-outline" size={16} color={colors.primary} />
                <Text style={[styles.lockText, { color: colors.textSecondary }]}>
                  Cachê:{' '}
                  {Number(anuncio.cache_valor ?? 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                  . Ao aceitar, entra como despesa na agenda.
                </Text>
              </View>
              {whatsappUrl ? (
                <TouchableOpacity
                  style={[styles.whatsappBtn, { borderColor: '#16A34A', backgroundColor: '#16A34A10' }]}
                  onPress={() => void openWhatsAppConversation(anuncio.artist_whatsapp)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#16A34A" />
                  <Text style={styles.whatsappBtnText}>Chamar no WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {anuncio.feed_tipo === 'demanda' ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>
                  Função que você está oferecendo
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.roles}
                >
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
                        <Text
                          style={{
                            color: active ? '#fff' : colors.text,
                            fontWeight: '700',
                            fontSize: 13,
                          }}
                        >
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
              </>
            ) : null}

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
                <Text style={styles.submitText}>Confirmar interesse</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <PropostaEnviadaModal
        visible={showPropostaEnviada}
        isDemanda={anuncio?.feed_tipo === 'demanda'}
        podeDesfazer={!!anuncio?.pode_desfazer || anuncio?.ja_proposei}
        desfazendo={desfazendoProposta}
        onClose={fecharPropostaEnviada}
        onVerConvites={() => {
          setShowPropostaEnviada(false);
          router.replace('/convites-participacao-evento');
        }}
        onDesfazer={() => void handleDesfazerProposta()}
      />
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
  funcoesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  funcaoChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  funcaoChipText: { fontSize: 12, fontWeight: '700' },
  lockRow: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  lockText: { flex: 1, fontSize: 13, lineHeight: 18 },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 6,
  },
  whatsappBtnText: { color: '#16A34A', fontWeight: '800', fontSize: 14 },
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
