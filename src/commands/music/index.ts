import { Command } from 'commands/@types';
import { PLAY_COMMAND } from './play';
import { PAUSE_COMMAND, RESUME_COMMAND, SKIP_COMMAND, STOP_COMMAND } from './playback';

export const MUSIC_COMMANDS: Command[] = [
  PLAY_COMMAND,
  STOP_COMMAND,
  SKIP_COMMAND,
  PAUSE_COMMAND,
  RESUME_COMMAND
];