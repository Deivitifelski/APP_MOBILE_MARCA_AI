import { Event } from '../services/supabase/eventService';
import { Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

interface EventPDFData {
  event: Event;
  totalExpenses: number;
  creatorName?: string;
  artistName?: string;
}

export const generateEventPDF = async (data: EventPDFData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { event, totalExpenses, creatorName, artistName } = data;
    
    // Calcular lucro
    const profit = (event.value || 0) - totalExpenses;
    
    // Formatar data
    const formatDate = (dateString: string) => {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('pt-BR');
    };
    
    // Formatar hora
    const formatTime = (timeString: string) => {
      return timeString.substring(0, 5); // HH:MM
    };
    
    // Formatar moeda
    const formatCurrency = (value: number) => {
      return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    };

    // Criar conteúdo do relatório em texto
    const reportContent = `
🎵 DETALHES DO EVENTO - ${event.name}
${'='.repeat(50)}

📅 INFORMAÇÕES DO EVENTO:
${'='.repeat(30)}
📅 Data: ${formatDate(event.event_date)}
🕐 Horário: ${formatTime(event.start_time)} - ${formatTime(event.end_time)}
📍 Local: ${event.city || 'Não informado'}
📞 Contato: ${event.contractor_phone || 'Não informado'}
${artistName ? `🎭 Artista: ${artistName}` : ''}
${creatorName ? `👤 Criado por: ${creatorName}` : ''}
✅ Status: ${event.confirmed ? 'Confirmado' : 'A Confirmar'}

💰 RESUMO FINANCEIRO:
${'='.repeat(30)}
Valor do Evento: ${formatCurrency(event.value || 0)}
Total de Despesas: -${formatCurrency(totalExpenses)}
${'='.repeat(30)}
Lucro Líquido: ${formatCurrency(profit)} ${profit >= 0 ? '✅' : '❌'}

${event.description ? `
📝 DESCRIÇÃO:
${'='.repeat(30)}
${event.description}
` : ''}

${'='.repeat(50)}
📱 Marca AI - Sistema de Gestão de Shows
📅 Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
    `.trim();

    // Para Expo Go, vamos mostrar o relatório em um alerta
    // e sugerir copiar o conteúdo
    Alert.alert(
      '📄 Relatório do Evento',
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
    console.error('Erro ao gerar relatório:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar relatório' 
    };
  }
};
