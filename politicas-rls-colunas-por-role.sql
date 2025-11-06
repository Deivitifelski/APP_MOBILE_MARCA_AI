-- =====================================================
-- POLÍTICAS RLS COM SEGURANÇA POR COLUNA
-- Oculta colunas sensíveis baseado na role do usuário
-- =====================================================

-- ⚠️ IMPORTANTE: PostgreSQL RLS não suporta nativamente
-- segurança por coluna de forma simples. As opções são:
--
-- 1. Usar VIEW com CASE (criar-view-eventos-por-role.sql) ✅ RECOMENDADO
-- 2. Usar FUNÇÃO RPC (funcao-buscar-eventos-por-role.sql) ✅ RECOMENDADO
-- 3. Criar tabela auxiliar para dados sensíveis
-- 4. Usar extension pgsodium para criptografia
--
-- Vou mostrar a abordagem de tabela auxiliar abaixo:

-- =====================================================
-- OPÇÃO: Separar dados sensíveis em tabela auxiliar
-- =====================================================

-- 1️⃣ Criar tabela para dados financeiros dos eventos
CREATE TABLE IF NOT EXISTS event_financials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  value NUMERIC(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2️⃣ Política RLS: Apenas EDITOR/ADMIN/OWNER podem ver financials
CREATE POLICY editor_view_event_financials ON event_financials
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM events e
    JOIN artist_members am ON am.artist_id = e.artist_id
    WHERE e.id = event_financials.event_id
      AND am.user_id = auth.uid()
      AND am.role IN ('editor', 'admin', 'owner')
  )
);

-- 3️⃣ Política RLS: Apenas EDITOR/ADMIN/OWNER podem criar/editar
CREATE POLICY editor_manage_event_financials ON event_financials
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM events e
    JOIN artist_members am ON am.artist_id = e.artist_id
    WHERE e.id = event_financials.event_id
      AND am.user_id = auth.uid()
      AND am.role IN ('editor', 'admin', 'owner')
  )
);

-- 4️⃣ Habilitar RLS
ALTER TABLE event_financials ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- MELHOR ABORDAGEM: Manter VALUE na tabela events
-- mas usar VIEW ou FUNÇÃO RPC para filtrar
-- =====================================================

-- Isso é mais simples e mantém a estrutura atual!

-- ✅ Use: criar-view-eventos-por-role.sql
-- ou
-- ✅ Use: funcao-buscar-eventos-por-role.sql

-- =====================================================
-- RESUMO DAS OPÇÕES
-- =====================================================

/*

┌─────────────────────────────────────────────────────────────┐
│ OPÇÃO 1: VIEW com CASE                                      │
├─────────────────────────────────────────────────────────────┤
│ ✅ Simples de usar                                          │
│ ✅ Comporta-se como tabela                                  │
│ ✅ Boa performance                                          │
│ ❌ Menos flexível                                           │
│                                                              │
│ QUANDO USAR: Quando você quer transparência (app não        │
│              precisa saber que está usando VIEW)            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ OPÇÃO 2: FUNÇÃO RPC                                         │
├─────────────────────────────────────────────────────────────┤
│ ✅ Muito flexível                                           │
│ ✅ Pode ter parâmetros e lógica complexa                    │
│ ✅ Melhor controle                                          │
│ ✅ Pode validar e transformar dados                         │
│ ❌ Precisa chamar .rpc() explicitamente                     │
│                                                              │
│ QUANDO USAR: Quando você quer controle total e pode ter     │
│              lógica complexa de filtragem                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ OPÇÃO 3: Tabela Auxiliar                                    │
├─────────────────────────────────────────────────────────────┤
│ ✅ Segurança máxima (dados separados)                       │
│ ✅ RLS nativo                                               │
│ ❌ Mais complexo de manter                                  │
│ ❌ Precisa fazer JOIN sempre                               │
│ ❌ Mudança estrutural no banco                              │
│                                                              │
│ QUANDO USAR: Quando dados sensíveis precisam estar          │
│              completamente isolados                          │
└─────────────────────────────────────────────────────────────┘

RECOMENDAÇÃO: Use OPÇÃO 2 (FUNÇÃO RPC) ✅
- Mais flexível
- Seguro
- Fácil de manter
- Não precisa mudar estrutura do banco

*/

-- =====================================================
-- EXEMPLO DE USO DA FUNÇÃO RPC NO CÓDIGO
-- =====================================================

/*

// services/supabase/eventService.ts

export const getEventsByArtist = async (artistId: string) => {
  try {
    // Chama a função RPC que já filtra as colunas por role
    const { data, error } = await supabase
      .rpc('get_events_by_role', { 
        p_artist_id: artistId 
      });

    if (error) {
      return { events: null, error: error.message };
    }

    // data já vem com:
    // - Se VIEWER: { ...evento, value: null }
    // - Se EDITOR/ADMIN/OWNER: { ...evento, value: 1500.00 }
    
    return { events: data, error: null };
  } catch (error) {
    return { events: null, error: 'Erro ao buscar eventos' };
  }
};

// Na tela (app/(tabs)/agenda.tsx), não precisa mudar nada!
// O valor já virá null para viewers automaticamente

*/

-- =====================================================
-- FIM - Use funcao-buscar-eventos-por-role.sql ✅
-- =====================================================

