import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import OptimizedImage from '../components/OptimizedImage';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { getEventById } from '../services/supabase/eventService';
import {
  buscarArtistasParaConvite,
  enviarConviteParticipacao,
  listarConvitesDoEvento,
  type ArtistaBuscaConvite,
} from '../services/supabase/conviteParticipacaoEventoService';
import { useActiveArtist } from '../services/useActiveArtist';
import { brazilMobileDigits, maskBrazilMobile } from '../utils/brazilPhone';
import { extractNumericValueString, formatCurrencyBRLInput } from '../utils/currencyBRLInput';

export default function ConvidarColaboradorEventoScreen() {
  const { colors } = useTheme();
  const { activeArtist } = useActiveArtist();
  const { eventId } = useLocalSearchParams<{ eventId: string }>();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [eventData, setEventData] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canInvite, setCanInvite] = useState(false);

  const [search, setSearch] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ArtistaBuscaConvite[]>([]);
  const [blockedArtists, setBlockedArtists] = useState<Set<string>>(new Set());
  const [selectedArtist, setSelectedArtist] = useState<{ id: string; name: string } | null>(null);

  const [cacheDraft, setCacheDraft] = useState('R$ 0,00');
  const [whatsDraft, setWhatsDraft] = useState('');
  const [functionDraft, setFunctionDraft] = useState('');
  const [messageDraft, setMessageDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!eventId || !activeArtist?.id) {
        setLoading(false);
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;
      if (!userId) {
        if (!cancelled) {
          setLoading(false);
          Alert.alert('Erro', 'Usuário não autenticado.');
          router.back();
        }
        return;
      }
      const eventRes = await getEventById(eventId);
      if (!eventRes.success || !eventRes.event) {
        if (!cancelled) {
          setLoading(false);
          Alert.alert('Erro', 'Evento não encontrado.');
          router.back();
        }
        return;
      }
      const event = eventRes.event;
      const { data: member } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', userId)
        .eq('artist_id', activeArtist.id)
        .maybeSingle();
      const canCreate = ['owner', 'admin', 'editor'].includes(member?.role || '');
      const allowed = canCreate && event.artist_id === activeArtist.id;
      if (!cancelled) {
        setCurrentUserId(userId);
        setCanInvite(allowed);
        setEventData(event);
        setWhatsDraft(maskBrazilMobile(event?.contractor_phone ?? ''));
        setLoading(false);
      }
      if (!allowed) {
        Alert.alert('Acesso restrito', 'Somente o organizador com permissão pode convidar colaborador.');
        router.back();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, activeArtist?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!eventData?.id) return;
      const { convites } = await listarConvitesDoEvento(eventData.id);
      const blocked = new Set(
        (convites || [])
          .filter((c) => c.status === 'pendente' || c.status === 'aceito')
          .map((c) => c.artista_convidado_id)
      );
      if (!cancelled) setBlockedArtists(blocked);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventData?.id]);

  useEffect(() => {
    if (!canInvite || !eventData?.artist_id) return;
    const t = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      const { artists, error } = await buscarArtistasParaConvite(search, eventData.artist_id);
      const filtered = artists.filter((a) => !blockedArtists.has(a.id));
      setSearchResults(filtered);
      setSearchError(error);
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [search, canInvite, eventData?.artist_id, blockedArtists]);

  const selectedLabel = useMemo(() => selectedArtist?.name || 'Nenhum', [selectedArtist]);

  const handleSubmit = async () => {
    if (!eventData || !activeArtist || !currentUserId || !selectedArtist) return;
    const cacheDigits = extractNumericValueString(cacheDraft);
    const cacheNumerico = cacheDigits ? Number(cacheDigits) : NaN;
    if (!cacheDraft.trim() || Number.isNaN(cacheNumerico) || cacheNumerico <= 0) {
      Alert.alert('Cachê obrigatório', 'Informe um valor de cachê válido para enviar o convite.');
      return;
    }
    if (!functionDraft.trim()) {
      Alert.alert('Função obrigatória', 'Informe a função do participante.');
      return;
    }
    const whatsDigits = brazilMobileDigits(whatsDraft);
    if (whatsDigits.length > 0 && whatsDigits.length !== 11) {
      Alert.alert('WhatsApp incompleto', 'Informe (XX) XXXXX-XXXX ou deixe vazio.');
      return;
    }
    setSending(true);
    const { success, error } = await enviarConviteParticipacao({
      eventoOrigemId: eventData.id,
      artistaQueConvidaId: activeArtist.id,
      artistaConvidadoId: selectedArtist.id,
      usuarioQueEnviaId: currentUserId,
      mensagem: messageDraft.trim() || null,
      funcaoParticipacao: functionDraft.trim(),
      nomeEvento: eventData.name,
      dataEvento: eventData.event_date,
      horaInicio: eventData.start_time,
      horaFim: eventData.end_time,
      cacheValor: cacheNumerico,
      cidade: eventData.city ?? null,
      telefoneContratante: whatsDigits.length === 11 ? maskBrazilMobile(whatsDraft) : null,
      descricao: eventData.description ?? null,
    });
    setSending(false);
    if (!success) {
      Alert.alert('Erro', error || 'Não foi possível enviar o convite.');
      return;
    }
    Alert.alert('Convite enviado', 'O colaborador foi convidado com sucesso.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Convidar colaborador</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.text }]}>Buscar artista</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Nome do artista..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />

          {searchLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          ) : (
            <FlatList
              style={{ maxHeight: 210, marginTop: 6 }}
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ color: searchError ? colors.error : colors.textSecondary, paddingVertical: 10 }}>
                  {searchError || (search.trim().length < 2 ? 'Digite pelo menos 2 letras.' : 'Nenhum artista encontrado.')}
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.border }]}
                  onPress={() => setSelectedArtist({ id: item.id, name: item.name })}
                >
                  <View style={styles.rowContent}>
                    <OptimizedImage
                      imageUrl={item.image_url ?? item.profile_url ?? ''}
                      style={styles.rowAvatar}
                      fallbackIcon="person"
                      fallbackIconSize={18}
                      fallbackIconColor={colors.primary}
                      showLoadingIndicator={false}
                    />
                    <Text style={{ color: colors.text, fontWeight: selectedArtist?.id === item.id ? '700' : '500', flex: 1 }}>
                      {item.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          <Text style={[styles.selected, { color: colors.textSecondary }]}>Convidando: {selectedLabel}</Text>

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="R$ 0,00"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={cacheDraft}
            onChangeText={(t) => setCacheDraft(formatCurrencyBRLInput(t))}
          />
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="(XX) XXXXX-XXXX"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            value={whatsDraft}
            onChangeText={(t) => setWhatsDraft(maskBrazilMobile(t))}
          />
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Função (ex.: violão, voz, percussão)"
            placeholderTextColor={colors.textSecondary}
            value={functionDraft}
            onChangeText={setFunctionDraft}
          />
          <TextInput
            style={[styles.input, styles.messageInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Mensagem (opcional)"
            placeholderTextColor={colors.textSecondary}
            value={messageDraft}
            onChangeText={setMessageDraft}
            multiline
          />

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btnSecondary, { borderColor: colors.border }]} onPress={() => router.back()}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: colors.primary, opacity: selectedArtist ? 1 : 0.45 }]}
              onPress={() => void handleSubmit()}
              disabled={!selectedArtist || sending}
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Enviar convite</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 28 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 17,
  },
  messageInput: { minHeight: 88, textAlignVertical: 'top' },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowAvatar: { width: 34, height: 34, borderRadius: 17 },
  selected: { marginTop: 10, marginBottom: 12, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    flex: 1.2,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
