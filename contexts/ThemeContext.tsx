import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Simulação simples de AsyncStorage para modo escuro
const AsyncStorage = {
  getItem: async (key: string) => {
    // Simulação - retorna null por padrão
    return null;
  },
  setItem: async (key: string, value: string) => {
    // Simulação - não faz nada
    console.log(`Salvando ${key}: ${value}`);
  }
};

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  colors: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    text: string;
    textSecondary: string;
    border: string;
    shadow: string;
    error: string;
    success: string;
    warning: string;
  };
}

const lightColors = {
  background: '#f8f9fa',
  surface: '#ffffff',
  primary: '#667eea',
  secondary: '#f0f0f0',
  text: '#333333',
  textSecondary: '#666666',
  border: '#e9ecef',
  shadow: '#000000',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FF9800',
};

const darkColors = {
  background: '#1a1a1a',
  surface: '#2d2d2d',
  primary: '#667eea',
  secondary: '#404040',
  text: '#ffffff',
  textSecondary: '#cccccc',
  border: '#404040',
  shadow: '#000000',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FF9800',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadDarkModePreference();
  }, []);

  const loadDarkModePreference = async () => {
    try {
      const savedDarkMode = await AsyncStorage.getItem('darkMode');
      if (savedDarkMode !== null) {
        setIsDarkMode(JSON.parse(savedDarkMode));
      }
    } catch (error) {
      console.error('Erro ao carregar preferência do modo escuro:', error);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newDarkMode = !isDarkMode;
      setIsDarkMode(newDarkMode);
      await AsyncStorage.setItem('darkMode', JSON.stringify(newDarkMode));
    } catch (error) {
      console.error('Erro ao salvar preferência do modo escuro:', error);
    }
  };

  const colors = isDarkMode ? darkColors : lightColors;

  const value: ThemeContextType = {
    isDarkMode,
    toggleDarkMode,
    colors,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider');
  }
  return context;
};
