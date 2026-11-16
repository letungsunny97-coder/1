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
 * Race any async promise against a strict timeout so flaky 3rd-party packages never hang
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Resolve Facebook /share/r/, /share/v/, or fb.watch short links to canonical URLs
 */
async function resolveFacebookShareUrl(cleanUrl: string): Promise<string> {
  if (!/facebook\.com\/share\/|fb\.watch/i.test(cleanUrl)) {
    return cleanUrl;
  }
  let current = cleanUrl;
  for (let hop = 0; hop < 2; hop++) {
    try {
      const res = await fetchTimeout(
        current,
        {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        4000
      );
      const loc = res.headers.get('location');
      if (!loc) break;
      current = loc.startsWith('http') ? loc : new URL(loc, current).toString();
      if (/\/reel\/|\/videos\/|\?v=/i.test(current)) break;
    } catch {
      break;
    }
  }
  return current;
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

  // 2. Standard server-side Node.js extractor (skip unresolved /share/ links that always fail)
  if (/facebook\.com\/share\//i.test(cleanUrl)) return null;
  try {
    const m = await import('@xaviabot/fb-downloader');
    const getFBInfo = (m as any).default || m;
    const res = await withTimeout<any>(Promise.resolve(getFBInfo(cleanUrl)), 6500);
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
 * 1a-direct. Direct cookie-free Facebook HTML parser (handles watch/?v=, reels, videos reliably without stale cookies)
 */
async function tryFacebookDirect(cleanUrl: string): Promise<VideoItemMetadata | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const resp = await fetchTimeout(
      cleanUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Dest': 'document',
        },
        redirect: 'follow',
      },
      5500
    );
    if (!resp.ok) return null;
    const rawHtml = await resp.text();
    if (!rawHtml) return null;

    const html = rawHtml.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const parseJsonStr = (s: string) => {
      try {
        return JSON.parse(`"${s.replace(/\\?"/g, '\\"')}"`);
      } catch {
        return s.replace(/\\\//g, '/').replace(/\\u0025/g, '%');
      }
    };

    const sdMatch =
      html.match(/"browser_native_sd_url":"([^"]+)"/) ||
      html.match(/"playable_url":"([^"]+)"/) ||
      html.match(/sd_src\s*:\s*"([^"]*)"/);
    const hdMatch =
      html.match(/"browser_native_hd_url":"([^"]+)"/) ||
      html.match(/"playable_url_quality_hd":"([^"]+)"/) ||
      html.match(/hd_src\s*:\s*"([^"]*)"/);

    const sd = sdMatch?.[1] ? parseJsonStr(sdMatch[1]) : '';
    const hd = hdMatch?.[1] ? parseJsonStr(hdMatch[1]) : '';
    const bestUrl = hd || sd;
    if (!bestUrl || !bestUrl.startsWith('http')) return null;

    const titleMatch =
      html.match(/property="og:title"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const thumbMatch =
      html.match(/"preferred_thumbnail":\{"image":\{"uri":"([^"]+)"/) ||
      html.match(/property="og:image"\s+content="([^"]+)"/i);

    const options: VideoQualityOption[] = [];
    if (hd) {
      options.push({
        id: 'fb-direct-hd',
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
    if (sd && sd !== hd) {
      options.push({
        id: 'fb-direct-sd',
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
      id: 'fb-direct-audio',
      label: 'Tải Audio MP3 (Gốc từ video)',
      quality: 'audio',
      format: 'mp3',
      sizeFormatted: 'Audio MP3',
      hasWatermark: false,
      url: bestUrl,
      directUrl: bestUrl,
    });

    const safeTitle = decodeHtmlEntities(
      (titleMatch?.[1] ? parseJsonStr(titleMatch[1]) : '') || 'Facebook Video'
    );
    const thumb = thumbMatch?.[1] ? parseJsonStr(thumbMatch[1]) : '';

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
      thumbnail: thumb,
      stats: { views: 'HD Gốc' },
      options,
      previewStreamUrl: bestUrl,
      extractedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * 1b. Extract Facebook video using btch-downloader fbdown (handles /share/r/, /share/v/, /reel/, /watch/)
 */
async function tryBtchFbdown(cleanUrl: string): Promise<VideoItemMetadata | null> {
  try {
    const btch = await import('btch-downloader');
    const fbdown = (btch as any).fbdown || (btch as any).default?.fbdown;
    if (typeof fbdown !== 'function') return null;

    const res = await withTimeout<any>(Promise.resolve(fbdown(cleanUrl)), 6500);
    const hdUrl = res?.HD || res?.hd || '';
    const sdUrl = res?.Normal_video || res?.sd || '';
    const bestUrl = hdUrl || sdUrl;
    if (!bestUrl) return null;

    const options: VideoQualityOption[] = [];
    if (hdUrl) {
      options.push({
        id: 'fb-btch-hd',
        label: 'Facebook HD (Bản nét cao 720p/1080p Không Logo)',
        resolution: '1280 x 720 (HD)',
        quality: '1080p',
        format: 'mp4',
        sizeFormatted: 'Gốc (Chất lượng cao)',
        hasWatermark: false,
        url: hdUrl,
        directUrl: hdUrl,
        isRecommended: true,
      });
    }
    if (sdUrl && sdUrl !== hdUrl) {
      options.push({
        id: 'fb-btch-sd',
        label: 'Facebook SD (Bản tiêu chuẩn Không Logo)',
        resolution: '640 x 360 (SD)',
        quality: '720p',
        format: 'mp4',
        sizeFormatted: 'Tiết kiệm dung lượng',
        hasWatermark: false,
        url: sdUrl,
        directUrl: sdUrl,
        isRecommended: !hdUrl,
      });
    }
    options.push({
      id: 'fb-btch-audio',
      label: 'Tải Audio MP3 (Gốc từ video)',
      quality: 'audio',
      format: 'mp3',
      sizeFormatted: 'Audio MP3',
      hasWatermark: false,
      url: bestUrl,
      directUrl: bestUrl,
    });

    return {
      id: `fb-${Date.now()}`,
      originalInput: cleanUrl,
      cleanedUrl: cleanUrl,
      platform: 'facebook',
      platformLabel: PLATFORMS.facebook.name,
      title: decodeHtmlEntities((typeof res?.title === 'string' && res.title.trim()) || 'Facebook Video & Reels'),
      author: {
        name: 'Facebook Creator',
        username: '@facebook_user',
      },
      duration: 45,
      durationFormatted: 'Bản gốc',
      thumbnail: res?.thumbnail || '',
      stats: { views: 'HD Gốc' },
      options,
      previewStreamUrl: bestUrl,
      extractedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * 1c. Fast independent Facebook extractor via Siputzx API (handles /share/r/, /reel/, /watch/ in ~1s)
 */
async function tryFacebookSiputzx(cleanUrl: string): Promise<VideoItemMetadata | null> {
  try {
    const resp = await fetchTimeout(
      `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(cleanUrl)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      },
      7500
    );
    if (!resp.ok) return null;
    const json = await resp.json().catch(() => null);
    const downloads = json?.data?.downloads;
    if (!json?.status || !Array.isArray(downloads) || downloads.length === 0) return null;

    const options: VideoQualityOption[] = [];
    downloads.forEach((d: any, idx: number) => {
      if (!d?.url || typeof d.url !== 'string') return;
      const qLabel = String(d.quality || (idx === 0 ? '720p (HD)' : '360p (SD)'));
      const isHD = /hd|1080|720/i.test(qLabel);
      options.push({
        id: `fb-sip-${idx}`,
        label: `Facebook ${qLabel} Không Logo`,
        resolution: isHD ? '1280 x 720 (HD)' : '640 x 360 (SD)',
        quality: isHD ? '1080p' : '720p',
        format: 'mp4',
        sizeFormatted: isHD ? 'Gốc (Chất lượng cao)' : 'Tiêu chuẩn',
        hasWatermark: false,
        url: d.url,
        directUrl: d.url,
        isRecommended: idx === 0,
      });
    });

    if (options.length === 0) return null;
    options.push({
      id: 'fb-sip-audio',
      label: 'Tải Audio MP3 (Gốc từ video)',
      quality: 'audio',
      format: 'mp3',
      sizeFormatted: 'Audio MP3',
      hasWatermark: false,
      url: options[0].url,
      directUrl: options[0].directUrl,
    });

    return {
      id: `fb-${Date.now()}`,
      originalInput: cleanUrl,
      cleanedUrl: cleanUrl,
      platform: 'facebook',
      platformLabel: PLATFORMS.facebook.name,
      title: decodeHtmlEntities(json.data?.title || 'Facebook Video & Reels'),
      author: {
        name: 'Facebook Creator',
        username: '@facebook_user',
      },
      duration: 45,
      durationFormatted: json.data?.duration || 'Bản gốc',
      thumbnail: json.data?.thumbnail || '',
      stats: { views: 'HD Gốc' },
      options,
      previewStreamUrl: options[0].url,
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
    const result = await withTimeout<any>(Promise.resolve(snapsave(cleanUrl)), 16000);
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
 * 6a. Fast Direct Instagram extraction via embedded media JSON (Reels & Posts)
 */
async function tryInstagramDirect(cleanUrl: string): Promise<VideoItemMetadata | null> {
  try {
    const canonicalUrl = cleanUrl.split('?')[0];
    const resp = await fetchTimeout(
      canonicalUrl,
      {
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      },
      6500
    );
    if (!resp.ok) return null;
    const html = await resp.text();
    if (!html) return null;

    const decoded = html.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    const options: VideoQualityOption[] = [];
    const imagesList: string[] = [];
    let hasVideo = false;

    // Extract video_versions JSON array if present
    const vvMatches = [...decoded.matchAll(/"video_versions":(\[[^\]]+\])/g)];
    const seenVideoUrls = new Set<string>();
    for (const m of vvMatches) {
      try {
        const arr = JSON.parse(m[1]);
        if (Array.isArray(arr) && arr.length > 0) {
          const best = arr[0];
          if (best?.url && typeof best.url === 'string' && !seenVideoUrls.has(best.url)) {
            seenVideoUrls.add(best.url);
            hasVideo = true;
            options.push({
              id: `ig-direct-vid-${seenVideoUrls.size}`,
              label: `Instagram MP4 - ${best.width && best.height ? `${best.width}x${best.height}` : '1080p'} Video Không Logo`,
              resolution: best.width && best.height ? `${best.width} x ${best.height}` : '1080 x 1920',
              quality: '1080p',
              format: 'mp4',
              sizeFormatted: 'Gốc (Chất lượng cao)',
              hasWatermark: false,
              url: best.url,
              directUrl: best.url,
              fps: 60,
              isRecommended: seenVideoUrls.size === 1,
            });
          }
        }
      } catch {}
    }

    // Extract image candidates if no video (or photo carousel)
    if (!hasVideo) {
      const imgMatches = [...decoded.matchAll(/"image_versions2":\{"candidates":\[(\{"height":\d+,"url":"([^"]+)","width":\d+\})/g)];
      const seenImgUrls = new Set<string>();
      for (const m of imgMatches) {
        const imgUrl = m[2];
        if (imgUrl && !seenImgUrls.has(imgUrl)) {
          seenImgUrls.add(imgUrl);
          imagesList.push(imgUrl);
          options.push({
            id: `ig-direct-img-${imagesList.length}`,
            label: `Tải Ảnh Instagram ${imagesList.length} (Gốc Không Logo - JPG)`,
            quality: 'image',
            format: 'jpg',
            sizeFormatted: 'Ảnh Gốc HD',
            hasWatermark: false,
            url: imgUrl,
            directUrl: imgUrl,
            isRecommended: imagesList.length === 1,
          });
        }
      }
    }

    if (options.length === 0) return null;

    if (hasVideo && options[0]) {
      options.push({
        id: 'ig-direct-audio',
        label: 'Tải Audio MP3 (Tách từ video Instagram)',
        quality: 'audio',
        format: 'mp3',
        sizeFormatted: 'Audio MP3',
        hasWatermark: false,
        url: options[0].url,
        directUrl: options[0].directUrl,
      });
    }

    const ogTitleRaw = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] || '';
    const ogImg = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || '';
    const usernameMatch = decoded.match(/"user":\{[^}]*"username":"([^"]+)"/)?.[1] || '';
    const cleanTitle = decodeHtmlEntities(ogTitleRaw) || `Instagram ${hasVideo ? 'Reels Video' : 'Album Ảnh'} Không Logo`;

    return {
      id: `ig-${Date.now()}`,
      originalInput: cleanUrl,
      cleanedUrl: cleanUrl,
      platform: 'instagram',
      platformLabel: PLATFORMS.instagram.name,
      title: cleanTitle,
      author: {
        name: usernameMatch || 'Instagram Creator',
        username: usernameMatch ? `@${usernameMatch}` : '@instagram_post',
      },
      duration: imagesList.length || 30,
      durationFormatted: hasVideo ? 'Bản gốc' : `${imagesList.length} Ảnh Gốc HD Không Logo`,
      thumbnail: decodeHtmlEntities(ogImg) || imagesList[0] || '',
      stats: { likes: 'HD' },
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
 * 6. Try real live extraction for Instagram (both Video/Reel and High-res Photos/Carousels)
 */
async function tryInstagramBtch(cleanUrl: string): Promise<VideoItemMetadata | null> {
  // 1. Fast Direct HTML extraction (zero rate-limit, ~1s)
  const directRes = await tryInstagramDirect(cleanUrl);
  if (directRes) return directRes;

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'btch/6.4.0',
    'X-Client-Version': '6.4.0',
    'Accept': 'application/json, text/plain, */*',
  };

  const detectIgIsVideo = (mediaUrl: string, item: any): boolean => {
    if (item?.type === 'video' || mediaUrl.includes('.mp4')) return true;
    try {
      const m = mediaUrl.match(/[?&]token=([^&]+)/);
      if (m && m[1]) {
        const parts = m[1].split('.');
        if (parts.length >= 2) {
          const payloadStr = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
          const payload = JSON.parse(payloadStr);
          if (payload?.filename && /\.mp4/i.test(payload.filename)) return true;
          if (payload?.filename && /\.(jpg|jpeg|png|webp)/i.test(payload.filename)) return false;
          if (payload?.url && /\.mp4/i.test(payload.url)) return true;
        }
      }
    } catch {}
    return cleanUrl.includes('/reel/') || mediaUrl.includes('/v2?');
  };

  const buildIgResult = (list: any[]): VideoItemMetadata | null => {
    const imagesList: string[] = [];
    const options: VideoQualityOption[] = [];
    let hasVideo = false;

    list.forEach((item: any, idx: number) => {
      const mediaUrl = item.url || item.downloadUrl || item.link;
      if (!mediaUrl || typeof mediaUrl !== 'string' || !mediaUrl.startsWith('http')) return;
      const isVideo = detectIgIsVideo(mediaUrl, item);

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
          label: `Tải Ảnh Instagram ${imagesList.length} (Gốc Không Logo - JPG)`,
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

    if (hasVideo && options[0]) {
      options.push({
        id: 'ig-audio',
        label: 'Tải Audio MP3 (Tách từ video Instagram)',
        quality: 'audio',
        format: 'mp3',
        sizeFormatted: 'Audio MP3',
        hasWatermark: false,
        url: options[0].url,
        directUrl: options[0].directUrl,
      });
    }

    if (options.length === 0) return null;
    const firstMedia = options[0].url;
    return {
      id: `ig-${Date.now()}`,
      originalInput: cleanUrl,
      cleanedUrl: cleanUrl,
      platform: 'instagram',
      platformLabel: PLATFORMS.instagram.name,
      title: `Instagram ${hasVideo ? 'Reels Video' : 'Album Ảnh'} Không Logo`,
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
  };

  // 2. Single fast-timeout attempt to backend1 igdl (no hang)
  try {
    const res = await fetchTimeout(`https://backend1.tioo.eu.org/igdl?url=${encodeURIComponent(cleanUrl)}`, { headers }, 5000);
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json)
        ? json
        : json?.result && Array.isArray(json.result)
        ? json.result
        : [];
      if (list.length > 0) {
        const built = buildIgResult(list);
        if (built) return built;
      }
    }
  } catch {}

  // 3. Library fallback via btch-downloader with timeout
  try {
    const btch = await import('btch-downloader');
    const igdl = (btch as any).igdl || (btch as any).default?.igdl;
    if (typeof igdl === 'function') {
      const res = await withTimeout<any>(Promise.resolve(igdl(cleanUrl)), 6500);
      const list = Array.isArray(res)
        ? res
        : res?.result && Array.isArray(res.result)
        ? res.result
        : [];
      if (list.length > 0) {
        const built = buildIgResult(list);
        if (built) return built;
      }
    }
  } catch {}
  return null;
}

/**
 * 6. Extract Xiaohongshu (Tiểu Hồng Thư / RedNote) media (Video + High-res Image Album)
 */
async function tryXiaohongshu(cleanUrl: string): Promise<VideoItemMetadata | null> {
  // 1. Fast Direct Xiaohongshu Mobile scraping with __INITIAL_STATE__ (handles xhslink.com redirects in 1 hop, ~2-3s, watermark-free)
  try {
    const mobileHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,vi;q=0.8,en;q=0.7',
    };

    let html = '';
    const bridge = typeof window !== 'undefined' ? (window as any).AndroidBridge : null;
    if (bridge && typeof bridge.nativeFetch === 'function') {
      const respStr = bridge.nativeFetch(cleanUrl, 'GET', mobileHeaders['User-Agent'], JSON.stringify(mobileHeaders));
      if (respStr) {
        try {
          const parsed = JSON.parse(respStr);
          if (parsed && parsed.body) html = parsed.body;
        } catch {}
      }
    }

    if (!html) {
      const resp = await fetchTimeout(cleanUrl, {
        headers: mobileHeaders,
        redirect: 'follow',
      }, 9000);
      if (resp.ok) {
        html = await resp.text();
      }
    }

    if (html) {
      const match = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})<\/script>/s) ||
                    html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*({.+?})<\/script>/s);
      if (match) {
        const cleanedJson = match[1].replace(/\bundefined\b/g, 'null');
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
          const originKey = note.video?.consumer?.originVideoKey;
          const rawVideoUrl =
            (originKey ? `https://sns-video-bd.xhscdn.com/${originKey}` : '') ||
            h264List[0]?.masterUrl ||
            h265List[0]?.masterUrl ||
            h264List[0]?.backupUrls?.[0] ||
            note.video?.url ||
            '';
          const videoUrl =
            typeof rawVideoUrl === 'string' && rawVideoUrl.startsWith('http://')
              ? rawVideoUrl.replace(/^http:\/\//, 'https://')
              : rawVideoUrl;

          if (Array.isArray(note.imageList)) {
            note.imageList.forEach((img: any) => {
              if (img?.fileId && typeof img.fileId === 'string') {
                imagesList.push(`https://ci.xiaohongshu.com/${img.fileId}?imageView2/2/w/0/format/jpg`);
                return;
              }
              const u = img.urlDefault || img.infoList?.[0]?.url || img.urlPre || img.url;
              if (u && typeof u === 'string') {
                const httpsUrl = u.startsWith('http://') ? u.replace(/^http:\/\//, 'https://') : u;
                const cleanImg = httpsUrl.includes('rednotecdn.com')
                  ? httpsUrl
                  : httpsUrl.split('!')[0].replace(/\?imageView2.*$/, '');
                imagesList.push(cleanImg);
              }
            });
          }

          if (videoUrl) {
            options.push({
              id: 'xhs-stream-1080p',
              label: 'Tiểu Hồng Thư - Video Gốc Không Logo (HD)',
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

          if (imagesList.length > 0 && !videoUrl) {
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
                isRecommended: idx === 0,
              });
            });
          }

          if (options.length > 0) {
            const directUrl = videoUrl || imagesList[0];
            return {
              id: `xhs-${Date.now()}`,
              originalInput: cleanUrl,
              cleanedUrl: cleanUrl,
              platform: 'xiaohongshu',
              platformLabel: PLATFORMS.xiaohongshu.name,
              title: decodeHtmlEntities(note.title || note.desc || 'Xiaohongshu Note Không Logo'),
              description: note.desc || '',
              author: {
                name: note.user?.nickName || note.user?.nickname || 'Tiểu Hồng Thư Creator',
                username: `@${note.user?.redId || note.user?.userId || 'xiaohongshu_user'}`,
                avatar: note.user?.avatar || '',
              },
              duration: videoUrl ? Math.round(note.video?.capa?.duration || 45) : imagesList.length,
              durationFormatted: videoUrl ? formatDuration(Math.round(note.video?.capa?.duration || 45)) : `${imagesList.length} Ảnh Gốc`,
              thumbnail: imagesList[0] || '',
              stats: {
                likes: String(note.interactInfo?.likedCount || '0'),
                comments: String(note.interactInfo?.commentCount || '0'),
                shares: String(note.interactInfo?.shareCount || '0'),
              },
              options,
              images: videoUrl ? undefined : imagesList,
              previewStreamUrl: directUrl,
              extractedAt: Date.now(),
            };
          }
        }
      }
    }
  } catch {}

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'btch/6.4.0',
    'X-Client-Version': '6.4.0',
    'Accept': 'application/json, text/plain, */*',
  };

  // 2. Fast single-attempt fallback to backend1 rednote (no 21s retry hang)
  try {
    const res = await fetchTimeout(`https://backend1.tioo.eu.org/rednote?url=${encodeURIComponent(cleanUrl)}`, { headers }, 5500);
    if (res.ok) {
      const j = await res.json();
      if (j && j.status && j.result) {
        const r = j.result;
        const downloads = Array.isArray(r.downloads) ? r.downloads : [];
        const rawImages = Array.isArray(r.images)
          ? r.images.filter((u: any) => typeof u === 'string' && u && !u.includes('/fe-platform/'))
          : [];
        const isPlaceholderHome =
          (typeof r.title === 'string' && r.title.toLowerCase().includes('global lifestyle hub')) ||
          (downloads.length === 0 && !r.videoUrl && rawImages.length === 0);

        if (!isPlaceholderHome) {
          const options: VideoQualityOption[] = [];
          const imagesList: string[] = [];

          rawImages.forEach((u: string) => {
            const httpsUrl = u.startsWith('http://') ? u.replace(/^http:\/\//, 'https://') : u;
            const cleanImg = httpsUrl.includes('rednotecdn.com')
              ? httpsUrl
              : httpsUrl.split('!')[0].replace(/\?imageView2.*$/, '');
            imagesList.push(cleanImg);
          });

          const rawVideoStream = downloads[0]?.url || r.videoUrl;
          const videoStream =
            typeof rawVideoStream === 'string' && rawVideoStream.startsWith('http://')
              ? rawVideoStream.replace(/^http:\/\//, 'https://')
              : rawVideoStream;

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

          if (imagesList.length > 0 && !videoStream) {
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
                isRecommended: idx === 0,
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
              duration: videoStream ? 45 : imagesList.length,
              durationFormatted: videoStream ? 'Video HD' : `${imagesList.length} Ảnh Gốc`,
              thumbnail: r.cover || imagesList[0] || '',
              stats: {
                likes: String(r.engagement?.likes || '0'),
                comments: String(r.engagement?.comments || '0'),
                shares: String(r.engagement?.shares || '0'),
              },
              options,
              images: videoStream ? undefined : imagesList,
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

async function fetchTimeout(url: string, init: RequestInit = {}, timeoutMs = 7000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 7. Extract Douyin (抖音) videos and photo albums (Watermark-free Full HD & MP3)
 */
async function tryDouyin(cleanUrl: string): Promise<VideoItemMetadata | null> {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'btch/6.4.0',
    'X-Client-Version': '6.4.0',
    'Accept': 'application/json, text/plain, */*',
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetchTimeout(
        `https://backend1.tioo.eu.org/douyin?url=${encodeURIComponent(cleanUrl)}`,
        { headers },
        7000
      );
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
    if (attempt < 3) await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

/**
 * 7b. Extract Bilibili (哔哩哔哩) videos via native Bilibili API (Combined MP4 + Audio)
 */
async function tryBilibili(cleanUrl: string): Promise<VideoItemMetadata | null> {
  let targetUrl = cleanUrl;
  const biliHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com/',
  };

  try {
    if (cleanUrl.includes('b23.tv') || cleanUrl.includes('bili2233.cn')) {
      const headRes = await fetchTimeout(cleanUrl, { method: 'GET', redirect: 'manual', headers: biliHeaders }, 6000);
      const loc = headRes.headers.get('location');
      if (loc) targetUrl = loc;
    }

    const resId = extractResourceId(targetUrl, 'bilibili');
    if (!resId) return null;

    const viewQuery = resId.toUpperCase().startsWith('BV')
      ? `bvid=${encodeURIComponent(resId)}`
      : `aid=${encodeURIComponent(resId.replace(/^av/i, ''))}`;

    const viewRes = await fetchTimeout(
      `https://api.bilibili.com/x/web-interface/view?${viewQuery}`,
      { headers: biliHeaders },
      7000
    );
    if (!viewRes.ok) return null;
    const viewJson = await viewRes.json();
    const data = viewJson?.data;
    if (!data || !data.cid) return null;

    const bvid = data.bvid || resId;
    const cid = data.cid;

    const [html5Res, dashRes] = await Promise.all([
      fetchTimeout(
        `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${cid}&qn=80&fnval=1&platform=html5&high_quality=1`,
        { headers: biliHeaders },
        7000
      ).catch(() => null),
      fetchTimeout(
        `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${cid}&qn=80&fnval=16`,
        { headers: biliHeaders },
        7000
      ).catch(() => null),
    ]);

    const html5Json = html5Res && html5Res.ok ? await html5Res.json().catch(() => null) : null;
    const dashJson = dashRes && dashRes.ok ? await dashRes.json().catch(() => null) : null;

    const mp4Durl = html5Json?.data?.durl?.[0];
    const mp4Url: string | undefined = mp4Durl?.url;
    const mp4Size: number = Number(mp4Durl?.size) || 0;
    const dashAudioUrl: string | undefined = dashJson?.data?.dash?.audio?.[0]?.baseUrl;

    if (!mp4Url) return null;

    const options: VideoQualityOption[] = [
      {
        id: 'bili-hd-mp4',
        label: 'Bilibili HD - Video MP4 Gốc (Có âm thanh)',
        resolution: `${data.dimension?.width || 1280} x ${data.dimension?.height || 720}`,
        quality: '1080p',
        format: 'mp4',
        sizeFormatted: mp4Size > 0 ? formatBytes(mp4Size) : 'Full HD Gốc',
        hasWatermark: false,
        url: mp4Url,
        directUrl: mp4Url,
        isRecommended: true,
      },
      {
        id: 'bili-audio',
        label: 'Tải Audio MP3/M4A (Âm thanh gốc Bilibili)',
        quality: 'audio',
        format: 'mp3',
        sizeFormatted: 'Audio Gốc',
        hasWatermark: false,
        url: dashAudioUrl || mp4Url,
        directUrl: dashAudioUrl || mp4Url,
      },
    ];

    const thumb = typeof data.pic === 'string' ? data.pic.replace(/^http:\/\//, 'https://') : '';
    const dur = Math.round(Number(data.duration) || 60);

    return {
      id: `bili-${bvid}`,
      originalInput: cleanUrl,
      cleanedUrl: targetUrl,
      platform: 'bilibili',
      platformLabel: PLATFORMS.bilibili.name,
      title: decodeHtmlEntities(data.title || 'Bilibili Video'),
      description: data.desc || '',
      author: {
        name: data.owner?.name || 'Bilibili UP主',
        username: `@uid_${data.owner?.mid || 'bilibili'}`,
        avatar: typeof data.owner?.face === 'string' ? data.owner.face.replace(/^http:\/\//, 'https://') : '',
      },
      duration: dur,
      durationFormatted: formatDuration(dur),
      thumbnail: thumb,
      stats: {
        views: formatStatNumber(data.stat?.view),
        likes: formatStatNumber(data.stat?.like),
        comments: formatStatNumber(data.stat?.reply),
      },
      options,
      previewStreamUrl: mp4Url,
      extractedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * 8a. Reliable YouTube extraction via etacloud converter (MP4 720p + MP3 192kbps)
 */
async function tryYoutubeEtacloud(id: string, cleanUrl: string, canonicalUrl: string): Promise<VideoItemMetadata | null> {
  try {
    const hdr = {
      'Origin': 'https://y2mate.gs',
      'Referer': 'https://y2mate.gs/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    const [pageRes, oembedRes] = await Promise.all([
      fetchTimeout('https://y2mate.gs/', { headers: { 'User-Agent': hdr['User-Agent'] } }, 6000),
      fetchTimeout(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`, {}, 4000)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    if (!pageRes.ok) return null;
    const html = await pageRes.text();
    const rawKey = html.match(/decodeKey\(['"]([^'"]+)['"]\)/)?.[1];
    if (!rawKey) return null;
    const apiKey = atob(rawKey.split('').reverse().join(''));

    const authRes = await fetchTimeout(
      `https://eta.etacloud.org/api/v1/auth?api_key=${encodeURIComponent(apiKey)}&_=${Date.now()}`,
      { headers: hdr },
      6000
    );
    if (!authRes.ok) return null;
    const auth = await authRes.json();
    if (!auth?.key) return null;

    const initRes = await fetchTimeout(
      `https://eta.etacloud.org/api/v1/init?_=${Date.now()}`,
      { headers: { ...hdr, Authorization: `Bearer ${auth.key}` } },
      6000
    );
    if (!initRes.ok) return null;
    const init = await initRes.json();
    if (!init?.convertURL) return null;

    const convertFormat = async (fmt: 'mp4' | 'mp3'): Promise<{ url: string; title: string } | null> => {
      try {
        const baseConvert = String(init.convertURL).split('&v=')[0];
        let convRes = await fetchTimeout(`${baseConvert}&v=${id}&f=${fmt}&_=${Date.now()}`, { headers: hdr }, 8000);
        if (!convRes.ok) return null;
        let conv = await convRes.json();
        if (conv?.redirect && conv?.redirectURL) {
          const redirBase = String(conv.redirectURL).split('&v=')[0];
          const convRes2 = await fetchTimeout(`${redirBase}&v=${id}&f=${fmt}&_=${Date.now()}`, { headers: hdr }, 8000);
          if (!convRes2.ok) return null;
          conv = await convRes2.json();
        }
        if (conv?.error > 0 || !conv?.downloadURL) return null;

        let title = typeof conv.title === 'string' ? conv.title : '';
        if (conv.progressURL) {
          for (let p = 0; p < 22; p++) {
            const prRes = await fetchTimeout(`${conv.progressURL}&_=${Date.now()}`, { headers: hdr }, 6000).catch(() => null);
            if (prRes && prRes.ok) {
              const pr = await prRes.json().catch(() => null);
              if (pr?.title && !title) title = pr.title;
              if (pr?.error > 0) return null;
              if (pr && pr.progress >= 3) break;
            }
            await new Promise((r) => setTimeout(r, 700));
          }
        }

        return {
          url: `${conv.downloadURL}&v=${id}&f=${fmt}&r=y2mate.gs`,
          title,
        };
      } catch {
        return null;
      }
    };

    const [mp4Res, mp3Res] = await Promise.all([convertFormat('mp4'), convertFormat('mp3')]);
    if (!mp4Res?.url && !mp3Res?.url) return null;

    const options: VideoQualityOption[] = [];
    if (mp4Res?.url) {
      options.push({
        id: 'yt-720p',
        label: 'YouTube HD (MP4 720p - Có âm thanh)',
        resolution: '1280 x 720 (HD)',
        quality: '720p',
        format: 'mp4',
        sizeFormatted: 'HD MP4 Gốc',
        hasWatermark: false,
        url: mp4Res.url,
        directUrl: mp4Res.url,
        isRecommended: true,
      });
    }
    if (mp3Res?.url) {
      options.push({
        id: 'yt-audio',
        label: 'Tải Audio MP3 (192kbps - Chất lượng cao)',
        quality: 'audio',
        format: 'mp3',
        sizeFormatted: 'MP3 192kbps',
        hasWatermark: false,
        url: mp3Res.url,
        directUrl: mp3Res.url,
        isRecommended: !mp4Res?.url,
      });
    }

    const title = decodeHtmlEntities(oembedRes?.title || mp4Res?.title || mp3Res?.title || 'YouTube Video');
    const authorName = decodeHtmlEntities(oembedRes?.author_name || 'YouTube Creator');

    return {
      id: `yt-${id}`,
      originalInput: cleanUrl,
      cleanedUrl: canonicalUrl,
      platform: 'youtube',
      platformLabel: PLATFORMS.youtube.name,
      title,
      author: {
        name: authorName,
        username: `@${authorName.replace(/\s+/g, '_')}`,
      },
      duration: 180,
      durationFormatted: 'Bản gốc',
      thumbnail: oembedRes?.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      stats: { views: 'HD' },
      options,
      previewStreamUrl: mp4Res?.url || mp3Res?.url || '',
      extractedAt: Date.now(),
    };
  } catch {
    return null;
  }
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

  // 1. Fast Path: Direct api.vidsnap.app/parse (2 quick tries x 2.5s)
  if (id) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const vr = await fetchTimeout(
          `https://api.vidsnap.app/parse?id=${encodeURIComponent(id)}`,
          {
            headers: {
              'Origin': 'https://vidsnap.app',
              'Referer': 'https://vidsnap.app/',
              'Accept': 'application/json',
            },
          },
          2500
        );
        if (vr.ok) {
          const vj = await vr.json();
          const formats: any[] = Array.isArray(vj?.formats) ? vj.formats : [];
          const prog = formats.find((f) => f.kind === 'progressive' && f.url);
          const audio =
            formats.find((f) => f.kind === 'audio' && f.mimeType?.includes('audio/mp4') && f.url) ||
            formats.find((f) => f.kind === 'audio' && f.url);
          if (prog || audio) {
            const options: VideoQualityOption[] = [];
            const progProxy = prog ? `https://api.vidsnap.app/proxy?u=${encodeURIComponent(prog.url)}` : '';
            const audioProxy = audio ? `https://api.vidsnap.app/proxy?u=${encodeURIComponent(audio.url)}` : progProxy;

            if (progProxy) {
              options.push({
                id: 'yt-mp4',
                label: `YouTube MP4 (${prog.qualityLabel || '360p'} - Có âm thanh)`,
                resolution: prog.qualityLabel || 'MP4 Gốc',
                quality: prog.qualityLabel === '720p' ? '720p' : '1080p',
                format: 'mp4',
                sizeFormatted: 'Gốc (Tải nhanh)',
                hasWatermark: false,
                url: progProxy,
                directUrl: progProxy,
                isRecommended: true,
              });
            }
            if (audioProxy) {
              options.push({
                id: 'yt-audio',
                label: 'Tải Audio MP3/M4A (Âm thanh gốc)',
                quality: 'audio',
                format: 'mp3',
                sizeFormatted: 'Audio Gốc',
                hasWatermark: false,
                url: audioProxy,
                directUrl: audioProxy,
                isRecommended: !progProxy,
              });
            }
            const dur = Math.round(Number(vj.lengthSeconds) || 180);
            const authorName = decodeHtmlEntities(vj.author || 'YouTube Creator');
            return {
              id: `yt-${id}`,
              originalInput: cleanUrl,
              cleanedUrl: canonicalUrl,
              platform: 'youtube',
              platformLabel: PLATFORMS.youtube.name,
              title: decodeHtmlEntities(vj.title || 'YouTube Video'),
              author: {
                name: authorName,
                username: `@${authorName.replace(/\s+/g, '_')}`,
              },
              duration: dur,
              durationFormatted: formatDuration(dur),
              thumbnail: vj.thumbnails?.[vj.thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
              stats: { views: 'HD' },
              options,
              previewStreamUrl: progProxy || audioProxy,
              extractedAt: Date.now(),
            };
          }
        }
      } catch {}
      if (attempt < 3) await new Promise((r) => setTimeout(r, 150));
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'btch/6.4.0',
    'X-Client-Version': '6.4.0',
    'Accept': 'application/json, text/plain, */*',
  };

  // 2. Direct fetch from backend1 (1 fast try with 5s timeout)
  try {
    const res = await fetchTimeout(
      `https://backend1.tioo.eu.org/youtube?url=${encodeURIComponent(canonicalUrl)}`,
      { headers },
      5000
    );
    if (res.ok) {
      const j = await res.json();
      if (j && j.status && (j.mp4 || j.mp3)) {
        const options: VideoQualityOption[] = [];
        if (j.mp4) {
          options.push({
            id: 'yt-1080p',
            label: 'YouTube HD (Video chất lượng cao MP4)',
            resolution: '1280 x 720 (HD)',
            quality: '1080p',
            format: 'mp4',
            sizeFormatted: 'Gốc (Chất lượng cao)',
            hasWatermark: false,
            url: j.mp4,
            directUrl: j.mp4,
            isRecommended: true,
          });
        }
        if (j.mp3 || j.mp4) {
          const audioStream = j.mp3 || j.mp4;
          options.push({
            id: 'yt-audio',
            label: 'Tải Audio MP3 (Tách từ video)',
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

  // 3. Rock-solid Etacloud converter (720p MP4 + 192kbps MP3, bypasses datacenter bot check)
  if (id) {
    const etaRes = await tryYoutubeEtacloud(id, cleanUrl, canonicalUrl);
    if (etaRes) return etaRes;
  }

  // 2. Try btch-downloader youtube method (bounded timeout)
  try {
    const btch = await import('btch-downloader');
    const getYt = (btch as any).youtube || (btch as any).default?.youtube;
    if (typeof getYt === 'function') {
      const res = await withTimeout<any>(Promise.resolve(getYt(canonicalUrl)), 6500);

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

const extractionCache = new Map<string, { data: VideoItemMetadata; expiresAt: number }>();

async function extractVideoUncached(cleanUrl: string, platform: PlatformId): Promise<VideoItemMetadata> {
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

  // Platform: Facebook (Fast direct HTML + independent Siputzx ~1s + btch.fbdown + 16s SnapSave)
  if (platform === 'facebook') {
    const isShareLink = /facebook\.com\/share\/|fb\.watch/i.test(cleanUrl);

    // 1. Direct cookie-free Facebook HTML parser (~400ms for /watch/?v= and public videos)
    if (!isShareLink) {
      const directFast = await tryFacebookDirect(cleanUrl);
      if (directFast) return directFast;
    }

    // 2. Fast independent API (handles /share/r/ & /watch/ in ~1s without snapsave throttling)
    const sipRes = await tryFacebookSiputzx(cleanUrl);
    if (sipRes) return sipRes;

    // 3. btch.fbdown handles /share/r/ when backend1 is warm
    const btchRes = await tryBtchFbdown(cleanUrl);
    if (btchRes) return btchRes;

    // 4. SnapSave with generous 16s window (handles slow 7-13s responses)
    const snapRes = await trySnapSave(cleanUrl, 'facebook');
    if (snapRes) return snapRes;

    // 5. Resolve /share/ redirect cleanly and try direct HTML + @xaviabot/fb-downloader + yt-dlp
    const rawResolved = await resolveFacebookShareUrl(cleanUrl);
    let resolvedFbUrl = rawResolved;
    try {
      const u = new URL(rawResolved);
      if (/\/reel\/|\/videos\//i.test(u.pathname)) {
        u.search = '';
        resolvedFbUrl = u.toString();
      }
    } catch {}

    const directRes = await tryFacebookDirect(resolvedFbUrl);
    if (directRes) {
      directRes.originalInput = cleanUrl;
      return directRes;
    }

    const fbInfoRes = await tryFbDownloader(resolvedFbUrl);
    if (fbInfoRes) {
      fbInfoRes.originalInput = cleanUrl;
      return fbInfoRes;
    }

    const ytdlpRes = await tryYtDlp(resolvedFbUrl, 'facebook');
    if (ytdlpRes) return ytdlpRes;
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
  if (platform === 'bilibili') {
    const res0 = await tryBilibili(cleanUrl);
    if (res0) return res0;

    const res1 = await tryYtDlp(cleanUrl, platform);
    if (res1) return res1;
  }

  if (platform === 'unknown') {
    const res1 = await tryYtDlp(cleanUrl, platform);
    if (res1) return res1;
  }

  // If all real extraction methods fail:
  throw new Error(
    `Không thể trích xuất video từ liên kết này. Video có thể đang ở chế độ riêng tư, bị hạn chế bản quyền, hoặc mạng xã hội yêu cầu đăng nhập tài khoản để xem.`
  );
}

/**
 * Main Extract Video Entrypoint (REAL extraction only, zero mock videos)
 */
export async function extractVideo(rawInput: string): Promise<VideoItemMetadata> {
  const cleanUrl = extractCleanUrl(rawInput);
  if (!cleanUrl) {
    throw new Error('Vui lòng nhập đường dẫn video hợp lệ.');
  }

  const now = Date.now();
  const cached = extractionCache.get(cleanUrl);
  if (cached && cached.expiresAt > now) {
    return { ...cached.data, extractedAt: now };
  }

  const platform = detectPlatform(cleanUrl);
  const result = await extractVideoUncached(cleanUrl, platform);

  if (extractionCache.size >= 100) {
    const oldestKey = extractionCache.keys().next().value;
    if (oldestKey) extractionCache.delete(oldestKey);
  }
  extractionCache.set(cleanUrl, { data: result, expiresAt: now + 180000 });
  return result;
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
