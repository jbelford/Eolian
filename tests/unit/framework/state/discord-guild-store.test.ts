import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@eolian/common/env';

const mocks = vi.hoisted(() => ({
  states: [] as Array<{
    isIdle: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    closeIdle: ReturnType<typeof vi.fn>;
  }>,
  guilds: [] as unknown[],
  clients: [] as unknown[],
}));

vi.mock('@eolian/framework/state/discord-guild-state', () => ({
  DiscordGuildState: class {
    isIdle = vi.fn(() => true);
    close = vi.fn().mockResolvedValue(undefined);
    closeIdle = vi.fn().mockResolvedValue(undefined);
    constructor(...args: unknown[]) {
      Object.assign(this, { args });
      mocks.states.push(this);
    }
  },
}));

vi.mock('@eolian/framework/discord-guild', () => ({
  DiscordGuild: class {
    id: string;
    get = vi.fn().mockResolvedValue({ _id: 'guild', volume: 0.5 });
    constructor(_servers: unknown, guild: { id: string }) {
      this.id = guild.id;
      mocks.guilds.push(this);
    }
  },
}));

vi.mock('@eolian/framework/discord-client', () => ({
  DiscordGuildClient: class {
    constructor(...args: unknown[]) {
      Object.assign(this, { args });
      mocks.clients.push(this);
    }
  },
}));

import { DiscordGuildStore } from '@eolian/framework/state/discord-guild-store';

describe('DiscordGuildStore', () => {
  const originalTtl = environment.config.guildCacheTTL;

  beforeEach(() => {
    vi.useFakeTimers();
    environment.config.guildCacheTTL = 1;
    mocks.states.length = 0;
    mocks.guilds.length = 0;
    mocks.clients.length = 0;
  });

  afterEach(() => {
    environment.config.guildCacheTTL = originalTtl;
    vi.useRealTimers();
  });

  it('caches guild details and state and tracks active entries', async () => {
    const store = new DiscordGuildStore({} as never, {} as never);
    const guild = { id: 'guild' };

    expect(store.getDetails(guild as never)).toBe(store.getDetails(guild as never));
    const state = await store.getState(guild as never);
    expect(await store.getState(guild as never)).toBe(state);
    expect(mocks.guilds).toHaveLength(1);
    expect(mocks.clients).toHaveLength(1);
    expect(mocks.states).toHaveLength(1);
    expect(store.active).toBe(1);
    await store.close();
  });

  it('closes and removes an idle state after cache expiration', async () => {
    const store = new DiscordGuildStore({} as never, {} as never);
    const guild = { id: 'guild' };
    const state = (await store.getState(guild as never)) as never as (typeof mocks.states)[number];

    await vi.advanceTimersByTimeAsync(1001);
    await store.getState(guild as never);
    await Promise.resolve();

    expect(state.close).toHaveBeenCalledOnce();
    expect(state.closeIdle).not.toHaveBeenCalled();
    expect(mocks.states).toHaveLength(2);
    expect(store.active).toBe(1);
    await store.close();
  });

  it('partially closes and preserves a busy state after expiration', async () => {
    const store = new DiscordGuildStore({} as never, {} as never);
    const guild = { id: 'guild' };
    const state = (await store.getState(guild as never)) as never as (typeof mocks.states)[number];
    state.isIdle.mockReturnValue(false);

    await vi.advanceTimersByTimeAsync(1001);
    const returned = await store.getState(guild as never);
    await Promise.resolve();

    expect(state.closeIdle).toHaveBeenCalledOnce();
    expect(state.close).not.toHaveBeenCalled();
    expect(returned).toBe(state);
    expect(mocks.states).toHaveLength(1);
    expect(store.active).toBe(1);
    await store.close();
  });

  it('closes every cached state during shutdown', async () => {
    const store = new DiscordGuildStore({} as never, {} as never);
    await store.getState({ id: 'one' } as never);
    await store.getState({ id: 'two' } as never);
    await store.close();
    expect(mocks.states[0].close).toHaveBeenCalledOnce();
    expect(mocks.states[1].close).toHaveBeenCalledOnce();
  });

  it('waits for in-flight expiration cleanup before shutting down', async () => {
    const store = new DiscordGuildStore({} as never, {} as never);
    const guild = { id: 'guild' };
    const state = (await store.getState(guild as never)) as never as (typeof mocks.states)[number];
    state.isIdle.mockReturnValue(false);
    let finishCleanup!: () => void;
    state.closeIdle.mockReturnValueOnce(
      new Promise<void>(resolve => {
        finishCleanup = () => resolve();
      }),
    );

    await vi.advanceTimersByTimeAsync(1001);
    const getPromise = store.getState(guild as never);
    await Promise.resolve();
    let closed = false;
    const closePromise = store.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);

    finishCleanup();
    await Promise.all([getPromise, closePromise]);
    expect(state.close).toHaveBeenCalledOnce();
  });
});
