'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-1.5 rounded-md text-gray-400 hover:text-white dark:hover:text-white hover:bg-gray-700 dark:hover:bg-gray-700 light:hover:bg-gray-200 transition-colors flex-shrink-0"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
