# 🔙 Como Reverter a Migration (Rollback)

## ⚠️ IMPORTANTE - Leia Antes de Executar!

O **rollback** desfaz todas as mudanças da migration e:
- ❌ **DELETA** todas as despesas avulsas (event_id = NULL)
- ❌ **REMOVE** os campos novos (description, category, date, notes)
- ❌ **TORNA** event_id obrigatório novamente

---

## 🤔 Quando Usar o Rollback?

Use apenas se:
- ❌ A migration causou problemas
- ❌ Você não quer mais usar despesas avulsas
- ❌ Precisa voltar ao estado anterior

**NÃO use se:**
- ✅ A migration funcionou bem
- ✅ Já tem despesas avulsas cadastradas
- ✅ Quer manter a nova funcionalidade

---

## 🚀 Como Executar o Rollback

### **Passo 1: Backup (OBRIGATÓRIO!)**

**ANTES de fazer rollback, faça backup das despesas avulsas:**

```sql
-- Ver despesas avulsas que serão deletadas
SELECT * FROM event_expenses WHERE event_id IS NULL;

-- Exportar para backup (copie o resultado)
SELECT 
  id,
  artist_id,
  description,
  category,
  date,
  value,
  notes,
  created_at
FROM event_expenses 
WHERE event_id IS NULL;
```

**Salve este resultado em um arquivo .txt ou .csv!**

---

### **Passo 2: Executar Rollback**

1. Acesse **Supabase Dashboard** → **SQL Editor**
2. Clique em **New Query**
3. Abra: `database/rollback_event_id_nullable.sql`
4. **LEIA** todo o conteúdo
5. **COPIE** e cole no SQL Editor
6. Clique em **Run** (▶️)

---

### **Passo 3: Verificar**

```sql
-- Verificar se event_id voltou a ser obrigatório
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'event_expenses' 
AND column_name = 'event_id';

-- Resultado esperado: is_nullable = NO ✅

-- Verificar se campos foram removidos
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'event_expenses';

-- NÃO deve aparecer: description, category, date, notes
```

---

## 🛡️ Rollback Seguro (Sem Deletar Despesas)

Se você quer reverter MAS manter as despesas avulsas, edite o arquivo de rollback:

1. Abra: `database/rollback_event_id_nullable.sql`
2. **Comente** a linha 12:

```sql
-- DELETE FROM event_expenses WHERE event_id IS NULL;  ← COMENTADO
```

3. Execute o resto normalmente

**Porém:** Isso causará erro ao tornar `event_id` obrigatório (pois existem registros com NULL).

---

## 📊 Comparação

### **ANTES da Migration (Estado Original):**
```sql
event_expenses
├── id
├── event_id (NOT NULL) ← Obrigatório
├── name
├── value
├── receipt_url
├── created_at
└── updated_at
```

### **DEPOIS da Migration:**
```sql
event_expenses
├── id
├── event_id (NULLABLE) ← Opcional ✨
├── name
├── description ← NOVO
├── category ← NOVO
├── date ← NOVO
├── notes ← NOVO
├── value
├── receipt_url
├── created_at
└── updated_at
```

### **DEPOIS do Rollback (Volta ao Original):**
```sql
event_expenses
├── id
├── event_id (NOT NULL) ← Obrigatório novamente
├── name
├── value
├── receipt_url
├── created_at
└── updated_at
```

---

## ⚠️ O Que Acontece com o App?

### **Depois do Rollback:**

1. ✅ Despesas de eventos funcionam normalmente
2. ❌ Tela "Adicionar Despesa" vai dar erro (event_id obrigatório)
3. ❌ Botão flutuante (+) na tela Financeiro não funciona mais

### **Para Corrigir:**
- Remova o botão FAB da tela Financeiro
- Remova a tela `adicionar-despesa.tsx`
- Ou... mantenha a migration e não faça rollback! 😉

---

## 🆘 Problemas Após Rollback?

### **Erro: "cannot drop column because other objects depend on it"**
✅ Outros índices/views dependem do campo. Liste com:
```sql
SELECT * FROM pg_depend WHERE objid = 'event_expenses'::regclass;
```

### **Erro: "column event_id contains null values"**
✅ Ainda existem despesas avulsas. Delete antes:
```sql
DELETE FROM event_expenses WHERE event_id IS NULL;
```

### **App dando erro após rollback**
✅ Normal! A tela de despesas avulsas espera os campos novos. Opções:
1. Remova a funcionalidade do app
2. Ou não faça rollback (recomendado)

---

## 💡 Recomendação

**NÃO FAÇA ROLLBACK** a menos que seja absolutamente necessário!

A funcionalidade de despesas avulsas é muito útil e:
- ✅ Não afeta despesas de eventos existentes
- ✅ Resolve o problema de criar eventos fake
- ✅ Organiza melhor suas finanças

---

## 🔄 E se Mudar de Ideia?

Se fizer rollback e quiser voltar:
1. Execute a migration novamente: `migration_event_id_nullable.sql`
2. Restaure as despesas do backup (se fez)

---

**Tem certeza que quer fazer rollback?** Pense bem! 😊

