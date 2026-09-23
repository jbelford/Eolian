import { Button } from '@heroui/react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../app/providers';

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
      {theme === 'dark' ? (
        <Sun aria-hidden="true" className="size-5" />
      ) : (
        <Moon aria-hidden="true" className="size-5" />
      )}
    </Button>
  );
};
