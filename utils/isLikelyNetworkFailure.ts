/**
 * Heurística para distinguir falha de rede/timeout de erros de auth ou dados.
 * Alinha com o tratamento usado na tela de login.
 */
export function isLikelyNetworkFailure(error: unknown, message?: string | null): boolean {
  const parts: string[] = [];
  if (message) parts.push(message);
  if (typeof error === 'string') parts.push(error);
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    parts.push((error as { message: string }).message);
  }
  const combined = parts.join(' ').toLowerCase();
  if (!combined.trim()) return false;

  const hints = [
    'network',
    'fetch',
    'failed to fetch',
    'network request failed',
    'internet',
    'offline',
    'timeout',
    'conexão',
    'conexao',
    'connection',
    'econnrefused',
    'enotfound',
    'econnreset',
    'etimedout',
    'abort',
    'unreachable',
    'sem internet',
    'load failed',
    'the internet connection appears to be offline',
  ];

  return hints.some((h) => combined.includes(h));
}
