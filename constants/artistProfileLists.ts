/** Opções sugeridas para `artists.work_roles` (JSONB array de strings). */
export const ARTIST_WORK_ROLE_PRESETS = [
  'Arranjador',
  'Ator',
  'Backing vocal',
  'Baixista',
  'Baterista',
  'Cantor',
  'Compositor',
  'DJ',
  'Guitarrista',
  'Iluminador',
  'Instrumentista',
  'MC',
  'Produtor musical',
  'Roundie',
  'Sanfoneiro',
  'Saxofonista',
  'Tecladista',
  'Técnico de som',
  'Trompetista',
  'Violonista',
  'Vocalista',
] as const;

/** Opções sugeridas para `artists.show_formats` (JSONB array de strings). */
export const ARTIST_SHOW_FORMAT_PRESETS = [
  'Show solo',
  'Duo',
  'Trio',
  'Banda completa',
  'Orquestra / big band',
  'DJ set',
  'Acústico',
  'Voz e violão',
  'Cerimônia',
  'Festa / animação',
  'Palco / festival',
  'Bar / restaurante',
] as const;

export function parseArtistStringArrayFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

export function joinArtistStringArrayJson(value: unknown): string {
  const arr = parseArtistStringArrayFromJson(value);
  return arr.length ? arr.join(', ') : '';
}

export function buildOrderedOptionsForPicker(
  presets: readonly string[],
  selected: string[]
): string[] {
  const custom = selected.filter((s) => !presets.includes(s));
  const sortedCustom = [...custom].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return [...presets, ...sortedCustom];
}
