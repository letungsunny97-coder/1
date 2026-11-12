import type { Plugin } from 'vite';
import { extractVideo } from './extractor.ts';
import { PLATFORMS } from '../utils/detector.ts';

export function videoApiPlugin(): Plugin {
  return {
    name: 'video-downloader-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlObj = new URL(req.url || '/', 'http://localhost:3000');
        const pathname = urlObj.pathname;

        // Enable CORS for Android APK & Web clients
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        // Download Android Studio project archive (.zip)
        if (pathname === '/api/download-source') {
          const fs = await import('fs');
          const path = await import('path');
          const zipPath = path.resolve(process.cwd(), 'public/seraph-android-project.zip');
          if (fs.existsSync(zipPath)) {
            const stat = fs.statSync(zipPath);
            res.writeHead(200, {
              'Content-Type': 'application/zip',
              'Content-Length': stat.size,
              'Content-Disposition': 'attachment; filename="seraph-android-project.zip"',
            });
            const stream = fs.createReadStream(zipPath);
            stream.pipe(res);
            return;
          }
        }

        // Download entire project full source code (.zip)
        if (pathname === '/api/download-full-source') {
          const fs = await import('fs');
          const path = await import('path');
          const zipPath = path.resolve(process.cwd(), 'public/seraph-full-source.zip');
          if (fs.existsSync(zipPath)) {
            const stat = fs.statSync(zipPath);
            res.writeHead(200, {
              'Content-Type': 'application/zip',
              'Content-Length': stat.size,
              'Content-Disposition': 'attachment; filename="seraph-full-source.zip"',
            });
            const stream = fs.createReadStream(zipPath);
            stream.pipe(res);
            return;
          }
        }

        // Download Web Production Build package (.zip)
        if (pathname === '/api/download-web-dist') {
          const fs = await import('fs');
          const path = await import('path');
          const zipPath = path.resolve(process.cwd(), 'public/seraph-web-dist.zip');
          if (fs.existsSync(zipPath)) {
            const stat = fs.statSync(zipPath);
            res.writeHead(200, {
              'Content-Type': 'application/zip',
              'Content-Length': stat.size,
              'Content-Disposition': 'attachment; filename="seraph-web-dist.zip"',
            });
            const stream = fs.createReadStream(zipPath);
            stream.pipe(res);
            return;
          }
        }

        // Health check
        if (pathname === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', time: Date.now() }));
          return;
        }

        // Get sample links for all 6 platforms
        if (pathname === '/api/samples') {
          res.setHeader('Content-Type', 'application/json');
          const samples = Object.values(PLATFORMS)
            .filter((p) => p.id !== 'unknown')
            .map((p) => ({
              platform: p.id,
              name: p.name,
              sampleUrl: p.sampleUrl,
              sampleTitle: p.sampleTitle,
              maxQuality: p.maxQuality,
            }));
          res.end(JSON.stringify({ success: true, samples }));
          return;
        }

        // Extract video endpoint
        if (pathname === '/api/extract' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });

          req.on('end', async () => {
            try {
              const { url } = JSON.parse(bodyStr || '{}');
              if (!url || typeof url !== 'string') {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Thiếu đường dẫn video.' }));
                return;
              }

              const result = await extractVideo(url);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, data: result }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: err?.message || 'Không thể quét liên kết video. Vui lòng kiểm tra lại liên kết.',
                })
              );
            }
          });
          return;
        }

        // Proxy download endpoint to avoid CORS / Referer / 403 Forbidden issues
        if (pathname === '/api/proxy-download' && req.method === 'GET') {
          const targetUrl = urlObj.searchParams.get('url');
          const filename = urlObj.searchParams.get('filename') || 'seraph-video.mp4';
          const format = urlObj.searchParams.get('format') || 'mp4';

          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }

          try {
            // Determine spoofed referer based on target URL
            let referer = 'https://www.google.com';
            if (targetUrl.includes('douyin') || targetUrl.includes('amemv')) {
              referer = 'https://www.douyin.com/';
            } else if (targetUrl.includes('tiktok')) {
              referer = 'https://www.tiktok.com/';
            } else if (targetUrl.includes('bilibili') || targetUrl.includes('bilivideo')) {
              referer = 'https://www.bilibili.com/';
            } else if (targetUrl.includes('instagram') || targetUrl.includes('cdninstagram')) {
              referer = 'https://www.instagram.com/';
            } else if (targetUrl.includes('fbcdn') || targetUrl.includes('facebook')) {
              referer = 'https://www.facebook.com/';
            } else if (targetUrl.includes('twimg') || targetUrl.includes('twitter')) {
              referer = 'https://twitter.com/';
            } else if (targetUrl.includes('xiaohongshu') || targetUrl.includes('xhscdn')) {
              referer = 'https://www.xiaohongshu.com/';
            } else if (targetUrl.includes('youtube') || targetUrl.includes('googlevideo') || targetUrl.includes('vidsnap')) {
              referer = 'https://www.youtube.com/';
            }

            const response = await fetch(targetUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                Referer: referer,
                Accept: '*/*',
              },
            });

            if (!response.ok && response.status !== 206) {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Không thể kết nối đến máy chủ chứa video.' }));
              return;
            }

            const contentType =
              response.headers.get('content-type') ||
              (format === 'mp3' ? 'audio/mpeg' : format === 'jpg' ? 'image/jpeg' : 'video/mp4');

            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
              'Cache-Control': 'no-cache',
              'Access-Control-Allow-Origin': '*',
            });

            if (response.body) {
              const reader = response.body.getReader();
              const stream = async () => {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  res.write(value);
                }
                res.end();
              };
              stream().catch(() => res.end());
            } else {
              res.end();
            }
          } catch {
            res.statusCode = 500;
            res.end('Download error');
          }
          return;
        }

        next();
      });
    },
  };
}
