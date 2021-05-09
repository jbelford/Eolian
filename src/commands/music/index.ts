import { Command } from 'commands/@types';
import { PLAY_COMMAND } from './play';
import { SKIP_COMMAND } from './skip';
import { STOP_COMMAND } from './stop';

export const MUSIC_COMMANDS: Command[] = [
  PLAY_COMMAND,
  STOP_COMMAND,
  SKIP_COMMAND
];