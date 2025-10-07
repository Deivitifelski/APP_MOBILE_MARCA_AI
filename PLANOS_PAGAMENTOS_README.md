# Sistema de Planos e Pagamentos

## Funcionalidades Implementadas

### 1. Tela de Planos e Pagamentos (`app/planos-pagamentos.tsx`)
- **Design moderno estilo SaaS**: Interface clean e profissional
- **2 planos disponíveis**: Free e Premium
- **Cards visuais**: Cada plano em um card com design diferenciado
- **Badge de destaque**: "Recomendado" para o plano Premium
- **Comparação de funcionalidades**: Tabela detalhada
- **Informação sobre assinaturas**: Aviso sobre disponibilidade via lojas de apps

### 2. Planos Disponíveis

#### 🆓 **Free** (Cinza)
- **Preço**: R$ 0/mês
- **Usuários**: 1
- **Funcionalidades**:
  - Eventos básicos
  - Agenda simples
  - Notificações básicas
- **Limitações**:
  - Sem acesso a finanças
  - Sem relatórios avançados
  - Sem suporte prioritário

#### 💎 **Premium** (Dourado)
- **Preço**: R$ 9,99/mês
- **Usuários**: Ilimitados
- **Funcionalidades**:
  - Eventos completos
  - Finanças completas
  - Relatórios avançados
  - Exportação PDF
  - Suporte prioritário
  - Colaboradores ilimitados
  - Agenda compartilhada

### 3. Sistema de Pagamento

#### **In-App Purchases (IAP)**:
As assinaturas serão gerenciadas através dos sistemas nativos das lojas:

- **App Store (iOS)**: Apple In-App Purchases
- **Google Play (Android)**: Google Play Billing

#### **Benefícios do IAP**:
- ✅ Pagamento seguro através da loja
- ✅ Gerenciamento de assinatura pelo usuário
- ✅ Cancelamento fácil nas configurações do dispositivo
- ✅ Conformidade com as políticas das lojas
- ✅ Suporte a diferentes métodos de pagamento locais

### 4. Design e UX

#### **Características Visuais**:
- **Cards responsivos**: Layout adaptável para diferentes tamanhos de tela
- **Cores diferenciadas**: Cada plano tem sua cor característica
- **Badge de destaque**: Visual chamativo para plano recomendado
- **Ícones intuitivos**: Gift (Free), Diamond (Premium)
- **Sombras e elevação**: Efeitos visuais modernos

#### **Interatividade**:
- **Botões informativos**: Cada card tem botão com status
- **Alertas informativos**: Informação sobre disponibilidade
- **Navegação fluida**: Botão de voltar e navegação intuitiva

### 5. Seções da Tela

#### **Hero Section**:
- Título principal: "Seja Premium"
- Subtítulo explicativo sobre funcionalidades

#### **Cards de Planos**:
- Layout em grid vertical
- Informações detalhadas de cada plano
- Lista de funcionalidades incluídas
- Lista de limitações (quando aplicável)
- Botão de ação para cada plano

#### **Card Informativo**:
- Aviso sobre disponibilidade via lojas de apps
- Ícone e texto explicativo

#### **Tabela de Comparação**:
- Comparação lado a lado de funcionalidades
- Headers organizados por plano
- Linhas para cada funcionalidade
- Visual limpo e fácil de comparar

### 6. Cancelamento de Plano

A tela `app/cancelar-plano.tsx` fornece:

- **Instruções detalhadas**: Como cancelar via App Store ou Google Play
- **Avisos importantes**: O que o usuário perderá ao cancelar
- **Informações sobre reembolso**: Política de reembolso
- **Suporte**: Opção de contatar o suporte antes de cancelar

#### **Como Cancelar**:

**App Store (iOS)**:
1. Abra Ajustes no iPhone
2. Toque no seu nome
3. Toque em Assinaturas
4. Selecione MarcaAi
5. Toque em Cancelar Assinatura

**Google Play (Android)**:
1. Abra o Google Play Store
2. Toque no ícone de perfil
3. Toque em Pagamentos e assinaturas
4. Selecione Assinaturas
5. Selecione MarcaAi
6. Toque em Cancelar assinatura

### 7. Integração

#### **Navegação**:
- **Configurações** → "Planos e Pagamentos"
- **Rota**: `/planos-pagamentos`
- **Header customizado**: Com botão de voltar

#### **Estados e Feedback**:
- **Alertas**: Informação sobre disponibilidade
- **Navegação**: Navegação fluida entre telas

### 8. Tecnologias Utilizadas

- **React Native**: Componentes nativos
- **TypeScript**: Tipagem forte
- **Expo Router**: Navegação
- **Safe Area**: Suporte a diferentes dispositivos
- **Theme Context**: Suporte a modo escuro/claro
- **Ionicons**: Ícones consistentes

### 9. Próximas Implementações

#### **Sistema de Pagamento IAP**:
- Integração com Apple In-App Purchases
- Integração com Google Play Billing
- Gerenciamento de assinaturas
- Histórico de compras
- Webhooks para sincronização com backend

#### **Revenue Cat (Recomendado)**:
- Gerenciamento unificado de IAP
- Sincronização com Supabase
- Analytics de assinaturas
- Testes gratuitos e ofertas
- Suporte a múltiplas plataformas

#### **Funcionalidades Avançadas**:
- Teste gratuito de 7 dias
- Upgrade/downgrade de planos
- Ofertas especiais
- Faturamento e recibos

#### **Analytics**:
- Tracking de conversões
- Métricas de uso por plano
- Relatórios de receita

### 10. Como Usar

1. **Acessar**: Configurações → "Planos e Pagamentos"
2. **Visualizar**: Comparar os planos disponíveis
3. **Informar-se**: Ler sobre disponibilidade via lojas
4. **Aguardar**: Implementação de IAP em versão futura

### 11. Customização

#### **Cores dos Planos**:
- **Free**: `#6B7280` (Cinza)
- **Premium**: `#F59E0B` (Dourado)

#### **Preços**:
- Facilmente alteráveis no array `PLANS`
- Suporte a diferentes moedas
- Períodos personalizáveis

#### **Funcionalidades**:
- Lista de features editável
- Limitações configuráveis
- Badges personalizáveis

### 12. Observações Importantes

⚠️ **Sistema de pagamento removido**: O Stripe foi completamente removido do projeto, pois não é compatível com as políticas das lojas de aplicativos (App Store e Google Play).

✅ **Próximos passos**: Implementar In-App Purchases nativos ou usar serviço como Revenue Cat para gerenciar assinaturas de forma compatível com as lojas.

A tela está pronta para uso e pode ser facilmente integrada com sistemas de IAP no futuro!
