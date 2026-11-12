export type PlatformId =
  | 'douyin'
  | 'tiktok'
  | 'xiaohongshu'
  | 'facebook'
  | 'x'
  | 'instagram'
  | 'bilibili'
  | 'youtube'
  | 'unknown';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  shortName: string;
  brandColor: string;
  gradient: string;
  domainKeywords: string[];
  placeholder: string;
  sampleUrl: string;
  sampleTitle: string;
  icon: string;
  supportsNoWatermark: boolean;
  maxQuality: string;
}

export type MediaQuality = '4k' | '1080p' | '720p' | '480p' | 'audio' | 'cover' | 'image';
export type MediaFormat = 'mp4' | 'mp3' | 'jpg' | 'png' | 'zip';

export interface VideoQualityOption {
  id: string;
  label: string;
  resolution?: string;
  quality: MediaQuality;
  format: MediaFormat;
  sizeFormatted: string;
  sizeBytes?: number;
  hasWatermark: boolean;
  url: string;
  directUrl?: string;
  bitrate?: string;
  fps?: number;
  isRecommended?: boolean;
}

export interface VideoItemMetadata {
  id: string;
  originalInput: string;
  cleanedUrl: string;
  platform: PlatformId;
  platformLabel: string;
  title: string;
  description?: string;
  author: {
    name: string;
    username: string;
    avatar?: string;
    verified?: boolean;
  };
  duration: number; // in seconds
  durationFormatted: string;
  thumbnail: string;
  stats?: {
    likes?: string | number;
    comments?: string | number;
    shares?: string | number;
    views?: string | number;
  };
  options: VideoQualityOption[];
  images?: string[]; // For slide shows
  previewStreamUrl: string;
  extractedAt: number;
}

export interface DownloadHistoryItem {
  id: string;
  metadata: VideoItemMetadata;
  selectedOptionId: string;
  downloadedAt: number;
  fileName: string;
}

export interface ExtractResponse {
  success: boolean;
  data?: VideoItemMetadata;
  error?: string;
  code?: string;
}
