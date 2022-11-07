import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';

const NOT_PLAYING = "I'm not playing anything right now!";

async function execute(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    context.server!.player.stop();
    if (context.interaction.reactable) {
      await context.interaction.react('😢');
    } else {
      await context.interaction.send('⏹️', { ephemeral: false });
    }
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const STOP_COMMAND: Command = {
  name: 'stop',
  details: 'Stop playing music.',
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  usage: [
    {
      example: '',
    },
  ],
  args: {
    base: true,
    groups: [],
  },
  execute,
};

async function executeSkip(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    await context.server!.player.skip();
    if (context.interaction.reactable) {
      await context.interaction.react('⏩');
    } else {
      await context.interaction.send('⏩', { ephemeral: false });
    }
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const SKIP_COMMAND: Command = {
  name: 'skip',
  details: 'Skip current song.',
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  usage: [
    {
      example: '',
    },
  ],
  args: {
    base: true,
    groups: [],
  },
  execute: executeSkip,
};

async function executeBack(context: CommandContext): Promise<void> {
  const success = await context.server!.queue.unpop(2);
  if (success) {
    if (context.server!.player.isStreaming) {
      await context.server!.player.skip();
    }
    if (context.interaction.reactable) {
      await context.interaction.react('⏪');
    } else {
      await context.interaction.send('⏪', { ephemeral: false });
    }
  } else {
    throw new EolianUserError('There are no previous songs!');
  }
}

export const BACK_COMMAND: Command = {
  name: 'back',
  details: 'Go back a song.',
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  usage: [
    {
      example: '',
    },
  ],
  args: {
    base: true,
    groups: [],
  },
  execute: executeBack,
};

async function executePause(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    if (context.server!.player.paused) {
      throw new EolianUserError('Playback is already paused!');
    } else {
      await context.server!.player.pause();
      if (context.interaction.reactable) {
        await context.interaction.react('⏸');
      } else {
        await context.interaction.send('⏸️', { ephemeral: false });
      }
    }
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const PAUSE_COMMAND: Command = {
  name: 'pause',
  details: 'Pause the current song.',
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  usage: [
    {
      example: '',
    },
  ],
  args: {
    base: true,
    groups: [],
  },
  execute: executePause,
};

async function executeResume(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    if (context.server!.player.paused) {
      await context.server!.player.resume();
      if (context.interaction.reactable) {
        await context.interaction.react('▶');
      } else {
        await context.interaction.send('▶️', { ephemeral: false });
      }
    } else {
      throw new EolianUserError('Playback is not paused!');
    }
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const RESUME_COMMAND: Command = {
  name: 'resume',
  details: 'Resume the current song.',
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  usage: [
    {
      example: '',
    },
  ],
  args: {
    base: true,
    groups: [],
  },
  execute: executeResume,
};

async function executeShowPlayer(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    context.server!.display.player.setChannel(context.interaction.channel, context.interaction);
    await context.server!.display.player.refresh();
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const SHOW_COMMAND: Command = {
  name: 'show',
  details: `Show what's playing. This will move the player and bind it to this channel.`,
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  usage: [
    {
      example: '',
    },
  ],
  args: {
    base: true,
    groups: [],
  },
  execute: executeShowPlayer,
};
