# 🔧 Resolver: Usuário não é removido ao sair do artista

## 🚨 Problema
A mensagem "Saiu do artista" aparece, mas o usuário não é realmente removido.

## 💡 Causa
As **políticas RLS (Row Level Security)** do Supabase estão bloqueando a operação DELETE.

---

## ⚡ Solução (2 passos)

### Passo 1: Aplicar Política RLS no Supabase

1. **Abra o Supabase SQL Editor**
   ```
   https://app.supabase.com → SQL Editor → New Query
   ```

2. **Execute o script `politica-rls-sair-artista.sql`**
   - Copie todo o conteúdo do arquivo
   - Cole no SQL Editor
   - Clique em **Run**

Este script cria a política:
```sql
CREATE POLICY "Users can remove themselves from artist"
ON artist_members
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
);
```

### Passo 2: Testar e Verificar Logs

1. **Abra o Console do Navegador** (F12)
2. **Vá para a aba "Console"**
3. **Tente sair do artista novamente**

Você verá logs como:
```
🚪 leaveArtist: Iniciando saída do artista: [ID]
👤 leaveArtist: Usuário atual: [USER_ID]
✅ leaveArtist: Usuário é membro com role: admin
🗑️ leaveArtist: Tentando remover usuário...
✅ leaveArtist: Usuário removido com sucesso!
```

Se houver erro, verá:
```
❌ leaveArtist: Erro ao deletar: [MENSAGEM DE ERRO]
```

---

## 🔍 Diagnóstico

### Verificar se a política foi criada

Execute no Supabase SQL Editor:
```sql
SELECT 
    policyname,
    cmd,
    qual as using_clause
FROM pg_policies 
WHERE tablename = 'artist_members' 
  AND cmd = 'DELETE'
ORDER BY policyname;
```

Deve mostrar:
- ✅ `Users can remove themselves from artist`

### Verificar se RLS está ativo

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'artist_members';
```

Deve mostrar:
- ✅ `rowsecurity = true`

---

## 🆘 Se Ainda Não Funcionar

### Solução 1: Desabilitar RLS Temporariamente (APENAS PARA TESTES)

```sql
-- ⚠️ ATENÇÃO: Use apenas para testes locais!
ALTER TABLE artist_members DISABLE ROW LEVEL SECURITY;

-- Teste se funciona agora
-- Se funcionar, o problema é definitivamente nas políticas RLS

-- DEPOIS, reabilite:
ALTER TABLE artist_members ENABLE ROW LEVEL SECURITY;
```

### Solução 2: Criar Política Mais Permissiva

```sql
-- Remover política existente
DROP POLICY IF EXISTS "Users can remove themselves from artist" ON artist_members;

-- Criar política muito permissiva (TEMPORÁRIO para testes)
CREATE POLICY "Allow all deletes for testing"
ON artist_members
FOR DELETE
TO authenticated
USING (true);

-- ⚠️ Esta política permite qualquer delete! Use apenas para teste.
-- Depois, volte para a política restritiva.
```

### Solução 3: Verificar Auth

```sql
-- Ver se o usuário está autenticado corretamente
SELECT auth.uid() as current_user_id;

-- Ver membros do artista
SELECT user_id, role 
FROM artist_members 
WHERE artist_id = 'SEU_ARTIST_ID_AQUI';
```

---

## 📊 Logs Detalhados

Com a nova versão da função, você verá logs detalhados:

| Log | Significado |
|-----|-------------|
| `🚪 leaveArtist: Iniciando saída` | Função iniciada |
| `👤 leaveArtist: Usuário atual: [ID]` | Usuário identificado |
| `✅ leaveArtist: Usuário é membro com role: [ROLE]` | Verificação OK |
| `🗑️ leaveArtist: Tentando remover usuário...` | Executando DELETE |
| `✅ leaveArtist: Usuário removido com sucesso!` | Sucesso! |
| `❌ leaveArtist: Erro ao deletar: [MSG]` | Erro - veja mensagem |

---

## ✅ Checklist de Resolução

- [ ] Executei `politica-rls-sair-artista.sql` no Supabase
- [ ] Vi mensagem "Success" no SQL Editor
- [ ] Abri o Console do navegador (F12)
- [ ] Tentei sair do artista
- [ ] Verifiquei os logs no console
- [ ] Confirmei que o usuário foi removido (não aparece mais na lista)

---

## 🎯 Resultado Esperado

Após aplicar a política e testar:

1. ✅ Logs mostram "Usuário removido com sucesso!"
2. ✅ Modal de confirmação aparece
3. ✅ App redireciona para agenda
4. ✅ Artista não aparece mais na lista
5. ✅ Usuário realmente foi removido da tabela `artist_members`

---

## 📝 Notas Importantes

- A política `Users can remove themselves from artist` permite que **qualquer usuário autenticado** remova **a si mesmo**
- Ela **não** permite remover outros usuários
- É segura para produção
- Funciona independente da role (admin, editor, viewer)

---

**Execute o script SQL e verifique os logs! O problema deve ser resolvido.** 🚀

