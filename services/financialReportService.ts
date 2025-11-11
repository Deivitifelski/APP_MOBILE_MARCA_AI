import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

interface EventWithExpenses {
  id: string;
  name: string;
  event_date: string;
  value?: number;
  expenses: any[];
  totalExpenses: number;
  description?: string;
  city?: string;
}

interface StandaloneTransaction {
  id: string;
  description: string;
  value: number;
  date: string;
  category?: string;
}

interface FinancialReportData {
  events: EventWithExpenses[];
  month: number;
  year: number;
  artistName?: string;
  includeFinancials?: boolean;
  standaloneIncome?: StandaloneTransaction[];
  standaloneExpenses?: StandaloneTransaction[];
}

export const generateFinancialReport = async (data: FinancialReportData): Promise<{ success: boolean; error?: string }> => {
  console.log('🚀 === INÍCIO DA GERAÇÃO DO RELATÓRIO FINANCEIRO ===');
  console.log('📊 Dados recebidos:', {
    eventos: data.events?.length || 0,
    mes: data.month,
    ano: data.year,
    artista: data.artistName,
    incluirFinanceiro: data.includeFinancials,
    receitasAvulsas: data.standaloneIncome?.length || 0,
    despesasAvulsas: data.standaloneExpenses?.length || 0
  });
  
  try {
    const { 
      events, 
      month, 
      year, 
      artistName, 
      includeFinancials = true,
      standaloneIncome = [],
      standaloneExpenses = []
    } = data;
    
    console.log('✅ Dados extraídos com sucesso');
    
    // Calcular totais dos eventos
    console.log('💰 Calculando totais dos eventos...');
    const totalRevenue = events.reduce((sum, event) => sum + (event.value || 0), 0);
    const totalExpenses = events.reduce((sum, event) => sum + event.totalExpenses, 0);
    console.log('Receitas eventos:', totalRevenue, 'Despesas eventos:', totalExpenses);
    
    // Calcular totais das transações avulsas
    console.log('💰 Calculando totais das transações avulsas...');
    const standaloneIncomeTotal = standaloneIncome.reduce((sum, income) => sum + Math.abs(income.value), 0);
    const standaloneExpensesTotal = standaloneExpenses.reduce((sum, expense) => sum + expense.value, 0);
    console.log('Receitas avulsas:', standaloneIncomeTotal, 'Despesas avulsas:', standaloneExpensesTotal);
    
    // Totais gerais
    const totalRevenueWithIncome = totalRevenue + standaloneIncomeTotal;
    const totalExpensesWithStandalone = totalExpenses + standaloneExpensesTotal;
    const netProfit = totalRevenueWithIncome - totalExpensesWithStandalone;
    console.log('💵 TOTAIS GERAIS:', {
      receitaTotal: totalRevenueWithIncome,
      despesaTotal: totalExpensesWithStandalone,
      lucroLiquido: netProfit
    });
    
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
      const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      return daysOfWeek[date.getDay()];
    };
    
    // Formatar moeda
    const formatCurrency = (value: number) => {
      return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    };
    
    // Formatar número sem símbolo
    const formatNumber = (value: number) => {
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };
    
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    // Criar HTML formatado para o PDF
    console.log('🎨 Criando HTML do relatório...');
    console.log('📅 Mês/Ano:', months[month], year);
    const now = new Date();
    const dataGeracao = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}hs`;
    console.log('📅 Data de geração:', dataGeracao);
    
    console.log('📊 Dados do relatório:', {
      eventos: events.length,
      receitasAvulsas: standaloneIncome.length,
      despesasAvulsas: standaloneExpenses.length,
      includeFinancials
    });
    
    // Avisar se há muitos dados
    const totalItems = events.length + standaloneIncome.length + standaloneExpenses.length;
    if (totalItems > 50) {
      console.warn('⚠️ Grande quantidade de dados:', totalItems, 'itens - pode demorar mais');
    }
    
    const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            padding: 40px;
            color: #333;
            background: white;
            line-height: 1.5;
          }
          
          .header-section {
            display: flex;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 20px;
          }
          
          .logo {
            width: 70px;
            height: 70px;
            background: #667eea;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          }
          
          .logo-text {
            font-size: 42px;
            font-weight: bold;
            color: #ffffff;
            line-height: 1;
          }
          
          .header-content {
            flex: 1;
          }
          
          .artist-name {
            font-size: 32px;
            font-weight: bold;
            color: #333;
            margin-bottom: 6px;
            letter-spacing: 0.5px;
            line-height: 1.2;
          }
          
          .report-title {
            font-size: 20px;
            color: #333;
            font-weight: 700;
            margin-bottom: 6px;
          }
          
          .generated-info {
            font-size: 11px;
            color: #666;
            line-height: 1.5;
          }
          
          .header-divider {
            height: 2px;
            background: #333;
            margin: 20px 0 30px 0;
          }
          
          .section-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin: 40px 0 25px 0;
            padding-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .summary-section {
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #d1d5db;
            page-break-inside: avoid;
            page-break-before: auto;
          }
          
          .summary-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            text-align: center;
            margin-bottom: 25px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            page-break-inside: avoid;
          }
          
          .summary-item {
            text-align: center;
            padding: 25px 20px;
            border: 2px solid #d1d5db;
            background: white;
            page-break-inside: avoid;
          }
          
          .summary-label {
            font-size: 14px;
            color: #333;
            margin-bottom: 15px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .summary-value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
            line-height: 1.2;
          }
          
          .event-card {
            background: white;
            padding: 15px 0;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          
          .event-card-title {
            font-size: 15px;
            font-weight: 700;
            color: #333;
            margin-bottom: 12px;
          }
          
          .event-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #333;
            margin-top: 12px;
          }
          
          .event-table thead {
            background: #f3f4f6;
          }
          
          .event-table th {
            padding: 10px;
            text-align: left;
            font-weight: 700;
            font-size: 12px;
            color: #333;
            border: 1px solid #333;
            background: #f3f4f6;
          }
          
          .event-table td {
            padding: 8px 10px;
            border: 1px solid #333;
            font-size: 13px;
            color: #333;
          }
          
          .event-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          
          .event-table tr.total-row {
            font-weight: 700;
            background: #f3f4f6;
            border-top: 2px solid #333;
            font-size: 14px;
          }
          
          .event-label {
            color: #333;
          }
          
          .event-value {
            text-align: right;
            color: #333;
          }
          
          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
            border: 1px dashed #d1d5db;
            border-radius: 8px;
            background: #f9fafb;
          }
          
          .footer {
            margin-top: 50px;
            padding-top: 25px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #666;
            font-size: 11px;
            line-height: 1.6;
          }
          
          @media print {
            body {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <!-- Cabeçalho -->
        <div class="header-section">
          <div class="logo">
            <div class="logo-text">M</div>
          </div>
          <div class="header-content">
            ${artistName ? `<h1 class="artist-name">${artistName.toUpperCase()}</h1>` : ''}
            <h2 class="report-title">Relatório Financeiro - ${months[month]}/${year}</h2>
            <p class="generated-info">
              Relatório gerado: ${dataGeracao} pelo aplicativo Marca AI.
            </p>
          </div>
        </div>
        
        <div class="header-divider"></div>

        ${events.length > 0 ? `
        <!-- Detalhamento dos Eventos -->
        <h3 class="section-title">DETALHAMENTO DOS EVENTOS</h3>
        ${includeFinancials ? events.map((event, index) => `
          <div class="event-card">
            <div class="event-card-title">
              ${index + 1}. ${event.name} - ${formatDate(event.event_date)}
            </div>
            <table class="event-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th style="text-align: right;">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="event-label">Receita do Evento</td>
                  <td class="event-value">R$ ${formatNumber(event.value || 0)}</td>
                </tr>
                ${event.expenses.length > 0 ? event.expenses.map(expense => `
                <tr>
                  <td class="event-label">${expense.name}</td>
                  <td class="event-value">-R$ ${formatNumber(expense.value)}</td>
                </tr>
                `).join('') : ''}
                <tr class="total-row">
                  <td class="event-label">Lucro Líquido</td>
                  <td class="event-value">R$ ${formatNumber((event.value || 0) - event.totalExpenses)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        `).join('') : `
          <table class="event-table" style="margin-top: 20px;">
            <thead>
              <tr>
                <th style="width: 40%;">Nome do Evento</th>
                <th style="width: 35%; text-align: center;">Data</th>
                <th style="width: 25%; text-align: center;">Cidade</th>
              </tr>
            </thead>
            <tbody>
              ${events.map(event => `
              <tr>
                <td class="event-label">${event.name}</td>
                <td class="event-value" style="text-align: center;">
                  <strong>${getDayOfWeek(event.event_date)}</strong><br/>
                  ${formatDate(event.event_date)}
                </td>
                <td class="event-value" style="text-align: center;">${event.city || '-'}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        `}
        
        <!-- Receitas Avulsas -->
        ${includeFinancials && standaloneIncome.length > 0 ? `
        <h3 class="section-title">RECEITAS AVULSAS</h3>
        <table class="event-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th style="text-align: center;">Data</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${standaloneIncome.map(income => `
            <tr>
              <td class="event-label">${income.description}</td>
              <td class="event-value" style="text-align: center;">${formatDate(income.date)}</td>
              <td class="event-value">R$ ${formatNumber(Math.abs(income.value))}</td>
            </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2" class="event-label">Total Receitas Avulsas</td>
              <td class="event-value">R$ ${formatNumber(standaloneIncomeTotal)}</td>
            </tr>
          </tbody>
        </table>
        ` : ''}

        <!-- Despesas Avulsas -->
        ${includeFinancials && standaloneExpenses.length > 0 ? `
        <h3 class="section-title">DESPESAS AVULSAS</h3>
        <table class="event-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th style="text-align: center;">Data</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${standaloneExpenses.map(expense => `
            <tr>
              <td class="event-label">${expense.description}</td>
              <td class="event-value" style="text-align: center;">${formatDate(expense.date)}</td>
              <td class="event-value">R$ ${formatNumber(expense.value)}</td>
            </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2" class="event-label">Total Despesas Avulsas</td>
              <td class="event-value">R$ ${formatNumber(standaloneExpensesTotal)}</td>
            </tr>
          </tbody>
        </table>
        ` : ''}
        
        <!-- Resumo Financeiro -->
        ${includeFinancials ? `
        <div class="summary-section">
          <div class="summary-title">RESUMO FINANCEIRO</div>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-label">Receitas Totais</div>
              <div class="summary-value">${formatCurrency(totalRevenueWithIncome)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Despesas Totais</div>
              <div class="summary-value">${formatCurrency(totalExpensesWithStandalone)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Lucro Líquido</div>
              <div class="summary-value">${formatCurrency(netProfit)}</div>
            </div>
          </div>
        </div>
        ` : ''}
        ` : `
        <div class="empty-state">
          <p style="font-size: 18px; margin-bottom: 10px;">Nenhum evento encontrado</p>
          <p>Não foram encontrados eventos para o período selecionado.</p>
        </div>
        `}

        <div class="footer">
          <p>Marca AI - Gestão Profissional de Shows e Eventos</p>
          <p>Documento gerado automaticamente • ${includeFinancials ? 'Relatório Completo' : 'Relatório Sem Valores'}</p>
        </div>
      </body>
    </html>
    `;

    console.log('📏 Tamanho do HTML:', (htmlContent.length / 1024).toFixed(2), 'KB');

    try {
      console.log('🔄 Verificando disponibilidade de compartilhamento...');
      // Verificar se compartilhamento está disponível
      console.log('🔍 Verificando disponibilidade de compartilhamento...');
      const isAvailable = await Sharing.isAvailableAsync();
      console.log('📱 Compartilhamento disponível:', isAvailable);
      
      if (!isAvailable) {
        console.error('❌ Compartilhamento não disponível');
        return { success: false, error: 'Compartilhamento não disponível neste dispositivo' };
      }

      console.log('📄 Iniciando geração do PDF...');
      console.log('⏰ Hora de início:', new Date().toISOString());
      console.log('📏 Tamanho do HTML:', htmlContent.length, 'caracteres');
      
      // Gerar PDF usando expo-print com timeout de 30 segundos
      const printStart = Date.now();
      
      const generatePDFWithTimeout = async () => {
        const pdfPromise = Print.printToFileAsync({ 
          html: htmlContent,
          base64: false,
          // Otimizações para melhor performance
          width: 612, // Largura padrão A4 em pontos
          height: 792 // Altura padrão A4 em pontos
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: A geração do relatório excedeu 30 segundos e foi cancelada. Tente reduzir o período ou gerar sem valores financeiros.')), 30000)
        );
        
        return Promise.race([pdfPromise, timeoutPromise]);
      };
      
      const result = await generatePDFWithTimeout();
      const uri = result.uri;
      
      const printTime = ((Date.now() - printStart) / 1000).toFixed(2);
      console.log(`✅ PDF gerado em ${printTime}s`);
      
      if (!uri) {
        console.error('❌ URI do PDF vazio');
        return { success: false, error: 'Falha ao gerar arquivo PDF' };
      }

      console.log('✅ PDF gerado, URI original:', uri);
      
      // SEMPRE copiar para documentDirectory (necessário no iOS)
      console.log('📦 Copiando PDF para documentDirectory (obrigatório no iOS)...');
      const fileName = `Relatorio_Financeiro_${months[month]}_${year}_${new Date().getTime()}.pdf`;
      const newUri = FileSystem.documentDirectory + fileName;
      
      try {
        // Verificar se o arquivo original existe
        const fileInfo = await FileSystem.getInfoAsync(uri);
        console.log('📄 Arquivo original:', {
          exists: fileInfo.exists,
          size: fileInfo.size,
          isDirectory: fileInfo.isDirectory,
          uri: uri
        });
        
        if (!fileInfo.exists) {
          throw new Error('Arquivo PDF original não foi gerado corretamente');
        }
        
        // Tentar copiar
        console.log('📋 Copiando de:', uri);
        console.log('📋 Copiando para:', newUri);
        
        await FileSystem.copyAsync({
          from: uri,
          to: newUri
        });
        
        // Verificar se a cópia funcionou
        const newFileInfo = await FileSystem.getInfoAsync(newUri);
        console.log('📄 Arquivo copiado:', {
          exists: newFileInfo.exists,
          size: newFileInfo.size,
          uri: newUri
        });
        
        if (!newFileInfo.exists) {
          throw new Error('Falha ao copiar PDF para documentDirectory');
        }
        
        console.log('✅ PDF copiado com sucesso!');
        
        // Usar o arquivo copiado para compartilhar
        console.log('📤 Compartilhando PDF de:', newUri);
        const shareStart = Date.now();
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartilhar Relatório Financeiro',
          UTI: 'com.adobe.pdf'
        });
        
        const shareTime = ((Date.now() - shareStart) / 1000).toFixed(2);
        console.log(`✅ Compartilhamento concluído em ${shareTime}s`);
        
      } catch (copyError: any) {
        console.error('❌ ERRO AO COPIAR/COMPARTILHAR PDF:', copyError);
        console.error('Detalhes do erro:', {
          message: copyError?.message,
          code: copyError?.code,
          stack: copyError?.stack
        });
        throw new Error(`Falha ao processar PDF: ${copyError?.message || 'Erro desconhecido'}`);
      }
      
      const shareTime = ((Date.now() - shareStart) / 1000).toFixed(2);
      console.log(`✅ Compartilhamento concluído em ${shareTime}s`);
      
      return { success: true };
    } catch (pdfError: any) {
      console.error('❌ Erro ao gerar/compartilhar PDF:', pdfError);
      console.error('Stack trace:', pdfError?.stack);
      
      let errorMessage = 'Erro ao gerar documento';
      if (pdfError?.message?.includes('Timeout')) {
        errorMessage = pdfError.message;
      } else if (pdfError?.message) {
        errorMessage = pdfError.message;
      }
      
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    const errorMessage = error?.message || 'Erro desconhecido';
    return { success: false, error: errorMessage };
  }
};
