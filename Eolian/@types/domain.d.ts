
type EmbedMessage = {
  header?: {
    icon?: string;
    text: string;
  };
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: string;
  url?: string;
  image?: string;
  footer?: {
    icon?: string;
    text: string;
  };
  buttons?: MessageButton[];
};

type MessageButton = {
  emoji: string;
  /**
   * Return true if message is to be destroyed after.
   */
  onClick?: (message: ContextMessage, user: ContextUser) => Promise<boolean>;
}

interface PollOption extends MessageButton {
  text: string;
}

type PollOptionResult = {
  option: string;
  count: number;
}
