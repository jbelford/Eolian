import { KeywordParsingStrategy } from "commands/parsing";

describe('KeywordParsingStrategy', () => {

  describe('#messageInvokesBot', () => {

    test('Missing token fails', () => {
      expect(KeywordParsingStrategy.messageInvokesBot('test')).toBe(false);
    });

  });

});