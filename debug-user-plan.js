// Script para debugar o plano do usuário
import { supabase } from './lib/supabase.js';
import { canExportData, getUserPlan, isPremiumUser } from './services/supabase/userService.js';

const debugUserPlan = async () => {
  console.log('🔍 Iniciando debug do plano do usuário...');
  
  try {
    // Obter usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log('❌ Erro ao obter usuário:', userError);
      return;
    }
    
    if (!user) {
      console.log('❌ Nenhum usuário logado');
      return;
    }
    
    console.log('👤 Usuário logado:', {
      id: user.id,
      email: user.email,
      metadata: user.user_metadata
    });
    
    // Testar getUserPlan
    console.log('\n1️⃣ Testando getUserPlan...');
    const { plan, error: planError } = await getUserPlan(user.id);
    console.log('Resultado getUserPlan:', { plan, error: planError });
    
    // Testar isPremiumUser
    console.log('\n2️⃣ Testando isPremiumUser...');
    const { isPremium, error: premiumError } = await isPremiumUser(user.id);
    console.log('Resultado isPremiumUser:', { isPremium, error: premiumError });
    
    // Testar canExportData
    console.log('\n3️⃣ Testando canExportData...');
    const { canExport, error: exportError } = await canExportData(user.id);
    console.log('Resultado canExportData:', { canExport, error: exportError });
    
    // Verificar diretamente no banco
    console.log('\n4️⃣ Verificando diretamente no banco...');
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('id, plan, created_at')
      .eq('id', user.id)
      .single();
    
    console.log('Dados do usuário no banco:', { userData, error: dbError });
    
    // Resultado final
    console.log('\n📊 RESUMO:');
    console.log('Plano do usuário:', plan);
    console.log('É premium:', isPremium);
    console.log('Pode exportar:', canExport);
    console.log('Comportamento esperado:', plan === 'premium' ? 'NÃO deve mostrar modal' : 'DEVE mostrar modal');
    
  } catch (error) {
    console.log('💥 Erro geral:', error);
  }
};

// Executar o debug
debugUserPlan();
