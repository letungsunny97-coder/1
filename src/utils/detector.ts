import type { PlatformConfig, PlatformId } from '../types/downloader.ts';

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  douyin: {
    id: 'douyin',
    name: 'Douyin (抖音)',
    shortName: 'Douyin',
    brandColor: '#161823',
    gradient: 'from-rose-500 to-pink-600',
    domainKeywords: ['douyin.com', 'iesdouyin.com'],
    placeholder: 'Dán liên kết Douyin (ví dụ: https://v.douyin.com/... hoặc văn bản chia sẻ)...',
    sampleUrl: 'https://v.douyin.com/ikq8axJ/',
    sampleTitle: 'Douyin Hot Trend - Không Logo 1080p 60fps',
    icon: 'Music2',
    supportsNoWatermark: true,
    maxQuality: '4K / 1080p 60fps',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    shortName: 'TikTok',
    brandColor: '#000000',
    gradient: 'from-cyan-400 via-pink-500 to-rose-500',
    domainKeywords: ['tiktok.com'],
    placeholder: 'Dán link TikTok (ví dụ: https://www.tiktok.com/@user/video/... hoặc vt.tiktok.com)...',
    sampleUrl: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
    sampleTitle: 'TikTok Frog Video HD - Watermark Free',
    icon: 'Video',
    supportsNoWatermark: true,
    maxQuality: '1080p Full HD',
  },
  xiaohongshu: {
    id: 'xiaohongshu',
    name: 'Xiaohongshu (小红书 - Tiểu Hồng Thư)',
    shortName: 'Tiểu Hồng Thư',
    brandColor: '#FF2442',
    gradient: 'from-rose-500 via-red-500 to-pink-600',
    domainKeywords: ['xiaohongshu.com', 'xhslink.com', 'rednote'],
    placeholder: 'Dán link Tiểu Hồng Thư (ví dụ: http://xhslink.com/... hoặc xiaohongshu.com)...',
    sampleUrl: 'https://www.xiaohongshu.com/discovery/item/6a658b6c000000000a03adcf?xsec_token=ABUgG3KfS3vZg1s5gjDbRERicZMJi7OQtHzHxvwd6N7yE=',
    sampleTitle: 'Tiểu Hồng Thư - Video & Ảnh HD Không Logo',
    icon: 'BookOpen',
    supportsNoWatermark: true,
    maxQuality: '4K / 1080p / Ảnh Gốc',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook Video & Reels',
    shortName: 'Facebook',
    brandColor: '#1877F2',
    gradient: 'from-blue-600 to-indigo-600',
    domainKeywords: ['facebook.com', 'fb.watch', 'fb.com', 'fb.gg'],
    placeholder: 'Dán link Facebook Watch, Reel hoặc bài đăng video...',
    sampleUrl: 'https://www.facebook.com/watch/?v=1393572814172251',
    sampleTitle: 'Facebook Reel - Bản gốc HD sắc nét',
    icon: 'Facebook',
    supportsNoWatermark: true,
    maxQuality: '1080p Full HD / HD',
  },
  x: {
    id: 'x',
    name: 'X (Twitter)',
    shortName: 'X (Twitter)',
    brandColor: '#000000',
    gradient: 'from-slate-700 via-zinc-800 to-black',
    domainKeywords: ['x.com', 'twitter.com', 't.co'],
    placeholder: 'Dán link X / Twitter (ví dụ: https://x.com/username/status/...)...',
    sampleUrl: 'https://x.com/ThuanCapital/status/2119962956666736869',
    sampleTitle: 'X (Twitter) Video HD Không Logo',
    icon: 'Twitter',
    supportsNoWatermark: true,
    maxQuality: '1080p / 720p',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram Reels & Video',
    shortName: 'Instagram',
    brandColor: '#E1306C',
    gradient: 'from-amber-500 via-rose-500 to-purple-600',
    domainKeywords: ['instagram.com', 'instagr.am'],
    placeholder: 'Dán link Instagram Reels, Post hoặc IGTV...',
    sampleUrl: 'https://www.instagram.com/reel/DKPtUL_S9Nh/?igsh=MTE1dTVkb2E4NTFmcw==',
    sampleTitle: 'Instagram Reel HD - Không Logo',
    icon: 'Instagram',
    supportsNoWatermark: true,
    maxQuality: '1080p HD',
  },
  bilibili: {
    id: 'bilibili',
    name: 'Bilibili (哔哩哔哩)',
    shortName: 'Bilibili',
    brandColor: '#00A1D6',
    gradient: 'from-sky-400 to-blue-500',
    domainKeywords: ['bilibili.com', 'b23.tv', 'bili2233.cn'],
    placeholder: 'Dán link Bilibili (ví dụ: https://www.bilibili.com/video/BV... hoặc b23.tv/...)...',
    sampleUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
    sampleTitle: 'Bilibili Anime Highlight - Full HD 60fps',
    icon: 'Tv',
    supportsNoWatermark: true,
    maxQuality: '4K / 1080p 60fps',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube (Shorts & Video)',
    shortName: 'YouTube',
    brandColor: '#FF0000',
    gradient: 'from-red-600 via-rose-600 to-red-700',
    domainKeywords: ['youtube.com', 'youtu.be', 'm.youtube.com'],
    placeholder: 'Dán liên kết YouTube Video hoặc YouTube Shorts...',
    sampleUrl: 'https://www.youtube.com/watch?v=Qw5eFJzQ-ts&list=RDSwuiiBKXVfc&index=13',
    sampleTitle: 'Gặp Em Đúng Lúc Remix - MP4 1080p & MP3',
    icon: 'Youtube',
    supportsNoWatermark: true,
    maxQuality: '1080p / 720p HD & MP3',
  },
  unknown: {
    id: 'unknown',
    name: 'Đa Nền Tảng',
    shortName: 'Unknown',
    brandColor: '#6366F1',
    gradient: 'from-indigo-500 to-purple-600',
    domainKeywords: [],
    placeholder: 'Dán liên kết video bất kỳ...',
    sampleUrl: '',
    sampleTitle: '',
    icon: 'HelpCircle',
    supportsNoWatermark: true,
    maxQuality: 'Tối đa chất lượng gốc',
  },
};

/**
 * Extracts a valid HTTP/HTTPS URL from potentially messy user input.
 * Especially handles mobile app share texts containing Chinese/Vietnamese/English intro and the link.
 */
export function extractCleanUrl(rawInput: string): string {
  if (!rawInput) return '';

  let trimmed = rawInput.trim();
  // Strip surrounding quotes: single quotes, double quotes, backticks, smart quotes
  trimmed = trimmed.replace(/^['"“‘`]+/, '').replace(/['"”’`]+$/, '').trim();

  // Look for http:// or https:// URL pattern inside the text (stops cleanly before CJK/Vietnamese share text)
  const urlRegex = /(https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+)/i;
  const match = trimmed.match(urlRegex);

  if (match && match[1]) {
    // Clean trailing punctuation and quotes often attached from copy-paste like , hoặc ) hoặc ' "
    return match[1].replace(/[.,);!?'"]+$/, '').trim();
  }

  // If user pasted without protocol, e.g. "www.tiktok.com/@..." or "www.facebook.com/share/v/..." or "youtu.be/..."
  const bareDomainRegex = /((?:www\.)?[a-zA-Z0-9-]+\.(?:com|tv|cn|watch|co|net|gg|link|be)\/[^\s'"<>]+)/i;
  const bareMatch = trimmed.match(bareDomainRegex);
  if (bareMatch && bareMatch[1]) {
    const cleanBare = bareMatch[1].replace(/[。，,、)）;；!！?？'"'”’]+$/, '').trim();
    return `https://${cleanBare}`;
  }

  return trimmed;
}

/**
 * Detects which platform a URL belongs to.
 */
export function detectPlatform(urlOrText: string): PlatformId {
  const url = extractCleanUrl(urlOrText).toLowerCase();
  if (!url) return 'unknown';

  if (
    url.includes('youtube.com') ||
    url.includes('youtu.be')
  ) {
    return 'youtube';
  }

  if (url.includes('douyin.com') || url.includes('iesdouyin.com')) {
    return 'douyin';
  }

  if (url.includes('tiktok.com')) {
    return 'tiktok';
  }

  if (
    url.includes('xiaohongshu.com') ||
    url.includes('xhslink.com') ||
    url.includes('rednote')
  ) {
    return 'xiaohongshu';
  }

  if (
    url.includes('facebook.com') ||
    url.includes('fb.watch') ||
    url.includes('fb.com') ||
    url.includes('fb.gg')
  ) {
    return 'facebook';
  }

  if (url.includes('twitter.com') || url.includes('x.com') || url.includes('t.co')) {
    return 'x';
  }

  if (url.includes('instagram.com') || url.includes('instagr.am')) {
    return 'instagram';
  }

  if (
    url.includes('bilibili.com') ||
    url.includes('b23.tv') ||
    url.includes('bili2233.cn')
  ) {
    return 'bilibili';
  }

  return 'unknown';
}

/**
 * Extracts platform-specific resource ID (useful for API lookup or display)
 */
export function extractResourceId(url: string, platform: PlatformId): string | null {
  const clean = extractCleanUrl(url);

  switch (platform) {
    case 'youtube': {
      // https://www.youtube.com/watch?v=dQw4w9WgXcQ
      // https://youtu.be/dQw4w9WgXcQ
      // https://www.youtube.com/shorts/dQw4w9WgXcQ
      // https://www.youtube.com/embed/dQw4w9WgXcQ
      const vMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
      if (vMatch) return vMatch[1];
      const beMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
      if (beMatch) return beMatch[1];
      const shortsMatch = clean.match(/\/shorts\/([a-zA-Z0-9_-]{11})/i);
      if (shortsMatch) return shortsMatch[1];
      const liveMatch = clean.match(/\/live\/([a-zA-Z0-9_-]{11})/i);
      if (liveMatch) return liveMatch[1];
      const embedMatch = clean.match(/\/embed\/([a-zA-Z0-9_-]{11})/i);
      return embedMatch ? embedMatch[1] : null;
    }
    case 'tiktok': {
      const match = clean.match(/\/video\/(\d+)/i) || clean.match(/\/v\/(\d+)/i);
      return match ? match[1] : null;
    }
    case 'douyin': {
      const match = clean.match(/\/video\/(\d+)/i) || clean.match(/\/note\/(\d+)/i);
      return match ? match[1] : null;
    }
    case 'xiaohongshu': {
      const match =
        clean.match(/\/explore\/([a-zA-Z0-9_-]+)/i) ||
        clean.match(/\/discovery\/item\/([a-zA-Z0-9_-]+)/i) ||
        clean.match(/xhslink\.com\/(?:a|o|m)?\/?([a-zA-Z0-9_-]+)/i);
      return match ? match[1] : null;
    }
    case 'x': {
      const match = clean.match(/status\/(\d+)/i);
      return match ? match[1] : null;
    }
    case 'instagram': {
      const match =
        clean.match(/\/reel\/([a-zA-Z0-9_-]+)/i) ||
        clean.match(/\/p\/([a-zA-Z0-9_-]+)/i) ||
        clean.match(/\/tv\/([a-zA-Z0-9_-]+)/i);
      return match ? match[1] : null;
    }
    case 'bilibili': {
      const match = clean.match(/(BV[a-zA-Z0-9]+)/i) || clean.match(/av(\d+)/i);
      return match ? match[1] : null;
    }
    case 'facebook': {
      const match =
        clean.match(/\/videos\/(\d+)/i) ||
        clean.match(/\/reel\/([a-zA-Z0-9_-]+)/i) ||
        clean.match(/\/share\/[vr]\/([a-zA-Z0-9_-]+)/i) ||
        clean.match(/\/watch\/?\?v=(\d+)/i) ||
        clean.match(/[?&]v=(\d+)/i);
      return match ? match[1] : null;
    }
    default:
      return null;
  }
}

/**
 * Format bytes into readable MB/GB string
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return 'Tự động';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format seconds into mm:ss or hh:mm:ss
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '00:00';
  const sec = Math.floor(seconds);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const remSec = sec % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
}

/**
 * Format view/like numbers into compact strings (e.g. 1.2M, 450K)
 */
export function formatStatNumber(num: number | string | undefined): string {
  if (num === undefined || num === null) return '0';
  const n = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num;
  if (isNaN(n)) return String(num);

  if (n >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString('vi-VN');
}
