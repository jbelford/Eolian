type ChatUser = {
  id: string;
  permission: import('../src/common/constants').PERMISSION;
};

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
};
