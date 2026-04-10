/** UF e nome do estado para listas e validação. */
export interface BrazilState {
  uf: string;
  name: string;
}

const RAW: BrazilState[] = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];

export const BRAZIL_STATES: BrazilState[] = [...RAW].sort((a, b) =>
  a.name.localeCompare(b.name, 'pt-BR')
);

export const BRAZIL_UFS = new Set(BRAZIL_STATES.map((s) => s.uf));

export function brazilStateByUf(uf: string | null | undefined): BrazilState | undefined {
  if (!uf || typeof uf !== 'string') return undefined;
  const u = uf.trim().toUpperCase();
  return BRAZIL_STATES.find((s) => s.uf === u);
}

export function formatBrazilStateChoice(uf: string | null | undefined): string {
  const s = brazilStateByUf(uf);
  if (!s) return '';
  return `${s.name} (${s.uf})`;
}

/**
 * Extrai UF quando o texto termina com ", PR", " - SP", "/RJ" etc. (dados legados no campo cidade).
 */
export function parseCityUf(raw: string | null | undefined): { cityLabel: string; uf: string | null } {
  const t = (raw || '').trim();
  if (!t) return { cityLabel: '', uf: null };
  const m = t.match(/\s*[,;/\-]\s*([A-Za-z]{2})\s*$/);
  if (m) {
    const uf = m[1].toUpperCase();
    if (BRAZIL_UFS.has(uf)) {
      const cityPart = t.slice(0, m.index).trim();
      return { cityLabel: cityPart || t, uf };
    }
  }
  return { cityLabel: t, uf: null };
}
