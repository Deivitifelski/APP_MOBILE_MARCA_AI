# Sistema de Despesas para Eventos

## Funcionalidades Implementadas

### 1. Criação de Eventos
- **Arquivo**: `adicionar-evento.tsx`
- **Funcionalidade**: Permite criar eventos com informações básicas
- **Integração**: Salva no Supabase na tabela `events`

### 2. Gerenciamento de Despesas
- **Arquivo**: `adicionar-despesa.tsx`
- **Funcionalidades**:
  - Adicionar nome da despesa
  - Definir valor (formatação automática em R$)
  - Adicionar descrição opcional
  - Upload de foto ou documento como comprovante
  - Validação de campos obrigatórios

### 3. Lista de Despesas
- **Arquivo**: `despesas-evento.tsx`
- **Funcionalidades**:
  - Visualizar todas as despesas do evento
  - Resumo financeiro (total de despesas)
  - Excluir despesas
  - Pull-to-refresh para atualizar dados
  - Navegação para adicionar nova despesa

### 4. Detalhes do Evento
- **Arquivo**: `detalhes-evento.tsx`
- **Funcionalidades**:
  - Visualizar informações completas do evento
  - Resumo financeiro (valor do evento - despesas = lucro)
  - Navegação para gerenciar despesas
  - Status do evento (confirmado/a confirmar)

## Serviços Criados

### EventService (`services/supabase/eventService.ts`)
- `createEvent()` - Criar evento
- `getEventsByArtist()` - Buscar eventos do artista
- `getEventById()` - Buscar evento por ID
- `updateEvent()` - Atualizar evento
- `deleteEvent()` - Deletar evento

### ExpenseService (`services/supabase/expenseService.ts`)
- `createExpense()` - Criar despesa
- `getExpensesByEvent()` - Buscar despesas do evento
- `getExpenseById()` - Buscar despesa por ID
- `updateExpense()` - Atualizar despesa
- `deleteExpense()` - Deletar despesa
- `getTotalExpensesByEvent()` - Calcular total de despesas

## Estrutura do Banco de Dados

### Tabela `events`
```sql
- id (UUID, PK)
- nome (VARCHAR)
- valor (DECIMAL)
- cidade (VARCHAR)
- telefone_contratante (VARCHAR)
- data (DATE)
- horario_inicio (TIME)
- horario_fim (TIME)
- status (VARCHAR: 'confirmado' | 'a_confirmar')
- artist_id (UUID, FK)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Tabela `expenses`
```sql
- id (UUID, PK)
- nome (VARCHAR)
- valor (DECIMAL)
- descricao (TEXT, opcional)
- arquivo_url (TEXT, opcional)
- arquivo_tipo (VARCHAR: 'image' | 'document', opcional)
- event_id (UUID, FK para events)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## Como Usar

### 1. Configurar Banco de Dados
Execute o arquivo `supabase-schema.sql` no seu projeto Supabase para criar as tabelas e políticas de segurança.

### 2. Navegação
- **Adicionar Evento**: Acesse através da agenda
- **Gerenciar Despesas**: A partir dos detalhes do evento
- **Adicionar Despesa**: Botão "+" na lista de despesas ou nos detalhes do evento

### 3. Upload de Arquivos
- **Fotos**: Usa `expo-image-picker` para selecionar da galeria
- **Documentos**: Usa `expo-document-picker` para selecionar qualquer tipo de arquivo
- **Permissões**: O app solicita permissões automaticamente

### 4. Validações
- Nome da despesa é obrigatório
- Valor deve ser um número válido
- Formatação automática de moeda (R$)
- Validação de campos obrigatórios no evento

## Dependências Instaladas
- `expo-image-picker` - Para upload de fotos
- `expo-document-picker` - Para upload de documentos

## Próximos Passos Sugeridos
1. Implementar autenticação real (obter artist_id do usuário logado)
2. Adicionar funcionalidade de editar despesas
3. Implementar categorias de despesas
4. Adicionar relatórios financeiros
5. Implementar backup/sincronização offline
6. Adicionar notificações para eventos próximos

## Segurança
- Row Level Security (RLS) habilitado
- Políticas de acesso baseadas no usuário autenticado
- Usuários só podem acessar eventos de seus artistas
- Triggers automáticos para atualizar timestamps
