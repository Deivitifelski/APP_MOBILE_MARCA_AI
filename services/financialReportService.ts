import { Event } from './supabase/eventService';
import { Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

interface EventWithExpenses {
  id: string;
  name: string;
  event_date: string;
  value?: number;
  expenses: any[];
  totalExpenses: number;
  description?: string;
}

interface FinancialReportData {
  events: EventWithExpenses[];
  month: number;
  year: number;
  artistName?: string;
  includeFinancials?: boolean;
}

export const generateFinancialReport = async (data: FinancialReportData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { events, month, year, artistName, includeFinancials = true } = data;
    
    // Calcular totais
    const totalRevenue = events.reduce((sum, event) => sum + (event.value || 0), 0);
    const totalExpenses = events.reduce((sum, event) => sum + event.totalExpenses, 0);
    const netProfit = totalRevenue - totalExpenses;
    
    // Formatar data
    const formatDate = (dateString: string) => {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('pt-BR');
    };
    
    // Formatar moeda
    const formatCurrency = (value: number) => {
      return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    };
    
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    // Criar conteúdo do relatório financeiro
    const reportContent = `
💰 MARCA AI - RELATÓRIO FINANCEIRO MENSAL

📅 Período: ${months[month]} de ${year}
${artistName ? `🎭 Artista: ${artistName}` : ''}

📊 RESUMO GERAL
Total de Eventos: ${events.length}
${includeFinancials ? `
Receita Total: ${formatCurrency(totalRevenue)}
Despesas Totais: ${formatCurrency(totalExpenses)}
Lucro Líquido: ${formatCurrency(netProfit)} ${netProfit >= 0 ? '✅' : '❌'}
${netProfit >= 0 ? 'Resultado: POSITIVO' : 'Resultado: NEGATIVO'}
` : `
ℹ️ Os valores financeiros foram omitidos conforme solicitado.
`}

${events.length > 0 ? `
📋 DETALHAMENTO DOS EVENTOS
${events.map((event, index) => `
${index + 1}. ${event.name}
   Data: ${formatDate(event.event_date)}
   ${event.description ? `Descrição: ${event.description}` : ''}
   ${includeFinancials ? `
   Receita: ${formatCurrency(event.value || 0)}
   Despesas: ${formatCurrency(event.totalExpenses)}
   Lucro: ${formatCurrency((event.value || 0) - event.totalExpenses)} ${((event.value || 0) - event.totalExpenses) >= 0 ? '✅' : '❌'}
   ${event.expenses.length > 0 ? `
   Detalhamento das Despesas:
   ${event.expenses.map(expense => `   • ${expense.name}: ${formatCurrency(expense.value)}`).join('\n')}
   ` : ''}
   ` : ''}
`).join('')}
` : `
📋 NENHUM EVENTO ENCONTRADO
Não foram encontrados eventos para o período selecionado.
`}

📱 INFORMAÇÕES DO SISTEMA
Sistema: Marca AI - Gestão de Shows e Eventos
Relatório gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
${includeFinancials ? '💰 Relatório: COM valores financeiros' : '🔒 Relatório: SEM valores financeiros'}
    `.trim();

    // Para Expo Go, vamos mostrar o relatório em um alerta
    // e sugerir copiar o conteúdo
    Alert.alert(
      '📊 Relatório Financeiro Mensal',
      `Relatório gerado com sucesso!\n\n${reportContent}`,
      [
        {
          text: 'Copiar Relatório',
          onPress: async () => {
            try {
              await Clipboard.setStringAsync(reportContent);
              Alert.alert('Sucesso', 'Relatório copiado para a área de transferência!');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível copiar o relatório.');
            }
          }
        },
        {
          text: 'OK',
          style: 'default'
        }
      ]
    );

    return { success: true };
  } catch (error) {
    console.error('Erro ao gerar relatório financeiro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar relatório financeiro'
    };
  }
};
