import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractVideo } from './src/server/extractor.ts';
import { PLATFORMS } from './src/utils/detector.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable CORS for Android APK & Web clients
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// API: Download Android Studio project package (.zip)
app.get('/api/download-source', (_req, res) => {
  const zipPath = path.resolve(__dirname, 'public/seraph-android-project.zip');
  res.download(zipPath, 'seraph-android-project.zip');
});

// API: Download entire project source code (.zip)
app.get('/api/download-full-source', (_req, res) => {
  const zipPath = path.resolve(__dirname, 'public/seraph-full-source.zip');
  res.download(zipPath, 'seraph-full-source.zip');
});

// API: Download Web Production Build package (.zip)
app.get('/api/download-web-dist', (_req, res) => {
  const zipPath = path.resolve(__dirname, 'public/seraph-web-dist.zip');
  res.download(zipPath, 'seraph-web-dist.zip');
});

// API: Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

// API: Get sample links
app.get('/api/samples', (_req, res) => {
  const samples = Object.values(PLATFORMS)
    .filter((p) => p.id !== 'unknown')
    .map((p) => ({
      platform: p.id,
      name: p.name,
      sampleUrl: p.sampleUrl,
      sampleTitle: p.sampleTitle,
      maxQuality: p.maxQuality,
    }));
  res.json({ success: true, samples });
});

// API: Extract video endpoint
app.post('/api/extract', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'Thiếu đường dẫn video.' });
      return;
    }

    const result = await extractVideo(url);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Không thể quét liên kết video. Vui lòng kiểm tra lại liên kết.',
    });
  }
});

// API: Proxy download endpoint to bypass CORS and Referer restrictions
app.get('/api/proxy-download', async (req, res) => {
  const targetUrl = req.query.url as string;
  const filename = (req.query.filename as string) || 'seraph-video.mp4';
  const format = (req.query.format as string) || 'mp4';

  if (!targetUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
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
      res.status(502).json({ error: 'Không thể tải luồng video trực tiếp từ nguồn.' });
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }
  } catch {
    res.status(500).send('Download error');
  }
});

// Serve frontend static build files
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback all routes to index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${PORT}`);
});
