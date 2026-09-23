import { describe, expect, it } from 'vitest';
import { validateDiscordClientId } from '../../web/config/discord-client-id.mts';
import { createDiscordInviteUrl } from '../../web/config/discord-invite';

describe('Discord invite configuration', () => {
  it('keeps invite scopes and permissions when using a configured client ID', () => {
    const url = new URL(createDiscordInviteUrl('123456789012345678'));

    expect(url.searchParams.get('client_id')).toBe('123456789012345678');
    expect(url.searchParams.get('scope')).toBe('bot applications.commands');
    expect(url.searchParams.get('permissions')).toBe('3665216');
  });

  it.each([undefined, '', 'replace-with-your-discord-application-id', '123', '12345678901234567x'])(
    'rejects missing or invalid client ID %s',
    clientId => {
      expect(() => validateDiscordClientId(clientId)).toThrow(/VITE_DISCORD_CLIENT_ID/);
      expect(() => createDiscordInviteUrl(clientId)).toThrow(/VITE_DISCORD_CLIENT_ID/);
    },
  );
});
