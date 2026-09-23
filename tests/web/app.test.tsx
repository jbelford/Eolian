import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../web/app';

const testClientId = '123456789012345678';

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

describe('public web experience', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    delete document.documentElement.dataset.theme;
  });

  it('renders the marketing experience and primary calls to action', () => {
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

  it('navigates to the placeholder workspace without authentication', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getAllByRole('link', { name: 'Sign in' })[0]);

    expect(
      screen.getByRole('heading', { name: /your eolian workspace is warming up/i }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/app');
  });

  it('toggles and persists the color theme', async () => {
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
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('renders stable placeholder routes for later authenticated features', () => {
    renderAt('/app/guilds');

    expect(
      screen.getByRole('heading', { name: /guild controls will live here/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/app/account');
  });
});
