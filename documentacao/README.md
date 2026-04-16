# Documentação de fluxos — Marca AI

Cada arquivo segue o **mesmo modelo**: Visão Geral, **diagrama de sequência** (Mermaid `sequenceDiagram` + `autonumber`), **Links das Queries / Chamadas** (`[Q1]` …), **Regras Importantes** e **Resultado Esperado**.

| Fluxo | Arquivo |
|--------|---------|
| Excluir conta (Auth + RPC Postgres) | [DIAGRAMA_SEQUENCIA_DELETAR_USUARIO.md](./DIAGRAMA_SEQUENCIA_DELETAR_USUARIO.md) |
| Criar usuário (Auth + `users`) | [FLUXO_CRIAR_USUARIO.md](./FLUXO_CRIAR_USUARIO.md) |
| Criar artista (`artists` + `artist_members`) | [FLUXO_CRIAR_ARTISTA.md](./FLUXO_CRIAR_ARTISTA.md) |
| Criar evento (`events` + despesas + push) | [FLUXO_CRIAR_EVENTO.md](./FLUXO_CRIAR_EVENTO.md) |
| Adicionar colaborador direto | [FLUXO_ADICIONAR_COLABORADOR.md](./FLUXO_ADICIONAR_COLABORADOR.md) |
| Convite de colaborador (`notifications`) | [FLUXO_CONVITE_COLABORADOR.md](./FLUXO_CONVITE_COLABORADOR.md) |

Os links `[Qx]` apontam para arquivos do repositório (caminhos relativos e linhas aproximadas onde aplicável).
