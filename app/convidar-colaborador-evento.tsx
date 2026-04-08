import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ESTADOS_BRASIL } from '../constants/estadosBrasil';
import { SafeAreaView } from 'react-native-safe-area-context';
import OptimizedImage from '../components/OptimizedImage';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { getEventById } from '../services/supabase/eventService';
import { parseArtistStringArrayFromJson } from '../constants/artistProfileLists';
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
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showFilterEstados, setShowFilterEstados] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ArtistaBuscaConvite[]>([]);
  const [blockedArtists, setBlockedArtists] = useState<Set<string>>(new Set());
  const [selectedArtist, setSelectedArtist] = useState<{
    id: string;
    name: string;
    location?: string | null;
    musicalStyle?: string | null;
  } | null>(null);
  const [artistLocations, setArtistLocations] = useState<Record<string, string>>({});
  const [artistStyles, setArtistStyles] = useState<Record<string, string>>({});
  const [artistWorkRoles, setArtistWorkRoles] = useState<Record<string, string[]>>({});
  const [artistShowFormats, setArtistShowFormats] = useState<Record<string, string[]>>({});

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
      const { artists, error } = await buscarArtistasParaConvite(search, eventData.artist_id, {
        cidade: filterCity,
        estado: filterState,
        funcao: filterRole,
      });
      const filtered = artists.filter((a) => !blockedArtists.has(a.id));
      setSearchResults(filtered);
      setSearchError(error);
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [search, filterCity, filterState, filterRole, canInvite, eventData?.artist_id, blockedArtists]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = searchResults.map((artist) => artist.id);
      if (ids.length === 0) {
        if (!cancelled) {
          setArtistLocations({});
          setArtistStyles({});
          setArtistWorkRoles({});
          setArtistShowFormats({});
        }
        return;
      }

      const { data: styleData } = await supabase
        .from('artists')
        .select('id, musical_style, work_roles, show_formats')
        .in('id', ids);
      if (!cancelled) {
        const nextStyles: Record<string, string> = {};
        const nextWorkRoles: Record<string, string[]> = {};
        const nextShowFormats: Record<string, string[]> = {};
        (
          (styleData as Array<{
            id: string;
            musical_style?: string | null;
            work_roles?: unknown;
            show_formats?: unknown;
          }> | null) || []
        ).forEach((row) => {
          const style = String(row.musical_style || '').trim();
          if (style) nextStyles[row.id] = style;
          nextWorkRoles[row.id] = parseArtistStringArrayFromJson(row.work_roles);
          nextShowFormats[row.id] = parseArtistStringArrayFromJson(row.show_formats);
        });
        setArtistStyles(nextStyles);
        setArtistWorkRoles(nextWorkRoles);
        setArtistShowFormats(nextShowFormats);
      }

      const fetchCityState = async () => {
        const { data, error } = await supabase.from('artists').select('id, city, state').in('id', ids);
        if (error) return { ok: false as const, rows: [] as Array<{ id: string; value: string }> };
        const rows =
          ((data as Array<{ id: string; city?: string | null; state?: string | null }> | null) || [])
            .map((row) => {
              const city = String(row.city || '').trim();
              const state = String(row.state || '').trim().toUpperCase();
              const value = city && state ? `${city}/${state}` : city || state;
              return { id: row.id, value };
            })
            .filter((row) => row.value.length > 0);
        return { ok: true as const, rows };
      };

      const fetchByColumn = async (column: 'city' | 'location') => {
        const { data, error } = await supabase.from('artists').select(`id, ${column}`).in('id', ids);
        if (error) return { ok: false as const, rows: [] as Array<{ id: string; value: string }> };
        const rows =
          ((data as Array<{ id: string; city?: string | null; location?: string | null }> | null) || [])
            .map((row) => ({
              id: row.id,
              value: String((column === 'city' ? row.city : row.location) || '').trim(),
            }))
            .filter((row) => row.value.length > 0);
        return { ok: true as const, rows };
      };

      const fetchFromMembersUserProfile = async () => {
        const { data, error } = await supabase
          .from('artist_members')
          .select('artist_id, role, users(city, state)')
          .in('artist_id', ids);
        if (error) return { ok: false as const, rows: [] as Array<{ id: string; value: string }> };

        const rolePriority: Record<string, number> = { owner: 1, admin: 2, editor: 3, viewer: 4 };
        const byArtist = new Map<string, { priority: number; value: string }>();

        (
          (data as Array<{
            artist_id: string;
            role?: string | null;
            users?: { city?: string | null; state?: string | null } | null;
          }> | null) || []
        ).forEach((row) => {
          const city = String(row.users?.city || '').trim();
          const state = String(row.users?.state || '').trim().toUpperCase();
          const value = city && state ? `${city}/${state}` : city || state;
          if (!value) return;

          const priority = rolePriority[String(row.role || '').toLowerCase()] ?? 99;
          const current = byArtist.get(row.artist_id);
          if (!current || priority < current.priority) {
            byArtist.set(row.artist_id, { priority, value });
          }
        });

        const rows = Array.from(byArtist.entries()).map(([id, meta]) => ({ id, value: meta.value }));
        return { ok: true as const, rows };
      };

      let result = await fetchCityState();
      if (!result.ok) result = await fetchByColumn('city');
      if (!result.ok) result = await fetchByColumn('location');
      if (!result.ok || result.rows.length === 0) result = await fetchFromMembersUserProfile();

      if (cancelled) return;
      const next: Record<string, string> = {};
      result.rows.forEach((row) => {
        next[row.id] = row.value;
      });
      setArtistLocations(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchResults]);

  const selectedLabel = useMemo(() => selectedArtist?.name || 'Nenhum', [selectedArtist]);
  const activeFiltersCount = useMemo(
    () =>
      [filterCity, filterState, filterRole].filter((s) => String(s || '').trim().length >= 2).length,
    [filterCity, filterState, filterRole]
  );

  const locationLine = (item: ArtistaBuscaConvite, fallback: string) => {
    const c = (item.city ?? '').trim();
    const s = (item.state ?? '').trim();
    if (c && s) return `${c} / ${s.toUpperCase()}`;
    if (c) return c;
    if (s) return s.toUpperCase();
    return fallback;
  };

  const whatsAppDisplay = (raw: string | null | undefined) => {
    const digits = brazilMobileDigits(String(raw ?? ''));
    if (digits.length < 10) return null;
    return maskBrazilMobile(digits);
  };
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quem convidar</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Busque pelo nome (mín. 2 letras). Use filtros para refinar por local e função.
          </Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            placeholder="Nome do artista..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />

          <TouchableOpacity
            style={[styles.filterBar, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() =>
              setFiltersOpen((o) => {
                const next = !o;
                if (!next) setShowFilterEstados(false);
                return next;
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.filterBarLeft}>
              <Ionicons name="options-outline" size={20} color={colors.primary} />
              <Text style={[styles.filterBarText, { color: colors.text }]}>Filtros</Text>
              {activeFiltersCount > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                </View>
              )}
            </View>
            <Ionicons name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {filtersOpen && (
            <View style={[styles.filterPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                style={[styles.filterInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Cidade (opcional)"
                placeholderTextColor={colors.textSecondary}
                value={filterCity}
                onChangeText={setFilterCity}
              />
              <Text style={[styles.filterFieldLabel, { color: colors.text }]}>Estado (opcional)</Text>
              <TouchableOpacity
                style={[
                  styles.estadoSelector,
                  { borderColor: colors.border, backgroundColor: colors.background },
                ]}
                onPress={() => setShowFilterEstados(!showFilterEstados)}
                activeOpacity={0.7}
              >
                <Text style={[styles.estadoText, { color: filterState ? colors.text : colors.textSecondary }]}>
                  {filterState || 'Selecione o estado'}
                </Text>
                <Ionicons
                  name={showFilterEstados ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              {showFilterEstados && (
                <View style={[styles.estadosList, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <ScrollView style={styles.estadosScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    <TouchableOpacity
                      style={[styles.estadoItem, { borderBottomColor: colors.border }]}
                      onPress={() => {
                        setFilterState('');
                        setShowFilterEstados(false);
                      }}
                    >
                      <Text style={[styles.estadoItemText, { color: colors.textSecondary }]}>Todos os estados</Text>
                    </TouchableOpacity>
                    {ESTADOS_BRASIL.map((estadoItem) => (
                      <TouchableOpacity
                        key={estadoItem}
                        style={[styles.estadoItem, { borderBottomColor: colors.border }]}
                        onPress={() => {
                          setFilterState(estadoItem);
                          setShowFilterEstados(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.estadoItemText,
                            { color: filterState === estadoItem ? colors.primary : colors.text },
                          ]}
                        >
                          {estadoItem}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
              <TextInput
                style={[styles.filterInput, styles.filterInputLast, { color: colors.text, borderColor: colors.border }]}
                placeholder="Função — ex.: violão, vocal (opcional)"
                placeholderTextColor={colors.textSecondary}
                value={filterRole}
                onChangeText={setFilterRole}
              />
            </View>
          )}

          <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Resultados</Text>

          {searchLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          ) : (
            <FlatList
              style={{ maxHeight: 260, marginTop: 6 }}
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={{ color: searchError ? colors.error : colors.textSecondary, paddingVertical: 10 }}>
                  {searchError || (search.trim().length < 2 ? 'Digite pelo menos 2 letras.' : 'Nenhum artista encontrado.')}
                </Text>
              }
              renderItem={({ item }) => (
                (() => {
                  const isSelected = selectedArtist?.id === item.id;
                  const artistLocation = locationLine(item, artistLocations[item.id] || 'Não informado');
                  const artistStyle = (item.musical_style || artistStyles[item.id] || '').trim();
                  const rolesFromRpc = parseArtistStringArrayFromJson(item.work_roles);
                  const formatsFromRpc = parseArtistStringArrayFromJson(item.show_formats);
                  const roles =
                    rolesFromRpc.length > 0 ? rolesFromRpc : artistWorkRoles[item.id] || [];
                  const formats =
                    formatsFromRpc.length > 0 ? formatsFromRpc : artistShowFormats[item.id] || [];
                  const whatsShown =
                    item.show_whatsapp === true ? whatsAppDisplay(item.whatsapp) : null;
                  return (
                <TouchableOpacity
                  style={[
                    styles.row,
                    {
                      borderColor: isSelected ? `${colors.primary}66` : colors.border,
                      backgroundColor: isSelected ? `${colors.primary}12` : colors.surface,
                    },
                  ]}
                  onPress={() =>
                    {
                      Keyboard.dismiss();
                      setSelectedArtist({
                        id: item.id,
                        name: item.name,
                        location: artistLocation,
                        musicalStyle: artistStyle || null,
                      });
                    }
                  }
                >
                  <View style={styles.rowContent}>
                    <OptimizedImage
                      imageUrl={item.image_url ?? item.profile_url ?? ''}
                      style={styles.rowAvatar}
                      fallbackText={item.name || 'Artista'}
                      fallbackIcon="person"
                      fallbackIconSize={18}
                      fallbackIconColor={colors.primary}
                      showLoadingIndicator={false}
                    />
                    <View style={styles.rowInfo}>
                      <View style={styles.rowHeader}>
                        <Text
                          style={[
                            styles.artistName,
                            { color: colors.text, fontWeight: isSelected ? '800' : '700' },
                          ]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                      </View>
                      <View style={styles.metaChipsRow}>
                        {!!artistStyle && (
                          <Text style={[styles.stylePill, { color: colors.primary, backgroundColor: `${colors.primary}14` }]} numberOfLines={1}>
                            {artistStyle}
                          </Text>
                        )}
                        {whatsShown != null && (
                          <View
                            style={[
                              styles.whatsTag,
                              {
                                backgroundColor: `${colors.success}18`,
                                borderColor: `${colors.success}50`,
                              },
                            ]}
                          >
                            <Ionicons name="logo-whatsapp" size={12} color={colors.success} />
                            <Text style={[styles.whatsTagText, { color: colors.success }]}>WhatsApp</Text>
                          </View>
                        )}
                      </View>
                      {whatsShown != null && (
                        <View style={styles.whatsContactRow}>
                          <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                          <Text style={[styles.whatsContactText, { color: colors.text }]} numberOfLines={1}>
                            {whatsShown}
                          </Text>
                        </View>
                      )}
                      {roles.length > 0 && (
                        <>
                          <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>Funções</Text>
                          <View style={styles.rolesWrap}>
                          {roles.map((role) => (
                            <View
                              key={`${item.id}-role-${role}`}
                              style={[styles.roleChip, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44` }]}
                            >
                              <Text style={[styles.roleChipText, { color: colors.primary }]} numberOfLines={1}>
                                {role}
                              </Text>
                            </View>
                          ))}
                          </View>
                        </>
                      )}
                      {formats.length > 0 && (
                        <>
                          <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>Formatos</Text>
                          <View style={styles.rolesWrap}>
                          {formats.map((fmt) => (
                            <View
                              key={`${item.id}-fmt-${fmt}`}
                              style={[
                                styles.formatChip,
                                {
                                  backgroundColor: `${colors.textSecondary}14`,
                                  borderColor: `${colors.textSecondary}40`,
                                },
                              ]}
                            >
                              <Text style={[styles.formatChipText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {fmt}
                              </Text>
                            </View>
                          ))}
                          </View>
                        </>
                      )}
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                        <Text style={[styles.locationText, { color: colors.textSecondary }]}>{artistLocation}</Text>
                      </View>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                  </View>
                </TouchableOpacity>
                  );
                })()
              )}
            />
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Dados do convite</Text>
          <View style={styles.selectedWrap}>
            <Text style={[styles.selected, { color: colors.textSecondary }]}>
              Artista selecionado: <Text style={{ color: colors.text, fontWeight: '700' }}>{selectedLabel}</Text>
            </Text>
          </View>

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
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sectionHint: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  subLabel: { fontSize: 12, fontWeight: '700', marginTop: 4, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  filterBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterBarText: { fontSize: 16, fontWeight: '600' },
  filterBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  filterPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  filterInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  filterInputLast: { marginBottom: 0 },
  filterFieldLabel: { fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 6 },
  estadoSelector: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  estadoText: { fontSize: 15, flex: 1 },
  estadosList: {
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: 200,
    overflow: 'hidden',
  },
  estadosScroll: { maxHeight: 200 },
  estadoItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  estadoItemText: { fontSize: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 17,
  },
  messageInput: { minHeight: 88, textAlignVertical: 'top' },
  row: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  rowContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowAvatar: { width: 42, height: 42, borderRadius: 21 },
  rowInfo: { flex: 1 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  artistName: { fontSize: 17, lineHeight: 22 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { fontSize: 12 },
  badgeText: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  metaChipsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  stylePill: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  whatsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  whatsTagText: { fontSize: 11, fontWeight: '800' },
  whatsContactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  whatsContactText: { fontSize: 14, fontWeight: '600', flex: 1 },
  groupLabel: { fontSize: 11, fontWeight: '700', marginTop: 8 },
  rolesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  roleChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  formatChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  formatChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  selectedWrap: { marginTop: 10, marginBottom: 12 },
  selected: { fontWeight: '500' },
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
