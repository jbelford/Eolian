import { describe, expect, it, vi } from 'vitest';

const { voiceMocks, environment } = vi.hoisted(() => ({
  voiceMocks: {
    joinVoiceChannel: vi.fn(),
    entersState: vi.fn(),
  },
  environment: {
    e2eBotId: undefined as string | undefined,
  },
}));

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: voiceMocks.joinVoiceChannel,
  entersState: voiceMocks.entersState,
  VoiceConnectionStatus: {
    Ready: 'ready',
  },
}));
vi.mock('@eolian/common/env', () => ({ environment }));

import { DiscordVoiceChannel } from '@eolian/framework/voice/discord-voice-channel';

function channel() {
  return {
    id: 'voice-id',
    joinable: true,
    guild: {
      id: 'guild-id',
      voiceAdapterCreator: { adapter: true },
    },
    members: {
      find: vi.fn(),
    },
  };
}

describe('DiscordVoiceChannel', () => {
  it('exposes channel properties and joins with the guild adapter', async () => {
    const raw = channel();
    const voice = new DiscordVoiceChannel(raw as never);
    const connection = { state: 'connection' };
    voiceMocks.joinVoiceChannel.mockReturnValueOnce(connection);

    expect(voice.id).toBe('voice-id');
    expect(voice.joinable).toBe(true);
    await voice.join();

    expect(voiceMocks.joinVoiceChannel).toHaveBeenCalledWith({
      channelId: 'voice-id',
      guildId: 'guild-id',
      adapterCreator: raw.guild.voiceAdapterCreator,
    });
    expect(voiceMocks.entersState).toHaveBeenCalledWith(connection, 'ready', 15_000);
  });

  it('counts humans and the configured E2E bot as listeners', () => {
    const raw = channel();
    const voice = new DiscordVoiceChannel(raw as never);
    const human = { id: 'human', user: { bot: false }, voice: { deaf: false } };
    const bot = { id: 'other-bot', user: { bot: true }, voice: { deaf: false } };
    const e2eBot = { id: 'e2e-bot', user: { bot: true }, voice: { deaf: false } };
    const deaf = { id: 'deaf', user: { bot: false }, voice: { deaf: true } };

    raw.members.find.mockImplementation(predicate => [bot, deaf, human].find(predicate));
    expect(voice.hasPeopleListening()).toBe(true);

    environment.e2eBotId = 'e2e-bot';
    raw.members.find.mockImplementation(predicate => [bot, deaf, e2eBot].find(predicate));
    expect(voice.hasPeopleListening()).toBe(true);

    environment.e2eBotId = undefined;
    raw.members.find.mockImplementation(predicate => [bot, deaf, e2eBot].find(predicate));
    expect(voice.hasPeopleListening()).toBe(false);
  });
});
