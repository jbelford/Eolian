import { CommandOptions, SyntaxType } from '@eolian/command-options/@types';
import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { syntaxTypeToName } from '@eolian/embed';
import { Command, CommandArgs, CommandContext } from '../@types';
import { ACCOUNT_CATEGORY } from '../category';
import { SimpleExample } from '../simple-argument-example';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (!options.ARG?.length) {
    const user = await context.interaction.user.get();
    if (user.syntax !== undefined) {
      await context.interaction.send(
        `Your syntax preference is currently: \`${syntaxTypeToName(user.syntax)}\``,
      );
    } else {
      await context.interaction.send(`Your syntax preference is currently: \`Server Default\``);
    }
    return;
  }

  const syntax = options.ARG[0];
  let type: SyntaxType | null;
  switch (syntax.toLowerCase()) {
    case 'keyword':
      type = SyntaxType.KEYWORD;
      break;
    case 'traditional':
      type = SyntaxType.TRADITIONAL;
      break;
    case 'clear':
      type = null;
      break;
    default:
      throw new EolianUserError(
        `Unrecognized syntax type! Available types are 'keyword' or 'traditional'.`,
      );
  }

  await context.interaction.user.setSyntax(type);
  const syntaxName = type !== null ? syntaxTypeToName(type) : 'Server Default';
  await context.interaction.send(`✨ Your syntax preference is now \`${syntaxName}\`!`);
}

const args: CommandArgs = {
  base: true,
  groups: [
    {
      required: false,
      options: [
        {
          name: 'type',
          details: 'The syntax setting',
          getChoices: () => ['keyword', 'traditional', 'clear'],
        },
      ],
    },
  ],
};

export const SYNTAX_COMMAND: Command = {
  name: 'syntax',
  shortName: 'stx',
  details: 'Show or change personalized syntax preference',
  category: ACCOUNT_CATEGORY,
  permission: UserPermission.User,
  new: true,
  usage: [
    {
      title: 'Show syntax config',
      example: '',
    },
    {
      title: 'Set syntax to keyword',
      example: SimpleExample.create(args, 'keyword'),
    },
    {
      title: 'Set syntax to traditional',
      example: SimpleExample.create(args, 'traditional'),
    },
    {
      title: 'Reset syntax config to server default',
      example: SimpleExample.create(args, 'clear'),
    },
  ],
  args,
  execute,
};
