import { Alert, Avatar, Button, Drawer } from '@heroui/react';
import { House, LogOut, Menu, UserRound, UsersRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { discordAvatarUrl, discordGuildIconUrl, type AuthGuild } from '../api/auth';
import { useAuth } from '../auth/auth-context';
import { BrandMark } from '../components/brand';
import { ThemeToggle } from '../components/theme-toggle';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus ${
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted hover:bg-surface hover:text-foreground'
  }`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const GuildAvatar = ({ guild }: { guild: AuthGuild }) => (
  <Avatar size="sm">
    <Avatar.Image alt="" src={discordGuildIconUrl(guild)} />
    <Avatar.Fallback>{initials(guild.name)}</Avatar.Fallback>
  </Avatar>
);

interface WorkspaceNavigationProps {
  guilds: AuthGuild[];
  onNavigate?: () => void;
}

const WorkspaceNavigation = ({ guilds, onNavigate }: WorkspaceNavigationProps) => (
  <nav aria-label="Workspace navigation" className="flex flex-col gap-1">
    <NavLink className={navLinkClass} end onClick={onNavigate} to="/app">
      <House aria-hidden="true" className="size-5" />
      Overview
    </NavLink>
    <NavLink className={navLinkClass} onClick={onNavigate} to="/app/guilds">
      <UsersRound aria-hidden="true" className="size-5" />
      Servers
    </NavLink>
    <NavLink className={navLinkClass} onClick={onNavigate} to="/app/account">
      <UserRound aria-hidden="true" className="size-5" />
      Account
    </NavLink>

    {guilds.length > 0 && (
      <div className="mt-6">
        <p className="px-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">
          Servers you can manage
        </p>
        <div className="mt-2 flex flex-col gap-1">
          {guilds.map(guild => (
            <NavLink
              className={navLinkClass}
              key={guild.id}
              onClick={onNavigate}
              to={`/app/guilds/${guild.id}`}
            >
              <GuildAvatar guild={guild} />
              <span className="truncate">{guild.name}</span>
            </NavLink>
          ))}
        </div>
      </div>
    )}
  </nav>
);

export const AuthenticatedLayout = () => {
  const { state, logout, clearLogoutError } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setIsMenuOpen(false), [location]);

  if (state.status !== 'authenticated') {
    return null;
  }

  const { session } = state;
  const displayName = session.user.globalName ?? session.user.username;

  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-separator bg-surface/70 p-5 lg:flex lg:flex-col">
        <BrandMark />
        <div className="mt-10 flex-1">
          <WorkspaceNavigation guilds={session.guilds} />
        </div>
        <a className="text-sm font-semibold text-muted hover:text-foreground" href="/">
          Public site
        </a>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-separator bg-background/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              aria-label="Open workspace navigation"
              className="lg:hidden"
              size="sm"
              variant="ghost"
              onPress={() => setIsMenuOpen(true)}
            >
              <Menu aria-hidden="true" className="size-5" />
            </Button>
            <span className="font-display text-lg font-bold">Workspace</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-muted">@{session.user.username}</p>
            </div>
            <Avatar size="sm">
              <Avatar.Image
                alt={`${displayName}'s Discord avatar`}
                src={discordAvatarUrl(session.user)}
              />
              <Avatar.Fallback>{initials(displayName)}</Avatar.Fallback>
            </Avatar>
            <Button
              aria-label="Sign out"
              isDisabled={state.isLoggingOut}
              size="sm"
              variant="ghost"
              onPress={() => void logout()}
            >
              <LogOut aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">
                {state.isLoggingOut ? 'Signing out…' : 'Sign out'}
              </span>
            </Button>
          </div>
        </header>

        {state.logoutError && (
          <div className="px-5 pt-5 sm:px-8">
            <Alert role="alert" status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Sign out failed</Alert.Title>
                <Alert.Description>{state.logoutError.message}</Alert.Description>
              </Alert.Content>
              <Button variant="danger" onPress={clearLogoutError}>
                Dismiss
              </Button>
            </Alert>
          </div>
        )}

        <main id="main-content">
          <Outlet />
        </main>
      </div>

      <Drawer.Backdrop isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Drawer.Content placement="left">
          <Drawer.Dialog>
            <Drawer.Header className="flex items-center justify-between">
              <Drawer.Heading>Workspace navigation</Drawer.Heading>
              <Button
                isIconOnly
                aria-label="Close workspace navigation"
                size="sm"
                variant="ghost"
                onPress={() => setIsMenuOpen(false)}
              >
                <X aria-hidden="true" className="size-5" />
              </Button>
            </Drawer.Header>
            <Drawer.Body>
              <WorkspaceNavigation
                guilds={session.guilds}
                onNavigate={() => setIsMenuOpen(false)}
              />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </div>
  );
};
