type ChatUser = {
  id: string;
};

type EmbedMessage = {
  header: {
    icon?: string;
    text: string;
  };
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: string;
  image?: string;
  footer?: {
    icon?: string;
    text: string;
  };
};
