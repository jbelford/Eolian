import { QueueCategory } from "commands/command";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from 'common/constants';

const info: CommandInfo = {
  name: 'add',
  details: 'Add songs to the queue',
  category: QueueCategory,
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.MY, KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE, KEYWORDS.PLAYLIST, KEYWORDS.ALBUM, KEYWORDS.ARTIST,
    KEYWORDS.NEXT, KEYWORDS.SHUFFLE, KEYWORDS.FAVORITES, KEYWORDS.TRACKS, KEYWORDS.TOP, KEYWORDS.BOTTOM,
    KEYWORDS.URL, KEYWORDS.QUERY, KEYWORDS.IDENTIFIER,
  ],
  usage: [
    `(what is love) next`,
    'soundcloud favorites shuffled',
    'https://www.youtube.com/watch?v=HEXWRTEbj1I',
    `playlist [retro]`,
    `spotify playlist (awesome music playlist) shuffle next`,
    `artist (deadmau5) top 10`,
    `tracks`,
    `album (the life of pablo)`
  ],
};

class AddAction implements CommandAction {

  info = info;

  constructor(private readonly services: CommandActionServices) {}

  public execute(context: CommandActionContext, params: CommandActionParams): Promise<any> {
    throw new Error("Method not implemented.");
  }

}

export const AddCommand: Command = {
  info,
  action: AddAction
};
