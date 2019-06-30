type YouTubeUrlDetails = {
  type: YouTubeResourceType;
  id: string;
}


type YoutubePlaylist = {
  id: string;
  channelName: string;
  name: string;
  url: string;
  videos?: number;
}

declare const enum YouTubeResourceType {
  VIDEO = 0,
  PLAYLIST
}