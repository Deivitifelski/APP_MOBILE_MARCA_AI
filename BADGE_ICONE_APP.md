# Badge no ícone do app (número na home)

## Comportamento desejado

1. **Push com app em background** → o número no ícone do app sobe (1, 2, 3…).
2. **Abrir o app** → o número no ícone zera.

---

## 1. Push em background (+1 no contador)

Quem define o número é o **payload do FCM** enviado pela Edge Function **`send-push`**.

- A função já busca no Supabase a **contagem de não lidas** por usuário (`notifications` com `to_user_id` e `read = false`) e envia esse valor em **`badge`** no payload.
- Para o número bater certo, o seu backend precisa **inserir a notificação na tabela `notifications` antes** de chamar `send-push` (assim a contagem já inclui a nova notificação).

Fluxo correto no backend:

1. Inserir linha em `notifications` (para cada destinatário, com `read: false`).
2. Chamar a Edge Function `send-push` (artist_id, creator_user_id, title, message, etc.).

Nada mais é necessário no app para “+1” no ícone; o sistema usa o `badge` do push.

---

## 2. Zerar o badge ao abrir o app

O app chama **`setAppIconBadge(0)`** em:

- **`_layout.tsx`**: ao montar e quando o AppState fica `active`.
- **`index.tsx`**: antes de navegar para a Agenda (ou Selecionar artista).
- **`agenda.tsx`**: ao focar na tela Agenda (`useFocusEffect`).

Para isso **funcionar no iOS**, é obrigatório:

1. **Instalar dependências**
   ```bash
   npm install
   ```
   (garante que `expo-notifications` está em `node_modules`).

2. **Plugin no `app.json`**  
   O plugin `expo-notifications` já está na lista `plugins`. Se aparecer erro de plugin, rode `npm install` e tente de novo.

3. **Gerar o projeto nativo e rodar**
   ```bash
   npx expo prebuild --clean
   npx expo run:ios
   ```
   Ou só:
   ```bash
   npx expo run:ios
   ```
   (assim o código nativo do `expo-notifications` é aplicado e o badge pode ser zerado).

Sem **expo-notifications** instalado e sem **build nativo** (não use só Expo Go para testar o badge), o ícone não zera ao abrir o app.

---

## Resumo

| O que | Onde |
|-------|------|
| Número sobe a cada push (background) | Edge Function `send-push` envia `badge` = contagem do Supabase. Backend deve inserir em `notifications` antes de chamar `send-push`. |
| Número zera ao abrir o app | App chama `setAppIconBadge(0)`; depende de `expo-notifications` instalado + plugin + build nativo (`expo run:ios`). |
