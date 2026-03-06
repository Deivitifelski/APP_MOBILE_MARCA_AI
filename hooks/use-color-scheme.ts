import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

/**
 * Retorna o tema do app (preferência salva). Ignora o modo escuro do sistema
 * para que o app respeite apenas a opção escolhida nas configurações.
 */
export function useColorScheme(): 'light' | 'dark' {
  const themeContext = useContext(ThemeContext);
  if (themeContext !== undefined) {
    return themeContext.isDarkMode ? 'dark' : 'light';
  }
  return 'light';
}