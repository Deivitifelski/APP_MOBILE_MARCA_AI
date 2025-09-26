// Script de teste para verificar o sistema de planos
// Execute este código no console do app para testar

import { canExportData, getUserPlan } from './services/supabase/userService';

export const testPlanVerification = async () => {
  console.log('🧪 Iniciando teste de verificação de planos...');
  
  // Obter usuário atual
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.log('❌ Nenhum usuário logado');
    return;
  }
  
  console.log('👤 Usuário logado:', user.id);
  
  // Testar getUserPlan
  console.log('\n1️⃣ Testando getUserPlan...');
  const { plan, error: planError } = await getUserPlan(user.id);
  console.log('Resultado:', { plan, error: planError });
  
  // Testar canExportData
  console.log('\n2️⃣ Testando canExportData...');
  const { canExport, error: exportError } = await canExportData(user.id);
  console.log('Resultado:', { canExport, error: exportError });
  
  // Resultado final
  console.log('\n📊 RESUMO DO TESTE:');
  console.log('Plano do usuário:', plan);
  console.log('Pode exportar:', canExport);
  console.log('Comportamento esperado:', plan === 'premium' ? 'Modal de exportação' : 'Modal de upgrade');
  
  return { plan, canExport };
};

// Para usar no console:
// testPlanVerification();

