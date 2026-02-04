# Resposta às Diretrizes da Apple (App Store Review)

Este documento orienta como resolver os pontos levantados na análise do App Store.

---

## Diretriz 2.3.3 - Desempenho - Metadados Precisos

**Problema:** As capturas de tela do iPhone 5,5" mostram apenas a tela de login e não refletem o app em uso.

### O que fazer

1. **Gerar novas capturas de tela** em dispositivos reais ou simuladores, mostrando:
   - **Tela principal do app** (após login): agenda, eventos ou artista selecionado.
   - **Funcionalidades principais:** por exemplo, lista de eventos, detalhes de um evento, finanças (se Premium), colaboradores.
   - **Tela de planos/assinatura** (Planos e Pagamentos).
   - Evite usar apenas a tela de login como primeira imagem.

2. **Tamanhos obrigatórios (iPhone):**
   - 6,7" (iPhone 15 Pro Max, 14 Pro Max, etc.)
   - 6,5" (iPhone 11 Pro Max, XS Max)
   - 5,5" (iPhone 8 Plus) — **este era o que estava incorreto**
   - Inclua todos os tamanhos que o App Store Connect solicitar.

3. **No App Store Connect:**
   - Vá em **App** → **Pré-visualizações e Capturas de Tela**.
   - Selecione **"Exibir todos os tamanhos no Gerenciador de Mídia"**.
   - Envie capturas para **cada** tamanho de dispositivo listado.
   - As imagens devem refletir o **conceito principal** e o **valor** do app (gestão de agenda/eventos para artistas).

4. **Dica:** Use o simulador (Xcode) ou dispositivo físico, faça login, navegue até as telas principais e capture (Cmd+S no simulador ou botão lateral + volume no dispositivo).

---

## Diretriz 3.1.2 - Negócios - Pagamentos - Assinaturas

**Problema:** Faltavam link para Política de Privacidade e Termos de Uso (EULA).

### Alterações no app (já implementadas)

- Na tela **Planos e Pagamentos** foram adicionados:
  - Link funcional para **Política de Privacidade**
  - Link funcional para **Termos de Uso (EULA)**
  - Exibição de **título da assinatura**, **duração** (ex.: “Assinatura mensal com renovação automática”) e **preço**
  - Botão **Restaurar compras**

As URLs estão em `constants/legal.ts`. **Você deve:**

1. **Criar as páginas reais** (se ainda não existirem):
   - Política de Privacidade: ex. `https://www.marcaai.com/privacidade` (ou seu domínio).
   - Termos de Uso (EULA): ex. `https://www.marcaai.com/termos`.

2. **Atualizar `constants/legal.ts`** com as URLs definitivas:
   ```ts
   export const LEGAL_URLS = {
     PRIVACY_POLICY: 'https://SEU_DOMINIO/privacidade',
     TERMS_OF_USE_EULA: 'https://SEU_DOMINIO/termos',
   };
   ```

### No App Store Connect

1. **Política de Privacidade**
   - Em **App** → **Informações do App** (ou **App Information**).
   - No campo **"Política de Privacidade"** (URL), informe o **mesmo** link usado no app (ex.: `https://www.marcaai.com/privacidade`).

2. **Termos de Uso (EULA)**
   - **Opção A – EULA padrão da Apple:**  
     Na **Descrição do app**, inclua uma frase como:  
     *"Termos de Uso (EULA): [link para seus termos]".*
   - **Opção B – EULA personalizado:**  
     No App Store Connect, no campo **"EULA"** (se disponível para o app), adicione o texto ou o link para o EULA.

Garanta que os links do App Store Connect abrem corretamente no navegador.

---

## Diretriz 2.1 - Desempenho - Integridade do App (Planos não disponíveis no iPad)

**Problema:** Nenhum “Plano” estava disponível durante a análise no iPad Air 11" (M3), iPadOS 26.2.1.

### O que foi ajustado no código

- A tela **Planos e Pagamentos** passou a usar o **iapService** (RevenueCat) de forma centralizada:
  - Uso de `getAvailableProducts()` que garante usuário logado e RevenueCat configurado com `userId` antes de buscar ofertas.
  - Isso deve melhorar o carregamento dos planos também em iPad.

### O que você deve conferir

1. **Contrato de Apps Pagos**
   - App Store Connect → **Acordos, Tributação e Bancário** (ou **Agreements, Tax, and Banking**).
   - Confirme que o **Contrato de Apps Pagos** está **em vigor** (assinado e ativo).

2. **Produtos de assinatura no App Store Connect**
   - **App** → seu app → **Produtos In-App** (ou **In-App Purchases**).
   - Verifique se o produto de assinatura (ex.: mensal) está:
     - **Criado** e **ativo**.
     - Associado ao **mesmo App Store Connect** do app.
     - Com **preço** e **referência local** definidos.

3. **RevenueCat**
   - No dashboard do RevenueCat, confirme:
     - Produtos e **Offerings** configurados para **iOS**.
     - **Offerings** com pelo menos um **Package** e produto vinculado ao ID do App Store Connect.

4. **Teste em ambiente Sandbox**
   - No iPad (ou simulador iPad), use uma **conta Sandbox** da Apple (App Store Connect → **Usuários e Acesso** → **Sandbox** → **Testadores**).
   - Faça login no app com um usuário real do seu backend.
   - Abra **Configurações** → **Planos e Pagamentos** e confira se os planos aparecem e se a compra inicia no sandbox.

5. **Nota da Apple:** *"Os produtos não precisam de aprovação prévia para funcionar durante a análise"* — ou seja, o produto só precisa estar configurado e funcionando no sandbox; a análise usa esse ambiente.

---

## Checklist antes de reenviar

- [ ] Novas capturas de tela para todos os tamanhos (incl. iPhone 5,5" e iPads, se aplicável), mostrando o app em uso.
- [ ] No app: links de Política de Privacidade e Termos de Uso funcionando na tela de Planos e Pagamentos.
- [ ] URLs em `constants/legal.ts` apontando para as páginas reais.
- [ ] App Store Connect: campo Política de Privacidade preenchido com URL funcional.
- [ ] App Store Connect: Termos de Uso (EULA) na descrição ou no campo EULA.
- [ ] Contrato de Apps Pagos ativo.
- [ ] Produto(s) de assinatura configurados e testados no sandbox (incl. iPad).
- [ ] Teste no iPad com conta sandbox: tela de planos carrega e exibe pelo menos um plano.

Depois de concluir esses itens, reenvie o app para análise.
