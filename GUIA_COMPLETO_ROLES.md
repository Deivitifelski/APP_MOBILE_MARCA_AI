# 🎭 Guia Completo de Roles do Sistema

## 📊 Tabela Comparativa de Permissões

| **Permissão**                | 👁️ **Viewer** | ✏️ **Editor** | 🛡️ **Admin** | ⭐ **Owner** |
| ---------------------------- | :------------: | :-----------: | :-----------: | :---------: |
| **Ver eventos**              |        ✅       |       ✅       |       ✅       |      ✅      |
| **Ver valores financeiros**  |        ❌       |       ✅       |       ✅       |      ✅      |
| **Criar eventos**            |        ❌       |       ✅       |       ✅       |      ✅      |
| **Editar eventos**           |        ❌       |       ✅       |       ✅       |      ✅      |
| **Deletar eventos**          |        ❌       |       ❌       |       ✅       |      ✅      |
| **Gerenciar colaboradores**  |        ❌       |       ❌       |       ✅       |      ✅      |
| **Editar perfil do artista** |        ❌       |       ❌       |       ✅       |      ✅      |
| **Deletar artista**          |        ❌       |       ❌       |       ✅       |      ✅      |


---

## 👁️ VIEWER (Visualizador)

### ✅ O que PODE fazer:
- Ver lista de eventos na agenda
- Ver informações básicas do artista
- Ver lista de colaboradores
- Receber notificações

### ❌ O que NÃO pode fazer:
- Ver valores financeiros (aparece 🔒 cadeado)
- Criar eventos (botão "+" bloqueado)
- Editar eventos (não abre detalhes)
- Deletar eventos
- Adicionar/remover colaboradores
- Editar perfil do artista
- Deletar artista

### 📱 Comportamento no App:

**Agenda:**
```
┌─────────────────────────────┐
│ Show em São Paulo           │
│ 📍 São Paulo                │
│ 🔒 Valor oculto            │  ← Não vê valor
│          [+] ← DESABILITADO │
└─────────────────────────────┘
```

**Ao Clicar em Evento:**
```
❌ Modal: "Sem Permissão"
Você não tem permissão para visualizar 
detalhes deste evento.
```

---

## ✏️ EDITOR

### ✅ O que PODE fazer:
- ✅ Ver eventos
- ✅ Ver valores financeiros
- ✅ Criar eventos
- ✅ Editar eventos
- ✅ Ver/criar/editar despesas
- ✅ Ver colaboradores

### ❌ O que NÃO pode fazer:
- ❌ Deletar eventos
- ❌ Adicionar/remover colaboradores
- ❌ Editar perfil do artista
- ❌ Deletar artista

### 📱 Comportamento no App:

**Agenda:**
```
┌─────────────────────────────┐
│ Show em São Paulo           │
│ 📍 São Paulo                │
│ R$ 1.500,00                │  ← Vê valor
│             [+] ← HABILITADO│
└─────────────────────────────┘
```

**Ao Clicar em Evento:**
```
✅ Abre tela de detalhes
✅ Pode editar tudo
✅ Pode adicionar despesas
❌ Botão "Deletar Evento" não aparece
```

**Financeiro:**
```
✅ Vê todos os valores
✅ Vê relatórios
✅ Pode exportar dados
```

---

## 🛡️ ADMIN (Administrador)

### ✅ O que PODE fazer:
- ✅ Tudo que Editor pode
- ✅ Deletar eventos
- ✅ Adicionar/remover colaboradores
- ✅ Alterar role de colaboradores
- ✅ Editar perfil do artista
- ✅ Deletar artista
- ✅ Gerenciar convites

### ❌ O que NÃO pode fazer:
- (Nada - tem acesso total)

### 📱 Comportamento no App:

**Agenda:**
```
┌─────────────────────────────┐
│ Show em São Paulo           │
│ 📍 São Paulo                │
│ R$ 1.500,00                │
│             [+] ← HABILITADO│
└─────────────────────────────┘
```

**Detalhes do Evento:**
```
✅ Pode editar tudo
✅ Pode adicionar despesas
✅ Botão "Deletar Evento" APARECE
```

**Colaboradores:**
```
✅ Botão "Adicionar Colaborador"
✅ Pode alterar role de outros
✅ Pode remover colaboradores
✅ Pode enviar convites
```

**Perfil do Artista:**
```
✅ Pode editar nome
✅ Pode editar foto
✅ Botão "Deletar Artista" APARECE
```

---

## ⭐ OWNER (Proprietário) - LEGADO

### ℹ️ Nota:
Owner é um role **legado**. Novos artistas são criados com criador como **ADMIN**.

### ✅ Permissões:
Idênticas ao **ADMIN** (acesso total).

### 📌 Uso Atual:
- Artistas antigos podem ter "owner"
- Sistema suporta owner para retrocompatibilidade
- Funciona exatamente como admin

---

## 🔍 Diferenças Práticas no App

### 1. **AGENDA (Tela Principal)**

| Ação | Viewer | Editor | Admin | Owner |
|------|--------|--------|-------|-------|
| Ver eventos | ✅ | ✅ | ✅ | ✅ |
| Ver valores | ❌ 🔒 | ✅ | ✅ | ✅ |
| Botão "+" | ❌ | ✅ | ✅ | ✅ |
| Clicar evento | ❌ | ✅ | ✅ | ✅ |

---

### 2. **CRIAR/EDITAR EVENTO**

| Ação | Viewer | Editor | Admin | Owner |
|------|--------|--------|-------|-------|
| Criar evento | ❌ | ✅ | ✅ | ✅ |
| Editar evento | ❌ | ✅ | ✅ | ✅ |
| Deletar evento | ❌ | ❌ | ✅ | ✅ |
| Adicionar despesas | ❌ | ✅ | ✅ | ✅ |

---

### 3. **FINANCEIRO**

| Ação | Viewer | Editor | Admin | Owner |
|------|--------|--------|-------|-------|
| Ver relatórios | ❌ | ✅ | ✅ | ✅ |
| Ver valores | ❌ | ✅ | ✅ | ✅ |
| Exportar dados | ❌ | ✅ | ✅ | ✅ |

---

### 4. **COLABORADORES**

| Ação | Viewer | Editor | Admin | Owner |
|------|--------|--------|-------|-------|
| Ver lista | ✅ | ✅ | ✅ | ✅ |
| Adicionar colaborador | ❌ | ❌ | ✅ | ✅ |
| Remover colaborador | ❌ | ❌ | ✅ | ✅ |
| Alterar role | ❌ | ❌ | ✅ | ✅ |
| Enviar convites | ❌ | ❌ | ✅ | ✅ |

---

### 5. **PERFIL DO ARTISTA**

| Ação | Viewer | Editor | Admin | Owner |
|------|--------|--------|-------|-------|
| Ver informações | ✅ | ✅ | ✅ | ✅ |
| Editar nome | ❌ | ❌ | ✅ | ✅ |
| Editar foto | ❌ | ❌ | ✅ | ✅ |
| Deletar artista | ❌ | ❌ | ✅ | ✅ |

---

### 6. **NOTIFICAÇÕES**

| Tipo | Viewer | Editor | Admin | Owner |
|------|--------|--------|-------|-------|
| Recebe notificação de evento criado | ✅ | ✅ | ✅ | ✅ |
| Recebe notificação de evento atualizado | ✅ | ✅ | ✅ | ✅ |
| Recebe notificação de colaborador adicionado | ✅ | ✅ | ✅ | ✅ |

---

## 🎯 Casos de Uso por Role

### 👁️ **Use VIEWER para:**
- Músicos que só precisam ver a agenda
- Staff que só consulta horários
- Pessoas que não mexem nos dados

**Exemplo:** Técnico de som que só precisa saber data/horário dos shows

---

### ✏️ **Use EDITOR para:**
- Produtores que criam e editam eventos
- Gerentes que controlam despesas
- Pessoas de confiança para mexer na agenda

**Exemplo:** Produtor da banda que agenda shows e gerencia cachês

---

### 🛡️ **Use ADMIN para:**
- Sócios/donos da banda
- Gerentes com controle total
- Pessoas que podem demitir colaboradores

**Exemplo:** Dono da banda ou empresário principal

---

### ⭐ **OWNER (Legado):**
- Artistas antigos
- Funciona igual ao Admin
- Não é mais criado automaticamente

---

## 🔐 Código - Onde as Permissões São Usadas

### **permissionsService.ts** (Linhas 78-140):
Define todas as permissões por role.

### **agenda.tsx:**
- **handleAddShow** (linha 287): Verifica `canCreateEvents`
- **handleEventPress** (linha 202): Verifica se não é viewer
- **Renderização do valor**: Mostra 🔒 para viewer

### **colaboradores-artista.tsx:**
- Botão "Adicionar": Só admin/owner
- Alterar role: Só admin/owner
- Remover: Só admin/owner

### **detalhes-evento.tsx:**
- Botão "Deletar": Só admin/owner
- Editar campos: Editor/admin/owner

### **editar-artista.tsx:**
- Editar nome/foto: Só admin/owner

### **sair-artista.tsx:**
- Deletar artista: Só admin/owner

---

## 📋 Resumo Visual Rápido

```
┌─────────────────────────────────────────────────┐
│              MATRIZ DE PERMISSÕES               │
├──────────────┬─────────┬─────────┬──────┬───────┤
│              │ VIEWER  │ EDITOR  │ ADMIN│ OWNER │
├──────────────┼─────────┼─────────┼──────┼───────┤
│ Ver agenda   │    ✅   │    ✅   │  ✅  │  ✅   │
│ Ver valores  │    🔒   │    ✅   │  ✅  │  ✅   │
│ Criar evento │    ❌   │    ✅   │  ✅  │  ✅   │
│ Editar       │    ❌   │    ✅   │  ✅  │  ✅   │
│ Deletar      │    ❌   │    ❌   │  ✅  │  ✅   │
│ Colaborador  │    ❌   │    ❌   │  ✅  │  ✅   │
│ Delete Artist│    ❌   │    ❌   │  ✅  │  ✅   │
└──────────────┴─────────┴─────────┴──────┴───────┘
```

---

## 🎨 Visual das Roles

### **Viewer = Apenas Visualizar** 👁️
```
Pode VER mas NÃO pode MEXER
```

### **Editor = Criar e Editar** ✏️
```
Pode MEXER na agenda e despesas
mas NÃO pode DELETAR ou GERENCIAR pessoas
```

### **Admin = Controle Total** 🛡️
```
Pode fazer TUDO incluindo
DELETAR e GERENCIAR pessoas
```

### **Owner = Admin (Legado)** ⭐
```
Igual ao Admin
(não é mais criado automaticamente)
```

---

## 🚀 Recomendações

### Para Bandas/Artistas:

**Criador da banda:** Admin (automático) ✅

**Sócios/Donos:** Admin 🛡️

**Produtor/Empresário:** Editor ✏️

**Músicos da banda:** Editor ✏️

**Técnicos/Staff:** Viewer 👁️

**Assessores:** Viewer 👁️

---

**Atualizado:** 6 de Novembro de 2025

