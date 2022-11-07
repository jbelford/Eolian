import { Command } from '../@types';
import { BACK_COMMAND } from './back-command';
import { NIGHTCORE_COMMAND } from './nightcore-command';
import { PAUSE_COMMAND } from './pause-command';
import { PLAY_COMMAND } from './play-command';
import { RESUME_COMMAND } from './resume-command';
import { SHOW_COMMAND } from './show-command';
import { SKIP_COMMAND } from './skip-command';
import { STOP_COMMAND } from './stop-command';
import { VOLUME_COMMAND } from './volume-command';

export const MUSIC_COMMANDS: Command[] = [
  PLAY_COMMAND,
  STOP_COMMAND,
  BACK_COMMAND,
  SKIP_COMMAND,
  PAUSE_COMMAND,
  RESUME_COMMAND,
  VOLUME_COMMAND,
  SHOW_COMMAND,
  NIGHTCORE_COMMAND,
];

export { PLAY_MESSAGE_COMMAND } from './play-command';
