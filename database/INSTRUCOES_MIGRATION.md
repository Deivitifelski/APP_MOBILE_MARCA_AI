# 🔧 Migration: Habilitar Despesas Avulsas

## 📋 O que esta migration faz?

Atualiza a tabela **`event_expenses`** existente para permitir **despesas avulsas** (sem vínculo com eventos).

### Mudanças:
1. ✅ Torna `event_id` **opcional** (pode ser NULL)
2. ✅ Adiciona campos novos para despesas avulsas:
   - `description` - Descrição da despesa
   - `category` - Categoria (equipamento, transporte, etc.)
   - `date` - Data da despesa
   - `notes` - Observações
   - `artist_id` - Referência ao artista (se não existir)
3. ✅ Cria índices para melhor performance
4. ✅ Adiciona comentários explicativos

---

## 🚀 Como Executar

### **Passo 1: Acessar Supabase**
1. Entre em [https://supabase.com](https://supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)

### **Passo 2: Executar a Migration**
1. Clique em **New Query** (+ Nova)
2. Abra o arquivo: `database/migration_event_id_nullable.sql`
3. **Copie TODO o conteúdo**
4. **Cole** no SQL Editor
5. Clique em **Run** (▶️)

### **Passo 3: Verificar Sucesso**
Você deve ver mensagens como:
```
✅ Migration concluída com sucesso!
Agora você pode criar despesas avulsas (sem event_id)
```

---

## ✅ Verificar se Funcionou

Execute no SQL Editor:

```sql
-- Ver a estrutura da tabela
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'event_expenses';
```

**Resultado esperado:**
- `event_id` → `is_nullable = YES` ✅
- `description` → existe ✅
- `category` → existe ✅
- `date` → existe ✅
- `notes` → existe ✅

---

## 🧪 Testar Inserção de Despesa Avulsa

```sql
-- Substitua 'SEU_ARTIST_ID' por um ID válido
INSERT INTO event_expenses (
  artist_id, 
  event_id,      -- NULL = despesa avulsa
  description, 
  category, 
  date, 
  value
) VALUES (
  'SEU_ARTIST_ID',
  NULL,          -- ← Despesa SEM evento
  'Teste: Parcela do equipamento',
  'equipamento',
  CURRENT_DATE,
  150.00
);

-- Buscar a despesa criada
SELECT * FROM event_expenses 
WHERE event_id IS NULL 
ORDER BY created_at DESC 
LIMIT 1;

-- Deletar o teste
DELETE FROM event_expenses 
WHERE description = 'Teste: Parcela do equipamento';
```

---

## ⚠️ Importante

### **A migration é segura?**
✅ **SIM!** A migration:
- Não apaga dados existentes
- Não modifica despesas de eventos já criadas
- Apenas adiciona novos campos (se não existirem)
- Apenas torna `event_id` opcional

### **Dados existentes são afetados?**
❌ **NÃO!** Todas as despesas de eventos existentes continuam funcionando normalmente com `event_id` preenchido.

---

## 📱 Usar no App

Depois de executar a migration:

1. ✅ Abra o app **Marca AI**
2. ✅ Vá na aba **Financeiro**
3. ✅ Clique no **botão flutuante azul (+)** no canto inferior direito
4. ✅ Preencha os dados da despesa avulsa
5. ✅ Clique em **"Adicionar Despesa"**
6. ✅ Pronto! Sua despesa foi criada sem precisar de um evento fake 🎉

---

## 🔍 Diferença Visual

### **ANTES:**
```
📅 Evento Fake: "Despesas Gerais"
  └── 💰 Parcela do violão - R$ 350,00
  └── 🚗 Combustível - R$ 80,00
  └── 🎸 Cordas - R$ 45,00
```
❌ Eventos falsos poluindo a agenda

### **AGORA:**
```
💰 Despesas Avulsas
  ├── 🎸 Parcela do violão - R$ 350,00 (Equipamento)
  ├── 🚗 Combustível - R$ 80,00 (Transporte)
  └── 🎸 Cordas - R$ 45,00 (Equipamento)
```
✅ Despesas organizadas por categoria, sem poluir a agenda!

---

## 🆘 Problemas?

### **Erro: "column event_id is not nullable"**
✅ A migration resolve isso. Execute novamente.

### **Erro: "column description already exists"**
✅ Normal! A migration verifica se existe antes de criar.

### **Erro: "permission denied"**
✅ Certifique-se de estar usando um usuário admin no Supabase.

### **App não encontra os campos novos**
1. Reinicie o app
2. Force refresh (pull down na tela)
3. Verifique se a migration foi executada com sucesso

---

## 📊 Estrutura Final

```sql
event_expenses
├── id (UUID, PK)
├── artist_id (UUID, FK) ← Sempre obrigatório
├── event_id (UUID, FK) ← AGORA OPCIONAL! ✨
│
├── Campos para EVENTOS:
│   ├── name (VARCHAR)
│   └── receipt_url (TEXT)
│
├── Campos para DESPESAS AVULSAS:
│   ├── description (TEXT) ← NOVO!
│   ├── category (VARCHAR) ← NOVO!
│   ├── date (DATE) ← NOVO!
│   └── notes (TEXT) ← NOVO!
│
├── Comum:
│   ├── value (DECIMAL)
│   ├── created_at (TIMESTAMP)
│   └── updated_at (TIMESTAMP)
```

---

**Tudo pronto!** Execute a migration e teste no app! 🚀

