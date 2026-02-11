/**
 * Formata uma data ISO (UTC) para horário de Brasília (UTC-3).
 * Útil em React Native onde Intl timeZone pode não ser suportado.
 */
export function formatDateBrazil(dateString: string): string {
  const raw = dateString.trim();
  const hasTimezone = raw.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(raw);
  const date = new Date(hasTimezone ? raw : raw + 'Z');

  const utcMs = date.getTime();
  const brazilOffsetMs = -3 * 60 * 60 * 1000; // UTC-3
  const brazilDate = new Date(utcMs + brazilOffsetMs);

  const d = brazilDate.getUTCDate();
  const m = brazilDate.getUTCMonth() + 1;
  const y = brazilDate.getUTCFullYear();
  const h = brazilDate.getUTCHours();
  const min = brazilDate.getUTCMinutes();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d)}/${pad(m)}/${y} ${pad(h)}:${pad(min)}`;
}
