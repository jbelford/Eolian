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
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

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
