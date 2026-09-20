import { describe, expect, it, vi } from 'vitest';

const voiceMocks = vi.hoisted(() => ({
  entersState: vi.fn(),
}));

vi.mock('@discordjs/voice', () => ({
  VoiceConnectionStatus: {
    Connecting: 'connecting',
    Signalling: 'signalling',
  },
  entersState: voiceMocks.entersState,
}));

const channelMocks = vi.hoisted(() => ({
  created: [] as unknown[],
}));

vi.mock('@eolian/framework/voice/discord-voice-channel', () => ({
  DiscordVoiceChannel: class {
    constructor(readonly channel: unknown) {
      channelMocks.created.push(channel);
    }
  },
}));

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@eolian/common/logger', () => ({ logger: loggerMocks }));

import { VoiceConnectionStatus } from '@discordjs/voice';
import { DiscordVoiceConnection } from '@eolian/framework/voice/discord-voice-connection';

function harness(channel: unknown = { type: 2 }) {
  const client = {
    channels: {
      cache: {
        get: vi.fn().mockReturnValue(channel),
      },
    },
  };
  const raw = {
    joinConfig: { channelId: 'voice-id' },
    subscribe: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    connection: new DiscordVoiceConnection(client as never, raw as never),
    client,
    raw,
    channel,
  };
}

describe('DiscordVoiceConnection', () => {
  it('resolves its channel and wraps it', () => {
    const h = harness();

    expect(h.connection.channelId).toBe('voice-id');
    const wrapped = h.connection.getChannel();

    expect(h.client.channels.cache.get).toHaveBeenCalledWith('voice-id');
    expect(channelMocks.created).toContain(h.channel);
    expect(wrapped).toMatchObject({ channel: h.channel });
    expect(loggerMocks.warn).not.toHaveBeenCalled();
  });

  it('warns when the cached channel is not a guild voice channel', () => {
    const h = harness({ type: 0 });

    h.connection.getChannel();

    expect(loggerMocks.warn).toHaveBeenCalledWith(
      'Guild channel received is not voice. Type: %s Id: %s',
      0,
      'voice-id',
    );
  });

  it('reports reconnect success when either target state is reached', async () => {
    const h = harness();
    voiceMocks.entersState
      .mockRejectedValueOnce(new Error('not signalling'))
      .mockResolvedValueOnce(undefined);

    await expect(h.connection.awaitReconnect()).resolves.toBe(true);

    expect(voiceMocks.entersState).toHaveBeenNthCalledWith(
      1,
      h.raw,
      VoiceConnectionStatus.Signalling,
      5000,
    );
    expect(voiceMocks.entersState).toHaveBeenNthCalledWith(
      2,
      h.raw,
      VoiceConnectionStatus.Connecting,
      5000,
    );
  });

  it('reports reconnect failure when both target states reject', async () => {
    const h = harness();
    voiceMocks.entersState.mockRejectedValue(new Error('disconnected'));

    await expect(h.connection.awaitReconnect()).resolves.toBe(false);
    expect(loggerMocks.debug).toHaveBeenCalledWith('Voice was disconnected');
  });

  it('normalizes subscription results and destroys on close', async () => {
    const h = harness();
    const audioPlayer = { player: true };
    h.raw.subscribe.mockReturnValueOnce({ subscription: true }).mockReturnValueOnce(undefined);

    expect(h.connection.subscribe(audioPlayer as never)).toBe(true);
    expect(h.connection.subscribe(audioPlayer as never)).toBe(false);
    expect(h.raw.subscribe).toHaveBeenCalledWith(audioPlayer);

    await h.connection.close();
    expect(h.raw.destroy).toHaveBeenCalledOnce();
  });
});
