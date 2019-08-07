import { CommandCategory } from './@types';

export const ACCOUNT_CATEGORY: CommandCategory = {
  name: 'Account',
  details: 'This category contains commands for configuring third-party accounts and aliases'
};

export const GENERAL_CATEGORY: CommandCategory = {
  name: 'General',
  details: 'This category contains commands of varying utility'
};

export const MUSIC_CATEGORY: CommandCategory = {
  name: 'Music',
  details: 'This category contains commands for manipulating the player'
};

export const QUEUE_CATEGORY: CommandCategory = {
  name: 'Queue',
  details: 'This category contains commands for manipulating the queue'
};

export const COMMAND_CATEGORIES: CommandCategory[] = [
  GENERAL_CATEGORY,
  MUSIC_CATEGORY,
  QUEUE_CATEGORY,
  ACCOUNT_CATEGORY
];