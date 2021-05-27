import { Command, CommandContext } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { PERMISSION } from 'common/constants';


async function execute(context: CommandContext): Promise<void> {
  const voice = context.client.getVoice();
  if (voice) {
    await voice.disconnect();
    await context.message.react('😢');
  }
}

export const STOP_COMMAND: Command = {
  name: 'stop',
  details: 'Stop playing music',
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  usage: [
    {
      example: '',
    }
  ],
  execute
};


async function executeSkip(context: CommandContext): Promise<void> {
  const voice = context.client.getVoice();
  if (voice) {
    await voice.player.skip();
    await context.message.react('⏩');
  } else {
    await context.message.reply("I'm not playing anything right now!");
  }
}

export const SKIP_COMMAND: Command = {
  name: 'skip',
  details: 'Skip current song',
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  usage: [
    {
      example: ''
    }
  ],
  execute: executeSkip
};

async function executeBack(context: CommandContext): Promise<void> {
  const success = await context.server!.queue.unpop(2);
  if (success) {
    const voice = context.client.getVoice();
    if (voice) {
      await voice.player.skip();
    }
    await context.message.react('⏪');
  } else {
    await context.message.reply("There are no previous songs!");
  }
}

export const BACK_COMMAND: Command = {
  name: 'back',
  details: 'Go back a song',
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  usage: [
    {
      example: ''
    }
  ],
  execute: executeBack
};

async function executePause(context: CommandContext): Promise<void> {
  const voice = context.client.getVoice();
  if (voice) {
    if (voice.player.paused) {
      await context.message.reply('Playback is already paused!');
    } else {
      await voice.player.pause();
      await context.message.react('⏸');
    }
  } else {
    await context.message.reply("I'm not playing anything right now!");
  }
}

export const PAUSE_COMMAND: Command = {
  name: 'pause',
  details: 'Pause the current song',
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  usage: [
    {
      example: ''
    }
  ],
  execute: executePause
};

async function executeResume(context: CommandContext): Promise<void> {
  const voice = context.client.getVoice();
  if (voice) {
    if (voice.player.paused) {
      await voice.player.resume();
      await context.message.react('▶');
    } else {
      await context.message.reply('Playback is not paused!');
    }
  } else {
    await context.message.reply("I'm not playing anything right now!");
  }
}

export const RESUME_COMMAND: Command = {
  name: 'resume',
  details: 'Resume the current song',
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  usage: [
    {
      example: ''
    }
  ],
  execute: executeResume
};

async function executeShowPlayer(context: CommandContext): Promise<void> {
  const voice = context.client.getVoice();
  if (voice) {
    context.server!.display.player.setChannel(context.channel);
    await context.server!.display.player.refresh();
  } else {
    await context.message.reply("I'm not playing anything right now!");
  }
}

export const SHOW_COMMAND: Command = {
  name: 'show',
  details: `Show what's playing. This will move the player and bind it to this channel.`,
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  usage: [
    {
      example: ''
    }
  ],
  execute: executeShowPlayer
};