import { COLOR } from 'common/constants';
import { EmbedMessage } from 'eolian/@types';
import { PollOption, PollOptionResult } from './@types';

export function createPollQuestionEmbed(question: string, options: PollOption[], username: string, pic?: string): EmbedMessage {
  return {
    header: {
      text: '📣 Poll 📣'
    },
    title: `*${question}*`,
    color: COLOR.POLL,
    description: options.map(option => `${option.emoji}  ${option.text}`).join('\n\n'),
    footer: {
      text: `${username}'s poll`,
      icon: pic
    }
  };
}

export function createPollResultsEmbed(question: string, results: PollOptionResult[], username: string, pic?: string): EmbedMessage {
  const description = results.sort((a, b) => b.count - a.count)
    .map(result => `**${result.option}**: ${result.count} Votes`);
  description[0] += ' ✅';

  return {
    header: {
      text: '📣 Poll Results 📣'
    },
    title: `*${question}*`,
    color: COLOR.POLL,
    description: description.join('\n'),
    footer: {
      text: `${username}'s poll`,
      icon: pic
    }
  };
}
