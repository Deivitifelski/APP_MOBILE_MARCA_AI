export function formatSocialTimeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 45_000) return 'agora';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} sem`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
