type YouTubeUrlDetails = {
  type: import('api/youtube').YouTubeResourceType
  id: string;
}

type YoutubePlaylist = {
  id: string;
  channelName: string;
  name: string;
  url: string;
  videos?: number;
}
