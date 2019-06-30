import { KEYWORDS } from "commands/keywords";
import { KeywordParsingStrategy } from "commands/parsing";
import { PERMISSION, SOURCE } from "common/constants";

describe('KeywordParsingStrategy', () => {

  describe('#messageInvokesBot', () => {

    test('Missing token fails', () => {
      expect(KeywordParsingStrategy.messageInvokesBot('test')).toBe(false);
    });

    test('Token present returns true', () => {
      expect(KeywordParsingStrategy.messageInvokesBot('!test')).toBe(true);
    });

  });

  describe('#parseParams', () => {

    test('Correctly parses simple keywords and removes from text', () => {
      const simpleKeywords = Object.values(KEYWORDS)
        .filter((keyword: Keyword) => !keyword.priority)
        .map((keyword: Keyword) => keyword.name);

      let mockMessage = '!' + simpleKeywords.join(' ');

      const [params, newText] = KeywordParsingStrategy.parseParams(mockMessage, PERMISSION.OWNER);

      simpleKeywords.forEach(keyword => expect(params[keyword]).toBe(true));
      expect(newText.trim()).toHaveLength(0);
    });

    test('Does not flag param if user missing permission', () => {
      const mockMessage = KEYWORDS.ENABLE.name;
      const [params, newText] = KeywordParsingStrategy.parseParams(mockMessage, PERMISSION.USER);

      expect(params.ENABLE).toBeFalsy();
      expect(newText).toHaveLength(mockMessage.length);
    });

    [
      {
        message: 'bottom 100 top 100',
        object: { start: 100, stop: null }
      },
      {
        message: 'bottom 100:200 top 100:200',
        object: { start: 100, stop: 200 }
      },
      {
        message: 'bottom 100:-200 top 100:-200',
        object: { start: 100, stop: -200 }
      }
    ].forEach(arg => {

      test(`Bottom and top keywords are parsed correctly: ${arg.message}`, () => {
        const [params, newText] = KeywordParsingStrategy.parseParams(arg.message, PERMISSION.USER);

        expect(params.TOP).toBeTruthy();
        expect(params.TOP.start).toBe(arg.object.start);
        expect(params.TOP.stop).toBe(arg.object.stop);

        expect(params.BOTTOM).toBeTruthy();
        expect(params.BOTTOM.start).toBe(arg.object.start);
        expect(params.BOTTOM.stop).toBe(arg.object.stop);

        expect(newText.trim()).toHaveLength(0);
      });

    });

    test('Query is parsed correctly', () => {
      const mockMessage = 'ajksdlfkaj ( this is a query ) jadlkfjak';
      const [params, newText] = KeywordParsingStrategy.parseParams(mockMessage, PERMISSION.USER);

      expect(params.QUERY).toBe('this is a query');
      expect(newText.includes('( this is a query )')).toBe(false);
    });


    test('Identifier is parsed correctly', () => {
      const mockMessage = 'dkjlsj [ my identifier] ksdljf';
      const [params, newText] = KeywordParsingStrategy.parseParams(mockMessage, PERMISSION.USER);

      expect(params.IDENTIFIER).toBe('my identifier');
      expect(newText.includes('[ my identifier]')).toBe(false);
    });

    [
      {
        type: 'SoundCloud url',
        message: 'https://soundcloud.com/moodygood/slum-village-in-love-moody',
        source: SOURCE.SOUNDCLOUD
      },
      {
        type: 'YouTube url',
        message: 'https://www.youtube.com/watch?v=98M6OlzDxkc',
        source: SOURCE.YOUTUBE
      },
      {
        type: 'Spotify url',
        message: 'https://open.spotify.com/user/223s63jeyr4myd4svixalybaa/playlist/79ILVxEFXKGkQHIYPvu3OC?si=yzGO9c5ZT-qDiUA6Wap49A',
        source: SOURCE.SPOTIFY
      },
      {
        type: 'Spotify uri',
        message: 'spotify:user:223s63jeyr4myd4svixalybaa:playlist:79ILVxEFXKGkQHIYPvu3OC',
        source: SOURCE.SPOTIFY
      },
      {
        type: 'Unknown uri',
        message: 'https://www.google.com',
        source: SOURCE.UNKNOWN
      }
    ].forEach(arg => {

      test(`${arg.type} is parsed correctly`, () => {
        const [params, newText] = KeywordParsingStrategy.parseParams(arg.message, PERMISSION.USER);

        expect(params.URL).toBeTruthy();
        expect(params.URL.value).toBe(arg.message);
        expect(params.URL.source).toBe(arg.source);
      });

    });

    test('Args are parsed correctly', () => {
      const args = ['arg1', 'arg2', ' arg2 ', '  j dkslfjlka klajfdlka ; kdslajf;alk;j fkljdsa; fasjkfaskjsfdlkajf '];
      const message = '/' + args.join('/') + '/';

      const [params, newText] = KeywordParsingStrategy.parseParams(message, PERMISSION.USER);

      expect(params.ARG).toBeTruthy();
      args.forEach((arg, i) => expect(params.ARG[i]).toBe(arg.trim()));
      expect(newText.trim()).toHaveLength(0);
    });

  });

});