import { KeywordParsingStrategy } from "commands/parsing";

describe('KeywordParsingStrategy', () => {

  const parser = new KeywordParsingStrategy();

  describe('#messageInvokesBot', () => {

    test('Missing token fails', () => {
      expect(parser.messageInvokesBot('test')).toBe(false);
    });

    test('Token present returns true', () => {
      expect(parser.messageInvokesBot('!test')).toBe(true);
    });

  });

  // describe('#parseParams', () => {

  //   test('Correctly parses simple keywords and removes from text', () => {
  //     const simpleKeywords = Object.values(KEYWORDS)
  //       .filter(keyword => !keyword!.priority)
  //       .map(keyword => keyword!.name);

  //     const mockMessage = '!' + simpleKeywords.join(' ');

  //     const [params, newText] = parser.parseParams(mockMessage, PERMISSION.OWNER);

  //     simpleKeywords.forEach(keyword => expect(params[keyword]).toBe(true));
  //     expect(newText.trim()).toHaveLength(0);
  //   });

  //   test('Does not flag param if user missing permission', () => {
  //     const mockMessage = KEYWORDS.ENABLE.name;
  //     const [params, newText] = parser.parseParams(mockMessage, PERMISSION.USER);

  //     expect(params.ENABLE).toBeFalsy();
  //     expect(newText).toHaveLength(mockMessage.length);
  //   });

  //   [
  //     {
  //       name: 'bottom 100 top 100',
  //       args: { start: 100, stop: undefined }
  //     },
  //     {
  //       name: 'bottom 100:200 top 100:200',
  //       args: { start: 100, stop: 200 }
  //     },
  //     {
  //       name: 'bottom 100:-200 top 100:-200',
  //       args: { start: 100, stop: -200 }
  //     }
  //   ].forEach(({ name, args }) => {

  //     const { start, stop } = args;

  //     test(`Bottom and top keywords are parsed correctly: ${name}`, () => {
  //       const [params, newText] = parser.parseParams(name, PERMISSION.USER);

  //       expect(params.TOP).toBeTruthy();
  //       expect(params.TOP!.start).toBe(start);
  //       expect(params.TOP!.stop).toBe(stop);

  //       expect(params.BOTTOM).toBeTruthy();
  //       expect(params.BOTTOM!.start).toBe(start);
  //       expect(params.BOTTOM!.stop).toBe(stop);

  //       expect(newText.trim()).toHaveLength(0);
  //     });

  //   });

  //   test('Query is parsed correctly', () => {
  //     const mockMessage = 'ajksdlfkaj ( this is a query ) jadlkfjak';
  //     const [params, newText] = parser.parseParams(mockMessage, PERMISSION.USER);

  //     expect(params.QUERY).toBe('this is a query');
  //     expect(newText.includes('( this is a query )')).toBe(false);
  //   });


  //   test('Identifier is parsed correctly', () => {
  //     const mockMessage = 'dkjlsj [ my identifier] ksdljf';
  //     const [params, newText] = parser.parseParams(mockMessage, PERMISSION.USER);

  //     expect(params.IDENTIFIER).toBe('my identifier');
  //     expect(newText.includes('[ my identifier]')).toBe(false);
  //   });

  //   [
  //     {
  //       type: 'SoundCloud url',
  //       message: 'https://soundcloud.com/moodygood/slum-village-in-love-moody',
  //       source: SOURCE.SOUNDCLOUD
  //     },
  //     {
  //       type: 'YouTube url',
  //       message: 'https://www.youtube.com/watch?v=98M6OlzDxkc',
  //       source: SOURCE.YOUTUBE
  //     },
  //     {
  //       type: 'Spotify url',
  //       message: 'https://open.spotify.com/user/223s63jeyr4myd4svixalybaa/playlist/79ILVxEFXKGkQHIYPvu3OC?si=yzGO9c5ZT-qDiUA6Wap49A',
  //       source: SOURCE.SPOTIFY
  //     },
  //     {
  //       type: 'Spotify uri',
  //       message: 'spotify:user:223s63jeyr4myd4svixalybaa:playlist:79ILVxEFXKGkQHIYPvu3OC',
  //       source: SOURCE.SPOTIFY
  //     },
  //     {
  //       type: 'Unknown uri',
  //       message: 'https://www.google.com',
  //       source: SOURCE.UNKNOWN
  //     }
  //   ].forEach(({ type, message, source }) => {

  //     test(`${type} is parsed correctly`, () => {
  //       const [params, newText] = parser.parseParams(message, PERMISSION.USER);

  //       expect(params.URL).toBeTruthy();
  //       expect(params.URL!.value).toBe(message);
  //       expect(params.URL!.source).toBe(source);
  //     });

  //   });

  //   test('Args are parsed correctly', () => {
  //     const args = ['arg1', 'arg2', ' arg2 ', '  j dkslfjlka klajfdlka ; kdslajf;alk;j fkljdsa; fasjkfaskjsfdlkajf '];
  //     const message = '/' + args.join('/') + '/';

  //     const [params, newText] = parser.parseParams(message, PERMISSION.USER);

  //     expect(params.ARG).toBeTruthy();
  //     args.forEach((arg, i) => expect(params.ARG![i]).toBe(arg.trim()));
  //     expect(newText.trim()).toHaveLength(0);
  //   });

  // });

});