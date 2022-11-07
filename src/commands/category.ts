import { UserPermission } from '@eolian/common/constants';
import { CommandCategory } from './@types';

export const ACCOUNT_CATEGORY: CommandCategory = {
  name: 'Account',
  details: 'This category contains commands for configuring third-party accounts and aliases',
  permission: UserPermission.User,
};

export const GENERAL_CATEGORY: CommandCategory = {
  name: 'General',
  details: 'This category contains commands of varying utility',
  permission: UserPermission.User,
};

export const MUSIC_CATEGORY: CommandCategory = {
  name: 'Music',
  details: 'This category contains commands for manipulating the player',
  permission: UserPermission.User,
};

export const QUEUE_CATEGORY: CommandCategory = {
  name: 'Queue',
  details: 'This category contains commands for manipulating the queue',
  permission: UserPermission.User,
};

export const SETTINGS_CATEGORY: CommandCategory = {
  name: 'Settings',
  details: 'This category contains commands for configuring the bot for your server',
  permission: UserPermission.Admin,
};

export const COMMAND_CATEGORIES: CommandCategory[] = [
  GENERAL_CATEGORY,
  MUSIC_CATEGORY,
  QUEUE_CATEGORY,
  ACCOUNT_CATEGORY,
  SETTINGS_CATEGORY,
];
