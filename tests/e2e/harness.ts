import {
  EndBehaviorType,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  Message,
  PermissionFlagsBits,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import prism from 'prism-media';
import { once } from 'node:events';
import { createCleanupCommands, createPlayCommand } from './chat-command';
import { loadHarnessConfig } from './harness-config';
import { evaluatePlayback, VerificationSignals } from './verification';

const config = loadHarnessConfig(process.env);
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
});
const signals: VerificationSignals = {
  discordResponseObserved: false,
  voiceStateObserved: false,
  packetCount: 0,
  pcmBytes: 0,
  rms: 0,
};
let commandChannel: TextChannel | VoiceChannel | undefined;
let commandSent = false;

client.on('messageCreate', (message: Message) => {
  if (message.channelId === config.textChannelId && message.author.id === config.eolianBotId) {
    signals.discordResponseObserved = true;
  }
});
client.on('voiceStateUpdate', (_, state) => {
  if (
    state.id === config.eolianBotId &&
    state.guild.id === config.guildId &&
    state.channelId === config.voiceChannelId
  ) {
    signals.voiceStateObserved = true;
  }
});

try {
  await client.login(config.discordToken);
  if (!client.isReady()) {
    await once(client, 'clientReady', { signal: AbortSignal.timeout(15000) });
  }

  const guild = await client.guilds.fetch(config.guildId);
  const voiceChannel = await guild.channels.fetch(config.voiceChannelId);
  const textChannel = await guild.channels.fetch(config.textChannelId);
  if (voiceChannel?.type !== ChannelType.GuildVoice) {
    throw new Error('E2E_VOICE_CHANNEL_ID must identify a guild voice channel');
  }
  if (textChannel?.type !== ChannelType.GuildText && textChannel?.type !== ChannelType.GuildVoice) {
    throw new Error('E2E_TEXT_CHANNEL_ID must identify a guild text or voice channel');
  }
  const me = await guild.members.fetchMe();
  const eolian = await guild.members.fetch(config.eolianBotId);
  if (!eolian.user.bot || eolian.id === me.id) {
    throw new Error('E2E_EOLIAN_BOT_ID must identify the separate Eolian bot application');
  }
  if (config.triggerMode === 'chat' && eolian.voice.channelId) {
    throw new Error(
      `Eolian is already connected to voice channel ${eolian.voice.channelId}; refusing to disrupt it`,
    );
  }
  const voicePermissions = voiceChannel.permissionsFor(me);
  if (
    !voicePermissions.has(PermissionFlagsBits.ViewChannel) ||
    !voicePermissions.has(PermissionFlagsBits.Connect)
  ) {
    throw new Error('The E2E bot requires View Channel and Connect in the voice channel');
  }
  if (!textChannel.permissionsFor(me).has(PermissionFlagsBits.ViewChannel)) {
    throw new Error('The E2E bot requires View Channel in the configured text channel');
  }
  if (
    config.triggerMode === 'chat' &&
    !textChannel.permissionsFor(me).has(PermissionFlagsBits.SendMessages)
  ) {
    throw new Error('The E2E bot requires Send Messages in the configured text channel');
  }
  commandChannel = textChannel;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 15000);

  const opus = connection.receiver.subscribe(config.eolianBotId, {
    end: { behavior: EndBehaviorType.Manual },
  });
  const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
  opus.on('data', packet => {
    signals.packetCount++;
    signals.voiceStateObserved ||=
      guild.members.cache.get(config.eolianBotId)?.voice.channelId === config.voiceChannelId;
  });
  opus.on('error', error => {
    process.stderr.write(`Opus receive warning: ${error.message}\n`);
  });
  decoder.on('data', (pcm: Buffer) => {
    signals.pcmBytes += pcm.length;
    signals.rms = Math.max(signals.rms, calculateRms(pcm));
  });
  decoder.on('error', error => {
    process.stderr.write(`Opus decode warning: ${error.message}\n`);
  });
  opus.pipe(decoder);

  const playCommand = createPlayCommand({
    eolianBotId: config.eolianBotId,
    source: config.source,
    requestType: config.requestType,
    request: config.request,
  });
  if (config.triggerMode === 'chat') {
    await textChannel.send(playCommand);
    commandSent = true;
  } else {
    process.stdout.write(
      `Human trigger mode: have a real user send this command in <#${config.textChannelId}>:\n${playCommand}\n`,
    );
  }

  const deadline = Date.now() + config.timeoutMs;
  let result = evaluatePlayback(signals, {
    minPackets: config.minPackets,
    minPcmBytes: config.minPcmBytes,
    minRms: config.minRms,
  });
  while (!result.passed && Date.now() < deadline) {
    await sleep(500);
    signals.voiceStateObserved ||=
      guild.members.cache.get(config.eolianBotId)?.voice.channelId === config.voiceChannelId;
    result = evaluatePlayback(signals, {
      minPackets: config.minPackets,
      minPcmBytes: config.minPcmBytes,
      minRms: config.minRms,
    });
  }

  process.stdout.write(`${JSON.stringify({ result, signals }, null, 2)}\n`);
  if (!result.passed) {
    process.exitCode = 1;
  }

  opus.destroy();
  decoder.destroy();
  connection.destroy();
} finally {
  if (commandSent && config.triggerMode === 'chat') {
    try {
      if (!commandChannel) {
        throw new Error('Missing the configured command channel');
      }
      for (const command of createCleanupCommands(config.eolianBotId)) {
        await commandChannel.send(command);
        await sleep(500);
      }
      await waitForVoiceDisconnect();
    } catch (error) {
      process.stderr.write(`Cleanup failed: ${error instanceof Error ? error.message : error}\n`);
      process.exitCode = 1;
    }
  } else if (config.triggerMode === 'human') {
    process.stdout.write('Human trigger mode: stop playback and clear the queue when finished.\n');
  }
  client.destroy();
}

async function waitForVoiceDisconnect(): Promise<void> {
  const deadline = Date.now() + Math.min(config.timeoutMs, 10000);
  while (Date.now() < deadline) {
    const guild = client.guilds.cache.get(config.guildId);
    if (guild?.members.cache.get(config.eolianBotId)?.voice.channelId === null) {
      return;
    }
    await sleep(250);
  }
  throw new Error('Timed out waiting for Eolian to leave the voice channel');
}

function calculateRms(pcm: Buffer): number {
  if (pcm.length < 2) {
    return 0;
  }
  let squareSum = 0;
  const samples = Math.floor(pcm.length / 2);
  for (let offset = 0; offset + 1 < pcm.length; offset += 2) {
    const sample = pcm.readInt16LE(offset);
    squareSum += sample * sample;
  }
  return Math.sqrt(squareSum / samples);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
