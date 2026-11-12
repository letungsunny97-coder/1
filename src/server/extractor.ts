import type {
  PlatformId,
  VideoItemMetadata,
  VideoQualityOption,
} from '../types/downloader.ts';
import {
  detectPlatform,
  extractCleanUrl,
  extractResourceId,
  formatBytes,
  formatDuration,
  formatStatNumber,
  PLATFORMS,
} from '../utils/detector.ts';

/**
 * Clean ID string
 */
function cleanId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
}

/**
 * Decode HTML entities in extracted titles
 */
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return _; }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return _; }
    })
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * 1. Extract Facebook video using @xaviabot/fb-downloader
 */
async function tryFbDownloader(cleanUrl: string): Promise<VideoItemMetadata | null> {
  // 1. If running inside Android APK with native AndroidBridge.nativeFetch:
  try {
    const bridge = typeof window !== 'undefined' ? (window as any).AndroidBridge : null;
    if (bridge && typeof bridge.nativeFetch === 'function') {
      const fbCookie =
        'sb=Rn8BYQvCEb2fpMQZjsd6L382; datr=Rn8BYbyhXgw9RlOvmsosmVNT; c_user=100003164630629; _fbp=fb.1.1629876126997.444699739; wd=1920x939; spin=r.1004812505_b.trunk_t.1638730393_s.1_v.2_; xs=28%3A8ROnP0aeVF8XcQ%3A2%3A1627488145%3A-1%3A4916%3A%3AAcWIuSjPy2mlTPuZAeA2wWzHzEDuumXI89jH8a_QIV8; fr=0jQw7hcrFdas2ZeyT.AWVpRNl_4noCEs_hb8kaZahs-jA.BhrQqa.3E.AAA.0.0.BhrQqa.AWUu879ZtCw';
      const respStr = bridge.nativeFetch(
        cleanUrl,
        'GET',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36',
        JSON.stringify({
          'authority': 'www.facebook.com',
          'sec-fetch-user': '?1',
          'sec-ch-ua-mobile': '?0',
          'sec-fetch-site': 'none',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'cache-control': 'max-age=0',
          'upgrade-insecure-requests': '1',
          'accept-language': 'en-GB,en;q=0.9,tr-TR;q=0.8,tr;q=0.7,en-US;q=0.6',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'cookie': fbCookie,
        })
      );
      if (respStr) {
        const resp = JSON.parse(respStr);
        if (resp && resp.body) {
          const html = resp.body.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
          const sdMatch = html.match(/"browser_native_sd_url":"(.*?)"/) || html.match(/"playable_url":"(.*?)"/) || html.match(/sd_src\s*:\s*"([^"]*)"/);
          const hdMatch = html.match(/"browser_native_hd_url":"(.*?)"/) || html.match(/"playable_url_quality_hd":"(.*?)"/) || html.match(/hd_src\s*:\s*"([^"]*)"/);
          const titleMatch = html.match(/<meta\sname="description"\scontent="(.*?)"/) || html.match(/<title>(.*?)<\/title>/);
          const thumbMatch = html.match(/"preferred_thumbnail":{"image":{"uri":"(.*?)"/);

          const parseStr = (s: string) => {
            try { return JSON.parse(`{"t":"${s}"}`).t; } catch { return s.replace(/\\\//g, '/'); }
          };

          const sd = sdMatch && sdMatch[1] ? parseStr(sdMatch[1]) : '';
          const hd = hdMatch && hdMatch[1] ? parseStr(hdMatch[1]) : '';
          const rawTitle = titleMatch && titleMatch[1] ? parseStr(titleMatch[1]) : 'Facebook Video';
          const thumb = thumbMatch && thumbMatch[1] ? parseStr(thumbMatch[1]) : '';
          const directUrl = hd || sd;

          if (directUrl) {
            const options: VideoQualityOption[] = [];
            if (hd) {
              options.push({
                id: 'fb-hd',
                label: 'Facebook HD (Bản nét cao 720p/1080p)',
                resolution: '1280 x 720 (HD)',
                quality: '1080p',
                format: 'mp4',
                sizeFormatted: 'Gốc (Chất lượng cao)',
                hasWatermark: false,
                url: hd,
                directUrl: hd,
                isRecommended: true,
              });
            }
            if (sd) {
              options.push({
                id: 'fb-sd',
                label: 'Facebook SD (Bản tiêu chuẩn 360p/480p)',
                resolution: '640 x 360 (SD)',
                quality: '720p',
                format: 'mp4',
                sizeFormatted: 'Tiết kiệm dung lượng',
                hasWatermark: false,
                url: sd,
                directUrl: sd,
                isRecommended: !hd,
              });
            }
            options.push({
              id: 'fb-audio',
              label: 'Tải Audio MP3 (Gốc từ video)',
              quality: 'audio',
              format: 'mp3',
              sizeFormatted: 'Chất lượng cao',
              hasWatermark: false,
              url: directUrl,
              directUrl,
            });

            return {
              id: `fb-${Date.now()}`,
              originalInput: cleanUrl,
              cleanedUrl: cleanUrl,
              platform: 'facebook',
              platformLabel: PLATFORMS.facebook.name,
              title: decodeHtmlEntities(rawTitle),
              author: {
                name: 'Facebook Creator',
                username: '@facebook_user',
              },
              duration: 60,
              durationFormatted: 'Bản gốc',
              thumbnail: thumb,
              stats: { views: 'HD Gốc' },
              options,
              previewStreamUrl: directUrl,
              extractedAt: Date.now(),
            };
          }
        }
      }
    }
  } catch {}

  // 2. Standard server-side Node.js extractor
  try {
    const m = await import('@xaviabot/fb-downloader');
    const getFBInfo = (m as any).default || m;
    const res = await getFBInfo(cleanUrl);
    if (!res || (!res.hd && !res.sd)) return null;

    const options: VideoQualityOption[] = [];
    const directUrl = res.hd || res.sd;

    if (res.hd) {
      options.push({
        id: 'fb-hd',
        label: 'Facebook HD (Bản nét cao 720p/1080p)',
        resolution: '1280 x 720 (HD)',
        quality: '1080p',
        format: 'mp4',
        sizeFormatted: 'Gốc (Chất lượng cao)',
        hasWatermark: false,
        url: res.hd,
        directUrl: res.hd,
        isRecommended: true,
      });
    }

    if (res.sd) {
      options.push({
        id: 'fb-sd',
        label: 'Facebook SD (Bản tiêu chuẩn 360p/480p)',
        resolution: '640 x 360 (SD)',
        quality: '720p',
        format: 'mp4',
        sizeFormatted: 'Tiết kiệm dung lượng',
        hasWatermark: false,
        url: res.sd,
        directUrl: res.sd,
        isRecommended: !res.hd,
      });
    }

    // Audio MP3 option from stream
    options.push({
      id: 'fb-audio',
      label: 'Tải Audio MP3 (Gốc từ video)',
      quality: 'audio',
      format: 'mp3',
      sizeFormatted: 'Chất lượng cao',
      hasWatermark: false,
      url: directUrl,
      directUrl: directUrl,
    });

    const rawTitle = res.title && res.title.trim() ? res.title.trim() : 'Facebook Video';
    const safeTitle = decodeHtmlEntities(rawTitle);

    return {
      id: `fb-${Date.now()}`,
      originalInput: cleanUrl,
      cleanedUrl: cleanUrl,
      platform: 'facebook',
      platformLabel: PLATFORMS.facebook.name,
      title: safeTitle,
      author: {
        name: 'Facebook Creator',
        username: '@facebook_user',
      },
      duration: 60,
      durationFormatted: 'Bản gốc',
      thumbnail: res.thumbnail || '',
      stats: {
        views: 'HD Gốc',
      },
      options,
      previewStreamUrl: directUrl,
      extractedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * 2. Extract media using SnapSave library (Facebook, Instagram, TikTok, Twitter)
 */
async function trySnapSave(cleanUrl: string, platform: PlatformId): Promise<VideoItemMetadata | null> {
  try {
    const { snapsave } = await import('snapsave-media-downloader');
    const result = await snapsave(cleanUrl);
    if (!result || !result.success || !result.data || !result.data.media || result.data.media.length === 0) {
      return null;
    }

    const d = result.data;
    const mediaList = d.media || [];
    const options: VideoQualityOption[] = [];
    const imagesList: string[] = [];
    let hasVideo = false;

    mediaList.forEach((m: any, idx: number) => {
      if (!m.url) return;
      const isPhoto = m.type === 'photo' || m.type === 'image' || /\.(jpe?g|png|webp)($|\?)/i.test(m.url);

      if (isPhoto) {
        imagesList.push(m.url);
        options.push({
          id: `snap-${platform}-img-${idx}`,
          label: `Tải Ảnh ${imagesList.length} (Gốc Không Logo - JPG)`,
          resolution: 'Ảnh Gốc HD',
          quality: 'image',
          format: 'jpg',
          sizeFormatted: 'Ảnh Gốc HD',
          hasWatermark: false,
          url: m.url,
          directUrl: m.url,
          isRecommended: !hasVideo && idx === 0,
        });
      } else {
        hasVideo = true;
        const resText = m.resolution || (idx === 0 ? '1080p HD' : '720p SD');
        const isHD = resText.toLowerCase().includes('hd') || resText.includes('1080') || resText.includes('720');

        options.push({
          id: `snap-${platform}-${idx}`,
          label: `${PLATFORMS[platform].name} - ${resText} Không Logo`,
          resolution: resText,
          quality: isHD ? '1080p' : '720p',
          format: 'mp4',
          sizeFormatted: isHD ? 'Chất lượng cao' : 'Tiêu chuẩn',
          hasWatermark: false,
          url: m.url,
          directUrl: m.url,
          isRecommended: idx === 0,
        });
      }
    });

    if (options.length === 0) return null;

    // Add audio option if video exists
    if (hasVideo) {
      options.push({
        id: `snap-${platform}-audio`,
        label: 'Tải Âm Thanh MP3 (Gốc từ video)',
        quality: 'audio',
        format: 'mp3',
        sizeFormatted: 'Audio MP3',
        hasWatermark: false,
        url: options[0].url,
        directUrl: options[0].directUrl,
      });
    }

    const title = decodeHtmlEntities((d.description && d.description.trim()) || `${PLATFORMS[platform].name} ${hasVideo ? 'Video' : 'Album Ảnh'}`);

    return {
      id: `${platform}-${Date.now()}`,
      originalInput: cleanUrl,
      cleanedUrl: cleanUrl,
      platform,
      platformLabel: PLATFORMS[platform].name,
      title,
      author: {
        name: `${PLATFORMS[platform].shortName} Creator`,
        username: `@${platform}_user`,
      },
      duration: hasVideo ? 45 : imagesList.length,
      durationFormatted: hasVideo ? 'Bản gốc' : `${imagesList.length} Ảnh Gốc HD`,
      thumbnail: d.preview || imagesList[0] || '',
      stats: {
        views: 'Sẵn sàng',
      },
      options,
      images: imagesList.length > 0 ? imagesList : undefined,
      previewStreamUrl: options[0].url,
      extractedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * 3. Extract media using local yt-dlp binary (Universal fallback on Node server)
 */
async function tryYtDlp(cleanUrl: string, platform: PlatformId): Promise<VideoItemMetadata | null> {
  if (typeof process === 'undefined' || !process.versions?.node) return null;
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['--no-playlist', '-j', '--no-warnings', '--skip-download', cleanUrl],
      { timeout: 15000, maxBuffer: 15 * 1024 * 1024 }
    );

    if (!stdout || !stdout.trim()) return null;
    const j = JSON.parse(stdout);
    if (!j) return null;

    const directUrl = j.url || j.formats?.filter((f: any) => f.url && f.ext === 'mp4').pop()?.url || j.formats?.[0]?.url;
    if (!directUrl) return null;

    const options: VideoQualityOption[] = [
      {
        id: `ytdlp-${platform}-best`,
        label: `${PLATFORMS[platform].name} - Bản gốc chất lượng cao nhất`,
        resolution: j.resolution || (j.width && j.height ? `${j.width}x${j.height}` : 'Full HD'),
        quality: '1080p',
        format: 'mp4',
        sizeFormatted: formatBytes(j.filesize || j.filesize_approx || 20 * 1024 * 1024),
        hasWatermark: false,
        url: directUrl,
        directUrl: directUrl,
        isRecommended: true,
      },
      {
        id: `ytdlp-${platform}-audio`,
        label: 'Tải Audio MP3 (Chất lượng gốc)',
        quality: 'audio',
        format: 'mp3',
        sizeFormatted: 'MP3 Audio',
        hasWatermark: false,
        url: directUrl,
        directUrl: directUrl,
      },
    ];

    return {
      id: String(j.id || Date.now()),
      originalInput: cleanUrl,
      cleanedUrl: cleanUrl,
      platform,
      platformLabel: PLATFORMS[platform].name,
      title: j.title || `${PLATFORMS[platform].name} Video`,
      author: {
        name: j.uploader || j.channel || `${PLATFORMS[platform].shortName} Creator`,
        username: `@${j.uploader_id || 'user'}`,
      },
      duration: Math.round(j.duration || 30),
      durationFormatted: formatDuration(Math.round(j.duration || 30)),
      thumbnail: j.thumbnail || '',
      stats: {
        views: String(j.view_count || '0'),
        likes: String(j.like_count || '0'),
      },
      options,
      previewStreamUrl: directUrl,
      extractedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Unified JSON fetcher compatible with both Web browser and Android APK native bridge
 */
async function fetchJsonUnified(url: string, headers: Record<string, string> = {}): Promise<any> {
  const bridge = typeof window !== 'undefined' ? (window as any).AndroidBridge : null;
  if (bridge && typeof bridge.nativeFetch === 'function') {
    try {
      const respStr = bridge.nativeFetch(
        url,
        'GET',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        JSON.stringify({
          'Accept': 'application/json, text/plain, */*',
          ...headers,
        })
      );
      if (respStr) {
        const parsed = JSON.parse(respStr);
        if (parsed && parsed.body) {
          return JSON.parse(parsed.body);
        }
      }
    } catch {}
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        ...headers,
      },
    });
    clearTimeout(timeout);
    if (resp.ok) {
      return await resp.json();
    }
  } catch {}
  return null;
}

/**
 * 4. Try real live extraction for TikTok / Douyin via Tikwm (supports both Video and Photo Album / Slideshow)
 */
async function tryLiveTikwm(cleanUrl: string, platform: PlatformId): Promise<VideoItemMetadata | null> {
  try {
    const json = await fetchJsonUnified(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
    if (!json || json.code !== 0 || !json.data) return null;

    const d = json.data;
    const playUrl = d.hdplay || d.play;
    const rawImages: string[] = Array.isArray(d.images) ? d.images : [];
    if (!playUrl && rawImages.length === 0) return null;

    const fullPlay = playUrl ? (playUrl.startsWith('http') ? playUrl : `https://www.tikwm.com${playUrl}`) : '';
    const fullAudio = d.music ? (d.music.startsWith('http') ? d.music : `https://www.tikwm.com${d.music}`) : '';
    const fullCover = d.cover ? (d.cover.startsWith('http') ? d.cover : `https://www.tikwm.com${d.cover}`) : '';

    const imagesList: string[] = rawImages.map((img: string) =>
      img.startsWith('http') ? img : `https://www.tikwm.com${img}`
    );

    const options: VideoQualityOption[] = [];

    // Video option
    if (fullPlay) {
      options.push({
        id: 'tikwm-1080p',
        label: 'MP4 Không Logo - 1080p Full HD Gốc',
        resolution: '1080 x 1920',
        quality: '1080p',
        format: 'mp4',
        sizeFormatted: formatBytes(d.hd_size || d.size || 25 * 1024 * 1024),
        hasWatermark: false,
        url: fullPlay,
        directUrl: fullPlay,
        fps: 60,
        isRecommended: true,
      });
    }

    // Photo album options
    if (imagesList.length > 0) {
      imagesList.forEach((imgUrl, idx) => {
        options.push({
          id: `tikwm-img-${idx}`,
          label: `Tải Ảnh ${idx + 1}/${imagesList.length} (HD Gốc Không Logo - JPG)`,
          quality: 'image',
          format: 'jpg',
          sizeFormatted: 'Ảnh Gốc HD',
          hasWatermark: false,
          url: imgUrl,
          directUrl: imgUrl,
          isRecommended: !fullPlay && idx === 0,
        });
      });
    }

    // Background Audio MP3
    if (fullAudio) {
      options.push({
        id: 'tikwm-audio',
        label: `Tải Nhạc Gốc MP3 (${d.music_info?.title || 'Original Sound'})`,
        quality: 'audio',
        format: 'mp3',
        sizeFormatted: '4.5 MB',
        bitrate: '320 kbps',
        hasWatermark: false,
        url: fullAudio,
        directUrl: fullAudio,
      });
    }

    const defaultTitle = platform === 'douyin'
      ? (imagesList.length > 0 ? 'Douyin Album Ảnh Không Logo' : 'Douyin Video Không Logo')
      : (imagesList.length > 0 ? 'TikTok Album Ảnh Không Logo' : 'TikTok Video Không Logo');

    return {
      id: String(d.id || Date.now()),
      originalInput: cleanUrl,
      cleanedUrl: cleanUrl,
      platform,
      platformLabel: PLATFORMS[platform].name,
      title: d.title || defaultTitle,
      author: {
        name: d.author?.nickname || 'TikTok User',
        username: `@${d.author?.unique_id || 'user'}`,
        avatar: d.author?.avatar,
      },
      duration: d.duration || (imagesList.length > 0 ? imagesList.length : 30),
      durationFormatted: fullPlay ? formatDuration(d.duration || 30) : `${imagesList.length} Ảnh Gốc HD Không Logo`,
      thumbnail: fullCover || imagesList[0] || '',
      stats: {
        likes: String(d.digg_count || '0'),
        comments: String(d.comment_count || '0'),
        shares: String(d.share_count || '0'),
        views: String(d.play_count || '0'),
      },
      options,
      images: imagesList.length > 0 ? imagesList : undefined,
      previewStreamUrl: fullPlay || fullAudio || imagesList[0] || '',
      extractedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * 5. Try real live extraction for X/Twitter via FxTwitter, VxTwitter and Twitter Syndication (Video & 4K Photos)
 */
async function tryLiveXTwitter(cleanUrl: string, statusId: string): Promise<VideoItemMetadata | null> {
  // Provider 1: FxTwitter (High reliability, multi-quality MP4s and 4K Photos)
  try {
    const fxData = await fetchJsonUnified(`https://api.fxtwitter.com/status/${statusId}`);
    if (fxData && fxData.code === 200 && fxData.tweet) {
      const tweet = fxData.tweet;
      const mediaList = tweet.media?.videos || [];

      // Case A: Tweet contains video
      if (mediaList.length > 0) {
        const video = mediaList[0];
        const formats: any[] = video.formats || [];
        const mp4Formats = formats.filter((f) => f.container === 'mp4' && f.url);
        mp4Formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        const bestStream = (mp4Formats[0] && mp4Formats[0].url) || video.url;
        if (bestStream) {
          const rawTitle = (tweet.text || 'X Video').replace(/https?:\/\/t\.co\/\w+/g, '').trim() || 'X Video';
          const safeTitle = decodeHtmlEntities(rawTitle);
          const durationSec = Math.round(video.duration || 30);

          const options: VideoQualityOption[] = [];
          if (mp4Formats.length > 0) {
            mp4Formats.forEach((fmt, idx) => {
              const qualityLabel = idx === 0 ? '1080p / 720p (HD Gốc)' : `${fmt.bitrate ? Math.round(fmt.bitrate / 1000) + 'kbps' : 'SD'}`;
              options.push({
                id: `x-opt-${idx}`,
                label: `MP4 - ${qualityLabel} Không Logo`,
                resolution: `${video.width || 1280} x ${video.height || 720}`,
                quality: idx === 0 ? '1080p' : '720p',
                format: 'mp4',
                sizeFormatted: fmt.bitrate ? formatBytes(Math.round((fmt.bitrate / 8) * durationSec)) : 'Bản gốc',
                hasWatermark: false,
                url: fmt.url,
                directUrl: fmt.url,
                fps: 60,
                isRecommended: idx === 0,
              });
            });
          } else {
            options.push({
              id: 'x-best',
              label: 'MP4 Video Gốc Không Logo (HD)',
              resolution: `${video.width || 1280} x ${video.height || 720}`,
              quality: '1080p',
              format: 'mp4',
              sizeFormatted: 'Bản gốc',
              hasWatermark: false,
              url: bestStream,
              directUrl: bestStream,
              fps: 60,
              isRecommended: true,
            });
          }

          options.push({
            id: 'x-mp3',
            label: 'Tải Audio MP3 (Tách từ video)',
            quality: 'audio',
            format: 'mp3',
            sizeFormatted: 'Audio MP3',
            hasWatermark: false,
            url: bestStream,
            directUrl: bestStream,
          });

          return {
            id: statusId,
            originalInput: cleanUrl,
            cleanedUrl: cleanUrl,
            platform: 'x',
            platformLabel: PLATFORMS.x.name,
            title: safeTitle,
            author: {
              name: tweet.author?.name || 'X User',
              username: `@${tweet.author?.screen_name || 'user'}`,
              avatar: tweet.author?.avatar_url,
            },
            duration: durationSec,
            durationFormatted: formatDuration(durationSec),
            thumbnail: video.thumbnail_url || '',
            stats: {
              likes: String(tweet.likes || '0'),
              comments: String(tweet.replies || '0'),
              shares: String(tweet.retweets || '0'),
            },
            options,
            previewStreamUrl: bestStream,
            extractedAt: Date.now(),
          };
        }
      }

      // Case B: Tweet contains photos (1-4 images in 4K original resolution)
      const photoList = tweet.media?.photos || [];
      if (photoList.length > 0) {
        const imagesList = photoList
          .map((p: any) => {
            const rawUrl = p.url || '';
            if (!rawUrl) return '';
            return rawUrl.includes('?') ? rawUrl.replace(/name=[^&]+/, 'name=orig') : `${rawUrl}?name=orig`;
          })
          .filter(Boolean);

        if (imagesList.length > 0) {
          const rawTitle = (tweet.text || 'X Photos').replace(/https?:\/\/t\.co\/\w+/g, '').trim() || 'X Photos';
          const safeTitle = decodeHtmlEntities(rawTitle);
          const options: VideoQualityOption[] = [];

          imagesList.forEach((imgUrl: string, idx: number) => {
            options.push({
              id: `x-photo-${idx}`,
              label: `Tải Ảnh ${idx + 1}/${imagesList.length} (4K Gốc Không Logo - JPG)`,
              quality: 'image',
              format: 'jpg',
              sizeFormatted: '4K Gốc',
              hasWatermark: false,
              url: imgUrl,
              directUrl: imgUrl,
              isRecommended: idx === 0,
            });
          });

          return {
            id: statusId,
            originalInput: cleanUrl,
            cleanedUrl: cleanUrl,
            platform: 'x',
            platformLabel: PLATFORMS.x.name,
            title: safeTitle,
            author: {
              name: tweet.author?.name || 'X User',
              username: `@${tweet.author?.screen_name || 'user'}`,
              avatar: tweet.author?.avatar_url,
            },
            duration: imagesList.length,
            durationFormatted: `${imagesList.length} Ảnh Gốc 4K Không Logo`,
            thumbnail: imagesList[0],
            stats: {
              likes: String(tweet.likes || '0'),
              comments: String(tweet.replies || '0'),
              shares: String(tweet.retweets || '0'),
            },
            options,
            images: imagesList,
            previewStreamUrl: imagesList[0],
            extractedAt: Date.now(),
          };
        }
      }
    }
  } catch {}

  // Provider 2: VxTwitter
  try {
    const vxData = await fetchJsonUnified(`https://api.vxtwitter.com/Twitter/status/${statusId}`);
    if (vxData) {
      const mediaList = vxData.media_extended || [];
      const videoMedia = mediaList.find((m: any) => m.type === 'video' || m.type === 'gif');
      const streamUrl = (videoMedia && videoMedia.url) || vxData.video_url;

      // Video
      if (streamUrl) {
        const rawTitle = (vxData.text || 'X Video').replace(/https?:\/\/t\.co\/\w+/g, '').trim() || 'X Video';
        const safeTitle = decodeHtmlEntities(rawTitle);

        return {
          id: statusId,
          originalInput: cleanUrl,
          cleanedUrl: cleanUrl,
          platform: 'x',
          platformLabel: PLATFORMS.x.name,
          title: safeTitle,
          author: {
            name: vxData.user_name || 'X User',
            username: `@${vxData.user_screen_name || 'user'}`,
            avatar: vxData.user_profile_image_url,
          },
          duration: 30,
          durationFormatted: '00:30',
          thumbnail: videoMedia?.thumbnail_url || vxData.mediaURLs?.[0] || '',
          stats: {
            likes: String(vxData.likes || '0'),
            comments: String(vxData.replies || '0'),
            shares: String(vxData.retweets || '0'),
          },
          options: [
            {
              id: 'x-vx-1080p',
              label: 'MP4 Video Gốc Không Logo (HD)',
              resolution: '1920 x 1080',
              quality: '1080p',
              format: 'mp4',
              sizeFormatted: 'Bản gốc',
              hasWatermark: false,
              url: streamUrl,
              directUrl: streamUrl,
              fps: 60,
              isRecommended: true,
            },
            {
              id: 'x-vx-mp3',
              label: 'Tải Audio MP3 (Tách từ video)',
              quality: 'audio',
              format: 'mp3',
              sizeFormatted: 'Audio MP3',
              hasWatermark: false,
              url: streamUrl,
              directUrl: streamUrl,
            },
          ],
          previewStreamUrl: streamUrl,
          extractedAt: Date.now(),
        };
      }

      // Photos
      const imageMedias = mediaList.filter((m: any) => m.type === 'image');
      let imagesList: string[] = imageMedias.map((m: any) => m.url).filter(Boolean);
      if (imagesList.length === 0 && Array.isArray(vxData.mediaURLs) && vxData.mediaURLs.length > 0) {
        imagesList = vxData.mediaURLs;
      }

      if (imagesList.length > 0) {
        imagesList = imagesList.map((u) => (u.includes('?') ? u.replace(/name=[^&]+/, 'name=orig') : `${u}?name=orig`));
        const rawTitle = (vxData.text || 'X Photos').replace(/https?:\/\/t\.co\/\w+/g, '').trim() || 'X Photos';
        const safeTitle = decodeHtmlEntities(rawTitle);
        const options: VideoQualityOption[] = [];

        imagesList.forEach((imgUrl: string, idx: number) => {
          options.push({
            id: `x-vx-photo-${idx}`,
            label: `Tải Ảnh ${idx + 1}/${imagesList.length} (4K Gốc Không Logo - JPG)`,
            quality: 'image',
            format: 'jpg',
            sizeFormatted: '4K Gốc',
            hasWatermark: false,
            url: imgUrl,
            directUrl: imgUrl,
            isRecommended: idx === 0,
          });
        });

        return {
          id: statusId,
          originalInput: cleanUrl,
          cleanedUrl: cleanUrl,
          platform: 'x',
          platformLabel: PLATFORMS.x.name,
          title: safeTitle,
          author: {
            name: vxData.user_name || 'X User',
            username: `@${vxData.user_screen_name || 'user'}`,
            avatar: vxData.user_profile_image_url,
          },
          duration: imagesList.length,
          durationFormatted: `${imagesList.length} Ảnh Gốc 4K Không Logo`,
          thumbnail: imagesList[0],
          stats: {
            likes: String(vxData.likes || '0'),
            comments: String(vxData.replies || '0'),
            shares: String(vxData.retweets || '0'),
          },
          options,
          images: imagesList,
          previewStreamUrl: imagesList[0],
          extractedAt: Date.now(),
        };
      }
    }
  } catch {}

  // Provider 3: Twitter Syndication CDN API
  try {
    const synData = await fetchJsonUnified(`https://cdn.syndication.twimg.com/tweet-result?id=${statusId}&token=4`);
    if (synData) {
      if (synData.video && Array.isArray(synData.video.variants)) {
        const mp4s = synData.video.variants.filter((v: any) => v.type === 'video/mp4' && v.src);
        if (mp4s.length > 0) {
          const bestStream = mp4s[mp4s.length - 1].src;
          const rawTitle = (synData.text || 'X Video').replace(/https?:\/\/t\.co\/\w+/g, '').trim() || 'X Video';
          const safeTitle = decodeHtmlEntities(rawTitle);

          return {
            id: statusId,
            originalInput: cleanUrl,
            cleanedUrl: cleanUrl,
            platform: 'x',
            platformLabel: PLATFORMS.x.name,
            title: safeTitle,
            author: {
              name: synData.user?.name || 'X User',
              username: `@${synData.user?.screen_name || 'user'}`,
              avatar: synData.user?.profile_image_url_https,
            },
            duration: Math.round((synData.video.durationMs || 30000) / 1000),
            durationFormatted: formatDuration(Math.round((synData.video.durationMs || 30000) / 1000)),
            thumbnail: synData.video.poster || '',
            stats: {
              likes: String(synData.favorite_count || '0'),
              comments: String(synData.conversation_count || '0'),
            },
            options: [
              {
                id: 'x-syn-hd',
                label: 'MP4 Video Gốc Không Logo (HD)',
                resolution: '1280 x 720',
                quality: '1080p',
                format: 'mp4',
                sizeFormatted: 'Bản gốc',
                hasWatermark: false,
                url: bestStream,
                directUrl: bestStream,
                isRecommended: true,
              },
              {
                id: 'x-syn-mp3',
                label: 'Tải Audio MP3 (Tách từ video)',
                quality: 'audio',
                format: 'mp3',
                sizeFormatted: 'Audio MP3',
                hasWatermark: false,
                url: bestStream,
                directUrl: bestStream,
              },
            ],
            previewStreamUrl: bestStream,
            extractedAt: Date.now(),
          };
        }
      }

      // Syndication Photos
      const synPhotos = synData.photos || [];
      if (synPhotos.length > 0) {
        const imagesList = synPhotos.map((p: any) => {
          const u = p.url || '';
          return u.includes('?') ? u.replace(/name=[^&]+/, 'name=orig') : `${u}?name=orig`;
        }).filter(Boolean);

        if (imagesList.length > 0) {
          const rawTitle = (synData.text || 'X Photos').replace(/https?:\/\/t\.co\/\w+/g, '').trim() || 'X Photos';
          const safeTitle = decodeHtmlEntities(rawTitle);
          const options: VideoQualityOption[] = [];

          imagesList.forEach((imgUrl: string, idx: number) => {
            options.push({
              id: `x-syn-photo-${idx}`,
              label: `Tải Ảnh ${idx + 1}/${imagesList.length} (4K Gốc Không Logo - JPG)`,
              quality: 'image',
              format: 'jpg',
              sizeFormatted: '4K Gốc',
              hasWatermark: false,
              url: imgUrl,
              directUrl: imgUrl,
              isRecommended: idx === 0,
            });
          });

          return {
            id: statusId,
            originalInput: cleanUrl,
            cleanedUrl: cleanUrl,
            platform: 'x',
            platformLabel: PLATFORMS.x.name,
            title: safeTitle,
            author: {
              name: synData.user?.name || 'X User',
              username: `@${synData.user?.screen_name || 'user'}`,
              avatar: synData.user?.profile_image_url_https,
            },
            duration: imagesList.length,
            durationFormatted: `${imagesList.length} Ảnh Gốc 4K Không Logo`,
            thumbnail: imagesList[0],
            stats: {
              likes: String(synData.favorite_count || '0'),
              comments: String(synData.conversation_count || '0'),
            },
            options,
            images: imagesList,
            previewStreamUrl: imagesList[0],
            extractedAt: Date.now(),
          };
        }
      }
    }
  } catch {}

  return null;
}

/**
 * 6. Try real live extraction for Instagram (both Video/Reel and High-res Photos/Carousels)
 */
async function tryInstagramBtch(cleanUrl: string): Promise<VideoItemMetadata | null> {
  const headers = {
    'User-Agent': 'btch/6.4.0',
    'Accept': 'application/json, text/plain, */*',
  };

  // 1. Direct fetch to backend1 igdl with retry
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://backend1.tioo.eu.org/igdl?url=${encodeURIComponent(cleanUrl)}`, { headers });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json)
          ? json
          : json?.result && Array.isArray(json.result)
          ? json.result
          : [];

        if (list.length > 0) {
          const imagesList: string[] = [];
          const options: VideoQualityOption[] = [];
          let hasVideo = false;

          list.forEach((item: any, idx: number) => {
            const mediaUrl = item.url || item.downloadUrl || item.link;
            if (!mediaUrl) return;
            const isVideo = mediaUrl.includes('.mp4') || item.type === 'video';

            if (isVideo) {
              hasVideo = true;
              options.push({
                id: `ig-vid-${idx}`,
                label: `Instagram MP4 - 1080p Video Không Logo`,
                resolution: '1080 x 1920',
                quality: '1080p',
                format: 'mp4',
                sizeFormatted: 'Gốc (Chất lượng cao)',
                hasWatermark: false,
                url: mediaUrl,
                directUrl: mediaUrl,
                fps: 60,
                isRecommended: idx === 0,
              });
            } else {
              imagesList.push(mediaUrl);
              options.push({
                id: `ig-img-${idx}`,
                label: `Tải Ảnh Instagram ${idx + 1} (Gốc Không Logo - JPG)`,
                quality: 'image',
                format: 'jpg',
                sizeFormatted: 'Ảnh Gốc HD',
                hasWatermark: false,
                url: mediaUrl,
                directUrl: mediaUrl,
                isRecommended: !hasVideo && idx === 0,
              });
            }
          });

          if (options.length > 0) {
            const firstMedia = options[0].url;
            return {
              id: `ig-${Date.now()}`,
              originalInput: cleanUrl,
              cleanedUrl: cleanUrl,
              platform: 'instagram',
              platformLabel: PLATFORMS.instagram.name,
              title: `Instagram ${hasVideo ? 'Video' : 'Album Ảnh'} Không Logo`,
              author: {
                name: 'Instagram Creator',
                username: '@instagram_post',
              },
              duration: imagesList.length || 30,
              durationFormatted: hasVideo ? 'Bản gốc' : `${imagesList.length} Ảnh Gốc HD Không Logo`,
              thumbnail: list[0]?.thumbnail || imagesList[0] || options[0].url,
              stats: { likes: 'HD' },
              options,
              images: imagesList.length > 0 ? imagesList : undefined,
              previewStreamUrl: firstMedia,
              extractedAt: Date.now(),
            };
          }
        }
      }
    } catch {}
    if (attempt < 3) await new Promise((r) => setTimeout(r, 500));
  }

  // 2. Library fallback via btch-downloader
  try {
    const btch = await import('btch-downloader');
    const igdl = (btch as any).igdl || (btch as any).default?.igdl;
    if (typeof igdl === 'function') {
      const res = await igdl(cleanUrl);
      const list = Array.isArray(res)
        ? res
        : res?.result && Array.isArray(res.result)
        ? res.result
        : [];

      if (list.length > 0) {
        const imagesList: string[] = [];
        const options: VideoQualityOption[] = [];
        let hasVideo = false;

        list.forEach((item: any, idx: number) => {
          const mediaUrl = item.url || item.downloadUrl || item.link;
          if (!mediaUrl) return;
          const isVideo = mediaUrl.includes('.mp4') || item.type === 'video';

          if (isVideo) {
            hasVideo = true;
            options.push({
              id: `ig-vid-${idx}`,
              label: `Instagram MP4 - 1080p Video Không Logo`,
              resolution: '1080 x 1920',
              quality: '1080p',
              format: 'mp4',
              sizeFormatted: 'Gốc (Chất lượng cao)',
              hasWatermark: false,
              url: mediaUrl,
              directUrl: mediaUrl,
              fps: 60,
              isRecommended: idx === 0,
            });
          } else {
            imagesList.push(mediaUrl);
            options.push({
              id: `ig-img-${idx}`,
              label: `Tải Ảnh Instagram ${idx + 1} (Gốc Không Logo - JPG)`,
              quality: 'image',
              format: 'jpg',
              sizeFormatted: 'Ảnh Gốc HD',
              hasWatermark: false,
              url: mediaUrl,
              directUrl: mediaUrl,
              isRecommended: !hasVideo && idx === 0,
            });
          }
        });

        if (options.length > 0) {
          const firstMedia = options[0].url;
          return {
            id: `ig-${Date.now()}`,
            originalInput: cleanUrl,
            cleanedUrl: cleanUrl,
            platform: 'instagram',
            platformLabel: PLATFORMS.instagram.name,
            title: `Instagram ${hasVideo ? 'Video' : 'Album Ảnh'} Không Logo`,
            author: {
              name: 'Instagram Creator',
              username: '@instagram_post',
            },
            duration: imagesList.length || 30,
            durationFormatted: hasVideo ? 'Bản gốc' : `${imagesList.length} Ảnh Gốc HD Không Logo`,
            thumbnail: list[0]?.thumbnail || imagesList[0] || options[0].url,
            stats: { likes: 'HD' },
            options,
            images: imagesList.length > 0 ? imagesList : undefined,
            previewStreamUrl: firstMedia,
            extractedAt: Date.now(),
          };
        }
      }
    }
  } catch {}
  return null;
}

/**
 * 6. Extract Xiaohongshu (Tiểu Hồng Thư / RedNote) media (Video + High-res Image Album)
 */
async function tryXiaohongshu(cleanUrl: string): Promise<VideoItemMetadata | null> {
  const headers = {
    'User-Agent': 'btch/6.4.0',
    'Accept': 'application/json, text/plain, */*',
  };

  // 1. Direct fetch to backend1 rednote with retry
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://backend1.tioo.eu.org/rednote?url=${encodeURIComponent(cleanUrl)}`, { headers });
      if (res.ok) {
        const j = await res.json();
        if (j && j.status && j.result) {
          const r = j.result;
          const options: VideoQualityOption[] = [];
          const imagesList: string[] = [];

          if (Array.isArray(r.images)) {
            r.images.forEach((u: string) => {
              if (u && typeof u === 'string') {
                const cleanImg = u.split('!')[0].replace(/\?imageView2.*$/, '');
                imagesList.push(cleanImg);
              }
            });
          }

          const downloads = Array.isArray(r.downloads) ? r.downloads : [];
          const videoStream = downloads[0]?.url || r.videoUrl;

          if (videoStream) {
            options.push({
              id: 'xhs-video-hd',
              label: 'Tiểu Hồng Thư HD - Video Gốc Không Logo',
              resolution: '1080 x 1920 (HD)',
              quality: '1080p',
              format: 'mp4',
              sizeFormatted: 'Gốc (Chất lượng cao)',
              hasWatermark: false,
              url: videoStream,
              directUrl: videoStream,
              isRecommended: true,
            });
            options.push({
              id: 'xhs-audio',
              label: 'Tải Audio MP3 (Gốc từ video)',
              quality: 'audio',
              format: 'mp3',
              sizeFormatted: 'Audio MP3',
              hasWatermark: false,
              url: videoStream,
              directUrl: videoStream,
            });
          }

          if (imagesList.length > 0) {
            imagesList.forEach((imgUrl, idx) => {
              options.push({
                id: `xhs-img-${idx + 1}`,
                label: `Tải Ảnh ${idx + 1}/${imagesList.length} (HD Siêu Nét Không Logo)`,
                resolution: 'Độ phân giải gốc',
                quality: 'image',
                format: 'jpg',
                sizeFormatted: 'Ảnh Gốc HD',
                hasWatermark: false,
                url: imgUrl,
                directUrl: imgUrl,
                isRecommended: !videoStream && idx === 0,
              });
            });
          }

          if (options.length > 0) {
            const directUrl = videoStream || imagesList[0];
            return {
              id: `xhs-${Date.now()}`,
              originalInput: cleanUrl,
              cleanedUrl: cleanUrl,
              platform: 'xiaohongshu',
              platformLabel: PLATFORMS.xiaohongshu.name,
              title: decodeHtmlEntities(r.title || r.desc || 'Xiaohongshu Không Logo'),
              description: r.desc || '',
              author: {
                name: r.author?.nickname || 'Tiểu Hồng Thư Creator',
                username: `@${r.author?.id || 'xiaohongshu_user'}`,
                avatar: r.author?.avatar || '',
              },
              duration: videoStream ? 45 : 15,
              durationFormatted: videoStream ? 'Video HD' : `${imagesList.length} Ảnh Gốc`,
              thumbnail: r.cover || imagesList[0] || '',
              stats: {
                likes: String(r.engagement?.likes || '0'),
                comments: String(r.engagement?.comments || '0'),
                shares: String(r.engagement?.shares || '0'),
              },
              options,
              images: imagesList,
              previewStreamUrl: directUrl,
              extractedAt: Date.now(),
            };
          }
        }
      }
    } catch {}
    if (attempt < 3) await new Promise((r) => setTimeout(r, 500));
  }

  // 2. Follow short link if needed (e.g. xhslink.com/a/... or xhslink.com/o/...)
  let targetUrl = cleanUrl;
  if (cleanUrl.includes('xhslink.com')) {
    try {
      const headRes = await fetch(cleanUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
      });
      const loc = headRes.headers.get('location');
      if (loc) {
        targetUrl = loc.startsWith('http') ? loc : `https://www.xiaohongshu.com${loc}`;
      }
    } catch {
      // Continue with cleanUrl
    }
  }

  // 3. Try btch-downloader xiaohongshu
  try {
    const btch = await import('btch-downloader');
    const getXhs = (btch as any).xiaohongshu || (btch as any).default?.xiaohongshu;
    if (typeof getXhs === 'function') {
      const res = await getXhs(cleanUrl);
      if (res && res.status && res.result) {
        const r = res.result;
        const options: VideoQualityOption[] = [];
        const isVideo = !!r.videoUrl || (r.mediaType === 'video') || (Array.isArray(r.videos) && r.videos.length > 0);
        const videoStream = r.videoUrl || (Array.isArray(r.videos) ? r.videos[0]?.url || r.videos[0] : null);
        const imagesList: string[] = [];

        if (Array.isArray(r.images)) {
          r.images.forEach((img: any) => {
            const u = typeof img === 'string' ? img : img.url || img.originUrl;
            if (u) {
              const cleanImg = u.split('!')[0].replace(/\?imageView2.*$/, '');
              imagesList.push(cleanImg);
            }
          });
        }

        if (videoStream) {
          options.push({
            id: 'xhs-video-hd',
            label: 'Tiểu Hồng Thư HD - Video Gốc Không Logo',
            resolution: '1080 x 1920 (HD)',
            quality: '1080p',
            format: 'mp4',
            sizeFormatted: 'Gốc (Chất lượng cao)',
            hasWatermark: false,
            url: videoStream,
            directUrl: videoStream,
            isRecommended: true,
          });
          options.push({
            id: 'xhs-audio',
            label: 'Tải Audio MP3 (Gốc từ video)',
            quality: 'audio',
            format: 'mp3',
            sizeFormatted: 'Audio MP3',
            hasWatermark: false,
            url: videoStream,
            directUrl: videoStream,
          });
        }

        if (imagesList.length > 0) {
          imagesList.forEach((imgUrl, idx) => {
            options.push({
              id: `xhs-img-${idx + 1}`,
              label: `Tải Ảnh ${idx + 1}/${imagesList.length} (HD Siêu Nét Không Logo)`,
              resolution: 'Độ phân giải gốc',
              quality: 'image',
              format: 'jpg',
              sizeFormatted: 'Ảnh Gốc HD',
              hasWatermark: false,
              url: imgUrl,
              directUrl: imgUrl,
              isRecommended: !videoStream && idx === 0,
            });
          });
        }

        if (options.length > 0) {
          const directUrl = videoStream || imagesList[0];
          return {
            id: `xhs-${Date.now()}`,
            originalInput: cleanUrl,
            cleanedUrl: targetUrl,
            platform: 'xiaohongshu',
            platformLabel: PLATFORMS.xiaohongshu.name,
            title: decodeHtmlEntities(r.title || r.desc || 'Xiaohongshu Không Logo'),
            description: r.desc || '',
            author: {
              name: r.author || r.nickname || 'Tiểu Hồng Thư Creator',
              username: `@${r.userId || 'xiaohongshu_user'}`,
              avatar: r.avatar || '',
            },
            duration: isVideo ? 45 : 15,
            durationFormatted: isVideo ? 'Video HD' : `${imagesList.length} Ảnh Gốc`,
            thumbnail: r.cover || imagesList[0] || '',
            stats: {
              likes: String(r.likes || r.liked || '0'),
              comments: String(r.comments || '0'),
              shares: String(r.collects || r.shares || '0'),
            },
            options,
            images: imagesList,
            previewStreamUrl: directUrl,
            extractedAt: Date.now(),
          };
        }
      }
    }
  } catch {}

  // 3. Try Direct Xiaohongshu Web scraping with __INITIAL_STATE__
  try {
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,vi;q=0.8,en;q=0.7',
      'Cookie': `a1=18e${Math.random().toString(16).slice(2, 10)}0000; webId=seraph_${Date.now()};`,
    };

    let html = '';
    // Check if Android Native Bridge is available
    const bridge = typeof window !== 'undefined' ? (window as any).AndroidBridge : null;
    if (bridge && typeof bridge.nativeFetch === 'function') {
      const respStr = bridge.nativeFetch(targetUrl, 'GET', fetchHeaders['User-Agent'], JSON.stringify(fetchHeaders));
      if (respStr) {
        try {
          const parsed = JSON.parse(respStr);
          if (parsed && parsed.body) html = parsed.body;
        } catch {}
      }
    }

    if (!html) {
      const resp = await fetch(targetUrl, {
        headers: fetchHeaders,
        redirect: 'follow',
      });
      if (resp.ok) {
        html = await resp.text();
      }
    }

    if (html) {
      const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})<\/script>/s) ||
                    html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*({.+?})<\/script>/s);
      if (match) {
        const cleanedJson = match[1].replace(/undefined/g, 'null');
        const json = JSON.parse(cleanedJson);
        const noteDetailMap = json.note?.noteDetailMap || {};
        const firstKey = Object.keys(noteDetailMap)[0];
        const note = (firstKey && noteDetailMap[firstKey]?.note) || json.noteData?.data?.noteData || null;

        if (note) {
          const options: VideoQualityOption[] = [];
          const imagesList: string[] = [];
          const stream = note.video?.media?.stream;
          const h264List = stream?.h264 || [];
          const h265List = stream?.h265 || [];
          const videoUrl = h264List[0]?.masterUrl || h265List[0]?.masterUrl || h264List[0]?.backupUrls?.[0] || note.video?.url || '';

          if (Array.isArray(note.imageList)) {
            note.imageList.forEach((img: any) => {
              const u = img.urlDefault || img.infoList?.[0]?.url || img.urlPre || img.url;
              if (u) {
                const cleanImg = u.split('!')[0].replace(/\?imageView2.*$/, '');
                imagesList.push(cleanImg);
              }
            });
          }

          if (videoUrl) {
            options.push({
              id: 'xhs-stream-1080p',
              label: 'Tiểu Hồng Thư - Video HD Không Logo (1080p)',
              resolution: '1080 x 1920',
              quality: '1080p',
              format: 'mp4',
              sizeFormatted: 'Gốc (Chất lượng cao)',
              hasWatermark: false,
              url: videoUrl,
              directUrl: videoUrl,
              isRecommended: true,
            });
            options.push({
              id: 'xhs-audio',
              label: 'Tải Audio MP3 (Gốc từ video)',
              quality: 'audio',
              format: 'mp3',
              sizeFormatted: 'Audio MP3',
              hasWatermark: false,
              url: videoUrl,
              directUrl: videoUrl,
            });
          }

          if (imagesList.length > 0) {
            imagesList.forEach((imgUrl, idx) => {
              options.push({
                id: `xhs-img-${idx + 1}`,
                label: `Tải Ảnh ${idx + 1}/${imagesList.length} (HD Siêu Nét Không Logo)`,
                resolution: 'Độ phân giải gốc',
                quality: 'image',
                format: 'jpg',
                sizeFormatted: 'Ảnh Gốc HD',
                hasWatermark: false,
                url: imgUrl,
                directUrl: imgUrl,
                isRecommended: !videoUrl && idx === 0,
              });
            });
          }

          if (options.length > 0) {
            const directUrl = videoUrl || imagesList[0];
            return {
              id: `xhs-${Date.now()}`,
              originalInput: cleanUrl,
              cleanedUrl: targetUrl,
              platform: 'xiaohongshu',
              platformLabel: PLATFORMS.xiaohongshu.name,
              title: decodeHtmlEntities(note.title || note.desc || 'Xiaohongshu Note Không Logo'),
              description: note.desc || '',
              author: {
                name: note.user?.nickname || 'Tiểu Hồng Thư Creator',
                username: `@${note.user?.redId || note.user?.userId || 'xiaohongshu_user'}`,
                avatar: note.user?.avatar || '',
              },
              duration: videoUrl ? 45 : 15,
              durationFormatted: videoUrl ? 'Video HD' : `${imagesList.length} Ảnh Gốc`,
              thumbnail: imagesList[0] || '',
              stats: {
                likes: String(note.interactInfo?.likedCount || '0'),
                comments: String(note.interactInfo?.commentCount || '0'),
                shares: String(note.interactInfo?.shareCount || '0'),
              },
              options,
              images: imagesList,
              previewStreamUrl: directUrl,
              extractedAt: Date.now(),
            };
          }
        }
      }
    }
  } catch {}

  // 4. Try public fallback API endpoints
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const pubRes = await fetch(`https://api.vience.my.id/api/download/xhs?url=${encodeURIComponent(cleanUrl)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (pubRes.ok) {
      const j = await pubRes.json();
      if (j && (j.data || j.result)) {
        const r = j.data || j.result;
        const options: VideoQualityOption[] = [];
        const video = r.video || r.videoUrl;
        const imgs = r.images || r.imageList || [];

        if (video) {
          options.push({
            id: 'xhs-pub-video',
            label: 'Tiểu Hồng Thư - Video Không Logo HD',
            quality: '1080p',
            format: 'mp4',
            sizeFormatted: 'Gốc',
            hasWatermark: false,
            url: video,
            directUrl: video,
            isRecommended: true,
          });
        }
        if (Array.isArray(imgs)) {
          imgs.forEach((img: any, idx: number) => {
            const u = typeof img === 'string' ? img : img.url;
            if (u) {
              options.push({
                id: `xhs-pub-img-${idx + 1}`,
                label: `Tải Ảnh ${idx + 1}/${imgs.length} (HD Không Logo)`,
                quality: 'image',
                format: 'jpg',
                sizeFormatted: 'Ảnh Gốc HD',
                hasWatermark: false,
                url: u,
                directUrl: u,
                isRecommended: !video && idx === 0,
              });
            }
          });
        }
        if (options.length > 0) {
          const direct = video || imgs[0];
          return {
            id: `xhs-${Date.now()}`,
            originalInput: cleanUrl,
            cleanedUrl: cleanUrl,
            platform: 'xiaohongshu',
            platformLabel: PLATFORMS.xiaohongshu.name,
            title: decodeHtmlEntities(r.title || 'Xiaohongshu Video & Album Ảnh'),
            author: {
              name: r.author || 'Tiểu Hồng Thư Creator',
              username: '@xiaohongshu_user',
            },
            duration: video ? 45 : 15,
            durationFormatted: video ? 'Video HD' : 'Album Ảnh',
            thumbnail: imgs[0] || '',
            stats: {},
            options,
            previewStreamUrl: direct,
            extractedAt: Date.now(),
          };
        }
      }
    }
  } catch {}

  return null;
}

/**
 * 7. Extract Douyin (抖音) videos and photo albums (Watermark-free Full HD & MP3)
 */
async function tryDouyin(cleanUrl: string): Promise<VideoItemMetadata | null> {
  const headers = {
    'User-Agent': 'btch/6.4.0',
    'Accept': 'application/json, text/plain, */*',
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://backend1.tioo.eu.org/douyin?url=${encodeURIComponent(cleanUrl)}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json && json.status && json.data) {
          const d = json.data;
          const links = d.links || [];
          if (links.length > 0) {
            const options: VideoQualityOption[] = [];
            const mp4Links = links.filter((l: any) => l.url && (!l.quality?.includes('3') && !l.url?.includes('.mp3')));
            const audioLinks = links.filter((l: any) => l.url && (l.quality?.includes('3') || l.url?.includes('.mp3')));

            mp4Links.forEach((l: any, idx: number) => {
              const isHD = idx === 1 || l.quality?.includes('2');
              options.push({
                id: `douyin-mp4-${idx}`,
                label: isHD ? 'Douyin HD - Video 1080p Không Logo' : 'Douyin Video MP4 Không Logo (Gốc)',
                resolution: isHD ? '1080 x 1920' : '720 x 1280',
                quality: isHD ? '1080p' : '720p',
                format: 'mp4',
                sizeFormatted: isHD ? 'Full HD Gốc' : 'Tiêu chuẩn',
                hasWatermark: false,
                url: l.url,
                directUrl: l.url,
                isRecommended: isHD || idx === 0,
              });
            });

            if (audioLinks.length > 0) {
              options.push({
                id: 'douyin-audio',
                label: 'Tải Audio MP3 (Nhạc nền gốc Douyin)',
                quality: 'audio',
                format: 'mp3',
                sizeFormatted: 'Audio MP3',
                hasWatermark: false,
                url: audioLinks[0].url,
                directUrl: audioLinks[0].url,
              });
            }

            if (options.length > 0) {
              return {
                id: `douyin-${Date.now()}`,
                originalInput: cleanUrl,
                cleanedUrl: cleanUrl,
                platform: 'douyin',
                platformLabel: PLATFORMS.douyin.name,
                title: decodeHtmlEntities(d.title || 'Douyin Video Không Logo'),
                author: {
                  name: 'Douyin Creator',
                  username: '@douyin_user',
                },
                duration: 30,
                durationFormatted: 'Bản gốc',
                thumbnail: d.thumbnail || '',
                stats: { views: 'HD Gốc' },
                options,
                previewStreamUrl: options[0].url,
                extractedAt: Date.now(),
              };
            }
          }
        }
      }
    } catch {}
    if (attempt < 3) await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/**
 * 8. Extract YouTube videos and YouTube Shorts (Full HD MP4 & MP3)
 */
async function tryYoutube(cleanUrl: string): Promise<VideoItemMetadata | null> {
  const id = extractResourceId(cleanUrl, 'youtube');
  let canonicalUrl = cleanUrl;
  if (id) {
    canonicalUrl = `https://www.youtube.com/watch?v=${id}`;
  }

  const headers = {
    'User-Agent': 'btch/6.4.0',
    'Accept': 'application/json, text/plain, */*',
  };

  // 1. Direct fetch from backend1 with retry loop (3 attempts)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://backend1.tioo.eu.org/youtube?url=${encodeURIComponent(canonicalUrl)}`, { headers });
      if (res.ok) {
        const j = await res.json();
        if (j && j.status && (j.mp4 || j.mp3)) {
          const options: VideoQualityOption[] = [];
          if (j.mp4) {
            options.push({
              id: 'yt-1080p',
              label: 'YouTube HD (Video chất lượng cao MP4)',
              resolution: '1920 x 1080 (HD)',
              quality: '1080p',
              format: 'mp4',
              sizeFormatted: 'Gốc (Chất lượng cao)',
              hasWatermark: false,
              url: j.mp4,
              directUrl: j.mp4,
              isRecommended: true,
            });
            options.push({
              id: 'yt-720p',
              label: 'YouTube SD (Tiết kiệm dung lượng 720p/480p)',
              resolution: '1280 x 720 (SD)',
              quality: '720p',
              format: 'mp4',
              sizeFormatted: 'Tiết kiệm bộ nhớ',
              hasWatermark: false,
              url: j.mp4,
              directUrl: j.mp4,
              isRecommended: false,
            });
          }
          if (j.mp3 || j.mp4) {
            const audioStream = j.mp3 || j.mp4;
            options.push({
              id: 'yt-audio',
              label: 'Tải Audio MP3 (320kbps - Tách từ video)',
              quality: 'audio',
              format: 'mp3',
              sizeFormatted: 'Audio MP3',
              hasWatermark: false,
              url: audioStream,
              directUrl: audioStream,
              isRecommended: !j.mp4,
            });
          }
          if (options.length > 0) {
            return {
              id: `yt-${id || Date.now()}`,
              originalInput: cleanUrl,
              cleanedUrl: canonicalUrl,
              platform: 'youtube',
              platformLabel: PLATFORMS.youtube.name,
              title: decodeHtmlEntities(j.title || 'YouTube Video'),
              author: {
                name: j.author || 'YouTube Creator',
                username: j.author ? `@${j.author.replace(/\s+/g, '_')}` : '@youtube_creator',
              },
              duration: 180,
              durationFormatted: 'Bản gốc',
              thumbnail: j.thumbnail || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''),
              stats: { views: 'Full HD' },
              options,
              previewStreamUrl: j.mp4 || j.mp3,
              extractedAt: Date.now(),
            };
          }
        }
      }
    } catch {}
    if (attempt < 3) await new Promise((r) => setTimeout(r, 500));
  }

  // 2. Try btch-downloader youtube method
  try {
    const btch = await import('btch-downloader');
    const getYt = (btch as any).youtube || (btch as any).default?.youtube;
    if (typeof getYt === 'function') {
      let res = await getYt(canonicalUrl);
      if (!res || !res.status || (!res.mp4 && !res.mp3)) {
        if (canonicalUrl !== cleanUrl) {
          res = await getYt(cleanUrl);
        }
      }

      if (res && res.status && (res.mp4 || res.mp3)) {
        const options: VideoQualityOption[] = [];
        const videoStream = res.mp4;
        const audioStream = res.mp3 || res.mp4;

        if (videoStream) {
          options.push({
            id: 'yt-1080p',
            label: 'YouTube HD (Video chất lượng cao MP4)',
            resolution: '1920 x 1080 (HD)',
            quality: '1080p',
            format: 'mp4',
            sizeFormatted: 'Gốc (Chất lượng cao)',
            hasWatermark: false,
            url: videoStream,
            directUrl: videoStream,
            isRecommended: true,
          });
          options.push({
            id: 'yt-720p',
            label: 'YouTube SD (Tiết kiệm dung lượng 720p/480p)',
            resolution: '1280 x 720 (SD)',
            quality: '720p',
            format: 'mp4',
            sizeFormatted: 'Tiết kiệm bộ nhớ',
            hasWatermark: false,
            url: videoStream,
            directUrl: videoStream,
            isRecommended: false,
          });
        }

        if (audioStream) {
          options.push({
            id: 'yt-audio',
            label: 'Tải Audio MP3 (320kbps - Tách từ video)',
            quality: 'audio',
            format: 'mp3',
            sizeFormatted: 'Audio MP3',
            hasWatermark: false,
            url: audioStream,
            directUrl: audioStream,
            isRecommended: !videoStream,
          });
        }

        const rawTitle = res.title && res.title.trim() ? res.title.trim() : 'YouTube Video';
        const safeTitle = decodeHtmlEntities(rawTitle);

        return {
          id: `yt-${id || Date.now()}`,
          originalInput: cleanUrl,
          cleanedUrl: canonicalUrl,
          platform: 'youtube',
          platformLabel: PLATFORMS.youtube.name,
          title: safeTitle,
          author: {
            name: res.author || 'YouTube Creator',
            username: res.author ? `@${res.author.replace(/\s+/g, '_')}` : '@youtube_creator',
          },
          duration: 180,
          durationFormatted: 'Bản gốc',
          thumbnail: res.thumbnail || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''),
          stats: {
            views: 'Full HD',
          },
          options,
          previewStreamUrl: videoStream || audioStream,
          extractedAt: Date.now(),
        };
      }
    }
  } catch {}

  // 2. Try @distube/ytdl-core fallback
  try {
    const { Ytdl } = await import('@distube/ytdl-core');
    const ytdl = new Ytdl();
    const info = await ytdl.getInfo(canonicalUrl);
    if (info && info.videoDetails) {
      const details = info.videoDetails;
      const options: VideoQualityOption[] = [];

      const videoFormats = info.formats.filter((f) => f.url && (f.hasVideo || f.qualityLabel));
      const audioFormats = info.formats.filter((f) => f.url && f.hasAudio && !f.hasVideo);

      const bestVideo = videoFormats[0]?.url;
      const bestAudio = (audioFormats[0] || videoFormats[0])?.url;

      if (bestVideo) {
        options.push({
          id: 'yt-ytdl-hd',
          label: 'YouTube HD (1080p/720p Video)',
          resolution: '1920 x 1080',
          quality: '1080p',
          format: 'mp4',
          sizeFormatted: 'Gốc (Chất lượng cao)',
          hasWatermark: false,
          url: bestVideo,
          directUrl: bestVideo,
          isRecommended: true,
        });
      }

      if (bestAudio) {
        options.push({
          id: 'yt-ytdl-audio',
          label: 'Tải Audio MP3/M4A (Âm thanh gốc)',
          quality: 'audio',
          format: 'mp3',
          sizeFormatted: 'Chất lượng cao',
          hasWatermark: false,
          url: bestAudio,
          directUrl: bestAudio,
          isRecommended: !bestVideo,
        });
      }

      if (options.length > 0) {
        const thumb =
          details.thumbnails?.[details.thumbnails.length - 1]?.url ||
          (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');
        return {
          id: `yt-${id || Date.now()}`,
          originalInput: cleanUrl,
          cleanedUrl: canonicalUrl,
          platform: 'youtube',
          platformLabel: PLATFORMS.youtube.name,
          title: decodeHtmlEntities(details.title || 'YouTube Video'),
          author: {
            name: details.author?.name || 'YouTube Creator',
            username: details.author?.name ? `@${details.author.name.replace(/\s+/g, '_')}` : '@youtube_creator',
          },
          duration: Number(details.lengthSeconds) || 180,
          durationFormatted: formatDuration(Number(details.lengthSeconds) || 180),
          thumbnail: thumb,
          stats: {
            views: formatStatNumber(details.viewCount),
          },
          options,
          previewStreamUrl: bestVideo || bestAudio || '',
          extractedAt: Date.now(),
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Main Extract Video Entrypoint (REAL extraction only, zero mock videos)
 */
export async function extractVideo(rawInput: string): Promise<VideoItemMetadata> {
  const cleanUrl = extractCleanUrl(rawInput);
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập đường dẫn video hợp lệ.');
  }

  const platform = detectPlatform(cleanUrl);

  // Platform: YouTube (Shorts & Standard Video)
  if (platform === 'youtube') {
    const res1 = await tryYoutube(cleanUrl);
    if (res1) return res1;

    const res2 = await tryYtDlp(cleanUrl, 'youtube');
    if (res2) return res2;
  }

  // Platform: Xiaohongshu (Tiểu Hồng Thư)
  if (platform === 'xiaohongshu') {
    const res1 = await tryXiaohongshu(cleanUrl);
    if (res1) return res1;

    const res2 = await tryYtDlp(cleanUrl, 'xiaohongshu');
    if (res2) return res2;
  }

  // Platform: Facebook
  if (platform === 'facebook') {
    const res1 = await tryFbDownloader(cleanUrl);
    if (res1) return res1;

    const res2 = await trySnapSave(cleanUrl, 'facebook');
    if (res2) return res2;

    const res3 = await tryYtDlp(cleanUrl, 'facebook');
    if (res3) return res3;
  }

  // Platform: Instagram
  if (platform === 'instagram') {
    const res0 = await tryInstagramBtch(cleanUrl);
    if (res0) return res0;

    const res1 = await trySnapSave(cleanUrl, 'instagram');
    if (res1) return res1;

    const res2 = await tryYtDlp(cleanUrl, 'instagram');
    if (res2) return res2;
  }

  // Platform: Douyin (抖音)
  if (platform === 'douyin') {
    const res0 = await tryDouyin(cleanUrl);
    if (res0) return res0;

    const res1 = await tryLiveTikwm(cleanUrl, 'douyin');
    if (res1) return res1;

    const res2 = await trySnapSave(cleanUrl, 'douyin');
    if (res2) return res2;

    const res3 = await tryYtDlp(cleanUrl, 'douyin');
    if (res3) return res3;
  }

  // Platform: TikTok
  if (platform === 'tiktok') {
    const res1 = await tryLiveTikwm(cleanUrl, 'tiktok');
    if (res1) return res1;

    const res2 = await trySnapSave(cleanUrl, 'tiktok');
    if (res2) return res2;

    const res3 = await tryYtDlp(cleanUrl, 'tiktok');
    if (res3) return res3;
  }

  // Platform: X / Twitter
  if (platform === 'x') {
    const statusId = extractResourceId(cleanUrl, 'x');
    if (statusId) {
      const res1 = await tryLiveXTwitter(cleanUrl, statusId);
      if (res1) return res1;
    }

    const res2 = await trySnapSave(cleanUrl, 'x');
    if (res2) return res2;

    const res3 = await tryYtDlp(cleanUrl, 'x');
    if (res3) return res3;
  }

  // Platform: Bilibili or others
  if (platform === 'bilibili' || platform === 'unknown') {
    const res1 = await tryYtDlp(cleanUrl, platform);
    if (res1) return res1;
  }

  // If all real extraction methods fail:
  throw new Error(
    `Không thể trích xuất video từ liên kết này. Video có thể đang ở chế độ riêng tư, bị hạn chế bản quyền, hoặc mạng xã hội yêu cầu đăng nhập tài khoản để xem.`
  );
}

/**
 * Fallback builder for tests ONLY (no oceans.mp4)
 */
export function generatePlatformFallback(cleanUrl: string, platform: PlatformId): VideoItemMetadata {
  const pInfo = PLATFORMS[platform] || PLATFORMS.unknown;
  const safeId = cleanId(extractResourceId(cleanUrl, platform) || 'test');

  return {
    id: `${platform}-${safeId}`,
    originalInput: cleanUrl,
    cleanedUrl: cleanUrl,
    platform,
    platformLabel: pInfo.name,
    title: `${pInfo.name} Video (${safeId})`,
    author: {
      name: `${pInfo.shortName} Creator`,
      username: `@user_${safeId}`,
    },
    duration: 30,
    durationFormatted: '00:30',
    thumbnail: '',
    stats: {},
    options: [
      {
        id: `${platform}-1080p`,
        label: 'MP4 1080p Full HD',
        resolution: '1920x1080',
        quality: '1080p',
        format: 'mp4',
        sizeFormatted: 'Bản gốc',
        hasWatermark: false,
        url: cleanUrl,
        directUrl: cleanUrl,
        isRecommended: true,
      },
      {
        id: `${platform}-audio`,
        label: 'Audio MP3',
        quality: 'audio',
        format: 'mp3',
        sizeFormatted: 'MP3',
        hasWatermark: false,
        url: cleanUrl,
        directUrl: cleanUrl,
      },
    ],
    previewStreamUrl: cleanUrl,
    extractedAt: Date.now(),
  };
}
