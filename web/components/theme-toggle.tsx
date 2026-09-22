import { Button } from '@heroui/react';
import { useTheme } from '../app/providers';
import { MoonIcon, SunIcon } from './icons';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      isIconOnly
      aria-label={`Switch to ${nextTheme} theme`}
      className="shrink-0"
      size="sm"
      variant="ghost"
      onPress={toggleTheme}
    >
      {theme === 'dark' ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
    </Button>
  );
};
