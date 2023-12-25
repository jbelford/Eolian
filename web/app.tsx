import { Display, FluentProvider, Link, webLightTheme } from '@fluentui/react-components';
import { Flex } from '@fluentui/react-migration-v0-v9';

const GITHUB_PAGE = 'https://github.com/jbelford/Eolian';

export const App = () => (
  <FluentProvider theme={webLightTheme}>
    <Flex column gap='gap.large'>
      <Flex hAlign='center'>
        <Display>
          Eolian Bot
        </Display>
      </Flex>
      <Link href={GITHUB_PAGE}>
        Github Page
      </Link>
    </Flex>
  </FluentProvider>
);
