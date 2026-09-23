import { Button } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { discordInviteUrl } from '../config/discord-invite';
import { BrandMark } from './brand';
import { ThemeToggle } from './theme-toggle';
import { discordLoginUrl } from '../api/auth';

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
          <a
            className="hidden rounded-full px-3 py-2 text-sm font-semibold text-foreground outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-focus sm:inline-flex"
            href={discordLoginUrl('/app')}
          >
            Sign in
          </a>
          <a
            className={`${buttonVariants({ size: 'sm', variant: 'primary' })} hidden sm:inline-flex`}
            href={discordInviteUrl}
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
            {isMenuOpen ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
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
              <a
                className={buttonVariants({ size: 'md', variant: 'secondary' })}
                href={discordLoginUrl('/app')}
              >
                Sign in
              </a>
              <a
                className={buttonVariants({ size: 'md', variant: 'primary' })}
                href={discordInviteUrl}
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
