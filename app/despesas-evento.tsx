import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
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
import {
  buscarArtistasParaConvite,
  cancelarConviteParticipacao,
  enviarConviteParticipacao,
  listarConvitesDoEvento,
  obterNomeArtista,
  type ArtistaBuscaConvite,
  type ConviteParticipacaoEventoRow,
} from '../services/supabase/conviteParticipacaoEventoService';
import { getEventById, type Event } from '../services/supabase/eventService';
import { deleteExpense, getExpensesByEvent, getTotalExpensesByEvent, type Expense } from '../services/supabase/expenseService';
import { useActiveArtist } from '../services/useActiveArtist';
import { extractNumericValueString, formatCurrencyBRLInput } from '../utils/currencyBRLInput';

export default function DespesasEventoScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;
  const eventName = params.eventName as string;
  const { activeArtist } = useActiveArtist();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventData, setEventData] = useState<Event | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [canInviteCollaborator, setCanInviteCollaborator] = useState(false);

  const [participationInvites, setParticipationInvites] = useState<ConviteParticipacaoEventoRow[]>([]);
  const [participationInviteeNames, setParticipationInviteeNames] = useState<Record<string, string>>({});
  const [showParticipationModal, setShowParticipationModal] = useState(false);
  const [participationSearch, setParticipationSearch] = useState('');
  const [participationSearchResults, setParticipationSearchResults] = useState<ArtistaBuscaConvite[]>([]);
  const [participationSearchLoading, setParticipationSearchLoading] = useState(false);
  const [participationSearchError, setParticipationSearchError] = useState<string | null>(null);
  const [inviteMessageDraft, setInviteMessageDraft] = useState('');
  const [inviteCacheDraft, setInviteCacheDraft] = useState('R$ 0,00');
  const [inviteWhatsappDraft, setInviteWhatsappDraft] = useState('');
  const [inviteFunctionDraft, setInviteFunctionDraft] = useState('');
  const [selectedArtistToInvite, setSelectedArtistToInvite] = useState<{ id: string; name: string } | null>(null);
  const [sendingParticipationInvite, setSendingParticipationInvite] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    })();
  }, []);

  const loadParticipationInvites = useCallback(async (origemId: string) => {
    const { convites, error } = await listarConvitesDoEvento(origemId);
    if (error) {
      setParticipationInvites([]);
      return;
    }
    setParticipationInvites(convites);
    const map: Record<string, string> = {};
    for (const c of convites) {
      if (!map[c.artista_convidado_id]) {
        const n = await obterNomeArtista(c.artista_convidado_id);
        if (n) map[c.artista_convidado_id] = n;
      }
    }
    setParticipationInviteeNames(map);
  }, []);

  const refreshInvitePermission = useCallback(
    async (ev: Event | null) => {
      if (!ev || !activeArtist?.id || !currentUserId) {
        setCanInviteCollaborator(false);
        return;
      }
      if (ev.artist_id !== activeArtist.id) {
        setCanInviteCollaborator(false);
        return;
      }
      const { data: memberData, error } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', currentUserId)
        .eq('artist_id', activeArtist.id)
        .single();
      if (error || !memberData) {
        setCanInviteCollaborator(false);
        return;
      }
      setCanInviteCollaborator(['admin', 'editor'].includes(memberData.role));
    },
    [activeArtist?.id, currentUserId]
  );

  const loadAll = useCallback(async () => {
    try {
      const [expensesResult, totalResult, eventResult] = await Promise.all([
        getExpensesByEvent(eventId),
        getTotalExpensesByEvent(eventId),
        getEventById(eventId),
      ]);

      if (expensesResult.success) {
        setExpenses(expensesResult.expenses || []);
      } else {
        Alert.alert('Erro', expensesResult.error || 'Erro ao carregar despesas');
      }

      if (totalResult.success) {
        setTotalExpenses(totalResult.total || 0);
      }

      if (eventResult.success && eventResult.event) {
        const ev = eventResult.event;
        setEventData(ev);
        await refreshInvitePermission(ev);
        if (ev.artist_id === activeArtist?.id) {
          void loadParticipationInvites(ev.id);
        } else {
          setParticipationInvites([]);
        }
      } else {
        setEventData(null);
        setCanInviteCollaborator(false);
        setParticipationInvites([]);
      }
    } catch {
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [eventId, activeArtist?.id, loadParticipationInvites, refreshInvitePermission]);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
    }, [loadAll])
  );

  useEffect(() => {
    if (!showParticipationModal || !eventData?.artist_id) return;
    const t = setTimeout(() => {
      void (async () => {
        setParticipationSearchLoading(true);
        setParticipationSearchError(null);
        const { artists, error } = await buscarArtistasParaConvite(participationSearch, eventData.artist_id);
        setParticipationSearchResults(artists);
        setParticipationSearchError(error);
        setParticipationSearchLoading(false);
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [participationSearch, showParticipationModal, eventData?.artist_id]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadAll();
  };

  const labelConviteStatus = (s: string) => {
    switch (s) {
      case 'pendente':
        return 'Pendente';
      case 'aceito':
        return 'Aceito';
      case 'recusado':
        return 'Recusado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return s;
    }
  };

  const submitParticipationInvite = async () => {
    if (!eventData || !activeArtist || !selectedArtistToInvite || !currentUserId) return;
    const cacheDigits = extractNumericValueString(inviteCacheDraft);
    const cacheNumerico = cacheDigits ? Number(cacheDigits) : NaN;
    const funcaoLimpa = inviteFunctionDraft.trim();
    if (!inviteCacheDraft.trim() || Number.isNaN(cacheNumerico) || cacheNumerico <= 0) {
      Alert.alert('Cachê obrigatório', 'Informe um valor de cachê válido para enviar o convite.');
      return;
    }
    if (!funcaoLimpa) {
      Alert.alert('Função obrigatória', 'Informe a função do participante para enviar o convite.');
      return;
    }
    if (eventData.artist_id !== activeArtist.id) return;
    setSendingParticipationInvite(true);
    const { success, error } = await enviarConviteParticipacao({
      eventoOrigemId: eventData.id,
      artistaQueConvidaId: activeArtist.id,
      artistaConvidadoId: selectedArtistToInvite.id,
      usuarioQueEnviaId: currentUserId,
      mensagem: inviteMessageDraft.trim() || null,
      funcaoParticipacao: funcaoLimpa,
      nomeEvento: eventData.name,
      dataEvento: eventData.event_date,
      horaInicio: eventData.start_time,
      horaFim: eventData.end_time,
      cacheValor: cacheNumerico,
      cidade: eventData.city ?? null,
      telefoneContratante: inviteWhatsappDraft.trim() || null,
      descricao: eventData.description ?? null,
    });
    setSendingParticipationInvite(false);
    if (success) {
      Alert.alert('Enviado', 'O convite foi enviado.');
      setShowParticipationModal(false);
      setSelectedArtistToInvite(null);
      setInviteMessageDraft('');
      setInviteCacheDraft('R$ 0,00');
      setInviteWhatsappDraft('');
      setInviteFunctionDraft('');
      void loadParticipationInvites(eventData.id);
    } else {
      Alert.alert('Erro', error || 'Não foi possível enviar.');
    }
  };

  const cancelParticipationRow = (c: ConviteParticipacaoEventoRow) => {
    Alert.alert('Cancelar convite', 'Remover o convite pendente para este artista?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim',
        style: 'destructive',
        onPress: async () => {
          const { success, error } = await cancelarConviteParticipacao(c.id);
          if (success && eventData) void loadParticipationInvites(eventData.id);
          else Alert.alert('Erro', error || 'Não foi possível cancelar.');
        },
      },
    ]);
  };

  const handleDeleteExpense = (expenseId: string, expenseName: string) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir a despesa "${expenseName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteExpense(expenseId);
            if (result.success) {
              void loadAll();
            } else {
              Alert.alert('Erro', result.error || 'Erro ao excluir despesa');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');

  const renderExpenseItem = (expense: Expense) => (
    <View
      key={expense.id}
      style={[styles.expenseItem, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}
    >
      <View style={styles.expenseHeader}>
        <View style={styles.expenseInfo}>
          <Text style={[styles.expenseName, { color: colors.text }]}>{expense.name}</Text>
          <Text style={[styles.expenseValue, { color: colors.error }]}>{formatCurrency(expense.value)}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteExpense(expense.id, expense.name)} style={styles.deleteButton}>
          <Ionicons name="trash" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.expenseDate, { color: colors.textSecondary }]}>{formatDate(expense.created_at)}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Despesas do Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando despesas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Despesas do Evento</Text>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: '/adicionar-despesa',
              params: { eventId, eventName },
            })
          }
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Resumo das Despesas</Text>
          <Text style={[styles.summaryEvent, { color: colors.textSecondary }]}>{eventName}</Text>
          <Text style={[styles.summaryTotal, { color: colors.error }]}>Total: {formatCurrency(totalExpenses)}</Text>
          <Text style={[styles.summaryCount, { color: colors.textSecondary }]}>
            {expenses.length} {expenses.length === 1 ? 'despesa' : 'despesas'}
          </Text>
        </View>

        {expenses.length > 0 ? (
          <View>{expenses.map(renderExpenseItem)}</View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma despesa cadastrada</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Adicione despesas para acompanhar os gastos do evento
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() =>
                router.push({
                  pathname: '/adicionar-despesa',
                  params: { eventId, eventName },
                })
              }
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyButtonText}>Adicionar Primeira Despesa</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { padding: 8 },
  title: { fontSize: 18, fontWeight: 'bold' },
  addButton: { padding: 8 },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16 },
  summaryCard: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  summaryEvent: { fontSize: 16, marginBottom: 12 },
  summaryTotal: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  summaryCount: { fontSize: 14 },
  collabCard: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1 },
  collabHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  collabTitle: { fontSize: 17, fontWeight: '700', marginLeft: 10, flex: 1 },
  collabSub: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  collabList: { marginBottom: 12 },
  collabRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  collabName: { fontSize: 15, fontWeight: '600' },
  collabStatus: { fontSize: 13, marginTop: 2 },
  collabEmpty: { fontSize: 14, marginBottom: 12 },
  collabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  collabBtnText: { fontSize: 15, fontWeight: '600' },
  expenseItem: { borderRadius: 12, padding: 16, borderWidth: 1 },
  expenseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  expenseValue: { fontSize: 18, fontWeight: 'bold' },
  deleteButton: { padding: 4 },
  expenseDate: { fontSize: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  emptyButton: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  emptyButtonText: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { borderRadius: 16, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalSub: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 8,
  },
  searchHit: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  searchHitRow: { flexDirection: 'row', alignItems: 'center' },
  searchHitAvatar: { width: 44, height: 44, borderRadius: 22 },
  searchHitName: { flex: 1, fontWeight: '600', fontSize: 16, marginLeft: 12 },
  fieldHelp: { fontSize: 12, lineHeight: 16, marginTop: -2, marginBottom: 8 },
  modalActions: { flexDirection: 'row', marginTop: 16 },
  modalBtnSec: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginRight: 6,
  },
  modalBtnPri: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    marginLeft: 6,
  },
  modalBtnPriText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
