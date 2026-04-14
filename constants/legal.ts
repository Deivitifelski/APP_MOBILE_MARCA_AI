/**
 * URLs legais obrigatórias para assinaturas (Diretriz 3.1.2 - Apple).
 * EULA: padrão Apple. No Connect, use EULA padrão da Apple e o mesmo link na descrição do app.
 * Política de privacidade: campo dedicado no App Store Connect + mesmo link aqui.
 */
export const LEGAL_URLS = {
  /** Link funcional para a Política de Privacidade (obrigatório no app e nos metadados) */
  PRIVACY_POLICY:
    'https://www.freeprivacypolicy.com/live/179f60bd-8cb5-4987-96b7-1c6863cc8a83',
  /** EULA padrão Apple (Licensed Application). Abre no Safari pelo Linking. */
  TERMS_OF_USE_EULA: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
} as const;
