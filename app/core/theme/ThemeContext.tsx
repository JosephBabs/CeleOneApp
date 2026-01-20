// theme/ThemeContext.tsx
import React, { createContext, useEffect, useState, useContext } from 'react';
import { Appearance } from 'react-native';

type ThemeMode = 'light' | 'dark';

interface ThemeContextProps {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  mode: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemColorScheme = Appearance.getColorScheme();
  const initialMode: ThemeMode = (systemColorScheme === 'dark' || systemColorScheme === 'light') ? systemColorScheme : 'light';
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setMode(colorScheme === 'dark' ? 'dark' : 'light');
    });

    return () => listener.remove();
  }, []);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => useContext(ThemeContext);
