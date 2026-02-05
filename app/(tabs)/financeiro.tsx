import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Clipboard,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PermissionModal from '../../components/PermissionModal';
import { useActiveArtistContext } from '../../contexts/ActiveArtistContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { generateFinancialReport } from '../../services/financialReportService';
import { getEventsByMonth } from '../../services/supabase/eventService';
import { deleteStandaloneExpense, getExpensesByEvent, getStandaloneExpensesByArtist } from '../../services/supabase/expenseService';
// import * as FileSystem from 'expo-file-system';

interface EventWithExpenses {
  id: string;
  name: string;
  event_date: string;
  value?: number;
  expenses: any[];
  totalExpenses: number;
  city?: string;
}

export default function FinanceiroScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<EventWithExpenses[]>([]);
  const [standaloneExpenses, setStandaloneExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { activeArtist, refreshActiveArtist } = useActiveArtistContext();
  const [hasAnyArtist, setHasAnyArtist] = useState(false);
  
  // Estados para controle de acesso
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();
  

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


  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Verificar se usuário tem artistas disponíveis
  useEffect(() => {
    checkIfUserHasArtists();
  }, []);

  const checkIfUserHasArtists = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('artist_members')
        .select('artist_id')
        .eq('user_id', user.id)
        .limit(1);

      setHasAnyArtist(!error && data && data.length > 0);
    } catch (error) {
      // Erro ao verificar artistas
    }
  };

  // ✅ Verificar permissões quando artista mudar
  useEffect(() => {
    checkUserAccess();
  }, [activeArtist]);

  const checkUserAccess = async () => {
    if (!activeArtist) {
      setHasAccess(null);
      setIsCheckingAccess(false);
      return;
    }

    try {
      setIsCheckingAccess(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasAccess(false);
        setIsCheckingAccess(false);
        return;
      }

      // Buscar role diretamente na tabela artist_members
      const { data: memberData, error } = await supabase
        .from('artist_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('artist_id', activeArtist.id)
        .single();

      if (error) {
        setHasAccess(false);
        setIsCheckingAccess(false);
        return;
      }

      const userRole = memberData?.role;

      // ✅ Ocultar valores APENAS para viewers
      const isViewer = userRole === 'viewer';
      const hasPermission = !isViewer; // Todos menos viewer têm acesso
      
      setHasAccess(hasPermission);
      setIsCheckingAccess(false);
    } catch (error) {
      // Erro ao verificar acesso
      setHasAccess(false);
      setIsCheckingAccess(false);
    }
  };

  // ✅ Carregar dados financeiros (eventos sempre, valores só com permissão)
  useEffect(() => {
    if (activeArtist && hasAccess !== null) {
      loadFinancialData();
    }
  }, [activeArtist, hasAccess, currentMonth, currentYear]);

  // Recarregar ao voltar para a aba (ex.: após adicionar evento, despesa ou receita)
  useFocusEffect(
    React.useCallback(() => {
      if (activeArtist && hasAccess !== null) {
        loadFinancialData();
      }
    }, [activeArtist?.id, hasAccess, currentMonth, currentYear])
  );

  const loadFinancialData = async () => {
    if (!activeArtist) {
      return;
    }
    
    try {
      setIsLoading(true);

      // Buscar eventos do mês usando o artista ativo
      const { events: monthEvents, error: eventsError } = await getEventsByMonth(activeArtist.id, currentYear, currentMonth);
      
      if (eventsError) {
        Alert.alert('Erro ao Carregar Eventos', eventsError || 'Não foi possível carregar os eventos do mês.');
        return;
      }

      // Para cada evento, buscar suas despesas
      const eventsWithExpenses = await Promise.all(
        (monthEvents || []).map(async (event) => {
          const { success, expenses, error: expensesError } = await getExpensesByEvent(event.id);
          
          const totalExpenses = expenses?.reduce((sum, expense) => sum + expense.value, 0) || 0;
          
          return {
            ...event,
            expenses: expenses || [],
            totalExpenses
          };
        })
      );

      setEvents(eventsWithExpenses);

      // Buscar transações avulsas do artista (despesas E receitas)
      const { success: expensesSuccess, expenses: standalone, error: standaloneError } = await getStandaloneExpensesByArtist(
        activeArtist.id, 
        currentMonth, 
        currentYear
      );

      if (expensesSuccess && standalone) {
        // Separar despesas (valor > 0) de receitas (valor < 0)
        setStandaloneExpenses(standalone);
      } else {
        setStandaloneExpenses([]);
      }
    } catch (error: any) {
      Alert.alert(
        'Erro ao Carregar Finanças', 
        error?.message || 'Ocorreu um erro inesperado ao carregar os dados financeiros. Tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(currentMonth - 1);
    } else {
      newDate.setMonth(currentMonth + 1);
    }
    setSelectedDate(newDate);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) {
      return 'Data não informada';
    }
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR');
  };


  const handleExportFinancialReport = async () => {
    if (!activeArtist || events.length === 0) {
      Alert.alert('Aviso', 'Não há eventos para exportar neste mês.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
      return;
    }

    setShowExportModal(true);
  };

  const generateReport = async (includeFinancials: boolean) => {
    if (!activeArtist) return;
    
    setShowExportModal(false);
    
    // Separar despesas (valor > 0) e receitas (valor < 0)
    const standaloneExpensesOnly = standaloneExpenses.filter(item => item.value > 0);
    const standaloneIncome = standaloneExpenses.filter(item => item.value < 0);
    
    try {
      const result = await generateFinancialReport({
        events,
        month: currentMonth,
        year: currentYear,
        artistName: activeArtist.name,
        includeFinancials,
        standaloneIncome: standaloneIncome.map(item => ({
          id: item.id,
          description: item.description,
          value: item.value,
          date: item.date,
          category: item.category
        })),
        standaloneExpenses: standaloneExpensesOnly.map(item => ({
          id: item.id,
          description: item.description,
          value: item.value,
          date: item.date,
          category: item.category
        }))
      });
      
      if (result.success && result.uri) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartilhar Relatório Financeiro',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Erro', result.error || 'Não foi possível gerar o PDF');
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Erro ao gerar o documento');
    }
  };

  const copyAsText = (includeFinancials: boolean) => {
    if (!activeArtist) return;
    
    setShowExportModal(false);

    // Formatar data
    const formatDate = (dateString: string) => {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('pt-BR');
    };

    // Obter dia da semana
    const getDayOfWeek = (dateString: string) => {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      return daysOfWeek[date.getDay()];
    };

    const formatCurrency = (value: number) => {
      return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    };

    let text = `📊 RELATÓRIO FINANCEIRO\n`;
    text += `${activeArtist.name.toUpperCase()}\n`;
    text += `${months[currentMonth]}/${currentYear}\n`;
    text += `Gerado: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (includeFinancials) {
      text += `💰 RESUMO FINANCEIRO\n`;
      text += `Receita Total: ${formatCurrency(totalRevenueWithIncome)}\n`;
      text += `  • Eventos: ${formatCurrency(totalRevenue)}\n`;
      text += `  • Receitas Avulsas: ${formatCurrency(standaloneIncomeTotal)}\n`;
      text += `Despesas Totais: ${formatCurrency(totalExpenses)}\n`;
      text += `  • Eventos: ${formatCurrency(eventsExpenses)}\n`;
      text += `  • Despesas Avulsas: ${formatCurrency(standaloneExpensesTotal)}\n`;
      text += `Lucro Líquido: ${formatCurrency(netProfit)}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      text += `📋 DETALHAMENTO DOS EVENTOS\n\n`;
      events.forEach((event, index) => {
        text += `${index + 1}. ${event.name}\n`;
        text += `   Data: ${formatDate(event.event_date)}\n`;
        if (event.city) text += `   Local: ${event.city}\n`;
        text += `   Receita: ${formatCurrency(event.value || 0)}\n`;
        text += `   Despesas: ${formatCurrency(event.totalExpenses)}\n`;
        text += `   Lucro: ${formatCurrency((event.value || 0) - event.totalExpenses)}\n`;
        if (index < events.length - 1) text += `   ───────────────────────\n`;
      });

      // Adicionar receitas avulsas
      if (standaloneIncome.length > 0) {
        text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `💵 RECEITAS AVULSAS (${standaloneIncome.length})\n\n`;
        standaloneIncome.forEach((income, index) => {
          text += `${index + 1}. ${income.description}\n`;
          text += `   Data: ${formatDate(income.date)}\n`;
          text += `   Categoria: ${income.category === 'show' ? 'Show/Apresentação' :
                     income.category === 'cache_extra' ? 'Cachê Extra' :
                     income.category === 'streaming' ? 'Streaming' :
                     income.category === 'direitos' ? 'Direitos Autorais' :
                     income.category === 'patrocinio' ? 'Patrocínio' : 'Outros'}\n`;
          text += `   Valor: ${formatCurrency(Math.abs(income.value))}\n`;
          if (income.notes) text += `   Obs: ${income.notes}\n`;
          if (index < standaloneIncome.length - 1) text += `   ───────────────────────\n`;
        });
      }

      // Adicionar despesas avulsas
      if (standaloneExpensesOnly.length > 0) {
        text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `💸 DESPESAS AVULSAS (${standaloneExpensesOnly.length})\n\n`;
        standaloneExpensesOnly.forEach((expense, index) => {
          text += `${index + 1}. ${expense.description}\n`;
          text += `   Data: ${formatDate(expense.date)}\n`;
          text += `   Categoria: ${expense.category === 'equipamento' ? 'Equipamento' :
                     expense.category === 'manutencao' ? 'Manutenção' :
                     expense.category === 'transporte' ? 'Transporte' :
                     expense.category === 'software' ? 'Software/Assinaturas' :
                     expense.category === 'marketing' ? 'Marketing' : 'Outros'}\n`;
          text += `   Valor: ${formatCurrency(expense.value)}\n`;
          if (expense.notes) text += `   Obs: ${expense.notes}\n`;
          if (index < standaloneExpensesOnly.length - 1) text += `   ───────────────────────\n`;
        });
      }
    } else {
      // Sem valores financeiros - apenas lista de eventos
      text += `📅 EVENTOS DO MÊS (${events.length})\n\n`;
      events.forEach((event, index) => {
        text += `${index + 1}. ${event.name}\n`;
        text += `   ${getDayOfWeek(event.event_date)}, ${formatDate(event.event_date)}\n`;
        if (event.city) text += `   📍 ${event.city}\n`;
        if (index < events.length - 1) text += `   ───────────────────────\n`;
      });
    }

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Marca AI - Gestão de Shows\n`;
    text += includeFinancials ? `Relatório Completo` : `Relatório Sem Valores`;

    Clipboard.setString(text);
    Alert.alert('✅ Copiado!', 'Relatório copiado para a área de transferência. Cole em qualquer aplicativo de mensagem.');
  };

  // ✅ VERIFICAÇÃO DE SEGURANÇA: Cálculos financeiros só se tiver acesso
  const totalRevenue = hasAccess 
    ? events.reduce((sum, event) => sum + (event.value || 0), 0) 
    : 0;
  
  const eventsExpenses = hasAccess 
    ? events.reduce((sum, event) => sum + event.totalExpenses, 0) 
    : 0;
  
  // Separar despesas (valor > 0) e receitas (valor < 0)
  const standaloneExpensesOnly = standaloneExpenses.filter(item => item.value > 0);
  const standaloneIncome = standaloneExpenses.filter(item => item.value < 0);
  
  const standaloneExpensesTotal = hasAccess
    ? standaloneExpensesOnly.reduce((sum, expense) => sum + (expense.value || 0), 0)
    : 0;
  
  const standaloneIncomeTotal = hasAccess
    ? Math.abs(standaloneIncome.reduce((sum, income) => sum + (income.value || 0), 0))
    : 0;
  
  const totalExpenses = eventsExpenses + standaloneExpensesTotal;
  const totalRevenueWithIncome = totalRevenue + standaloneIncomeTotal;
  const netProfit = totalRevenueWithIncome - totalExpenses;


  const handleDeleteStandaloneExpense = async (expenseId: string) => {
    if (!hasAccess) {
      setShowPermissionModal(true);
      return;
    }

    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir esta despesa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const { success, error } = await deleteStandaloneExpense(expenseId);
            if (success) {
              // Recarregar dados
              loadFinancialData();
              Alert.alert('Sucesso', 'Despesa excluída com sucesso!');
            } else {
              Alert.alert('Erro', error || 'Não foi possível excluir a despesa');
            }
          }
        }
      ]
    );
  };

  const renderExpense = ({ item }: { item: any }) => (
    <View style={[styles.expenseItem, { backgroundColor: colors.secondary }]}>
      <View style={styles.expenseInfo}>
        <Text style={[styles.expenseName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.expenseValue, { color: colors.error }]}>{formatCurrency(item.value)}</Text>
      </View>
    </View>
  );


  const renderEvent = ({ item }: { item: EventWithExpenses }) => (
    <View 
      style={[styles.eventCard, { backgroundColor: colors.surface }]}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventInfo}>
          <View style={styles.eventNameContainer}>
            <Text style={[styles.eventName, { color: colors.text }]}>{item.name}</Text>
            {!hasAccess && (
              <Ionicons name="lock-closed" size={16} color={colors.textSecondary} style={{ marginLeft: 8 }} />
            )}
          </View>
          <Text style={[styles.eventDate, { color: colors.textSecondary }]}>{formatDate(item.event_date)}</Text>
        </View>
        {hasAccess ? (
          <View style={styles.eventValues}>
            <View style={styles.eventValueRow}>
              <Text style={[styles.eventValueLabel, { color: colors.textSecondary }]}>Receita:</Text>
              <Text style={[styles.eventRevenue, { color: colors.success }]}>
                {formatCurrency(item.value || 0)}
              </Text>
            </View>
            {item.totalExpenses > 0 && (
              <View style={styles.eventValueRow}>
                <Text style={[styles.eventValueLabel, { color: colors.textSecondary }]}>Despesas:</Text>
                <Text style={[styles.eventExpenses, { color: colors.error }]}>
                  -{formatCurrency(item.totalExpenses)}
                </Text>
              </View>
            )}
            <View style={[styles.eventValueRow, styles.eventNetRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.eventNetLabel, { color: colors.text }]}>Líquido:</Text>
              <Text style={[styles.eventNet, { color: ((item.value || 0) - item.totalExpenses) >= 0 ? colors.success : colors.error }]}>
                {formatCurrency((item.value || 0) - item.totalExpenses)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.eventValues}>
            <View style={[styles.lockedInfo, { backgroundColor: colors.background }]}>
              <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
              <Text style={[styles.lockedText, { color: colors.textSecondary }]}>Valores ocultos</Text>
            </View>
          </View>
        )}
      </View>
      
      {hasAccess && item.expenses.length > 0 && (
        <View style={[styles.expensesSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.expensesTitle, { color: colors.text }]}>Despesas:</Text>
          <FlatList
            data={item.expenses}
            renderItem={renderExpense}
            keyExtractor={(expense) => expense.id}
            scrollEnabled={false}
          />
        </View>
      )}
    </View>
  );

  // Se ainda está verificando acesso, mostrar loading
  if (isCheckingAccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { 
          backgroundColor: colors.surface, 
          borderBottomColor: colors.border,
          paddingTop: insets.top + 20
        }]}>
          <Text style={[styles.title, { color: colors.text }]}>Financeiro</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Verificando permissões...</Text>
        </View>
      </View>
    );
  }

  // Se não há artista ativo, mostrar mensagem informativa
  if (!activeArtist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { 
          backgroundColor: colors.surface, 
          borderBottomColor: colors.border,
          paddingTop: insets.top + 20
        }]}>
          <Text style={[styles.title, { color: colors.text }]}>Financeiro</Text>
        </View>
        <View style={styles.noArtistContainer}>
          <View style={[styles.noArtistCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.noArtistIcon, { backgroundColor: colors.background }]}>
              <Ionicons name="musical-notes" size={60} color={colors.primary} />
            </View>
            
            {hasAnyArtist ? (
              /* Usuário tem artistas mas nenhum selecionado */
              <>
                <Text style={[styles.noArtistTitle, { color: colors.text }]}>
                  Selecione um Artista
                </Text>
                <Text style={[styles.noArtistMessage, { color: colors.textSecondary }]}>
                  Você precisa selecionar um artista para visualizar os dados financeiros.
                </Text>
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: colors.primary, marginTop: 20 }]}
                  onPress={() => router.push('/selecionar-artista')}
                >
                  <Ionicons name="list" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Selecionar Artista</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Usuário não tem artistas */
              <>
                <Text style={[styles.noArtistTitle, { color: colors.text }]}>
                  Nenhum Artista Selecionado
                </Text>
                <Text style={[styles.noArtistMessage, { color: colors.textSecondary }]}>
                  Para visualizar dados financeiros, você precisa ter um perfil de artista ativo.
                </Text>
                <Text style={[styles.noArtistSubMessage, { color: colors.textSecondary }]}>
                  Após criar seu perfil de artista e começar a adicionar eventos, você poderá acompanhar:
                </Text>
                
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                      Receitas dos seus eventos
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                      Controle de despesas
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                      Relatórios financeiros
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                      Análise de lucratividade
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }


  // Removido o bloqueio total - viewers podem ver a tela mas sem valores

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { 
        backgroundColor: colors.surface, 
        borderBottomColor: colors.border,
        paddingTop: insets.top + 20
      }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.text }]}>Financeiro</Text>
          
          <View style={styles.headerButtons}>
            {/* Botão de exportação - apenas para owners e editors */}
            {hasAccess && events.length > 0 && (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={handleExportFinancialReport}
              >
                <Ionicons 
                  name="share-outline" 
                  size={26} 
                  color={colors.text} 
                />
              </TouchableOpacity>
            )}

            {/* Botão Adicionar - apenas editor, admin e owner (bloqueado para visualizador) */}
            {hasAccess && (
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => setShowAddModal(true)}
              >
                <Ionicons name="add" size={28} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Navegação de mês */}
        <View style={[styles.monthNavigation, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          
          <Text style={[styles.monthText, { color: colors.text }]}>
            {months[currentMonth]} {currentYear}
          </Text>
          
          <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={[styles.content, { backgroundColor: colors.background }]}>
        {/* Resumo financeiro */}
        {hasAccess ? (
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                Lucro Líquido
              </Text>
              <Text 
                style={[styles.summaryValue, { color: netProfit >= 0 ? colors.success : colors.error }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {formatCurrency(netProfit)}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  Receita Bruta
                </Text>
                <Text 
                  style={[styles.summaryItemValue, { color: colors.success }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCurrency(totalRevenueWithIncome)}
                </Text>
              </View>
              
              <View style={[styles.summaryItem, { backgroundColor: colors.surface }]}>
                <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  Despesas Totais
                </Text>
                <Text 
                  style={[styles.summaryItemValue, { color: colors.error }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCurrency(totalExpenses)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="lock-closed" size={32} color={colors.textSecondary} style={{ marginBottom: 8 }} />
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Valores Financeiros Ocultos</Text>
              <Text style={[styles.lockedSubtext, { color: colors.textSecondary }]}>
                Apenas gerentes e editores podem visualizar dados financeiros
              </Text>
            </View>
          </View>
        )}

        {/* Lista de eventos */}
        <View style={styles.eventsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Eventos de {months[currentMonth]} ({events.length})
          </Text>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Carregando dados financeiros...
              </Text>
            </View>
          ) : events.length > 0 ? (
            <FlatList
              data={events}
              renderItem={renderEvent}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                Nenhum evento encontrado para este mês
              </Text>
            </View>
          )}
        </View>

        {/* Receitas Avulsas */}
        {hasAccess && (
          <View style={styles.eventsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              💵 Receitas Avulsas ({standaloneIncome.length})
            </Text>
            
            {standaloneIncome.length > 0 ? (
              <View style={[styles.standaloneExpensesContainer, { backgroundColor: colors.surface }]}>
                {standaloneIncome.map((income) => (
                <View key={income.id} style={[styles.standaloneExpenseItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.standaloneExpenseInfo}>
                    <View style={styles.standaloneExpenseHeader}>
                      <Text style={[styles.standaloneExpenseDescription, { color: colors.text }]}>
                        {income.description}
                      </Text>
                      <Text style={[styles.standaloneExpenseValue, { color: colors.success }]}>
                        {formatCurrency(Math.abs(income.value))}
                      </Text>
                    </View>
                    
                    <View style={styles.standaloneExpenseMeta}>
                      <View style={[styles.categoryBadge, { backgroundColor: colors.success + '20' }]}>
                        <Text style={[styles.categoryText, { color: colors.success }]}>
                          {income.category === 'show' ? '🎤 Show' :
                           income.category === 'cache_extra' ? '💵 Cachê Extra' :
                           income.category === 'streaming' ? '📺 Streaming' :
                           income.category === 'direitos' ? '📄 Direitos' :
                           income.category === 'patrocinio' ? '🎗️ Patrocínio' :
                           '⚙️ Outros'}
                        </Text>
                      </View>
                      <Text style={[styles.standaloneExpenseDate, { color: colors.textSecondary }]}>
                        {income.date ? new Date(income.date).toLocaleDateString('pt-BR') : ''}
                      </Text>
                    </View>
                    
                    {income.notes && (
                      <Text style={[styles.standaloneExpenseNotes, { color: colors.textSecondary }]} numberOfLines={2}>
                        {income.notes}
                      </Text>
                    )}
                  </View>
                  
                  <TouchableOpacity
                    style={styles.deleteExpenseButton}
                    onPress={() => handleDeleteStandaloneExpense(income.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              </View>
            ) : (
              <View style={[styles.emptyExpensesContainer, { backgroundColor: colors.surface }]}>
                <Ionicons name="cash-outline" size={32} color={colors.textSecondary} />
                <Text style={[styles.emptyExpensesText, { color: colors.textSecondary }]}>
                  Nenhuma receita avulsa neste mês
                </Text>
                <Text style={[styles.emptyExpensesHint, { color: colors.textSecondary }]}>
                  Clique no botão + para adicionar
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Despesas Avulsas */}
        {hasAccess && (
          <View style={styles.eventsSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              💸 Despesas Avulsas ({standaloneExpensesOnly.length})
            </Text>
            
            {standaloneExpensesOnly.length > 0 ? (
              <View style={[styles.standaloneExpensesContainer, { backgroundColor: colors.surface }]}>
                {standaloneExpensesOnly.map((expense) => (
                  <View key={expense.id} style={[styles.standaloneExpenseItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.standaloneExpenseInfo}>
                      <View style={styles.standaloneExpenseHeader}>
                        <Text style={[styles.standaloneExpenseDescription, { color: colors.text }]}>
                          {expense.description}
                        </Text>
                        <Text style={[styles.standaloneExpenseValue, { color: colors.error }]}>
                          {formatCurrency(expense.value)}
                        </Text>
                      </View>
                      
                      <View style={styles.standaloneExpenseMeta}>
                        <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.categoryText, { color: colors.primary }]}>
                            {expense.category === 'equipamento' ? '🔧 Equipamento' :
                             expense.category === 'manutencao' ? '🛠️ Manutenção' :
                             expense.category === 'transporte' ? '🚗 Transporte' :
                             expense.category === 'software' ? '💻 Software' :
                             expense.category === 'marketing' ? '📢 Marketing' :
                             '⚙️ Outros'}
                          </Text>
                        </View>
                        <Text style={[styles.standaloneExpenseDate, { color: colors.textSecondary }]}>
                          {expense.date ? new Date(expense.date).toLocaleDateString('pt-BR') : ''}
                        </Text>
                      </View>
                      
                      {expense.notes && (
                        <Text style={[styles.standaloneExpenseNotes, { color: colors.textSecondary }]} numberOfLines={2}>
                          {expense.notes}
                        </Text>
                      )}
                    </View>
                    
                    <TouchableOpacity
                      style={styles.deleteExpenseButton}
                      onPress={() => handleDeleteStandaloneExpense(expense.id)}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyExpensesContainer, { backgroundColor: colors.surface }]}>
                <Ionicons name="wallet-outline" size={32} color={colors.textSecondary} />
                <Text style={[styles.emptyExpensesText, { color: colors.textSecondary }]}>
                  Nenhuma despesa avulsa neste mês
                </Text>
                <Text style={[styles.emptyExpensesHint, { color: colors.textSecondary }]}>
                  Clique no botão + para adicionar
                </Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Modal de Seleção: Despesa ou Receita */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableOpacity 
          style={styles.addModalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddModal(false)}
        >
          <View style={[styles.addModalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.addModalTitle, { color: colors.text }]}>
              O que deseja adicionar?
            </Text>

            <TouchableOpacity
              style={[styles.addModalOption, { borderColor: colors.border }]}
              onPress={() => {
                setShowAddModal(false);
                router.push('/adicionar-despesa');
              }}
            >
              <View style={[styles.addModalIconContainer, { backgroundColor: colors.error + '20' }]}>
                <Ionicons name="remove-circle" size={32} color={colors.error} />
              </View>
              <View style={styles.addModalOptionText}>
                <Text style={[styles.addModalOptionTitle, { color: colors.text }]}>
                  Despesa
                </Text>
                <Text style={[styles.addModalOptionDescription, { color: colors.textSecondary }]}>
                  Gastos gerais, equipamentos, etc.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addModalOption, { borderColor: colors.border }]}
              onPress={() => {
                setShowAddModal(false);
                router.push('/adicionar-receita');
              }}
            >
              <View style={[styles.addModalIconContainer, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="add-circle" size={32} color={colors.success} />
              </View>
              <View style={styles.addModalOptionText}>
                <Text style={[styles.addModalOptionTitle, { color: colors.text }]}>
                  Receita
                </Text>
                <Text style={[styles.addModalOptionDescription, { color: colors.textSecondary }]}>
                  Ganhos extras, cachês avulsos, etc.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addModalCancelButton, { backgroundColor: colors.background }]}
              onPress={() => setShowAddModal(false)}
            >
              <Text style={[styles.addModalCancelText, { color: colors.text }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de Permissão */}
      <PermissionModal
        visible={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title="Acesso Restrito"
        message="Apenas gerentes e editores podem visualizar os detalhes e valores financeiros dos eventos. Entre em contato com um gerente para solicitar mais permissões."
        icon="lock-closed"
      />

      {/* Modal de Exportação */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.exportModalOverlay}>
          <View style={[styles.exportModalContainer, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 20) + 30 }]}>
            {/* Header */}
            <View style={styles.exportModalHeader}>
              <View style={styles.exportModalTitleContainer}>
                <Ionicons name="share-outline" size={24} color={colors.primary} />
                <Text style={[styles.exportModalTitle, { color: colors.text }]}>
                  Exportar Relatório
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Info Card */}
            <View style={[styles.exportInfoCard, { backgroundColor: colors.background }]}>
              <View style={styles.exportInfoRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={[styles.exportInfoText, { color: colors.text }]}>
                  {months[currentMonth]} de {currentYear}
                </Text>
              </View>
              <View style={styles.exportInfoRow}>
                <Ionicons name="musical-notes-outline" size={18} color={colors.primary} />
                <Text style={[styles.exportInfoText, { color: colors.text }]}>
                  {events.length} evento{events.length !== 1 ? 's' : ''}
                </Text>
              </View>
              {activeArtist && (
                <View style={styles.exportInfoRow}>
                  <Ionicons name="person-outline" size={18} color={colors.primary} />
                  <Text style={[styles.exportInfoText, { color: colors.text }]}>
                    {activeArtist.name}
                  </Text>
                </View>
              )}
            </View>

            <ScrollView style={styles.exportModalContent}>
              {/* Seção: Exportar como Documento PDF */}
              <View style={styles.exportSection}>
                <Text style={[styles.exportSectionTitle, { color: colors.text }]}>
                  📄 Exportar como Documento
                </Text>
                
                <TouchableOpacity
                  style={[styles.exportOptionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => generateReport(true)}
                >
                  <View style={[styles.exportOptionIconCircle, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="document-text" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.exportOptionContent}>
                    <Text style={[styles.exportOptionTitle, { color: colors.text }]}>
                      Com Valores Financeiros
                    </Text>
                    <Text style={[styles.exportOptionDescription, { color: colors.textSecondary }]}>
                      PDF completo com receitas, despesas e lucros
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.exportOptionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => generateReport(false)}
                >
                  <View style={[styles.exportOptionIconCircle, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="eye-off" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.exportOptionContent}>
                    <Text style={[styles.exportOptionTitle, { color: colors.text }]}>
                      Sem Valores Financeiros
                    </Text>
                    <Text style={[styles.exportOptionDescription, { color: colors.textSecondary }]}>
                      PDF apenas com agenda e locais dos eventos
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Seção: Copiar como Texto */}
              <View style={styles.exportSection}>
                <Text style={[styles.exportSectionTitle, { color: colors.text }]}>
                  📋 Copiar como Texto
                </Text>
                
                <TouchableOpacity
                  style={[styles.exportOptionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => copyAsText(true)}
                >
                  <View style={[styles.exportOptionIconCircle, { backgroundColor: '#25D366' + '15' }]}>
                    <Ionicons name="copy" size={24} color="#25D366" />
                  </View>
                  <View style={styles.exportOptionContent}>
                    <Text style={[styles.exportOptionTitle, { color: colors.text }]}>
                      Com Valores Financeiros
                    </Text>
                    <Text style={[styles.exportOptionDescription, { color: colors.textSecondary }]}>
                      Texto com receitas, despesas e lucros
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.exportOptionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => copyAsText(false)}
                >
                  <View style={[styles.exportOptionIconCircle, { backgroundColor: '#25D366' + '15' }]}>
                    <Ionicons name="list" size={24} color="#25D366" />
                  </View>
                  <View style={styles.exportOptionContent}>
                    <Text style={[styles.exportOptionTitle, { color: colors.text }]}>
                      Sem Valores Financeiros
                    </Text>
                    <Text style={[styles.exportOptionDescription, { color: colors.textSecondary }]}>
                      Texto com agenda e locais dos eventos
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 8,
  },
  navButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    padding: 20,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 15,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryItemLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryItemValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  transactionsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  transactionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 14,
    color: '#666',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  eventsSection: {
    padding: 20,
  },
  eventCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
  },
  eventValues: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  eventValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventValueLabel: {
    fontSize: 12,
    marginRight: 8,
  },
  eventRevenue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventExpenses: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventNetRow: {
    borderTopWidth: 1,
    paddingTop: 6,
    marginTop: 4,
    marginBottom: 0,
  },
  eventNetLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  eventNet: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expensesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  expensesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseName: {
    fontSize: 14,
    marginBottom: 2,
  },
  expenseValue: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  noArtistContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  noArtistCard: {
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 400,
    width: '100%',
  },
  noArtistIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noArtistTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  noArtistMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  noArtistSubMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  featuresList: {
    width: '100%',
    alignItems: 'flex-start',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  featureText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  noAccessCard: {
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 400,
    width: '100%',
  },
  noAccessIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noAccessTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  noAccessMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  noAccessSubMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  lockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  lockedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lockedSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
  exportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  exportModalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  exportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  exportModalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  exportInfoCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  exportInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  exportInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  exportModalContent: {
    paddingHorizontal: 20,
  },
  exportSection: {
    marginTop: 20,
  },
  exportSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  exportOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    gap: 12,
  },
  exportOptionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportOptionContent: {
    flex: 1,
  },
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  exportOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  standaloneExpensesContainer: {
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  standaloneExpenseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  standaloneExpenseInfo: {
    flex: 1,
    marginRight: 12,
  },
  standaloneExpenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  standaloneExpenseDescription: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  standaloneExpenseValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  standaloneExpenseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  standaloneExpenseDate: {
    fontSize: 12,
  },
  standaloneExpenseNotes: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  deleteExpenseButton: {
    padding: 8,
  },
  emptyExpensesContainer: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyExpensesText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyExpensesHint: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  addModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  addModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  addModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
  },
  addModalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addModalOptionText: {
    flex: 1,
  },
  addModalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  addModalOptionDescription: {
    fontSize: 13,
  },
  addModalCancelButton: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  addModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

