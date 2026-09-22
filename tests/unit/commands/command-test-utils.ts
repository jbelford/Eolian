import { vi } from 'vitest';
import { Track, TrackSource } from '@eolian/api/@types';
import { SyntaxType } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { UserPermission } from '@eolian/common/constants';
import {
  AppDatabase,
  ResourceType,
  ServerDTO,
  ServersDb,
  UserDTO,
  UsersDb,
} from '@eolian/data/@types';
import {
  ContextClient,
  ContextCommandInteraction,
  ContextMessage,
  ContextMusicQueue,
  ContextServer,
  ContextTextChannel,
  ContextUser,
  ContextVoiceChannel,
  PlayerDisplay,
  QueueDisplay,
} from '@eolian/framework/@types';
import { ServerState } from '@eolian/framework/state/@types';
import { Player } from '@eolian/framework/voice/@types';

export const track = (title = 'Song'): Track => ({
  id: title.toLowerCase(),
  title,
  poster: 'Artist',
  url: `https://example.test/${title}`,
  src: TrackSource.YouTube,
});

export const identifier = (type = ResourceType.Song) => ({
  type,
  src: TrackSource.YouTube,
  id: 'resource-id',
  url: 'https://example.test/resource',
});

export function createMessage() {
  return {
    text: '',
    id: 'message-id',
    edit: vi.fn().mockResolvedValue(undefined),
    editEmbed: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    releaseButtons: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  } satisfies ContextMessage;
}

export function createSelection(selected = 0) {
  return {
    selected,
    message: createMessage(),
  };
}

export function createUser(overrides: Partial<ContextUser> = {}) {
  const user = {
    id: 'user-id',
    name: 'Test User',
    avatar: 'avatar',
    permission: UserPermission.Owner,
    send: vi.fn().mockResolvedValue(createMessage()),
    sendEmbed: vi.fn().mockResolvedValue(createMessage()),
    updatePermissions: vi.fn().mockResolvedValue(undefined),
    getVoice: vi.fn(),
    get: vi.fn().mockResolvedValue({ _id: 'user-id' } satisfies UserDTO),
    getRequest: vi.fn().mockResolvedValue({}),
    setToken: vi.fn().mockResolvedValue(undefined),
    clearData: vi.fn().mockResolvedValue(true),
    setIdentifier: vi.fn().mockResolvedValue(undefined),
    removeIdentifier: vi.fn().mockResolvedValue(true),
    setSpotify: vi.fn().mockResolvedValue(undefined),
    setSoundCloud: vi.fn().mockResolvedValue(undefined),
    setSyntax: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return user as typeof user & ContextUser;
}

export function createChannel(overrides: Partial<ContextTextChannel> = {}) {
  const channel = {
    id: 'channel-id',
    isDm: false,
    visible: true,
    reactable: true,
    lastMessageId: undefined,
    sendable: true,
    send: vi.fn().mockResolvedValue(createMessage()),
    sendSelection: vi.fn().mockResolvedValue(createSelection()),
    sendEmbed: vi.fn().mockResolvedValue(createMessage()),
    ...overrides,
  };
  return channel as typeof channel & ContextTextChannel;
}

export function createInteraction(
  user = createUser(),
  channel = createChannel(),
  overrides: Partial<ContextCommandInteraction> = {},
) {
  const interaction = {
    user,
    channel,
    sendable: true,
    hasReplied: false,
    reactable: true,
    isSlash: false,
    send: vi.fn().mockResolvedValue(createMessage()),
    sendSelection: vi.fn().mockResolvedValue(createSelection()),
    sendEmbed: vi.fn().mockResolvedValue(createMessage()),
    defer: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
    getCommand: vi.fn(),
    toString: vi.fn().mockReturnValue('command'),
    ...overrides,
  };
  return interaction as typeof interaction & ContextCommandInteraction;
}

export function createVoice(overrides: Partial<ContextVoiceChannel> = {}) {
  const voice = {
    id: 'voice-id',
    joinable: true,
    join: vi.fn().mockResolvedValue(undefined),
    hasPeopleListening: vi.fn().mockReturnValue(true),
    ...overrides,
  };
  return voice as typeof voice & ContextVoiceChannel;
}

export function createQueue(overrides: Partial<ContextMusicQueue> = {}) {
  const queue = {
    loop: false,
    idle: false,
    setLoopMode: vi.fn().mockResolvedValue(undefined),
    size: vi.fn().mockResolvedValue(1),
    unpop: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue([[track()], []]),
    remove: vi.fn().mockResolvedValue(1),
    move: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    shuffle: vi.fn().mockResolvedValue(true),
    clear: vi.fn().mockResolvedValue(true),
    pop: vi.fn().mockResolvedValue(track()),
    peek: vi.fn().mockResolvedValue(track()),
    peekReverse: vi.fn().mockResolvedValue(track()),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    listeners: vi.fn().mockReturnValue([]),
    rawListeners: vi.fn().mockReturnValue([]),
    listenerCount: vi.fn().mockReturnValue(0),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
    off: vi.fn(),
    eventNames: vi.fn().mockReturnValue([]),
    getMaxListeners: vi.fn().mockReturnValue(10),
    setMaxListeners: vi.fn(),
    ...overrides,
  };
  return queue as typeof queue & ContextMusicQueue;
}

export function createPlayer(overrides: Partial<Player> = {}) {
  const player = {
    isStreaming: false,
    paused: false,
    idle: false,
    volume: 0.5,
    nightcore: false,
    bass: false,
    queue: createQueue(),
    getChannel: vi.fn(),
    setVolume: vi.fn(),
    setNightcore: vi.fn(),
    setBassBoost: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    skip: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    listeners: vi.fn().mockReturnValue([]),
    rawListeners: vi.fn().mockReturnValue([]),
    listenerCount: vi.fn().mockReturnValue(0),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
    off: vi.fn(),
    eventNames: vi.fn().mockReturnValue([]),
    getMaxListeners: vi.fn().mockReturnValue(10),
    setMaxListeners: vi.fn(),
    ...overrides,
  };
  return player as typeof player & Player;
}

export function createServerDetails(overrides: Partial<ContextServer> = {}) {
  const details = {
    name: 'Test Server',
    id: 'guild-id',
    members: 10,
    owner: 'owner-id',
    avatar: undefined,
    botCount: 2,
    botRatio: 0.2,
    isAllowedYouTube: true,
    get: vi.fn().mockResolvedValue({ _id: 'guild-id' } satisfies ServerDTO),
    setPrefix: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn().mockResolvedValue(undefined),
    setSyntax: vi.fn().mockResolvedValue(undefined),
    setChannel: vi.fn().mockResolvedValue(undefined),
    addDjRole: vi.fn().mockResolvedValue(true),
    removeDjRole: vi.fn().mockResolvedValue(true),
    setDjLimited: vi.fn().mockResolvedValue(undefined),
    updateUsage: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return details as typeof details & ContextServer;
}

export function createServerState(overrides: Partial<ServerState> = {}) {
  const playerDisplay = {
    setChannel: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    removeIdle: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } satisfies PlayerDisplay;
  const queueDisplay = {
    setChannel: vi.fn(),
    send: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    removeIdle: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } satisfies QueueDisplay;
  const server = {
    details: createServerDetails(),
    player: createPlayer(),
    queue: createQueue(),
    display: { player: playerDisplay, queue: queueDisplay },
    isIdle: vi.fn().mockReturnValue(false),
    closeIdle: vi.fn().mockResolvedValue(undefined),
    addDisposable: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return server as typeof server & ServerState;
}

export function createClient(overrides: Partial<ContextClient> = {}) {
  const client = {
    name: 'Eolian',
    pic: 'avatar',
    getVoice: vi.fn(),
    generateInvite: vi.fn().mockReturnValue('https://discord.test/invite'),
    getServers: vi.fn().mockReturnValue([]),
    getIdleServers: vi.fn().mockResolvedValue([]),
    getUnusedServers: vi.fn().mockResolvedValue([]),
    updateCommands: vi.fn().mockResolvedValue(true),
    getRecentlyUsedCount: vi.fn().mockReturnValue(0),
    leave: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  return client as typeof client & ContextClient;
}

export function createUsersDatabase(overrides: Partial<UsersDb> = {}) {
  const users = {
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    setSoundCloud: vi.fn().mockResolvedValue(undefined),
    removeSoundCloud: vi.fn().mockResolvedValue(undefined),
    setSoundCloudRefreshToken: vi.fn().mockResolvedValue(undefined),
    removeSoundCloudRefreshToken: vi.fn().mockResolvedValue(undefined),
    setSpotifyRefreshToken: vi.fn().mockResolvedValue(undefined),
    setSpotify: vi.fn().mockResolvedValue(undefined),
    removeSpotify: vi.fn().mockResolvedValue(undefined),
    removeSpotifyRefreshToken: vi.fn().mockResolvedValue(undefined),
    setIdentifier: vi.fn().mockResolvedValue(undefined),
    removeIdentifier: vi.fn().mockResolvedValue(false),
    setSyntax: vi.fn().mockResolvedValue(undefined),
    removeSyntax: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return users as typeof users & UsersDb;
}

export function createServersDatabase(overrides: Partial<ServersDb> = {}) {
  const servers = {
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(false),
    getIdleServers: vi.fn().mockResolvedValue([]),
    setLastUsage: vi.fn().mockResolvedValue(undefined),
    setPreferredChannel: vi.fn().mockResolvedValue(undefined),
    setPrefix: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn().mockResolvedValue(undefined),
    setSyntax: vi.fn().mockResolvedValue(undefined),
    addDjRole: vi.fn().mockResolvedValue(undefined),
    removeDjRole: vi.fn().mockResolvedValue(false),
    setDjAllowLimited: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return servers as typeof servers & ServersDb;
}

export function createDatabase(overrides: Partial<AppDatabase> = {}) {
  const database = {
    users: createUsersDatabase(),
    servers: createServersDatabase(),
    sessions: {
      initialize: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(false),
      renew: vi.fn().mockResolvedValue(false),
      delete: vi.fn().mockResolvedValue(false),
    },
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return database as typeof database & AppDatabase;
}

export function createContext(overrides: Partial<CommandContext> = {}) {
  const context = {
    client: createClient(),
    interaction: createInteraction(),
    server: createServerState(),
    ...overrides,
  };
  return context as typeof context & CommandContext;
}

export const options = {
  none: {},
  syntax: (value: string) => ({ ARG: [value] }),
  legacySyntax: SyntaxType.KEYWORD,
};
