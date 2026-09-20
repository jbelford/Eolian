import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';
import { SyntaxType } from '@eolian/command-options/@types';
import { FeatureFlag } from '@eolian/data/@types';
import { IDENTIFY_COMMAND } from '@eolian/commands/account/identify-command';
import { LINK_COMMAND } from '@eolian/commands/account/link-command';
import { ME_COMMAND } from '@eolian/commands/account/me-command';
import { SYNTAX_COMMAND } from '@eolian/commands/account/syntax-command';
import { UNLINK_COMMAND } from '@eolian/commands/account/unlink-command';
import {
  createContext,
  createInteraction,
  createMessage,
  createSelection,
  createUser,
  identifier,
} from './command-test-utils';

const mocks = vi.hoisted(() => ({
  enabled: vi.fn(),
  resolve: vi.fn(),
  getSourceResolver: vi.fn(),
  spotifyResolve: vi.fn(),
  spotifyGetUser: vi.fn(),
  soundcloudResolveUser: vi.fn(),
  soundcloudSearchUser: vi.fn(),
  soundcloudGetUser: vi.fn(),
  spotifyGetMe: vi.fn(),
  soundcloudGetMe: vi.fn(),
  createUserDetailsEmbed: vi.fn(),
}));

vi.mock('@eolian/data', async importOriginal => ({
  ...(await importOriginal<typeof import('@eolian/data')>()),
  feature: { enabled: mocks.enabled },
}));
vi.mock('@eolian/resolvers', () => ({
  getSourceResolver: mocks.getSourceResolver,
}));
vi.mock('@eolian/api', () => ({
  createSpotifyClient: vi.fn(() => ({ getMe: mocks.spotifyGetMe })),
  createSoundCloudClient: vi.fn(() => ({ getMe: mocks.soundcloudGetMe })),
  spotify: {
    resolve: mocks.spotifyResolve,
    getUser: mocks.spotifyGetUser,
  },
  soundcloud: {
    resolveUser: mocks.soundcloudResolveUser,
    searchUser: mocks.soundcloudSearchUser,
    getUser: mocks.soundcloudGetUser,
  },
}));
vi.mock('@eolian/embed', () => ({
  createUserDetailsEmbed: mocks.createUserDetailsEmbed,
  syntaxTypeToName: (type: SyntaxType) => (type === SyntaxType.KEYWORD ? 'Keyword' : 'Traditional'),
}));

describe('account commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockReturnValue(false);
  });

  describe('identify', () => {
    it('validates the identifier and source arguments', async () => {
      const context = createContext();

      await expect(IDENTIFY_COMMAND.execute(context, {})).rejects.toThrow(
        'forgot to specify the key',
      );
      await expect(
        IDENTIFY_COMMAND.execute(context, { IDENTIFIER: 'x'.repeat(33) }),
      ).rejects.toThrow('less than 32 characters');
      await expect(
        IDENTIFY_COMMAND.execute(context, {
          IDENTIFIER: 'mix',
          SEARCH: 'query',
          URL: { source: TrackSource.YouTube, value: 'https://example.test' },
        }),
      ).rejects.toThrow('both URL and SEARCH');
    });

    it('removes an existing identifier and rejects a missing one', async () => {
      const removeIdentifier = vi.fn().mockResolvedValueOnce(true);
      const user = createUser({ removeIdentifier });
      const interaction = createInteraction(user);

      await IDENTIFY_COMMAND.execute(createContext({ interaction }), {
        IDENTIFIER: 'favorite',
        CLEAR: true,
      });

      expect(user.removeIdentifier).toHaveBeenCalledWith('favorite');
      expect(interaction.send).toHaveBeenCalledWith(
        '💨 I have removed your identifier `favorite`!',
      );

      removeIdentifier.mockResolvedValueOnce(false);
      await expect(
        IDENTIFY_COMMAND.execute(createContext({ interaction }), {
          IDENTIFIER: 'missing',
          CLEAR: true,
        }),
      ).rejects.toThrow("don't have an identifier");
    });

    it('stores a resolved identifier and edits its selection message', async () => {
      const selectionMessage = createMessage();
      const resource = {
        name: 'Playlist',
        authors: ['One', 'Two'],
        identifier: identifier(),
        selectionMessage,
      };
      mocks.getSourceResolver.mockReturnValue({
        resolve: vi.fn().mockResolvedValue(resource),
      });
      const user = createUser();
      const interaction = createInteraction(user);

      await IDENTIFY_COMMAND.execute(createContext({ interaction }), {
        IDENTIFIER: 'mix',
        SEARCH: 'playlist',
      });

      expect(interaction.defer).toHaveBeenCalledWith(false);
      expect(user.setIdentifier).toHaveBeenCalledWith('mix', resource.identifier);
      expect(selectionMessage.edit).toHaveBeenCalledWith(
        expect.stringContaining('can now be identified with `mix`'),
      );
      expect(interaction.send).not.toHaveBeenCalled();
    });

    it('rejects a resolver result with no resource', async () => {
      mocks.getSourceResolver.mockReturnValue({
        resolve: vi.fn().mockResolvedValue(undefined),
      });
      await expect(
        IDENTIFY_COMMAND.execute(createContext(), {
          IDENTIFIER: 'missing',
          SEARCH: 'nothing',
        }),
      ).rejects.toThrow('provide me something to identify');
    });
  });

  describe('link', () => {
    it('authenticates enabled Spotify and SoundCloud accounts', async () => {
      mocks.enabled.mockImplementation((flag: FeatureFlag) => flag !== FeatureFlag.WEBSITE);
      mocks.spotifyGetMe.mockResolvedValue({ id: 'spotify-id', display_name: 'Spotify User' });
      mocks.soundcloudGetMe.mockResolvedValue({ id: 42, username: 'SoundCloud User' });
      const user = createUser();
      const interaction = createInteraction(user);
      const context = createContext({ interaction });

      await LINK_COMMAND.execute(context, { SPOTIFY: true });
      await LINK_COMMAND.execute(context, { SOUNDCLOUD: true });

      expect(user.getRequest).toHaveBeenNthCalledWith(1, interaction, TrackSource.Spotify);
      expect(user.getRequest).toHaveBeenNthCalledWith(2, interaction, TrackSource.SoundCloud);
      expect(interaction.send).toHaveBeenCalledWith(expect.stringContaining('Spotify User'));
      expect(interaction.send).toHaveBeenCalledWith(expect.stringContaining('SoundCloud User'));
    });

    it('links legacy Spotify and SoundCloud URLs', async () => {
      mocks.spotifyResolve.mockReturnValue({ id: 'spotify-id', type: 'user' });
      mocks.spotifyGetUser.mockResolvedValue({ id: 'spotify-id', display_name: 'Spotify User' });
      mocks.soundcloudResolveUser.mockResolvedValue({
        id: 42,
        username: 'SoundCloud User',
        permalink_url: 'https://soundcloud.test/user',
      });
      const user = createUser();
      const interaction = createInteraction(user);
      const context = createContext({ interaction });

      await LINK_COMMAND.execute(context, {
        URL: { source: TrackSource.Spotify, value: 'https://spotify.test/user' },
      });
      await LINK_COMMAND.execute(context, {
        URL: { source: TrackSource.SoundCloud, value: 'https://soundcloud.test/user' },
      });

      expect(user.setSpotify).toHaveBeenCalledWith('spotify-id');
      expect(user.setSoundCloud).toHaveBeenCalledWith(42);
    });

    it('selects and links a SoundCloud search result', async () => {
      const users = [
        { id: 1, username: 'First', permalink_url: 'https://soundcloud.test/first' },
        { id: 2, username: 'Second', permalink_url: 'https://soundcloud.test/second' },
      ];
      mocks.soundcloudSearchUser.mockResolvedValue(users);
      const selection = createSelection(1);
      const user = createUser();
      const interaction = createInteraction(user, undefined, {
        sendSelection: vi.fn().mockResolvedValue(selection),
      });

      await LINK_COMMAND.execute(createContext({ interaction }), { SEARCH: 'artist' });

      expect(interaction.sendSelection).toHaveBeenCalledWith(
        'Which SoundCloud account do you want me to link?',
        expect.arrayContaining([expect.objectContaining({ name: 'Second' })]),
        user,
      );
      expect(user.setSoundCloud).toHaveBeenCalledWith(2);
      expect(selection.message.edit).toHaveBeenCalledWith(
        expect.stringContaining('SoundCloud account to `Second`'),
      );
    });

    it.each([
      [{ SEARCH: 'x', URL: { source: TrackSource.SoundCloud, value: 'x' } }, 'both SEARCH and URL'],
      [{ SEARCH: 'x', SPOTIFY: true }, "Spotify doesn't allow me to search"],
      [{}, 'provide valid URL or SEARCH'],
      [{ URL: { source: TrackSource.YouTube, value: 'x' } }, 'does not match any source'],
    ])('rejects invalid link input %#', async (commandOptions, message) => {
      await expect(LINK_COMMAND.execute(createContext(), commandOptions)).rejects.toThrow(message);
    });

    it('reports empty SoundCloud search results', async () => {
      mocks.soundcloudSearchUser.mockResolvedValue([]);
      await expect(LINK_COMMAND.execute(createContext(), { SEARCH: 'nobody' })).rejects.toThrow(
        'found nothing for `nobody`',
      );
    });
  });

  describe('me, syntax, and unlink', () => {
    it('clears account data and reports both outcomes', async () => {
      const clearData = vi.fn().mockResolvedValueOnce(true);
      const user = createUser({ clearData });
      const interaction = createInteraction(user);

      await ME_COMMAND.execute(createContext({ interaction }), { CLEAR: true });
      clearData.mockResolvedValueOnce(false);
      await ME_COMMAND.execute(createContext({ interaction }), { CLEAR: true });

      expect(interaction.send).toHaveBeenNthCalledWith(
        1,
        'Okay! I have erased my knowledge about you entirely.',
      );
      expect(interaction.send).toHaveBeenNthCalledWith(
        2,
        `I already don't know anything about you`,
      );
    });

    it('loads linked accounts before sending the user details embed', async () => {
      const stored = {
        _id: 'user-id',
        spotify: 'spotify-id',
        soundcloud: 42,
        identifiers: { favorite: identifier() },
        syntax: SyntaxType.TRADITIONAL,
      };
      const spotifyUser = { id: 'spotify-id', display_name: 'Spotify User' };
      const soundcloudUser = { id: 42, username: 'SoundCloud User' };
      const embed = { title: 'Account' };
      mocks.spotifyGetUser.mockResolvedValue(spotifyUser);
      mocks.soundcloudGetUser.mockResolvedValue(soundcloudUser);
      mocks.createUserDetailsEmbed.mockReturnValue(embed);
      const user = createUser({ get: vi.fn().mockResolvedValue(stored) });
      const interaction = createInteraction(user);

      await ME_COMMAND.execute(createContext({ interaction }), {});

      expect(mocks.createUserDetailsEmbed).toHaveBeenCalledWith(
        user,
        spotifyUser,
        soundcloudUser,
        stored.identifiers,
        SyntaxType.TRADITIONAL,
      );
      expect(interaction.sendEmbed).toHaveBeenCalledWith(embed);
    });

    it('shows, sets, clears, and validates syntax preference', async () => {
      const user = createUser({
        get: vi.fn().mockResolvedValue({ _id: 'user-id', syntax: SyntaxType.TRADITIONAL }),
      });
      const interaction = createInteraction(user);
      const context = createContext({ interaction });

      await SYNTAX_COMMAND.execute(context, {});
      await SYNTAX_COMMAND.execute(context, { ARG: ['keyword'] });
      await SYNTAX_COMMAND.execute(context, { ARG: ['clear'] });

      expect(interaction.send).toHaveBeenNthCalledWith(
        1,
        'Your syntax preference is currently: `Traditional`',
      );
      expect(user.setSyntax).toHaveBeenNthCalledWith(1, SyntaxType.KEYWORD);
      expect(user.setSyntax).toHaveBeenNthCalledWith(2, null);
      await expect(SYNTAX_COMMAND.execute(context, { ARG: ['unknown'] })).rejects.toThrow(
        'Unrecognized syntax type',
      );
    });

    it('unlinks both legacy providers and handles no selection', async () => {
      const user = createUser();
      const interaction = createInteraction(user);
      const context = createContext({ interaction });

      await UNLINK_COMMAND.execute(context, { SOUNDCLOUD: true, SPOTIFY: true });
      await UNLINK_COMMAND.execute(context, {});

      expect(user.setSoundCloud).toHaveBeenCalledWith(null);
      expect(user.setSpotify).toHaveBeenCalledWith(null);
      expect(interaction.send).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('also unlinked your Spotify account'),
      );
      expect(interaction.send).toHaveBeenNthCalledWith(
        2,
        'You need to specify the accounts you want me to unlink!',
      );
    });

    it('clears OAuth tokens when provider authentication is enabled', async () => {
      mocks.enabled.mockReturnValue(true);
      const user = createUser();
      const interaction = createInteraction(user);

      await UNLINK_COMMAND.execute(createContext({ interaction }), {
        SOUNDCLOUD: true,
        SPOTIFY: true,
      });

      expect(user.setToken).toHaveBeenCalledWith(null, TrackSource.SoundCloud);
      expect(user.setToken).toHaveBeenCalledWith(null, TrackSource.Spotify);
      expect(user.setSoundCloud).not.toHaveBeenCalled();
      expect(user.setSpotify).not.toHaveBeenCalled();
    });
  });
});
