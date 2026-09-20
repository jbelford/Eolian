import { describe, expect, it, vi } from 'vitest';

const voiceMocks = vi.hoisted(() => ({
  joinVoiceChannel: vi.fn(),
}));

vi.mock('@discordjs/voice', () => ({
  joinVoiceChannel: voiceMocks.joinVoiceChannel,
}));

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

    expect(voice.id).toBe('voice-id');
    expect(voice.joinable).toBe(true);
    await voice.join();

    expect(voiceMocks.joinVoiceChannel).toHaveBeenCalledWith({
      channelId: 'voice-id',
      guildId: 'guild-id',
      adapterCreator: raw.guild.voiceAdapterCreator,
    });
  });

  it('only counts non-bot, non-deaf members as listeners', () => {
    const raw = channel();
    const voice = new DiscordVoiceChannel(raw as never);
    const human = { user: { bot: false }, voice: { deaf: false } };
    const bot = { user: { bot: true }, voice: { deaf: false } };
    const deaf = { user: { bot: false }, voice: { deaf: true } };

    raw.members.find.mockImplementation(predicate => [bot, deaf, human].find(predicate));
    expect(voice.hasPeopleListening()).toBe(true);

    raw.members.find.mockImplementation(predicate => [bot, deaf].find(predicate));
    expect(voice.hasPeopleListening()).toBe(false);
  });
});
