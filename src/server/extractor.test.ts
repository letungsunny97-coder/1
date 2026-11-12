import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVideo, generatePlatformFallback } from './extractor.ts';

test('generatePlatformFallback creates valid video metadata for all platforms', () => {
  const platforms = ['douyin', 'tiktok', 'facebook', 'x', 'instagram', 'bilibili'] as const;

  for (const p of platforms) {
    const meta = generatePlatformFallback(`https://${p}.com/test`, p);
    assert.equal(meta.platform, p);
    assert.ok(meta.title.length > 0, `${p} has title`);
    assert.ok(meta.author.name.length > 0, `${p} has author name`);
    assert.ok(meta.options.length >= 2, `${p} has multiple download options`);
    assert.ok(meta.options.some((o: any) => o.hasWatermark === false), `${p} has no-watermark option`);
    assert.ok(meta.options.some((o: any) => o.quality === 'audio'), `${p} has audio option`);
    assert.ok(meta.previewStreamUrl.startsWith('http'), `${p} has playable preview url`);
  }
});

test('extractVideo rejects empty input', async () => {
  await assert.rejects(
    async () => {
      await extractVideo('');
    },
    { message: /Vui lòng nhập đường dẫn/ }
  );
});

test('extractVideo returns structured result for test URL', async () => {
  const result = await extractVideo('https://www.facebook.com/watch/?v=10153231379946729');
  assert.equal(result.platform, 'facebook');
  assert.ok(result.options.length > 0);
  assert.ok(result.options.some((opt) => opt.format === 'mp4'));
});
