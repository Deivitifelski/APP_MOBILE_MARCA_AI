# Diagrama de Sequência - Criação de Artista

Este documento descreve o fluxo de criação de perfil de artista no app, incluindo validação de limite do plano, upload de imagem, criação no Supabase e definição do artista ativo.

## Diagrama de Sequência

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuário
    participant APP as App MarcaAI
    participant AUTH as AuthService
    participant PLAN as UserService (Plano)
    participant STORAGE as Supabase Storage
    participant API as ArtistService
    participant DB as Supabase DB
    participant CTX as ActiveArtistContext

    U->>APP: Preenche formulário de artista
    U->>APP: Toca em "Criar Perfil do Artista"

    APP->>AUTH: getCurrentUser() [Q1]
    AUTH-->>APP: user.id

    APP->>PLAN: canCreateArtist(user.id) [Q2]
    PLAN->>DB: Consulta user_subscriptions + artist_members
    DB-->>PLAN: Pode criar? (sim/não)
    PLAN-->>APP: canCreate, limite, premium

    alt Limite do plano atingido
        APP-->>U: Exibe alerta + opção "Ver Premium"
    else Pode criar
        opt Foto selecionada
            APP->>STORAGE: uploadImageToSupabase(..., image_artists) [Q3]
            STORAGE-->>APP: profile_url
        end

        APP->>API: createArtist(payload) [Q4]
        API->>DB: INSERT em artists [Q5]
        DB-->>API: artist.id
        API->>DB: INSERT em artist_members role=admin [Q6]
        DB-->>API: vínculo criado
        API-->>APP: success + artist

        APP->>CTX: setActiveArtist(artist criado) [Q7]
        CTX-->>APP: artista ativo atualizado
        APP-->>U: Modal de sucesso + navegação para agenda
    end
```

## Links das Queries/Chamadas

- **[Q1] Usuário atual autenticado**: [`services/supabase/authService.ts`](../services/supabase/authService.ts)
- **[Q2] Verificação de limite/plano para criar artista (`canCreateArtist`)**: [`services/supabase/userService.ts`](../services/supabase/userService.ts)
- **[Q3] Upload da imagem do artista (bucket `image_artists`)**: [`services/supabase/imageUploadService.ts`](../services/supabase/imageUploadService.ts)
- **[Q4] Chamada de criação (`createArtist`)**: [`services/supabase/artistService.ts`](../services/supabase/artistService.ts)
- **[Q5] INSERT na tabela `artists`**: [`services/supabase/artistService.ts`](../services/supabase/artistService.ts)
- **[Q6] INSERT na tabela `artist_members` com papel `admin`**: [`services/supabase/artistService.ts`](../services/supabase/artistService.ts)
- **[Q7] Definição do artista ativo no contexto**: [`app/screens/profile/ArtistProfileScreen.tsx`](../app/screens/profile/ArtistProfileScreen.tsx)

## Regras Importantes

- O criador do artista entra automaticamente como `admin` em `artist_members`.
- Se falhar a criação de `artist_members`, o código remove o artista recém-criado para evitar inconsistência.
- O limite de criação no plano gratuito é validado antes de tentar inserir no banco.
- Após sucesso, o novo artista vira o artista ativo da sessão.

