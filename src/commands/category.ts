import { PERMISSION } from 'common/constants';
import { CommandCategory } from './@types';

export const ACCOUNT_CATEGORY: CommandCategory = {
  name: 'Account',
  details: 'This category contains commands for configuring third-party accounts and aliases',
  permission: PERMISSION.USER
};

export const GENERAL_CATEGORY: CommandCategory = {
  name: 'General',
  details: 'This category contains commands of varying utility',
  permission: PERMISSION.USER
};

export const MUSIC_CATEGORY: CommandCategory = {
  name: 'Music',
  details: 'This category contains commands for manipulating the player',
  permission: PERMISSION.USER
};

export const QUEUE_CATEGORY: CommandCategory = {
  name: 'Queue',
  details: 'This category contains commands for manipulating the queue',
  permission: PERMISSION.USER
};

export const SETTINGS_CATEGORY: CommandCategory = {
  name: 'Settings',
  details: 'This category contains commands for configuring the bot for your server',
  permission: PERMISSION.ADMIN
}

export const COMMAND_CATEGORIES: CommandCategory[] = [
  GENERAL_CATEGORY,
  MUSIC_CATEGORY,
  QUEUE_CATEGORY,
  ACCOUNT_CATEGORY,
  SETTINGS_CATEGORY
];