/**
 * Heurística para distinguir falha de rede/timeout de erros de auth ou dados.
 * Alinha com o tratamento usado na tela de login.
 */
export function isLikelyNetworkFailure(error: unknown, message?: string | null): boolean {
  if (error instanceof TypeError) {
    const m = String(error.message ?? '').toLowerCase();
    if (
      m.includes('network') ||
      m.includes('fetch') ||
      m.includes('failed to fetch') ||
      m.includes('network request failed')
    ) {
      return true;
    }
  }

  const parts: string[] = [];
  if (message) parts.push(message);
  if (typeof error === 'string') parts.push(error);
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    parts.push((error as { message: string }).message);
  }
  if (error && typeof error === 'object' && 'name' in error && typeof (error as { name: unknown }).name === 'string') {
    parts.push((error as { name: string }).name);
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
    'tempo limite',
    'request timeout',
    'timed out',
  ];

  return hints.some((h) => combined.includes(h));
}
