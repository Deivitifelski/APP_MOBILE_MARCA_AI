import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PermissionModal from '../components/PermissionModal';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { generateEventPDF } from '../services/pdfService';
import { getEventCreatorName } from '../services/supabase/eventCreatorService';
import {
    Event,
    createEventWithPermissions,
    deleteEvent,
    getEventById,
    getEventByIdWithPermissions,
} from '../services/supabase/eventService';
import { getExpensesByEvent, getTotalExpensesByEvent } from '../services/supabase/expenseService';
import { useActiveArtist } from '../services/useActiveArtist';

function parseEventDateToLocalDate(eventDate: string): Date {
    const [y, m, d] = eventDate.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatLocalDateToISO(d: Date): string {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
}

const CLONE_MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const CLONE_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function CloneEventMonthCalendar({
  selectedDate,
  onSelectDate,
  colors,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  colors: ThemeColors;
}) {
  const [viewYear, setViewYear] = useState(() => selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedDate.getMonth());

  useEffect(() => {
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [selectedDate.getTime()]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells: { day: number | null }[] = [];
  for (let i = 0; i < firstDayWeekday; i++) {
    cells.push({ day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d });
  }

  const isDaySelected = (day: number) =>
    selectedDate.getFullYear() === viewYear &&
    selectedDate.getMonth() === viewMonth &&
    selectedDate.getDate() === day;

  return (
    <View style={styles.cloneCalendarWrap}>
      <View style={styles.cloneMonthNav}>
        <TouchableOpacity onPress={goPrevMonth} hitSlop={12} style={styles.cloneMonthNavBtn} accessibilityLabel="Mês anterior">
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.cloneMonthNavTitle, { color: colors.text }]}>
          {CLONE_MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={goNextMonth} hitSlop={12} style={styles.cloneMonthNavBtn} accessibilityLabel="Próximo mês">
          <Ionicons name="chevron-forward" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.cloneWeekdayRow}>
        {CLONE_WEEKDAYS.map((w) => (
          <Text key={w} style={[styles.cloneWeekdayCell, { color: colors.textSecondary }]}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.cloneDaysGrid}>
        {cells.map((cell, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.cloneDayCell,
              { backgroundColor: colors.background },
              cell.day && isDaySelected(cell.day) ? { backgroundColor: colors.primary } : null,
              !cell.day ? styles.cloneDayCellEmpty : null,
            ]}
            disabled={!cell.day}
            onPress={() => {
              if (cell.day) {
                onSelectDate(new Date(viewYear, viewMonth, cell.day));
              }
            }}
            activeOpacity={0.7}
          >
            {cell.day ? (
              <Text
                style={[
                  styles.cloneDayCellText,
                  { color: colors.text },
                  isDaySelected(cell.day) && styles.cloneDayCellTextSelected,
                ]}
              >
                {cell.day}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function DetalhesEventoScreen() {
  const { colors, isDarkMode } = useTheme();
  const params = useLocalSearchParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneTargetDate, setCloneTargetDate] = useState(() => new Date());
  const [isCloning, setIsCloning] = useState(false);
  const { activeArtist } = useActiveArtist();
  
  // Estados para controle de acesso
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [canCreateEventsPermission, setCanCreateEventsPermission] = useState(false);

  // Obter usuário atual
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Verificar permissões quando o artista ativo mudar
  useEffect(() => {
    checkUserAccess();
  }, [activeArtist, currentUserId]);

  const checkUserAccess = async () => {
    if (!activeArtist || !currentUserId) {
      setHasAccess(null);
      setIsCheckingAccess(false);
      setCanCreateEventsPermission(false);
      return;
    }

    try {
      setIsCheckingAccess(true);

      // Buscar role diretamente na tabela artist_members
      const { data: memberData, error } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', currentUserId)
        .eq('artist_id', activeArtist.id)
        .single();

      if (error) {
        setHasAccess(false);
        setIsCheckingAccess(false);
        setCanCreateEventsPermission(false);
        return;
      }

      const userRole = memberData?.role;

      // ✅ Ocultar valores APENAS para viewers
      const isViewer = userRole === 'viewer';
      const hasPermission = !isViewer; // Todos menos viewer têm acesso
      const canCreate = ['owner', 'admin', 'editor'].includes(userRole);
      
      setHasAccess(hasPermission);
      setCanCreateEventsPermission(canCreate);
      setIsCheckingAccess(false);
    } catch (error) {
      setHasAccess(false);
      setCanCreateEventsPermission(false);
      setIsCheckingAccess(false);
    }
  };

  const loadEventData = async (isInitialLoad = true) => {
    if (isInitialLoad) {
      setIsLoading(true);
    }
    
    try {
      // Primeiro, sempre tentar carregar o evento sem permissões para obter todos os dados
      const [eventResult, expensesResult] = await Promise.all([
        getEventById(eventId),
        getTotalExpensesByEvent(eventId)
      ]);

      if (eventResult.success && eventResult.event) {
        let finalEvent = eventResult.event;
        
        // Se temos um usuário logado, verificar permissões
        if (currentUserId) {
          // Verificar se o usuário tem permissão para visualizar este evento
          const permissionResult = await getEventByIdWithPermissions(eventId, currentUserId);
          
          if (permissionResult.error) {
            Alert.alert('Erro', permissionResult.error);
            return;
          }
          
          // Se o usuário não tem permissão para ver valores financeiros, remover o valor
          if (permissionResult.event && !permissionResult.event.value) {
            finalEvent = { ...finalEvent, value: undefined };
          }
        }
        
        setEvent(finalEvent);
        
        // Buscar nome do criador do evento
        if (finalEvent.created_by) {
          const creatorResult = await getEventCreatorName(finalEvent.created_by);
          if (creatorResult.name) {
            setCreatorName(creatorResult.name);
          }
        }
      } else {
        setShowDeletedModal(true);
      }

      if (expensesResult.success) {
        setTotalExpenses(expensesResult.total || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do evento:', error);
      Alert.alert('Erro', 'Erro ao carregar dados do evento');
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadEventData(true); // Carregamento inicial
  }, [eventId, currentUserId]);

  // Recarregar dados quando a tela receber foco (ex: voltar da tela de editar)
  useFocusEffect(
    React.useCallback(() => {
      loadEventData(false); // Reload silencioso
    }, [eventId])
  );


  const formatDate = (dateString: string) => {
    // Parse da data sem conversão de fuso horário
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR');
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5); // HH:MM
  };

  const formatCurrency = (value: number | string) => {
    // Se for string, trata como centavos (para compatibilidade com eventos)
    if (typeof value === 'string') {
      const numericValue = value.replace(/\D/g, '');
      if (!numericValue) return '';
      const number = parseInt(numericValue, 10);
      return `R$ ${(number / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
    
    // Se for number, trata como reais (para despesas)
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const extractNumericValue = (formattedValue: string) => {
    const numericValue = formattedValue.replace(/\D/g, '');
    return numericValue ? parseInt(numericValue, 10) / 100 : 0;
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'ensaio':
        return '#10B981'; // Verde
      case 'evento':
        return '#667eea'; // Azul
      case 'reunião':
        return '#F59E0B'; // Laranja
      default:
        return '#667eea'; // Azul padrão
    }
  };

  const getTagIcon = (tag: string) => {
    switch (tag) {
      case 'ensaio':
        return 'musical-notes';
      case 'evento':
        return 'mic';
      case 'reunião':
        return 'people';
      default:
        return 'mic';
    }
  };

  const handleRestrictedAction = (actionName: string) => {
    if (!hasAccess) {
      setShowPermissionModal(true);
      return false;
    }
    return true;
  };

  const handleEditEvent = () => {
    if (!handleRestrictedAction('editar')) return;
    router.push({
      pathname: '/editar-evento',
      params: { eventId: event?.id }
    });
  };

  const handleManageExpenses = () => {
    if (!handleRestrictedAction('gerenciar despesas')) return;
    router.push({
      pathname: '/despesas-evento',
      params: { 
        eventId: event?.id, 
        eventName: event?.name 
      }
    });
  };

  const handleAddExpense = () => {
    if (!handleRestrictedAction('adicionar despesa')) return;
    router.push({
      pathname: '/adicionar-despesa',
      params: { 
        eventId: event?.id, 
        eventName: event?.name 
      }
    });
  };

  const handleDeleteEvent = () => {
    if (!handleRestrictedAction('deletar')) return;
    
    Alert.alert(
      'Deletar Evento',
      `Tem certeza que deseja deletar o evento "${event?.name}"?\n\nEsta ação não pode ser desfeita e todas as despesas relacionadas também serão removidas.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: confirmDeleteEvent
        }
      ]
    );
  };

  const confirmDeleteEvent = async () => {
    if (!event || !currentUserId) return;
    
    setIsDeleting(true);
    
    try {
      const result = await deleteEvent(event.id, currentUserId);
      
      if (result.success) {
        Alert.alert(
          'Evento Deletado',
          'O evento foi deletado com sucesso.',
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
      } else {
        Alert.alert('Erro', result.error || 'Erro ao deletar evento');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao deletar evento');
    } finally {
      setIsDeleting(false);
    }
  };

  const openCloneModal = () => {
    if (!canCreateEventsPermission) return;
    if (!event) return;
    setCloneTargetDate(parseEventDateToLocalDate(event.event_date));
    setShowCloneModal(true);
  };

  const confirmCloneEvent = async () => {
    if (!canCreateEventsPermission || !event || !currentUserId) return;
    setIsCloning(true);
    try {
      const expensesRes = await getExpensesByEvent(event.id);
      const expenses =
        expensesRes.success && expensesRes.expenses?.length
          ? expensesRes.expenses.map((e) => ({
              name: e.name?.trim() ? e.name : 'Despesa',
              value: Number(e.value) || 0,
              receipt_url: e.receipt_url || undefined,
            }))
          : undefined;

      const newDateStr = formatLocalDateToISO(cloneTargetDate);

      const result = await createEventWithPermissions(
        {
          artist_id: event.artist_id,
          user_id: currentUserId,
          name: event.name,
          description: event.description,
          event_date: newDateStr,
          start_time: event.start_time,
          end_time: event.end_time,
          value: event.value,
          city: event.city,
          contractor_phone: event.contractor_phone,
          confirmed: event.confirmed,
          tag: event.tag,
          expenses,
        },
        currentUserId
      );

      if (result.success && result.event) {
        setShowCloneModal(false);
        Alert.alert('Evento duplicado', 'As mesmas informações foram salvas na nova data.', [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/agenda'),
          },
        ]);
      } else {
        Alert.alert('Erro', result.error || 'Não foi possível duplicar o evento.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível duplicar o evento.');
    } finally {
      setIsCloning(false);
    }
  };

  const cloneDateLabel = formatDate(formatLocalDateToISO(cloneTargetDate));

  const handleExportPDF = async () => {
    if (!event || !currentUserId) return;

    // Modal melhorado para escolher tipo de relatório
    Alert.alert(
      '📄 Exportar Relatório do Evento',
      `Evento: ${event.name}\n\nEscolha o tipo de relatório que deseja gerar:`,
      [
        {
          text: '💰 Com Valores Financeiros',
          onPress: () => generateReport(true),
          style: 'default'
        },
        {
          text: '🔒 Sem Valores Financeiros',
          onPress: () => generateReport(false),
          style: 'default'
        },
        {
          text: '❌ Cancelar',
          style: 'cancel'
        }
      ],
      { cancelable: true }
    );
  };

  const generateReport = async (includeFinancials: boolean) => {
    if (!event) return;
    
    setIsGeneratingPDF(true);
    
    try {
      const result = await generateEventPDF({
        event,
        totalExpenses,
        creatorName: creatorName || undefined,
        artistName: activeArtist?.name || undefined,
        includeFinancials
      });
      
      if (!result.success) {
        Alert.alert('❌ Erro ao Gerar Relatório', result.error || 'Ocorreu um erro inesperado. Tente novamente.');
      }
    } catch (error) {
      Alert.alert('❌ Erro ao Gerar Relatório', 'Ocorreu um erro inesperado ao gerar o relatório. Verifique sua conexão e tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };



  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Detalhes do Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Carregando evento...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Detalhes do Evento</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Evento não encontrado</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            O evento solicitado não foi encontrado ou foi removido.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const profit = (event.value || 0) - totalExpenses;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Detalhes do Evento</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 20 : 10 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Informações do Evento */}
        <View style={[styles.eventCard, { backgroundColor: colors.surface }]}>
          <View style={styles.eventHeader}>
            <Text style={[styles.eventName, { color: colors.text }]}>{event.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: event.confirmed ? colors.success : colors.warning }]}>
              <Ionicons 
                name={event.confirmed ? 'checkmark-circle' : 'time'} 
                size={16} 
                color="#fff" 
              />
              <Text style={styles.statusText}>{event.confirmed ? 'Confirmado' : 'A Confirmar'}</Text>
            </View>
          </View>

          <View style={styles.eventDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.text }]}>{formatDate(event.event_date)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time" size={20} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.text }]}>
                {formatTime(event.start_time)} - {formatTime(event.end_time)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.text }]}>{event.city || 'Não informado'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.text }]}>{event.contractor_phone || 'Não informado'}</Text>
            </View>

            {event.tag && (
              <View style={styles.detailRow}>
                <Ionicons name={getTagIcon(event.tag)} size={20} color={getTagColor(event.tag)} />
                <View style={styles.tagContainer}>
                  <View style={[styles.tagBadge, { backgroundColor: getTagColor(event.tag) }]}>
                    <Text style={styles.tagText}>{event.tag}</Text>
                  </View>
                </View>
              </View>
            )}

            {creatorName && (
              <View style={styles.detailRow}>
                <Ionicons name="person" size={20} color={colors.primary} />
                <Text style={[styles.detailText, { color: colors.text }]}>Criado por: {creatorName}</Text>
              </View>
            )}

            {event.description && (
              <View style={styles.descriptionContainer}>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text" size={20} color={colors.primary} />
                  <Text style={[styles.detailLabel, { color: colors.text }]}>Descrição:</Text>
                </View>
                <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{event.description}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Resumo Financeiro */}
        <View style={[styles.financialCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.financialTitle, { color: colors.text }]}>Resumo Financeiro</Text>
          
          {hasAccess ? (
            <>
              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>Valor do Evento:</Text>
                <Text style={[styles.financialValue, { color: colors.success }]}>{formatCurrency(event.value || 0)}</Text>
              </View>

              <View style={styles.financialRow}>
                <Text style={[styles.financialLabel, { color: colors.textSecondary }]}>Total de Despesas:</Text>
                <Text style={[styles.financialValue, { color: colors.error }]}>
                  -{formatCurrency(totalExpenses)}
                </Text>
              </View>

              <View style={[styles.financialRow, styles.financialTotal, { borderTopColor: colors.border }]}>
                <Text style={[styles.financialTotalLabel, { color: colors.text }]}>Lucro Líquido:</Text>
                <Text style={[
                  styles.financialTotalValue,
                  { color: profit >= 0 ? colors.success : colors.error }
                ]}>
                  {formatCurrency(profit)}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.lockedFinancialContainer}>
              <Ionicons name="lock-closed" size={32} color={colors.textSecondary} />
              <Text style={[styles.lockedFinancialText, { color: colors.textSecondary }]}>
                Valores financeiros ocultos
              </Text>
              <Text style={[styles.lockedFinancialSubtext, { color: colors.textSecondary }]}>
                Apenas gerentes e editores podem visualizar dados financeiros
              </Text>
            </View>
          )}
        </View>



        {/* Ações */}
        <View style={styles.actionsContainer}>
          {hasAccess && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleExportPDF}
              disabled={isGeneratingPDF}
            >
              <Ionicons name="document-text" size={24} color="#9C27B0" />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                {isGeneratingPDF ? 'Gerando Relatório...' : 'Exportar Relatório'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleEditEvent}
          >
            <Ionicons name="create" size={24} color={colors.warning} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Editar Evento</Text>
            {!hasAccess && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>

          {canCreateEventsPermission ? (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={openCloneModal}
            >
              <Ionicons name="copy-outline" size={24} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Duplicar evento</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleManageExpenses}
          >
            <Ionicons name="receipt" size={24} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Gerenciar Despesas</Text>
            {!hasAccess && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleAddExpense}
          >
            <Ionicons name="add-circle" size={24} color={colors.success} />
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Adicionar Despesa</Text>
            {!hasAccess && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleDeleteEvent}
            disabled={isDeleting}
          >
            <Ionicons name="trash" size={24} color={colors.error} />
            <Text style={[styles.actionButtonText, styles.deleteButtonText, { color: colors.error }]}>
              {isDeleting ? 'Deletando...' : 'Deletar Evento'}
            </Text>
            {!hasAccess && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />}
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Duplicar evento: escolher nova data */}
      <Modal
        visible={showCloneModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isCloning) setShowCloneModal(false);
        }}
      >
        <View style={styles.deletedModalOverlay}>
          <View style={[styles.cloneModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView
              style={styles.cloneModalScroll}
              contentContainerStyle={styles.cloneModalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.cloneModalIcon, { backgroundColor: `${colors.primary}22` }]}>
                <Ionicons name="calendar-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.cloneModalTitle, { color: colors.text }]}>Duplicar evento</Text>
              <Text style={[styles.cloneModalSubtitle, { color: colors.textSecondary }]}>
                Navegue pelos meses e toque no dia desejado. Serão copiados nome, horários, local, descrição, tag, status e as despesas cadastradas (valores e comprovantes).
              </Text>

              <Text style={[styles.cloneSelectedDateLabel, { color: colors.textSecondary }]}>Data selecionada</Text>
              <Text style={[styles.cloneDatePreview, { color: colors.text }]}>{cloneDateLabel}</Text>

              <CloneEventMonthCalendar
                selectedDate={cloneTargetDate}
                onSelectDate={setCloneTargetDate}
                colors={colors}
              />
            </ScrollView>

            <View style={styles.cloneModalActions}>
              <TouchableOpacity
                style={[styles.cloneModalBtnSecondary, { borderColor: colors.border }]}
                onPress={() => !isCloning && setShowCloneModal(false)}
                disabled={isCloning}
              >
                <Text style={[styles.cloneModalBtnSecondaryText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cloneModalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={() => void confirmCloneEvent()}
                disabled={isCloning}
                activeOpacity={0.85}
              >
                {isCloning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.cloneModalBtnPrimaryText}>Duplicar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Permissão */}
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acesso Restrito"
        message="Apenas gerentes e editores podem editar eventos, gerenciar despesas e visualizar valores financeiros. Entre em contato com um gerente para solicitar mais permissões."
        icon="lock-closed"
      />

      {/* Modal quando evento foi deletado */}
      <Modal
        visible={showDeletedModal}
        transparent
        animationType="fade"
      >
        <View style={styles.deletedModalOverlay}>
          <View style={[styles.deletedModalContent, { backgroundColor: colors.card }]}>
            <Ionicons name="trash-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 16 }} />
            <Text style={[styles.deletedModalTitle, { color: colors.text }]}>
              Evento não encontrado
            </Text>
            <Text style={[styles.deletedModalMessage, { color: colors.textSecondary }]}>
              Este evento pode já ter sido deletado. A agenda será atualizada.
            </Text>
            <TouchableOpacity
              style={[styles.deletedModalButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowDeletedModal(false);
                router.back();
              }}
            >
              <Text style={styles.deletedModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  eventName: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },
  eventDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 16,
    marginLeft: 12,
  },
  financialCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  financialTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  financialLabel: {
    fontSize: 16,
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  financialTotal: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
  },
  financialTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  financialTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 40,
  },
  actionButton: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginLeft: 12,
  },
  deleteButton: {
    borderColor: '#ff4444',
    backgroundColor: '#fff5f5',
  },
  deleteButtonText: {
    color: '#ff4444',
  },
  descriptionContainer: {
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 4,
    marginLeft: 28,
    fontStyle: 'italic',
  },
  tagContainer: {
    marginLeft: 12,
  },
  tagBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  tagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  lockedFinancialContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  lockedFinancialText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  lockedFinancialSubtext: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 16,
  },
  deletedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deletedModalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  deletedModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  deletedModalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deletedModalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  deletedModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cloneModalContent: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 360,
    maxHeight: '88%',
    borderWidth: 1,
    alignItems: 'stretch',
  },
  cloneModalScroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  cloneModalScrollContent: {
    paddingBottom: 8,
    alignItems: 'stretch',
  },
  cloneModalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cloneModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  cloneModalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 14,
  },
  cloneSelectedDateLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cloneDatePreview: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  cloneCalendarWrap: {
    width: '100%',
  },
  cloneMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  cloneMonthNavBtn: {
    padding: 8,
    borderRadius: 8,
  },
  cloneMonthNavTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  cloneWeekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  cloneWeekdayCell: {
    width: '14.28%',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  cloneDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  cloneDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    marginBottom: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloneDayCellEmpty: {
    backgroundColor: 'transparent',
  },
  cloneDayCellText: {
    fontSize: 15,
    fontWeight: '500',
  },
  cloneDayCellTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  cloneModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 4,
  },
  cloneModalBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloneModalBtnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cloneModalBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cloneModalBtnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
