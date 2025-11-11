# 🔒 Instruções: Políticas RLS para Update de Artistas

## ⚠️ Problema Identificado

O log mostrou que o UPDATE está funcionando no banco, mas o SELECT retorna vazio:
```json
{
  "dataLength": 0,        // ← SELECT não retorna dados
  "error": undefined,     
  "success": true,        // ← UPDATE funcionou!
  "updatedArtist": undefined
}
```

**Causa:** As políticas RLS (Row Level Security) do Supabase estão bloqueando o SELECT após o UPDATE.

---

## 🛠️ Solução: Aplicar Políticas RLS

### **Passo 1: Acessar o Supabase Dashboard**

1. Acesse: https://supabase.com
2. Entre no projeto **Marca AI**
3. Vá em **SQL Editor** (no menu lateral esquerdo)

### **Passo 2: Executar Script SQL**

Copie e cole o conteúdo do arquivo: `politica-rls-update-artists.sql`

Ou copie o SQL abaixo:

```sql
-- Remover políticas existentes
DROP POLICY IF EXISTS "Apenas owner e admin podem atualizar artistas" ON artists;
DROP POLICY IF EXISTS "Usuários podem ver seus artistas" ON artists;

-- Criar política para UPDATE (apenas owner e admin)
CREATE POLICY "Apenas owner e admin podem atualizar artistas"
ON artists
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM artist_members
    WHERE artist_members.artist_id = artists.id
    AND artist_members.user_id = auth.uid()
    AND artist_members.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM artist_members
    WHERE artist_members.artist_id = artists.id
    AND artist_members.user_id = auth.uid()
    AND artist_members.role IN ('owner', 'admin')
  )
);

-- Criar política para SELECT (todos os membros)
CREATE POLICY "Usuários podem ver seus artistas"
ON artists
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM artist_members
    WHERE artist_members.artist_id = artists.id
    AND artist_members.user_id = auth.uid()
  )
);
```

### **Passo 3: Clicar em "RUN"**

O script vai:
- ✅ Remover políticas antigas
- ✅ Criar política de UPDATE (apenas owner e admin)
- ✅ Criar política de SELECT (todos os membros)

### **Passo 4: Verificar Políticas**

Execute este SQL para verificar:

```sql
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'artists'
ORDER BY policyname;
```

Deve mostrar:
- ✅ Política de UPDATE
- ✅ Política de SELECT

---

## 🎯 O que Isso Resolve

### **ANTES:**
- ❌ UPDATE funcionava, mas SELECT retornava vazio
- ❌ App não conseguia confirmar dados atualizados
- ❌ Telas não atualizavam

### **DEPOIS:**
- ✅ UPDATE funciona (apenas owner e admin)
- ✅ SELECT retorna dados atualizados
- ✅ App confirma atualização
- ✅ Todas as telas atualizam automaticamente
- ✅ Segurança: Editor e Viewer **NÃO** podem editar artista

---

## 🔐 Controle de Acesso Final

| Role | Pode Editar Artista? | Pode Ver Artista? |
|------|---------------------|-------------------|
| **Owner** | ✅ Sim | ✅ Sim |
| **Admin** | ✅ Sim | ✅ Sim |
| **Editor** | ❌ Não | ✅ Sim |
| **Viewer** | ❌ Não | ✅ Sim |

---

## 📝 Nota Importante

Após aplicar o SQL:
1. **Teste editar o artista** no app
2. Veja os logs no console
3. Agora deve mostrar: `"dataLength": 1` e `"updatedArtist": { dados }`

Se precisar de ajuda, consulte o arquivo: `politica-rls-update-artists.sql`

