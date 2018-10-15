
type Track = {
  id: string;
  title: string;
  poster: string;
  url: string;
  stream: string;
  artwork?: string;
  src: import('common/constants').SOURCE;
};