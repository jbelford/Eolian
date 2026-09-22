import { Button } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from './brand';
import { CloseIcon, MenuIcon } from './icons';
import { ThemeToggle } from './theme-toggle';

const navigation = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Command modes', href: '/#command-modes' },
];

const navigationClass =
  'rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export const SiteHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  return (
    <header className="sticky top-0 z-40 border-b border-separator/70 bg-background/80 backdrop-blur-xl">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8"
      >
        <BrandMark />

        <div className="hidden items-center gap-1 lg:flex">
          {navigation.map(item => (
            <a className={navigationClass} href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            className="hidden rounded-full px-3 py-2 text-sm font-semibold text-foreground outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-focus sm:inline-flex"
            to="/app"
          >
            Sign in
          </Link>
          <a
            className={`${buttonVariants({ size: 'sm', variant: 'primary' })} hidden sm:inline-flex`}
            href="https://discord.com/api/oauth2/authorize?client_id=900529540839899138&scope=bot+applications.commands&permissions=3665216"
          >
            Add to Discord
          </a>
          <Button
            isIconOnly
            aria-controls="mobile-navigation"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden"
            size="sm"
            variant="ghost"
            onPress={() => setIsMenuOpen(open => !open)}
          >
            {isMenuOpen ? <CloseIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </Button>
        </div>
      </nav>

      {isMenuOpen && (
        <div
          className="border-t border-separator bg-background px-5 py-5 lg:hidden"
          id="mobile-navigation"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {navigation.map(item => (
              <a className={navigationClass} href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-separator pt-5">
              <Link className={buttonVariants({ size: 'md', variant: 'secondary' })} to="/app">
                Sign in
              </Link>
              <a
                className={buttonVariants({ size: 'md', variant: 'primary' })}
                href="https://discord.com/api/oauth2/authorize?client_id=900529540839899138&scope=bot+applications.commands&permissions=3665216"
              >
                Add to Discord
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
