import { Command } from '../@types';
import { NIGHTCORE_COMMAND } from './nightcore';
import { PLAY_COMMAND } from './play';
import {
  STOP_COMMAND,
  BACK_COMMAND,
  SKIP_COMMAND,
  PAUSE_COMMAND,
  RESUME_COMMAND,
  SHOW_COMMAND,
} from './playback';
import { VOLUME_COMMAND } from './volume';

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

export { PLAY_MESSAGE_COMMAND } from './play';
