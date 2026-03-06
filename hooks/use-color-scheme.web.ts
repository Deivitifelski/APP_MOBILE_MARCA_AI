import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

/**
 * Mesmo comportamento do native: usa apenas a preferência do app (ThemeContext), ignora o sistema.
 */
export function useColorScheme(): 'light' | 'dark' {
  const themeContext = useContext(ThemeContext);
  if (themeContext !== undefined) {
    return themeContext.isDarkMode ? 'dark' : 'light';
  }
  return 'light';
}
