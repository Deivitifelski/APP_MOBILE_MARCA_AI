// Handler global de erros JavaScript
// Este arquivo deve ser importado no início do app

if (typeof global !== 'undefined') {
  // Capturar erros não tratados
  const originalErrorHandler = global.ErrorUtils?.getGlobalHandler?.();
  
  global.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
    console.error('❌ Erro JavaScript não tratado:', error);
    console.error('Stack:', error.stack);
    console.error('É fatal:', isFatal);
    
    // Aqui você pode enviar para um serviço de crash reporting
    // Ex: Sentry, Crashlytics, etc.
    
    // Chamar o handler original se existir
    if (originalErrorHandler) {
      originalErrorHandler(error, isFatal);
    }
  });
  
  // Capturar promessas rejeitadas não tratadas
  if (typeof Promise !== 'undefined' && Promise.reject) {
    const originalUnhandledRejection = global.onunhandledrejection;
    
    global.onunhandledrejection = (event: any) => {
      console.error('❌ Promise rejeitada não tratada:', event.reason);
      console.error('Stack:', event.reason?.stack);
      
      // Aqui você pode enviar para um serviço de crash reporting
      
      // Chamar o handler original se existir
      if (originalUnhandledRejection) {
        originalUnhandledRejection(event);
      }
    };
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

