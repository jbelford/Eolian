import { Color } from '@eolian/common/constants';
import { EmbedMessage } from '@eolian/framework/@types';
import { PollOption } from './@types';

export function createPollQuestionEmbed(
  question: string,
  options: PollOption[],
  username: string,
  pic?: string,
): EmbedMessage {
  return {
    header: {
      text: '📣 Poll 📣',
    },
    title: `*${question}*`,
    color: Color.Poll,
    description: options
      .map(option => `${option.emoji}  **${option.text}**:  ${option.count} Votes`)
      .join('\n\n'),
    footer: {
      text: `${username}'s poll`,
      icon: pic,
    },
  };
}

export function createPollResultsEmbed(
  question: string,
  options: PollOption[],
  username: string,
  pic?: string,
): EmbedMessage {
  const description = options
    .sort((a, b) => b.count - a.count)
    .map(option => `**${option.text}**: ${option.count} Votes`);
  description[0] += ' ✅';

  return {
    header: {
      text: '📣 Poll Results 📣',
    },
    title: `*${question}*`,
    color: Color.Poll,
    description: description.join('\n'),
    footer: {
      text: `${username}'s poll`,
      icon: pic,
    },
  };
}
