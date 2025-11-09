import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

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
    
    // Criar HTML formatado para o PDF
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            padding: 40px;
            color: #333;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #667eea;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #666;
            margin: 5px 0 0 0;
            font-size: 16px;
          }
          .period {
            text-align: center;
            font-size: 18px;
            color: #667eea;
            font-weight: bold;
            margin-bottom: 30px;
          }
          .section {
            margin-bottom: 30px;
            background: #f9fafb;
            padding: 20px;
            border-radius: 10px;
          }
          .section-title {
            color: #667eea;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 15px;
          }
          .summary-box {
            background: ${includeFinancials ? (netProfit >= 0 ? '#ecfdf5' : '#fef2f2') : '#fef3c7'};
            border: 2px solid ${includeFinancials ? (netProfit >= 0 ? '#10b981' : '#ef4444') : '#f59e0b'};
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 16px;
          }
          .summary-total {
            font-size: 22px;
            font-weight: bold;
            color: ${includeFinancials ? (netProfit >= 0 ? '#10b981' : '#ef4444') : '#666'};
            padding-top: 15px;
            border-top: 2px solid ${includeFinancials ? (netProfit >= 0 ? '#10b981' : '#ef4444') : '#f59e0b'};
            margin-top: 15px;
          }
          .event-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
            page-break-inside: avoid;
          }
          .event-title {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
          }
          .event-date {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
          }
          .event-financial {
            background: #f9fafb;
            padding: 10px;
            border-radius: 6px;
            margin-top: 10px;
          }
          .expense-item {
            color: #666;
            font-size: 13px;
            margin-left: 20px;
            margin-top: 5px;
          }
          .empty-state {
            text-align: center;
            padding: 40px;
            color: #999;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>💰 MARCA AI</h1>
          <p>Relatório Financeiro Mensal</p>
        </div>

        <div class="period">
          📅 ${months[month]} de ${year}
          ${artistName ? `<br>🎭 ${artistName}` : ''}
        </div>

        <div class="section">
          <div class="section-title">📊 Resumo Geral</div>
          <div class="summary-box">
            <div class="summary-row">
              <span>Total de Eventos:</span>
              <strong>${events.length}</strong>
            </div>
            ${includeFinancials ? `
            <div class="summary-row">
              <span>Receita Total:</span>
              <strong>${formatCurrency(totalRevenue)}</strong>
            </div>
            <div class="summary-row">
              <span>Despesas Totais:</span>
              <strong>-${formatCurrency(totalExpenses)}</strong>
            </div>
            <div class="summary-row summary-total">
              <span>Lucro Líquido:</span>
              <span>${formatCurrency(netProfit)}</span>
            </div>
            <div style="text-align: center; margin-top: 15px; font-weight: bold; color: ${netProfit >= 0 ? '#10b981' : '#ef4444'};">
              Resultado: ${netProfit >= 0 ? 'POSITIVO ✅' : 'NEGATIVO ❌'}
            </div>
            ` : `
            <div style="text-align: center; padding: 20px;">
              <p style="margin: 0; color: #92400e;">ℹ️ Os valores financeiros foram omitidos conforme solicitado.</p>
            </div>
            `}
          </div>
        </div>

        ${events.length > 0 ? `
        <div class="section">
          <div class="section-title">📋 Detalhamento dos Eventos</div>
          ${events.map((event, index) => `
            <div class="event-card">
              <div class="event-title">${index + 1}. ${event.name}</div>
              <div class="event-date">📅 ${formatDate(event.event_date)}</div>
              ${event.description ? `<p style="color: #666; font-size: 14px; margin: 10px 0;">${event.description}</p>` : ''}
              ${includeFinancials ? `
              <div class="event-financial">
                <div style="margin-bottom: 8px;">
                  <strong>Receita:</strong> ${formatCurrency(event.value || 0)}
                </div>
                <div style="margin-bottom: 8px;">
                  <strong>Despesas:</strong> ${formatCurrency(event.totalExpenses)}
                </div>
                <div style="margin-bottom: 8px; font-weight: bold; color: ${((event.value || 0) - event.totalExpenses) >= 0 ? '#10b981' : '#ef4444'};">
                  <strong>Lucro:</strong> ${formatCurrency((event.value || 0) - event.totalExpenses)} ${((event.value || 0) - event.totalExpenses) >= 0 ? '✅' : '❌'}
                </div>
                ${event.expenses.length > 0 ? `
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">
                  <div style="font-weight: 600; margin-bottom: 5px;">Despesas:</div>
                  ${event.expenses.map(expense => `
                    <div class="expense-item">• ${expense.name}: ${formatCurrency(expense.value)}</div>
                  `).join('')}
                </div>
                ` : ''}
              </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : `
        <div class="section">
          <div class="empty-state">
            <p>📋 NENHUM EVENTO ENCONTRADO</p>
            <p>Não foram encontrados eventos para o período selecionado.</p>
          </div>
        </div>
        `}

        <div class="footer">
          <p><strong>Sistema: Marca AI - Gestão de Shows e Eventos</strong></p>
          <p>Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          <p>${includeFinancials ? '💰 Com valores financeiros' : '🔒 Sem valores financeiros'}</p>
        </div>
      </body>
    </html>
    `;

    try {
      // Gerar PDF usando expo-print
      console.log('📄 Gerando relatório financeiro em PDF...');
      const { uri } = await Print.printToFileAsync({ 
        html: htmlContent,
        base64: false 
      });
      
      console.log('✅ PDF gerado:', uri);

      // Verificar se compartilhamento está disponível
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (!isAvailable) {
        // Fallback: copiar conteúdo em texto
        Alert.alert(
          'Compartilhamento não disponível',
          'Deseja copiar o relatório em texto?',
          [
            {
              text: 'Copiar',
              onPress: async () => {
                const textContent = `
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
` : 'ℹ️ Valores financeiros omitidos'}

${events.length > 0 ? `📋 DETALHAMENTO DOS EVENTOS
${events.map((event, index) => `
${index + 1}. ${event.name}
   Data: ${formatDate(event.event_date)}
   ${includeFinancials ? `Receita: ${formatCurrency(event.value || 0)}
   Despesas: ${formatCurrency(event.totalExpenses)}
   Lucro: ${formatCurrency((event.value || 0) - event.totalExpenses)}` : ''}
`).join('')}` : 'Nenhum evento encontrado'}

📱 Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
                `.trim();
                
                await Clipboard.setStringAsync(textContent);
                Alert.alert('Sucesso', 'Relatório copiado para a área de transferência!');
              }
            },
            { text: 'Cancelar', style: 'cancel' }
          ]
        );
        return { success: true };
      }

      // Mover PDF para um local acessível
      const fileName = `Relatorio_Financeiro_${months[month]}_${year}_${new Date().getTime()}.pdf`;
      const newUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri
      });

      console.log('📤 Compartilhando PDF financeiro:', newUri);

      // Compartilhar PDF via sistema nativo (WhatsApp, Email, etc)
      await Sharing.shareAsync(newUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartilhar Relatório Financeiro',
        UTI: 'com.adobe.pdf'
      });

      return { success: true };
    } catch (pdfError) {
      console.error('Erro ao gerar/compartilhar PDF financeiro:', pdfError);
      
      // Fallback: oferecer copiar texto
      Alert.alert(
        'Erro ao gerar PDF',
        'Não foi possível gerar o PDF. Deseja copiar o relatório em texto?',
        [
          {
            text: 'Copiar Texto',
            onPress: async () => {
              const textContent = `
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
` : 'ℹ️ Valores financeiros omitidos'}

${events.length > 0 ? `📋 DETALHAMENTO DOS EVENTOS
${events.map((event, index) => `
${index + 1}. ${event.name}
   Data: ${formatDate(event.event_date)}
   ${includeFinancials ? `Receita: ${formatCurrency(event.value || 0)}
   Despesas: ${formatCurrency(event.totalExpenses)}
   Lucro: ${formatCurrency((event.value || 0) - event.totalExpenses)}` : ''}
`).join('')}` : 'Nenhum evento encontrado'}

📱 Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
              `.trim();
              
              try {
                await Clipboard.setStringAsync(textContent);
                Alert.alert('Sucesso', 'Relatório copiado para a área de transferência!');
              } catch (error) {
                Alert.alert('Erro', 'Não foi possível copiar o relatório.');
              }
            }
          },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
      
      return { success: false, error: 'Erro ao gerar PDF' };
    }
  } catch (error) {
    console.error('Erro ao gerar relatório financeiro:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar relatório financeiro'
    };
  }
};
