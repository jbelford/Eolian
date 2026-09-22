import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../web/app';
import {
  emptyRoute,
  installFetchRouter,
  jsonRoute,
  networkErrorRoute,
  requestJsonBody,
} from './fetch-mock';

const session = () => ({
  authenticated: true,
  user: {
    id: '500',
    username: 'music-admin',
    globalName: 'Music Admin',
    avatar: null,
  },
  guilds: [
    {
      id: '100',
      name: 'Listening Room',
      icon: null,
      owner: true,
      permissions: '32',
    },
  ],
  csrfToken: 'csrf-secret',
  expiresAt: '2099-01-01T00:00:00.000Z',
});

const account = (overrides: Record<string, unknown> = {}) => ({
  syntax: 'keyword',
  providers: {
    spotify: { linked: false, linkAvailable: true },
    soundcloud: { linked: true, linkAvailable: true },
  },
  ...overrides,
});

const guild = (overrides: Record<string, unknown> = {}) => ({
  id: '100',
  name: 'Listening Room',
  icon: null,
  memberCount: 42,
  settings: {
    prefix: '!',
    volume: 0.25,
    syntax: 'keyword',
    preferredChannelId: '300',
    djRoleIds: ['200'],
    djAllowLimited: false,
  },
  channels: [
    { id: '300', name: 'music' },
    { id: '301', name: 'announcements' },
  ],
  roles: [
    { id: '200', name: 'DJ' },
    { id: '201', name: 'Moderator' },
  ],
  ...overrides,
});

const errorBody = (code: string, message: string) => ({ error: { code, message } });

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

describe('account settings', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('loads, resets, and saves the syntax preference with CSRF protection', async () => {
    const fetchMock = installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/account', account()),
      jsonRoute('PATCH', '/api/account/syntax', account({ syntax: 'traditional' })),
    ]);
    const user = userEvent.setup();
    renderAt('/app/account');

    expect(await screen.findByRole('radio', { name: /keyword/i })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /traditional/i }));
    expect(screen.getByRole('button', { name: 'Save preference' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Reset changes' }));
    expect(screen.getByRole('radio', { name: /keyword/i })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /traditional/i }));
    await user.click(screen.getByRole('button', { name: 'Save preference' }));

    expect(
      await screen.findByText('Your command syntax preference was saved.'),
    ).toBeInTheDocument();
    expect(requestJsonBody(fetchMock, 3)).toEqual({ syntax: 'traditional' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/account/syntax',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'x-csrf-token': 'csrf-secret' }),
      }),
    );
  });

  it('starts provider linking in a new tab and refreshes status', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute(
        'GET',
        '/api/account',
        account({
          providers: {
            spotify: { linked: false, linkAvailable: true },
            soundcloud: { linked: false, linkAvailable: false },
          },
        }),
      ),
      jsonRoute(
        'POST',
        '/api/account/providers/spotify/link',
        { authorizationUrl: 'https://provider.example/authorize' },
        { status: 201 },
      ),
      jsonRoute('GET', '/api/account', account()),
    ]);
    const user = userEvent.setup();
    renderAt('/app/account');

    await user.click(await screen.findByRole('button', { name: 'Link Spotify' }));
    expect(open).toHaveBeenCalledWith(
      'https://provider.example/authorize',
      '_blank',
      'noopener,noreferrer',
    );
    expect(
      screen.getByText(/finish linking spotify in the new tab, then refresh/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link SoundCloud' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByText('Connected to your Eolian account.')).toBeInTheDocument();
  });

  it('confirms unlinking and preserves linked state when the mutation fails', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/account', account()),
      jsonRoute(
        'DELETE',
        '/api/account/providers/soundcloud',
        errorBody('persistence_failed', 'Settings could not be saved.'),
        { status: 500 },
      ),
    ]);
    const user = userEvent.setup();
    renderAt('/app/account');

    const provider = await screen.findByRole('region', { name: 'SoundCloud' });
    await user.click(within(provider).getByRole('button', { name: 'Disconnect' }));
    expect(within(provider).getByText('Disconnect SoundCloud?')).toBeInTheDocument();
    await user.click(within(provider).getByRole('button', { name: 'Confirm disconnect' }));

    expect(await screen.findByText('Settings could not be saved.')).toBeInTheDocument();
    expect(within(provider).getByText('Linked')).toBeInTheDocument();
  });

  it('unlinks a provider and reports unavailable link flows', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/account', account()),
      emptyRoute('DELETE', '/api/account/providers/soundcloud'),
    ]);
    const user = userEvent.setup();
    renderAt('/app/account');

    const provider = await screen.findByRole('region', { name: 'SoundCloud' });
    await user.click(within(provider).getByRole('button', { name: 'Disconnect' }));
    await user.click(within(provider).getByRole('button', { name: 'Confirm disconnect' }));

    expect(await screen.findByText('SoundCloud was disconnected.')).toBeInTheDocument();
    expect(within(provider).getByText('Not linked')).toBeInTheDocument();
  });

  it('reports provider link failures without opening a tab', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/account', account()),
      jsonRoute(
        'POST',
        '/api/account/providers/spotify/link',
        errorBody('provider_link_failed', 'Provider linking could not be started.'),
        { status: 500 },
      ),
    ]);
    const user = userEvent.setup();
    renderAt('/app/account');

    await user.click(await screen.findByRole('button', { name: 'Link Spotify' }));
    expect(await screen.findByText('Provider linking could not be started.')).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('moves account API authentication failures through the existing expired-session UX', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute(
        'GET',
        '/api/account',
        errorBody('authentication_required', 'Authentication is required.'),
        { status: 401 },
      ),
    ]);
    renderAt('/app/account');

    expect(
      await screen.findByRole('heading', { name: 'Your session has expired' }),
    ).toBeInTheDocument();
  });
});

describe('guild settings', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('searches the manageable shared server list and opens a result from the keyboard', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds', {
        guilds: [
          { id: '100', name: 'Listening Room', icon: null },
          { id: '101', name: 'Late Night Radio', icon: null },
        ],
      }),
      jsonRoute('GET', '/api/guilds/101', guild({ id: '101', name: 'Late Night Radio' })),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds');

    await user.type(await screen.findByRole('searchbox', { name: 'Search servers' }), 'late');
    const main = screen.getByRole('main');
    expect(within(main).queryByRole('link', { name: /Listening Room/ })).not.toBeInTheDocument();
    const result = within(main).getByRole('link', { name: /Late Night Radio/ });
    result.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Late Night Radio' })).toBeInTheDocument();
  });

  it('shows meaningful empty and no-search-result states', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds', { guilds: [] }),
    ]);
    renderAt('/app/guilds');
    expect(
      await screen.findByRole('heading', { name: 'No shared manageable servers' }),
    ).toBeInTheDocument();
  });

  it('retries a failed guild list and identifies a bot-not-ready response', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds', errorBody('bot_not_ready', 'The bot is not ready.'), {
        status: 503,
      }),
      jsonRoute('GET', '/api/guilds', {
        guilds: [{ id: '100', name: 'Listening Room', icon: null }],
      }),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds');

    expect(await screen.findByText('Eolian is still starting')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await within(screen.getByRole('main')).findByRole('link', { name: /Listening Room/ }),
    ).toBeInTheDocument();
  });

  it('populates the accessible guild form from effective settings', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds/100', guild()),
    ]);
    renderAt('/app/guilds/100');

    expect(await screen.findByRole('heading', { name: 'Listening Room' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Command prefix/ })).toHaveValue('!');
    expect(screen.getByLabelText('Default volume percentage')).toHaveValue(25);
    expect(screen.getByRole('radio', { name: /keyword/i })).toBeChecked();
    expect(screen.getByRole('combobox', { name: /Preferred text channel/ })).toHaveValue('300');
    expect(screen.getByRole('checkbox', { name: 'DJ' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /allow limited dj mode/i })).not.toBeChecked();
  });

  it('validates fields locally and resets dirty changes', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds/100', guild()),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds/100');

    const prefix = await screen.findByRole('textbox', { name: /Command prefix/ });
    await user.clear(prefix);
    expect(screen.getByText('Enter exactly one character.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Reset changes' }));
    expect(prefix).toHaveValue('!');
    expect(screen.getByText('Up to date')).toBeInTheDocument();
  });

  it('enforces the ten-role selection limit with accessible controls', async () => {
    const roles = Array.from({ length: 11 }, (_, index) => ({
      id: String(200 + index),
      name: `Role ${index + 1}`,
    }));
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute(
        'GET',
        '/api/guilds/100',
        guild({
          settings: { ...guild().settings, djRoleIds: [] },
          roles,
        }),
      ),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds/100');

    await screen.findByRole('heading', { name: 'Listening Room' });
    for (let index = 1; index <= 10; index += 1) {
      await user.click(screen.getByRole('checkbox', { name: `Role ${index}` }));
    }
    expect(screen.getByText('10 of 10 roles selected.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Role 11' })).toBeDisabled();
  });

  it('sends a successful partial update and synchronizes the returned response', async () => {
    const fetchMock = installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds/100', guild()),
      jsonRoute(
        'PATCH',
        '/api/guilds/100',
        guild({ settings: { ...guild().settings, prefix: '?' } }),
      ),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds/100');

    const prefix = await screen.findByRole('textbox', { name: /Command prefix/ });
    await user.clear(prefix);
    await user.type(prefix, '?');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Server settings were saved.')).toBeInTheDocument();
    expect(requestJsonBody(fetchMock, 3)).toEqual({ prefix: '?' });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/guilds/100',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'x-csrf-token': 'csrf-secret' }),
      }),
    );
    expect(screen.getByText('Up to date')).toBeInTheDocument();
  });

  it('combines changed fields and maps displayed volume to the API range', async () => {
    const updated = guild({
      settings: {
        ...guild().settings,
        volume: 0.8,
        syntax: 'traditional',
        preferredChannelId: null,
        djRoleIds: ['200', '201'],
        djAllowLimited: true,
      },
    });
    const fetchMock = installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds/100', guild()),
      jsonRoute('PATCH', '/api/guilds/100', updated),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds/100');

    const volume = await screen.findByLabelText('Default volume percentage');
    await user.clear(volume);
    await user.type(volume, '80');
    await user.click(screen.getByRole('radio', { name: /traditional/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /Preferred text channel/ }), '');
    await user.click(screen.getByRole('checkbox', { name: 'Moderator' }));
    await user.click(screen.getByRole('checkbox', { name: /allow limited dj mode/i }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByText('Server settings were saved.');
    expect(requestJsonBody(fetchMock, 3)).toEqual({
      volume: 0.8,
      syntax: 'traditional',
      preferredChannelId: null,
      djRoleIds: ['200', '201'],
      djAllowLimited: true,
    });
  });

  it.each([
    [403, 'guild_forbidden', 'Guild management is not allowed.', 'You cannot manage this server'],
    [
      404,
      'bot_not_in_guild',
      'The bot is not in this guild.',
      'Eolian is no longer in this server',
    ],
    [404, 'missing', 'The server was not found.', 'Server not found'],
    [503, 'bot_not_ready', 'The bot is not ready.', 'Eolian is still starting'],
  ])('renders the dedicated %i %s detail state', async (status, code, message, heading) => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds/100', errorBody(code, message), { status }),
    ]);
    renderAt('/app/guilds/100');

    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it('shows stale channel and role selections and lets the user recover', async () => {
    const staleGuild = guild({
      settings: {
        ...guild().settings,
        preferredChannelId: '399',
        djRoleIds: ['299'],
      },
    });
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds/100', staleGuild),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds/100');

    expect(
      await screen.findByText('Some saved Discord options are unavailable'),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: /Preferred text channel/ }), '');
    await user.click(screen.getByRole('checkbox', { name: /unavailable role/i }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('refreshes Discord options after a stale role conflict without losing edits', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds/100', guild()),
      jsonRoute(
        'PATCH',
        '/api/guilds/100',
        errorBody('role_not_found', 'A selected role is unavailable.'),
        { status: 409 },
      ),
      jsonRoute('GET', '/api/guilds/100', guild({ roles: [{ id: '200', name: 'DJ' }] })),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds/100');

    const prefix = await screen.findByRole('textbox', { name: /Command prefix/ });
    await user.clear(prefix);
    await user.type(prefix, '?');
    await user.click(screen.getByRole('checkbox', { name: 'Moderator' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(/available options were refreshed; review and try again/i),
    ).toBeInTheDocument();
    expect(prefix).toHaveValue('?');
    expect(screen.getByRole('checkbox', { name: /unavailable role/i })).toBeChecked();
  });

  it('shows server validation errors and keeps dirty values available for correction', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds/100', guild()),
      jsonRoute(
        'PATCH',
        '/api/guilds/100',
        errorBody('invalid_request', 'The request is invalid.'),
        { status: 400 },
      ),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds/100');

    const prefix = await screen.findByRole('textbox', { name: /Command prefix/ });
    await user.clear(prefix);
    await user.type(prefix, '?');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('The request is invalid.')).toBeInTheDocument();
    expect(prefix).toHaveValue('?');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('retries a transient detail load failure', async () => {
    installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      networkErrorRoute('GET', '/api/guilds/100'),
      jsonRoute('GET', '/api/guilds/100', guild()),
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds/100');

    expect(await screen.findByText('Server settings could not be loaded')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Listening Room' })).toBeInTheDocument();
  });

  it('keeps the form pending and disabled until a save completes', async () => {
    let resolveSave: (response: Response) => void = () => undefined;
    const pending = new Promise<Response>(resolve => {
      resolveSave = resolve;
    });
    const fetchMock = installFetchRouter([
      jsonRoute('GET', '/api/auth/session', session()),
      jsonRoute('GET', '/api/guilds/100', guild()),
      {
        method: 'PATCH',
        path: '/api/guilds/100',
        respond: () => pending,
      },
    ]);
    const user = userEvent.setup();
    renderAt('/app/guilds/100');

    const prefix = await screen.findByRole('textbox', { name: /Command prefix/ });
    await user.clear(prefix);
    await user.type(prefix, '?');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(prefix).toBeDisabled();

    resolveSave(
      new Response(JSON.stringify(guild({ settings: { ...guild().settings, prefix: '?' } })), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await waitFor(() => expect(screen.getByText('Up to date')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
