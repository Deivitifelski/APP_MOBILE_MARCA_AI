# 🔧 Mudanças Necessárias no Supabase

## 📋 O que precisa ser alterado:

### **1. HABILITAR RLS (Row Level Security)**
```sql
-- Execute estes comandos no SQL Editor do Supabase:
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_members ENABLE ROW LEVEL SECURITY;
```

### **2. CRIAR FUNÇÕES AUXILIARES**
```sql
-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID, p_artist_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM artist_members 
    WHERE user_id = p_user_id 
      AND artist_id = p_artist_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário tem acesso
CREATE OR REPLACE FUNCTION user_has_access(p_user_id UUID, p_artist_id UUID, p_required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM artist_members 
    WHERE user_id = p_user_id 
      AND artist_id = p_artist_id
      AND role = ANY(p_required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### **3. CRIAR POLÍTICAS RLS**

#### **Para tabela EVENTS:**
```sql
-- VIEWER: pode apenas listar eventos
CREATE POLICY viewer_select_events ON events
FOR SELECT
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['viewer', 'editor', 'admin', 'owner'])
);

-- EDITOR/ADMIN/OWNER: pode criar e editar eventos
CREATE POLICY editor_manage_events ON events
FOR ALL
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
);
```

#### **Para tabela ARTISTS:**
```sql
-- VIEWER/EDITOR: pode visualizar informações básicas
CREATE POLICY viewer_select_artist ON artists
FOR SELECT
USING (
  user_has_access(auth.uid(), id, ARRAY['viewer', 'editor', 'admin', 'owner'])
);

-- ADMIN/OWNER: pode atualizar informações do artista
CREATE POLICY admin_manage_artist ON artists
FOR UPDATE
USING (
  user_has_access(auth.uid(), id, ARRAY['admin', 'owner'])
);

-- OWNER: pode deletar o artista
CREATE POLICY owner_delete_artist ON artists
FOR DELETE
USING (
  user_has_access(auth.uid(), id, ARRAY['owner'])
);
```

#### **Para tabela FINANCES:**
```sql
-- EDITOR/ADMIN/OWNER: pode visualizar e gerenciar finanças
CREATE POLICY editor_manage_finances ON finances
FOR ALL
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner'])
);
```

#### **Para tabela ARTIST_MEMBERS:**
```sql
-- ADMIN/OWNER: pode gerenciar membros
CREATE POLICY admin_manage_members ON artist_members
FOR ALL
USING (
  user_has_access(auth.uid(), artist_id, ARRAY['admin', 'owner'])
);
```

### **4. CRIAR VIEWS FILTRADAS**
```sql
-- View para eventos públicos (VIEWER)
CREATE OR REPLACE VIEW public_events AS
SELECT 
  id,
  artist_id,
  name,
  description,
  event_date,
  start_time,
  end_time,
  city,
  contractor_phone,
  confirmed,
  created_at,
  updated_at
FROM events
WHERE user_has_access(auth.uid(), artist_id, ARRAY['viewer', 'editor', 'admin', 'owner']);

-- View para eventos completos (EDITOR/ADMIN/OWNER)
CREATE OR REPLACE VIEW full_events AS
SELECT 
  id,
  artist_id,
  created_by,
  name,
  description,
  event_date,
  start_time,
  end_time,
  value,
  city,
  contractor_phone,
  confirmed,
  created_at,
  updated_at
FROM events
WHERE user_has_access(auth.uid(), artist_id, ARRAY['editor', 'admin', 'owner']);
```

### **5. CRIAR FUNÇÃO FILTRADA POR ROLE**
```sql
CREATE OR REPLACE FUNCTION get_events_by_role(p_artist_id UUID)
RETURNS TABLE (
  id UUID,
  artist_id UUID,
  created_by UUID,
  name TEXT,
  description TEXT,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  value NUMERIC,
  city TEXT,
  contractor_phone TEXT,
  confirmed BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Obter role do usuário
  user_role := get_user_role(auth.uid(), p_artist_id);
  
  -- Retornar dados baseados no role
  IF user_role = 'viewer' THEN
    RETURN QUERY
    SELECT 
      e.id,
      e.artist_id,
      e.created_by,
      e.name,
      e.description,
      e.event_date,
      e.start_time,
      e.end_time,
      NULL::NUMERIC as value, -- Ocultar valor para viewer
      e.city,
      e.contractor_phone,
      e.confirmed,
      e.created_at,
      e.updated_at
    FROM events e
    WHERE e.artist_id = p_artist_id;
  ELSE
    RETURN QUERY
    SELECT 
      e.id,
      e.artist_id,
      e.created_by,
      e.name,
      e.description,
      e.event_date,
      e.start_time,
      e.end_time,
      e.value,
      e.city,
      e.contractor_phone,
      e.confirmed,
      e.created_at,
      e.updated_at
    FROM events e
    WHERE e.artist_id = p_artist_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### **6. CRIAR ÍNDICES PARA PERFORMANCE**
```sql
CREATE INDEX IF NOT EXISTS idx_artist_members_user_artist ON artist_members(user_id, artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_members_role ON artist_members(role);
CREATE INDEX IF NOT EXISTS idx_events_artist_id ON events(artist_id);
CREATE INDEX IF NOT EXISTS idx_finances_artist_id ON finances(artist_id);
```

## 🚀 Como aplicar:

### **Opção 1: Copiar e colar tudo de uma vez**
1. Abra o **SQL Editor** no Supabase
2. Copie todo o conteúdo do arquivo `supabase-permissions.sql`
3. Cole no editor e execute

### **Opção 2: Executar por partes**
1. Execute primeiro as funções auxiliares
2. Depois as políticas RLS
3. Por último as views e índices

## ✅ Verificar se funcionou:

Execute este teste no SQL Editor:
```sql
-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('artists', 'events', 'finances', 'artist_members')
AND schemaname = 'public';
```

**Resultado esperado:** `rowsecurity = true` para todas as tabelas.

## 🎯 Resultado final:

Após aplicar essas mudanças:
- ✅ **VIEWER** não verá valores financeiros
- ✅ **EDITOR** poderá criar/editar eventos
- ✅ **ADMIN** poderá gerenciar membros
- ✅ **OWNER** terá acesso total
- ✅ **Performance** otimizada com índices
