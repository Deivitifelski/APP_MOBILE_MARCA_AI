# Tabela de Permissões por Papel (Roles)

Este arquivo explica as diferenças entre **Visualizador**, **Editor**, **Administrador** e **Gerente** no app Marca AI. Use para tirar dúvidas ou explicar para a equipe.

---

## Tabela resumida

| Ação | Visualizador | Editor | Admin | Owner (Gerente) |
|------|:------------:|:------:|:-----:|:---------------:|
| Ver eventos | ✅ | ✅ | ✅ | ✅ |
| Ver valores financeiros | ❌ | ✅ | ✅ | ✅ |
| Criar / editar eventos | ❌ | ✅ | ✅ | ✅ |
| Deletar eventos | ❌ | ❌ | ✅ | ✅ |
| Gerenciar colaboradores | ❌ | ❌ | ✅ | ✅* |
| Editar perfil do artista | ❌ | ❌ | ✅ | ✅ |
| Deletar artista | ❌ | ❌ | ✅ | ✅ |

\* **Owner** não pode alterar nem remover um **Admin**. Apenas um Admin pode alterar/remover outros (inclusive outros Admins).

---

## O que cada papel pode e não pode fazer

### 👁️ Visualizador
- **Pode:** ver lista de eventos (sem valores), informações do artista, lista de colaboradores e receber notificações.
- **Não pode:** ver valores financeiros, criar/editar/deletar eventos, gerenciar colaboradores, editar perfil do artista ou deletar o artista.
- **Resumo:** só visualiza; não altera nada e não vê valores financeiros.

### ✏️ Editor
- **Pode:** tudo do visualizador + ver valores financeiros, criar e editar eventos, ver/criar/editar despesas, ver colaboradores e exportar dados financeiros.
- **Não pode:** deletar eventos, adicionar/remover colaboradores, alterar permissões, editar perfil do artista ou deletar o artista.
- **Resumo:** mexe na agenda e nas finanças, mas não deleta eventos e não gerencia pessoas.

### 🛡️ Administrador (Admin)
- **Pode:** tudo do editor + deletar eventos, adicionar/remover colaboradores, alterar o papel de qualquer colaborador, editar perfil do artista, deletar artista e gerenciar convites.
- **Não pode:** nada em termos de permissão (acesso total ao artista).
- **Resumo:** controle total do artista (agenda, finanças, pessoas e perfil).

### ⭐ Gerente (Owner)
- **Pode:** no app, o mesmo que o Admin (acesso total).
- **Limitação:** na tela de colaboradores, **não pode** alterar nem remover um **Admin**. Só Admin pode alterar/remover outros Admins. Owner pode alterar/remover apenas Editor e Visualizador.
- **Resumo:** mesmo poder do Admin, exceto que não mexe em quem é Admin.

---

## Sugestão de uso por tipo de pessoa

| Tipo de pessoa | Papel sugerido |
|----------------|----------------|
| Criador da banda / dono | Admin |
| Produtor / empresário | Editor |
| Músicos / técnicos (editar agenda e despesas) | Editor |
| Staff / assessores (só ver) | Visualizador |

---

*Arquivo gerado para consulta. Para detalhes técnicos e RLS, veja também `GUIA_COMPLETO_ROLES.md`.*
