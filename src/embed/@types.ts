import { MessageButton } from 'eolian/@types';

export interface PollOption extends MessageButton {
  text: string;
}

export interface PollOptionResult {
  option: string;
  count: number;
}