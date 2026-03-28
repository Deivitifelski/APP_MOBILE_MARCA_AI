import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@marca_ai_financial_goal:v1:';

function key(artistId: string, year: number, month: number) {
  return `${PREFIX}${artistId}:${year}:${month}`;
}

export async function getFinancialGoal(
  artistId: string,
  year: number,
  month: number
): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(key(artistId, year, month));
    if (raw == null || raw === '') return null;
    const n = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  } catch {
    return null;
  }
}

export async function setFinancialGoal(
  artistId: string,
  year: number,
  month: number,
  value: number
): Promise<void> {
  if (!Number.isFinite(value) || value <= 0) {
    await clearFinancialGoal(artistId, year, month);
    return;
  }
  await AsyncStorage.setItem(key(artistId, year, month), String(value));
}

export async function clearFinancialGoal(
  artistId: string,
  year: number,
  month: number
): Promise<void> {
  await AsyncStorage.removeItem(key(artistId, year, month));
}
