import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  playerInstances: [] as unknown[],
  queueDisplays: [] as unknown[],
  playerDisplays: [] as unknown[],
}));

vi.mock('@eolian/framework/voice', () => ({
  DiscordPlayer: class {
    idle = false;
    stop = vi.fn();
    close = vi.fn().mockResolvedValue(undefined);
    constructor(
      public client: unknown,
      public queue: unknown,
      public volume: unknown,
    ) {
      mocks.playerInstances.push(this);
    }
  },
}));

vi.mock('@eolian/framework/discord-queue-display', () => ({
  DiscordQueueDisplay: class {
    removeIdle = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    constructor(public queue: unknown) {
      mocks.queueDisplays.push(this);
    }
  },
}));

vi.mock('@eolian/framework/discord-player-display', () => ({
  DiscordPlayerDisplay: class {
    removeIdle = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    constructor(
      public player: unknown,
      public queueDisplay: unknown,
    ) {
      mocks.playerDisplays.push(this);
    }
  },
}));

import { DiscordGuildState } from '@eolian/framework/state/discord-guild-state';

describe('DiscordGuildState', () => {
  beforeEach(() => {
    mocks.playerInstances.length = 0;
    mocks.queueDisplays.length = 0;
    mocks.playerDisplays.length = 0;
  });

  function createState() {
    return new DiscordGuildState(
      'guild',
      { name: 'client' } as never,
      { id: 'guild' } as never,
      { _id: 'guild', volume: 0.4 },
      {} as never,
    );
  }

  it('lazily creates and reuses queue, player, and display adapters', () => {
    const state = createState();

    const queue = state.queue;
    expect(state.queue).toBe(queue);
    const player = state.player;
    expect(state.player).toBe(player);
    expect(mocks.playerInstances).toHaveLength(1);
    expect(mocks.playerInstances[0]).toMatchObject({
      client: { name: 'client' },
      queue,
      volume: 0.4,
    });

    const queueDisplay = state.display.queue;
    expect(state.display.queue).toBe(queueDisplay);
    const playerDisplay = state.display.player;
    expect(state.display.player).toBe(playerDisplay);
    expect(mocks.queueDisplays[0]).toMatchObject({ queue });
    expect(mocks.playerDisplays[0]).toMatchObject({ player, queueDisplay });
  });

  it('is idle only when both player and queue are idle', () => {
    const state = createState();
    const player = state.player as never as { idle: boolean };
    const queue = state.queue as never as { lastUpdated: number };

    player.idle = true;
    Object.defineProperty(queue, 'idle', { configurable: true, get: () => true });
    expect(state.isIdle()).toBe(true);
    player.idle = false;
    expect(state.isIdle()).toBe(false);
  });

  it('stops and removes an idle player before flushing disposables', async () => {
    const state = createState();
    const player = state.player as never as {
      idle: boolean;
      stop: ReturnType<typeof vi.fn>;
    };
    player.idle = true;
    const display = state.display.player as never as {
      removeIdle: ReturnType<typeof vi.fn>;
    };
    const disposable = { close: vi.fn().mockResolvedValue(undefined) };
    state.addDisposable(disposable);

    await state.closeIdle();

    expect(display.removeIdle).toHaveBeenCalledOnce();
    expect(player.stop).toHaveBeenCalledOnce();
    expect(disposable.close).toHaveBeenCalledOnce();
  });

  it('removes only the queue display when the player is active and queue is idle', async () => {
    const state = createState();
    (state.player as never as { idle: boolean }).idle = false;
    Object.defineProperty(state.queue, 'idle', { configurable: true, get: () => true });
    const queueDisplay = state.display.queue as never as {
      removeIdle: ReturnType<typeof vi.fn>;
    };

    await state.closeIdle();

    expect(queueDisplay.removeIdle).toHaveBeenCalledOnce();
    expect(
      (mocks.playerInstances[0] as { stop: ReturnType<typeof vi.fn> }).stop,
    ).not.toHaveBeenCalled();
  });

  it('closes created resources, tolerates individual failures, and recreates the player', async () => {
    const state = createState();
    const firstPlayer = state.player as never as {
      close: ReturnType<typeof vi.fn>;
    };
    firstPlayer.close.mockRejectedValueOnce(new Error('player close'));
    const queueDisplay = state.display.queue as never as {
      close: ReturnType<typeof vi.fn>;
    };
    const playerDisplay = state.display.player as never as {
      close: ReturnType<typeof vi.fn>;
    };
    const failing = { close: vi.fn().mockRejectedValue(new Error('dispose')) };
    state.addDisposable(failing);

    await expect(state.close()).resolves.toBeUndefined();
    expect(firstPlayer.close).toHaveBeenCalledOnce();
    expect(queueDisplay.close).toHaveBeenCalledOnce();
    expect(playerDisplay.close).toHaveBeenCalledOnce();
    expect(failing.close).toHaveBeenCalledOnce();

    expect(state.player).not.toBe(firstPlayer);
    expect(mocks.playerInstances).toHaveLength(2);
  });

  it('does not instantiate unused resources during close', async () => {
    const state = createState();
    await state.close();
    expect(mocks.playerInstances).toHaveLength(0);
    expect(mocks.queueDisplays).toHaveLength(0);
    expect(mocks.playerDisplays).toHaveLength(0);
  });
});
