import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { Event } from '../services/supabase/eventService';

interface EventPDFData {
  event: Event;
  totalExpenses: number;
  creatorName?: string;
  artistName?: string;
  includeFinancials?: boolean;
}

interface AgendaPDFData {
  events: Event[];
  month: number;
  year: number;
  artistName?: string;
  includeFinancials?: boolean;
}

export const generateEventPDF = async (data: EventPDFData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { event, totalExpenses, creatorName, artistName, includeFinancials = true } = data;
    
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
            font-size: 14px;
          }
          .section {
            margin-bottom: 30px;
            background: #f9fafb;
            padding: 20px;
            border-radius: 10px;
          }
          .section-title {
            color: #667eea;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
          }
          .info-row {
            display: flex;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            font-weight: 600;
            color: #666;
            width: 150px;
          }
          .info-value {
            color: #333;
            flex: 1;
          }
          .financial-box {
            background: ${includeFinancials ? '#ecfdf5' : '#fef3c7'};
            border: 2px solid ${includeFinancials ? '#10b981' : '#f59e0b'};
            border-radius: 10px;
            padding: 20px;
            margin-top: 10px;
          }
          .financial-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 16px;
          }
          .financial-total {
            font-size: 20px;
            font-weight: bold;
            color: ${profit >= 0 ? '#10b981' : '#ef4444'};
            padding-top: 15px;
            border-top: 2px solid ${profit >= 0 ? '#10b981' : '#ef4444'};
            margin-top: 15px;
          }
          .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            background: ${event.confirmed ? '#10b981' : '#f59e0b'};
            color: white;
          }
          .description-box {
            background: white;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            margin-top: 10px;
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
          <h1>🎵 MARCA AI</h1>
          <p>Relatório de Evento</p>
        </div>

        <div class="section">
          <div class="section-title">📋 Informações do Evento</div>
          <div class="info-row">
            <div class="info-label">Nome:</div>
            <div class="info-value"><strong>${event.name}</strong></div>
          </div>
          <div class="info-row">
            <div class="info-label">Data:</div>
            <div class="info-value">${formatDate(event.event_date)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Horário:</div>
            <div class="info-value">${formatTime(event.start_time)} às ${formatTime(event.end_time)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Local:</div>
            <div class="info-value">${event.city || 'Não informado'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Contato:</div>
            <div class="info-value">${event.contractor_phone || 'Não informado'}</div>
          </div>
          ${artistName ? `<div class="info-row">
            <div class="info-label">Artista:</div>
            <div class="info-value">${artistName}</div>
          </div>` : ''}
          ${creatorName ? `<div class="info-row">
            <div class="info-label">Criado por:</div>
            <div class="info-value">${creatorName}</div>
          </div>` : ''}
          <div class="info-row">
            <div class="info-label">Status:</div>
            <div class="info-value">
              <span class="status-badge">${event.confirmed ? 'Confirmado' : 'A Confirmar'}</span>
            </div>
          </div>
        </div>

        ${includeFinancials ? `
        <div class="section">
          <div class="section-title">💰 Resumo Financeiro</div>
          <div class="financial-box">
            <div class="financial-row">
              <span>Valor do Evento:</span>
              <strong>${formatCurrency(event.value || 0)}</strong>
            </div>
            <div class="financial-row">
              <span>Total de Despesas:</span>
              <strong>-${formatCurrency(totalExpenses)}</strong>
            </div>
            <div class="financial-row financial-total">
              <span>Lucro Líquido:</span>
              <span>${formatCurrency(profit)}</span>
            </div>
            <div style="text-align: center; margin-top: 15px; font-weight: bold; color: ${profit >= 0 ? '#10b981' : '#ef4444'};">
              Resultado: ${profit >= 0 ? 'POSITIVO ✅' : 'NEGATIVO ❌'}
            </div>
          </div>
        </div>
        ` : `
        <div class="section">
          <div class="section-title">🔒 Informações Financeiras</div>
          <div class="financial-box">
            <p style="margin: 0; text-align: center;">Os valores financeiros foram omitidos conforme solicitado.</p>
          </div>
        </div>
        `}

        ${event.description ? `
        <div class="section">
          <div class="section-title">📝 Descrição</div>
          <div class="description-box">
            ${event.description}
          </div>
        </div>
        ` : ''}

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
      console.log('📄 Gerando PDF...');
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
🎵 MARCA AI - RELATÓRIO DE EVENTO

📋 INFORMAÇÕES DO EVENTO
Nome: ${event.name}
Data: ${formatDate(event.event_date)}
Horário: ${formatTime(event.start_time)} às ${formatTime(event.end_time)}
Local: ${event.city || 'Não informado'}
Contato: ${event.contractor_phone || 'Não informado'}
${artistName ? `Artista: ${artistName}` : ''}
${creatorName ? `Criado por: ${creatorName}` : ''}
Status: ${event.confirmed ? '✅ Confirmado' : '⏳ A Confirmar'}

${includeFinancials ? `💰 RESUMO FINANCEIRO
Valor do Evento: ${formatCurrency(event.value || 0)}
Total de Despesas: -${formatCurrency(totalExpenses)}
Lucro Líquido: ${formatCurrency(profit)} ${profit >= 0 ? '✅' : '❌'}
${profit >= 0 ? 'Resultado: POSITIVO' : 'Resultado: NEGATIVO'}` : '🔒 Valores financeiros omitidos'}

${event.description ? `📝 DESCRIÇÃO\n${event.description}` : ''}

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
      const fileName = `Evento_${event.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().getTime()}.pdf`;
      const newUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri
      });

      console.log('📤 Compartilhando PDF:', newUri);

      // Compartilhar PDF via sistema nativo (WhatsApp, Email, etc)
      await Sharing.shareAsync(newUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartilhar Relatório do Evento',
        UTI: 'com.adobe.pdf'
      });

      return { success: true };
    } catch (pdfError) {
      console.error('Erro ao gerar/compartilhar PDF:', pdfError);
      
      // Fallback: oferecer copiar texto
      Alert.alert(
        'Erro ao gerar PDF',
        'Não foi possível gerar o PDF. Deseja copiar o relatório em texto?',
        [
          {
            text: 'Copiar Texto',
            onPress: async () => {
              const textContent = `
🎵 MARCA AI - RELATÓRIO DE EVENTO

📋 INFORMAÇÕES DO EVENTO
Nome: ${event.name}
Data: ${formatDate(event.event_date)}
Horário: ${formatTime(event.start_time)} às ${formatTime(event.end_time)}
Local: ${event.city || 'Não informado'}
Contato: ${event.contractor_phone || 'Não informado'}
${artistName ? `Artista: ${artistName}` : ''}
${creatorName ? `Criado por: ${creatorName}` : ''}
Status: ${event.confirmed ? '✅ Confirmado' : '⏳ A Confirmar'}

${includeFinancials ? `💰 RESUMO FINANCEIRO
Valor do Evento: ${formatCurrency(event.value || 0)}
Total de Despesas: -${formatCurrency(totalExpenses)}
Lucro Líquido: ${formatCurrency(profit)} ${profit >= 0 ? '✅' : '❌'}
${profit >= 0 ? 'Resultado: POSITIVO' : 'Resultado: NEGATIVO'}` : '🔒 Valores financeiros omitidos'}

${event.description ? `📝 DESCRIÇÃO\n${event.description}` : ''}

📱 Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
              `.trim();
              
              try {
                await Clipboard.setStringAsync(textContent);
                Alert.alert('Sucesso', 'Relatório copiado para a área de transferência!');
              } catch {
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
    console.error('Erro ao gerar relatório:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar relatório' 
    };
  }
};

// Função para exportar agenda completa em PDF
export const generateAgendaPDF = async (data: AgendaPDFData): Promise<{ success: boolean; error?: string }> => {
  try {
    const { events, month, year, artistName, includeFinancials = true } = data;
    
    // Formatar data
    const formatDate = (dateString: string) => {
      const [y, m, d] = dateString.split('-').map(Number);
      const date = new Date(y, m - 1, d);
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

    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    // Agrupar eventos por dia
    const eventsByDate: { [key: string]: Event[] } = {};
    events.forEach(event => {
      if (!eventsByDate[event.event_date]) {
        eventsByDate[event.event_date] = [];
      }
      eventsByDate[event.event_date].push(event);
    });

    // Ordenar datas
    const sortedDates = Object.keys(eventsByDate).sort();

    // Criar HTML formatado para o PDF da agenda
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
          .date-section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .date-header {
            background: #667eea;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 15px;
          }
          .event-card {
            background: #f9fafb;
            padding: 18px;
            border-radius: 10px;
            margin-bottom: 12px;
            border-left: 4px solid #667eea;
          }
          .event-header {
            margin-bottom: 12px;
          }
          .event-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            display: inline;
          }
          .event-tag {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
          }
          .tag-evento {
            background: #dbeafe;
            color: #1e40af;
          }
          .tag-ensaio {
            background: #d1fae5;
            color: #065f46;
          }
          .tag-reuniao {
            background: #fef3c7;
            color: #92400e;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            margin-left: 10px;
          }
          .status-confirmado {
            background: #10b981;
            color: white;
          }
          .status-a-confirmar {
            background: #f59e0b;
            color: white;
          }
          .event-details {
            color: #666;
            font-size: 14px;
            line-height: 1.8;
          }
          .event-time {
            color: #667eea;
            font-weight: 600;
          }
          .event-financial {
            background: white;
            padding: 12px;
            border-radius: 8px;
            margin-top: 12px;
            border: 1px solid #e5e7eb;
          }
          .financial-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 14px;
          }
          .empty-state {
            text-align: center;
            padding: 60px 20px;
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
          <h1>📅 MARCA AI</h1>
          <p>Agenda de Eventos</p>
        </div>

        <div class="period">
          ${months[month]} de ${year}
          ${artistName ? `<br>🎭 ${artistName}` : ''}
        </div>

        ${sortedDates.length > 0 ? `
          ${sortedDates.map(date => `
            <div class="date-section">
              <div class="date-header">
                📅 ${formatDate(date)}
              </div>
              ${eventsByDate[date].map(event => `
                <div class="event-card">
                  <div class="event-header">
                    <span class="event-name">${event.name}</span>
                    <span class="event-tag tag-${event.tag || 'evento'}">${
                      event.tag === 'ensaio' ? 'Ensaio' : 
                      event.tag === 'reunião' ? 'Reunião' : 
                      'Evento'
                    }</span>
                    <span class="status-badge status-${event.confirmed ? 'confirmado' : 'a-confirmar'}">
                      ${event.confirmed ? '✓ Confirmado' : '⏳ A Confirmar'}
                    </span>
                  </div>
                  <div class="event-details">
                    <div class="event-time">
                      ⏰ ${formatTime(event.start_time)} - ${formatTime(event.end_time)}
                    </div>
                    ${event.city ? `<div>📍 ${event.city}</div>` : ''}
                    ${event.contractor_phone ? `<div>📞 ${event.contractor_phone}</div>` : ''}
                    ${event.description ? `<div style="margin-top: 8px; font-style: italic;">${event.description}</div>` : ''}
                  </div>
                  ${includeFinancials && event.value ? `
                  <div class="event-financial">
                    <div class="financial-row">
                      <span>Valor:</span>
                      <strong>${formatCurrency(event.value)}</strong>
                    </div>
                  </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          `).join('')}
        ` : `
        <div class="empty-state">
          <p style="font-size: 48px; margin: 0;">📅</p>
          <p style="font-size: 18px; margin: 20px 0 10px;">Nenhum evento encontrado</p>
          <p>Não há eventos programados para este período.</p>
        </div>
        `}

        <div class="footer">
          <p><strong>Sistema: Marca AI - Gestão de Shows e Eventos</strong></p>
          <p>Agenda gerada em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          <p>${includeFinancials ? '💰 Com valores financeiros' : '🔒 Sem valores financeiros'}</p>
        </div>
      </body>
    </html>
    `;

    try {
      // Gerar PDF usando expo-print
      console.log('📄 Gerando agenda em PDF...');
      const { uri } = await Print.printToFileAsync({ 
        html: htmlContent,
        base64: false 
      });
      
      console.log('✅ PDF da agenda gerado:', uri);

      // Verificar se compartilhamento está disponível
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert(
          'Compartilhamento não disponível',
          'Não foi possível compartilhar o PDF neste dispositivo.'
        );
        return { success: false, error: 'Compartilhamento não disponível' };
      }

      // Mover PDF para um local acessível
      const fileName = `Agenda_${months[month]}_${year}_${new Date().getTime()}.pdf`;
      const newUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.moveAsync({
        from: uri,
        to: newUri
      });

      console.log('📤 Compartilhando PDF da agenda:', newUri);

      // Compartilhar PDF via sistema nativo (WhatsApp, Email, etc)
      await Sharing.shareAsync(newUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartilhar Agenda',
        UTI: 'com.adobe.pdf'
      });

      return { success: true };
    } catch (pdfError) {
      console.error('Erro ao gerar/compartilhar PDF da agenda:', pdfError);
      return { success: false, error: 'Erro ao gerar PDF da agenda' };
    }
  } catch (error) {
    console.error('Erro ao gerar agenda:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido ao gerar agenda' 
    };
  }
};
