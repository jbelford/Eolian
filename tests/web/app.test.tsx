import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../web/app';
import {
  emptyResponse,
  installFetchMock,
  jsonResponse,
  queueJson,
  queueNetworkError,
  queueResponse,
} from './fetch-mock';

const authenticatedSession = (overrides: Record<string, unknown> = {}) => ({
  authenticated: true,
  user: {
    id: 'user-1',
    username: 'music-admin',
    globalName: 'Music Admin',
    avatar: 'avatar-hash',
  },
  guilds: [
    {
      id: 'guild-1',
      name: 'Listening Room',
      icon: 'guild-icon',
      owner: true,
      permissions: '0',
    },
    {
      id: 'guild-2',
      name: 'Late Night Radio',
      icon: null,
      owner: false,
      permissions: '32',
    },
  ],
  csrfToken: 'csrf-secret',
  expiresAt: '2099-01-01T00:00:00.000Z',
  ...overrides,
});

const testClientId = '123456789012345678';

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

describe('public web experience', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    document.documentElement.className = '';
    delete document.documentElement.dataset.theme;
  });

  it('keeps marketing routes public and sends sign-in calls to the Discord auth flow', () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, { authenticated: false });

    renderAt('/');

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /turn a voice channel into the place everyone stays/i,
      }),
    ).toBeInTheDocument();
    const inviteLinks = screen.getAllByRole('link', { name: /add (eolian )?to discord/i });
    expect(inviteLinks).toHaveLength(3);

    for (const link of inviteLinks) {
      const url = new URL(link.getAttribute('href')!);
      expect(url.origin).toBe('https://discord.com');
      expect(url.pathname).toBe('/api/oauth2/authorize');
      expect(url.searchParams.get('client_id')).toBe(testClientId);
      expect(url.searchParams.get('scope')).toBe('bot applications.commands');
      expect(url.searchParams.get('permissions')).toBe('3665216');
    }
    expect(
      screen.getByRole('heading', { name: /less time managing the bot/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /speak naturally/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute(
      'href',
      '/api/auth/discord?returnTo=%2Fapp',
    );
  });

  it('shows an illustrative now-playing embed without interactive transport controls', () => {
    const { container } = renderAt('/');
    const scene = container.querySelector('.discord-scene');
    const tiles = scene?.querySelectorAll('.discord-transport-tile');

    expect(scene).toHaveAttribute('aria-hidden', 'true');
    expect(scene).toHaveTextContent('Now Playing');
    expect(scene).toHaveTextContent('78%');
    expect(scene).toHaveTextContent('After the Rain');
    expect(scene).toHaveTextContent('by Lowlight Atlas');
    expect(scene?.querySelector('.discord-embed')).toBeInTheDocument();
    expect(scene?.querySelector('.discord-artwork')).toBeInTheDocument();
    const brandMarks = container.querySelectorAll('img.brand-mark');
    const playerAvatar = scene?.querySelector('img.discord-bot-avatar');
    expect(brandMarks).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Eolian home' })).toHaveLength(2);
    expect(playerAvatar).toHaveAttribute('src', brandMarks[0].getAttribute('src'));
    expect(playerAvatar).toHaveAttribute('alt', '');
    expect(tiles).toHaveLength(5);
    expect(tiles?.[0].querySelector('.lucide-list-music')).toBeInTheDocument();
    expect(tiles?.[1].querySelector('.lucide-skip-back')).toBeInTheDocument();
    expect(tiles?.[2].querySelector('.lucide-pause')).toBeInTheDocument();
    expect(tiles?.[3].querySelector('.lucide-skip-forward')).toBeInTheDocument();
    expect(tiles?.[4].querySelector('.lucide-square')).toBeInTheDocument();
    expect(scene?.querySelectorAll('button, a')).toHaveLength(0);
    for (const icon of scene?.querySelectorAll('svg') ?? []) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('toggles and persists the color theme', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, { authenticated: false });
    const user = userEvent.setup();
    renderAt('/');

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));
    const themeButton = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(themeButton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await user.click(themeButton);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(window.localStorage.getItem('eolian-theme')).toBe('dark');
    });
  });

  it('opens and closes the public mobile navigation accessibly', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, { authenticated: false });
    const user = userEvent.setup();
    renderAt('/');

    const menuButton = screen.getByRole('button', { name: 'Open navigation menu' });
    await user.click(menuButton);

    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(document.getElementById('mobile-navigation')!).getByRole('link', {
        name: 'Command modes',
      }),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Close navigation menu' }));
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument();
  });
});

describe('authenticated application shell', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
    document.documentElement.className = '';
    delete document.documentElement.dataset.theme;
  });

  it('announces the loading state until session bootstrap completes', async () => {
    const fetchMock = installFetchMock();
    let resolveSession: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>(resolve => {
          resolveSession = resolve;
        }),
    );

    renderAt('/app');

    expect(screen.getByRole('heading', { name: 'Loading your workspace' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');

    resolveSession(jsonResponse(authenticatedSession()));
    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Music Admin.' }),
    ).toBeInTheDocument();
  });

  it('bootstraps the session with same-origin credentials and renders identity and guilds', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, authenticatedSession());

    renderAt('/app');

    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Music Admin.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('@music-admin')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Listening Room/ })).not.toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('redirects protected routes to sign-in and preserves a safe return path', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, { authenticated: false });

    renderAt('/app/guilds/guild-1?tab=queue');

    expect(await screen.findByRole('heading', { name: 'Sign in to Eolian' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/sign-in');
    expect(window.location.search).toBe('?returnTo=%2Fapp%2Fguilds%2Fguild-1%3Ftab%3Dqueue');
    expect(screen.getByRole('link', { name: 'Continue with Discord' })).toHaveAttribute(
      'href',
      '/api/auth/discord?returnTo=%2Fapp%2Fguilds%2Fguild-1%3Ftab%3Dqueue',
    );
  });

  it('rejects unsafe sign-in return paths', () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, { authenticated: false });

    renderAt('/sign-in?returnTo=https://attacker.example');

    expect(screen.getByRole('link', { name: 'Continue with Discord' })).toHaveAttribute(
      'href',
      '/api/auth/discord?returnTo=%2Fapp',
    );
  });

  it('shows a retryable API error and recovers on retry', async () => {
    const fetchMock = installFetchMock();
    queueNetworkError(fetchMock);
    queueJson(fetchMock, authenticatedSession());
    const user = userEvent.setup();

    renderAt('/app');

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('We could not load your workspace')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Music Admin.' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats session 401 responses as expired instead of authenticated fallbacks', async () => {
    const fetchMock = installFetchMock();
    queueJson(
      fetchMock,
      { error: { code: 'authentication_required', message: 'Authentication is required.' } },
      { status: 401 },
    );

    renderAt('/app/account');

    expect(
      await screen.findByRole('heading', { name: 'Your session has expired' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue with Discord' })).toHaveAttribute(
      'href',
      '/api/auth/discord?returnTo=%2Fapp%2Faccount',
    );
    expect(window.location.pathname).toBe('/app/account');
  });

  it('expires an already elapsed session response', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, authenticatedSession({ expiresAt: '2000-01-01T00:00:00.000Z' }));

    renderAt('/app');

    expect(
      await screen.findByRole('heading', { name: 'Your session has expired' }),
    ).toBeInTheDocument();
  });

  it('navigates account and guild route outlets from the workspace navigation', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, authenticatedSession());
    const user = userEvent.setup();
    renderAt('/app');

    await screen.findByRole('heading', { name: 'Welcome back, Music Admin.' });
    const workspaceNav = screen.getByRole('navigation', { name: 'Workspace navigation' });

    await user.click(within(workspaceNav).getByRole('link', { name: 'Account' }));
    expect(screen.getByRole('heading', { name: 'Music Admin' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Account connections are ready for B3' }),
    ).toBeInTheDocument();

    await user.click(within(workspaceNav).getByRole('link', { name: /Listening Room/ }));
    expect(screen.getByRole('heading', { name: 'Listening Room' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Server settings are ready for B3' }),
    ).toBeInTheDocument();
  });

  it('opens the HeroUI mobile workspace drawer and closes it after navigation', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, authenticatedSession());
    const user = userEvent.setup();
    renderAt('/app');

    await screen.findByRole('heading', { name: 'Welcome back, Music Admin.' });
    await user.click(screen.getByRole('button', { name: 'Open workspace navigation' }));

    const dialog = screen.getByRole('dialog', { name: 'Workspace navigation' });
    await user.click(within(dialog).getByRole('link', { name: 'Account' }));

    expect(await screen.findByRole('heading', { name: 'Music Admin' })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Workspace navigation' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('posts logout with the in-memory CSRF token and returns to sign-in', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, authenticatedSession());
    queueResponse(fetchMock, emptyResponse());
    const user = userEvent.setup();
    renderAt('/app');

    await screen.findByRole('heading', { name: 'Welcome back, Music Admin.' });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in to Eolian' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'x-csrf-token': 'csrf-secret' }),
      }),
    );
    expect(window.localStorage.getItem('csrf-secret')).toBeNull();
  });

  it('keeps the authenticated shell visible when logout fails', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, authenticatedSession());
    queueJson(
      fetchMock,
      { error: { code: 'logout_failed', message: 'Discord logout is temporarily unavailable.' } },
      { status: 502 },
    );
    const user = userEvent.setup();
    renderAt('/app');

    await screen.findByRole('heading', { name: 'Welcome back, Music Admin.' });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Sign out failed')).toBeInTheDocument();
    expect(screen.getByText('Discord logout is temporarily unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome back, Music Admin.' })).toBeInTheDocument();
  });

  it('shows the no-manageable-guild state without inventing server access', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, authenticatedSession({ guilds: [] }));

    renderAt('/app');

    expect(
      await screen.findByRole('heading', { name: 'No manageable servers found' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Listening Room')).not.toBeInTheDocument();
  });

  it('reports invalid API content instead of treating it as a session', async () => {
    const fetchMock = installFetchMock();
    queueResponse(fetchMock, jsonResponse({ authenticated: true }, { contentType: 'text/plain' }));

    renderAt('/app');

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('We could not load your workspace')).toBeInTheDocument();
    expect(within(alert).getByText(/unexpected content type/i)).toBeInTheDocument();
  });
});
