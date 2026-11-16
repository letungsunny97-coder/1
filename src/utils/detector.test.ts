import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCleanUrl,
  detectPlatform,
  extractResourceId,
  formatBytes,
  formatDuration,
  formatStatNumber,
  PLATFORMS,
} from './detector.ts';

test('detectPlatform identifies all 6 required platforms correctly', () => {
  // Douyin
  assert.equal(detectPlatform('https://v.douyin.com/i8Kq7W8/'), 'douyin');
  assert.equal(detectPlatform('https://www.douyin.com/video/734291827491'), 'douyin');
  assert.equal(detectPlatform('https://www.iesdouyin.com/share/video/734291827491'), 'douyin');

  // TikTok
  assert.equal(detectPlatform('https://www.tiktok.com/@user/video/729182736451'), 'tiktok');
  assert.equal(detectPlatform('https://vt.tiktok.com/ZS6M8d9qa/'), 'tiktok');

  // Xiaohongshu (Tiểu Hồng Thư)
  assert.equal(detectPlatform('http://xhslink.com/a/abcdef'), 'xiaohongshu');
  assert.equal(detectPlatform('https://www.xiaohongshu.com/explore/654877f2000000003201416e'), 'xiaohongshu');
  assert.equal(detectPlatform('https://www.xiaohongshu.com/discovery/item/654877f2000000003201416e'), 'xiaohongshu');

  // Facebook
  assert.equal(detectPlatform('https://fb.watch/mG7Xw9KLpq/'), 'facebook');
  assert.equal(detectPlatform('https://www.facebook.com/reel/123456789'), 'facebook');
  assert.equal(detectPlatform('https://www.facebook.com/watch/?v=987654321'), 'facebook');
  assert.equal(detectPlatform('https://www.facebook.com/share/v/1JEX9aVaex/'), 'facebook');
  assert.equal(detectPlatform('https://www.facebook.com/share/r/1JEX9aVaex/'), 'facebook');

  // X (Twitter)
  assert.equal(detectPlatform('https://x.com/SpaceX/status/1768262705573425514'), 'x');
  assert.equal(detectPlatform('https://twitter.com/NASA/status/1768262705573425514'), 'x');

  // Instagram
  assert.equal(detectPlatform('https://www.instagram.com/reel/C3x99KLsF9z/'), 'instagram');
  assert.equal(detectPlatform('https://instagram.com/p/C3x99KLsF9z/'), 'instagram');

  // Bilibili
  assert.equal(detectPlatform('https://www.bilibili.com/video/BV1xx411c7mD'), 'bilibili');
  assert.equal(detectPlatform('https://b23.tv/abcd123'), 'bilibili');

  // YouTube
  assert.equal(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'youtube');

  // Unknown
  assert.equal(detectPlatform('https://example.com/video.mp4'), 'unknown');
  assert.equal(detectPlatform(''), 'unknown');
});

test('extractCleanUrl handles messy mobile copy-paste share text', () => {
  // Douyin mobile share format
  const douyinShareText = '7.35 复制打开抖音，看看【小猫咪吃鱼的样子】 https://v.douyin.com/i8Kq7W8/ d@g.OY 01/24';
  assert.equal(extractCleanUrl(douyinShareText), 'https://v.douyin.com/i8Kq7W8/');

  // TikTok mobile share format
  const tiktokShareText = 'Check out this awesome dance trend! https://vt.tiktok.com/ZS6M8d9qa/ see more';
  assert.equal(extractCleanUrl(tiktokShareText), 'https://vt.tiktok.com/ZS6M8d9qa/');

  // Bare domain without https
  assert.equal(extractCleanUrl('tiktok.com/@user/video/123456'), 'https://tiktok.com/@user/video/123456');

  // Clean URL with trailing punctuation
  assert.equal(extractCleanUrl('https://x.com/user/status/123456。'), 'https://x.com/user/status/123456');
  assert.equal(extractCleanUrl('https://instagram.com/p/ABC123/,'), 'https://instagram.com/p/ABC123/');

  // Quoted URLs from mobile copy paste
  assert.equal(extractCleanUrl("'www.facebook.com/share/v/1DFrxGeZf8/'"), 'https://www.facebook.com/share/v/1DFrxGeZf8/');
  assert.equal(extractCleanUrl("'https://www.facebook.com/share/v/1DFrxGeZf8/'"), 'https://www.facebook.com/share/v/1DFrxGeZf8/');
  assert.equal(extractCleanUrl('"www.facebook.com/share/v/1DFrxGeZf8/"'), 'https://www.facebook.com/share/v/1DFrxGeZf8/');
});

test('extractResourceId extracts platform IDs correctly', () => {
  assert.equal(extractResourceId('https://www.tiktok.com/@creator/video/734291827491', 'tiktok'), '734291827491');
  assert.equal(extractResourceId('https://www.douyin.com/video/718293049182', 'douyin'), '718293049182');
  assert.equal(extractResourceId('https://x.com/NASA/status/1768262705573425514', 'x'), '1768262705573425514');
  assert.equal(extractResourceId('https://www.instagram.com/reel/C3x99KLsF9z/', 'instagram'), 'C3x99KLsF9z');
  assert.equal(extractResourceId('https://www.bilibili.com/video/BV1xx411c7mD', 'bilibili'), 'BV1xx411c7mD');
  assert.equal(extractResourceId('https://www.facebook.com/reel/123456789', 'facebook'), '123456789');
  assert.equal(extractResourceId('https://www.facebook.com/share/v/1JEX9aVaex/', 'facebook'), '1JEX9aVaex');
  assert.equal(extractResourceId('https://www.xiaohongshu.com/explore/654877f2000000003201416e', 'xiaohongshu'), '654877f2000000003201416e');
  assert.equal(extractResourceId('http://xhslink.com/a/abcdef', 'xiaohongshu'), 'abcdef');
  assert.equal(detectPlatform('http://xhslink.com/o/2jYOikcHNUF'), 'xiaohongshu');
  assert.equal(extractResourceId('http://xhslink.com/o/2jYOikcHNUF', 'xiaohongshu'), '2jYOikcHNUF');
  assert.equal(detectPlatform('https://www.facebook.com/share/r/19o9JjmEjm/'), 'facebook');
  assert.equal(extractResourceId('https://www.facebook.com/share/r/19o9JjmEjm/', 'facebook'), '19o9JjmEjm');
  assert.equal(detectPlatform('https://www.youtube.com/watch?v=Qw5eFJzQ-ts&list=RDSwuiiBKXVfc&index=13'), 'youtube');
  assert.equal(extractResourceId('https://www.youtube.com/watch?v=Qw5eFJzQ-ts&list=RDSwuiiBKXVfc&index=13', 'youtube'), 'Qw5eFJzQ-ts');
  assert.equal(extractResourceId('https://www.youtube.com/live/dQw4w9WgXcQ?si=abc', 'youtube'), 'dQw4w9WgXcQ');
  assert.equal(extractResourceId('https://youtu.be/dQw4w9WgXcQ', 'youtube'), 'dQw4w9WgXcQ');
  assert.equal(extractResourceId('https://www.youtube.com/shorts/dQw4w9WgXcQ', 'youtube'), 'dQw4w9WgXcQ');
});

test('formatBytes formats file sizes appropriately', () => {
  assert.equal(formatBytes(0), 'Tự động');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(15 * 1024 * 1024), '15 MB');
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), '1.5 GB');
});

test('formatDuration formats seconds into clock display', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(45), '00:45');
  assert.equal(formatDuration(135), '02:15');
  assert.equal(formatDuration(3665), '1:01:05');
});

test('formatStatNumber formats compact numbers', () => {
  assert.equal(formatStatNumber(500), '500');
  assert.equal(formatStatNumber(15400), '15.4K');
  assert.equal(formatStatNumber(2300000), '2.3M');
  assert.equal(formatStatNumber(1500000000), '1.5B');
});

test('PLATFORMS registry has configurations for all 8 target platforms', () => {
  const targetKeys = ['youtube', 'douyin', 'tiktok', 'xiaohongshu', 'facebook', 'x', 'instagram', 'bilibili'];
  for (const key of targetKeys) {
    const p = PLATFORMS[key as keyof typeof PLATFORMS];
    assert.ok(p, `Platform ${key} exists`);
    assert.ok(p.name, `Platform ${key} has name`);
    assert.ok(p.sampleUrl, `Platform ${key} has sampleUrl`);
    assert.ok(p.supportsNoWatermark, `Platform ${key} supports no watermark`);
  }
});
