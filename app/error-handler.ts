// Handler global de erros JavaScript
// Este arquivo deve ser importado no início do app

if (typeof global !== 'undefined') {
  // Capturar erros não tratados ANTES de qualquer coisa
  try {
    const originalErrorHandler = global.ErrorUtils?.getGlobalHandler?.();
    
    global.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      try {
        // Log seguro do erro
        const errorMessage = error?.message || 'Erro desconhecido';
        const errorStack = error?.stack || 'Stack não disponível';
        
        console.error('❌ Erro JavaScript não tratado:', errorMessage);
        console.error('Stack:', errorStack);
        console.error('É fatal:', isFatal);
        
        // Aqui você pode enviar para um serviço de crash reporting
        // Ex: Sentry, Crashlytics, etc.
        
        // Chamar o handler original se existir
        if (originalErrorHandler) {
          originalErrorHandler(error, isFatal);
        } else if (isFatal) {
          // Se for fatal e não houver handler, pelo menos logar
          console.error('❌ Erro fatal não tratado - app pode crashar');
        }
      } catch (handlerError) {
        // Se falhar ao processar o erro, pelo menos não quebrar mais
        console.error('Erro ao processar handler de erro:', handlerError);
      }
    });
  } catch (e) {
    console.error('Erro ao configurar ErrorUtils:', e);
  }
  
  // Capturar promessas rejeitadas não tratadas
  try {
    if (typeof Promise !== 'undefined') {
      const originalUnhandledRejection = global.onunhandledrejection;
      
      global.onunhandledrejection = (event: any) => {
        try {
          const reason = event?.reason || 'Razão desconhecida';
          const stack = reason?.stack || 'Stack não disponível';
          
          console.error('❌ Promise rejeitada não tratada:', reason);
          console.error('Stack:', stack);
          
          // Aqui você pode enviar para um serviço de crash reporting
          
          // Chamar o handler original se existir
          if (originalUnhandledRejection) {
            originalUnhandledRejection(event);
          }
        } catch (handlerError) {
          console.error('Erro ao processar unhandled rejection:', handlerError);
        }
      };
    }
  } catch (e) {
    console.error('Erro ao configurar unhandled rejection:', e);
  }
  
  // Capturar erros de console.error também
  try {
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      try {
        // Usar call ao invés de apply para evitar problemas
        if (typeof originalConsoleError === 'function') {
          originalConsoleError(...args);
        }
        // Você pode adicionar lógica adicional aqui se necessário
      } catch (e) {
        // Se falhar, pelo menos não quebrar - usar try/catch interno
        try {
          if (typeof originalConsoleError === 'function') {
            originalConsoleError('Erro ao logar:', e);
          }
        } catch {
          // Se ainda falhar, ignorar silenciosamente
        }
      }
    };
  } catch (e) {
    // Se falhar ao configurar, apenas ignorar
    try {
      console.error('Erro ao configurar console.error:', e);
    } catch {
      // Ignorar se nem isso funcionar
    }
  }
}

// Exportar função para logar erros de forma segura
export const logError = (error: Error, context?: string) => {
  try {
    console.error(`❌ Erro${context ? ` em ${context}` : ''}:`, error);
    console.error('Stack:', error.stack);
    
    // Aqui você pode enviar para um serviço de crash reporting
    // Ex: Sentry.captureException(error, { tags: { context } });
  } catch (e) {
    // Se falhar ao logar, pelo menos não quebra o app
    console.error('Erro ao logar erro:', e);
  }
};

