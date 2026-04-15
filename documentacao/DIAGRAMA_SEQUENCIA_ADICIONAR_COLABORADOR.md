# Diagrama de Sequência - Adicionar Colaborador

Este documento descreve o fluxo de adicionar colaborador no artista, com foco no caminho por **convite** (usado na tela de colaboradores), incluindo busca, validação de convite pendente e criação da notificação.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuário (admin/owner)
    participant APP as App MarcaAI
    participant COL as CollaboratorService
    participant INV as ArtistInviteService
    participant NOTI as NotificationService
    participant DB as Supabase DB
    participant DEST as Usuário convidado

    U->>APP: Abre "Colaboradores" e toca "+"
    APP->>COL: getCollaborators(artistId) [Q1]
    COL->>DB: SELECT artist_members (meu role + lista) [Q2]
    DB-->>COL: role e colaboradores
    COL-->>APP: canAddCollaborators + lista

    U->>APP: Busca usuário por nome
    APP->>COL: searchUsersForCollaboratorInvite(term, artistId) [Q3]
    COL->>DB: RPC buscar_usuarios_para_convite_colaborador [Q4]
    DB-->>COL: usuários elegíveis (não vinculados)
    COL-->>APP: resultados

    U->>APP: Seleciona usuário e papel (viewer/editor/admin)
    APP->>INV: checkPendingInvite(artistId, toUserId) [Q5]
    INV->>DB: SELECT notifications type=invite status=pending [Q6]
    DB-->>INV: convite pendente? (sim/não)

    alt Já existe convite pendente
        APP-->>U: Exibe modal "Convite já enviado"
        opt Reenviar
            APP->>NOTI: deletePendingInviteNotifications(...) [Q7]
            NOTI->>DB: DELETE notifications pendentes
            DB-->>NOTI: ok
        end
    end

    APP->>INV: createArtistInvite(artistId, toUserId, fromUserId, role) [Q8]
    INV->>DB: valida slot do plano (assertArtistTeamSlot) [Q9]
    DB-->>INV: slot ok
    INV->>NOTI: createNotification(type=invite, status=pending, role) [Q10]
    NOTI->>DB: INSERT notifications [Q11]
    DB-->>NOTI: notificação criada
    NOTI-->>INV: sucesso
    INV-->>APP: convite criado
    APP-->>U: Modal "Convite enviado"
    DB-->>DEST: Convite disponível em notifications
```

## Links das Queries/Chamadas

- **[Q1] Carregar colaboradores e permissões na tela**: [`services/supabase/collaboratorService.ts`](../services/supabase/collaboratorService.ts)
- **[Q2] Consultas em `artist_members` (role e lista de membros)**: [`services/supabase/collaboratorService.ts`](../services/supabase/collaboratorService.ts)
- **[Q3] Busca de usuários para convite**: [`services/supabase/collaboratorService.ts`](../services/supabase/collaboratorService.ts)
- **[Q4] RPC de busca (`buscar_usuarios_para_convite_colaborador`)**: [`database/BUSCAR_USUARIOS_COLABORADOR.sql`](../database/BUSCAR_USUARIOS_COLABORADOR.sql)
- **[Q5] Verificação de convite pendente**: [`services/supabase/artistInviteService.ts`](../services/supabase/artistInviteService.ts)
- **[Q6] Consulta na tabela `notifications` para convites pendentes**: [`services/supabase/artistInviteService.ts`](../services/supabase/artistInviteService.ts)
- **[Q7] Limpeza de convites pendentes para reenviar**: [`services/supabase/notificationService.ts`](../services/supabase/notificationService.ts)
- **[Q8] Criação de convite de artista**: [`services/supabase/artistInviteService.ts`](../services/supabase/artistInviteService.ts)
- **[Q9] Validação de limite de plano (`assertArtistTeamSlot`)**: [`services/supabase/userService.ts`](../services/supabase/userService.ts)
- **[Q10] Criação de notificação de convite**: [`services/supabase/artistInviteService.ts`](../services/supabase/artistInviteService.ts)
- **[Q11] INSERT em `notifications` (`createNotification`)**: [`services/supabase/notificationService.ts`](../services/supabase/notificationService.ts)

## Regras Importantes

- Só `owner` e `admin` podem convidar/adicionar colaboradores.
- A tela evita convite duplicado verificando `notifications` com `status = pending`.
- Convite é persistido como notificação do tipo `invite` (não depende de `artist_invites` neste fluxo).
- O papel `owner` é normalizado para `admin` ao criar novo convite direto na tela.
- O limite do plano gratuito é validado antes de enviar convite.

