/**
 * Client-side download for Android Studio project ZIP & Full Source ZIP
 * Fetches the ZIP binary via authorized iframe session and triggers local Blob download
 * to completely eliminate "Site wasn't available" errors in browser.
 */

export async function downloadFileViaBlob(url: string, filename: string): Promise<void> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Tải file thất bại (HTTP ${resp.status})`);
  }
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('Phản hồi server không phải file ZIP');
  }
  const blob = await resp.blob();
  if (blob.size < 50000) {
    throw new Error('Dung lượng file tải về không đúng');
  }
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {}
  }, 10000);
}

export async function downloadAndroidZipInBrowser(): Promise<void> {
  try {
    await downloadFileViaBlob('/seraph-android-project.zip', 'seraph-android-project.zip');
  } catch (err) {
    console.warn('Static zip download failed, trying API:', err);
    await downloadFileViaBlob('/api/download-source', 'seraph-android-project.zip');
  }
}

export async function downloadFullSourceZipInBrowser(): Promise<void> {
  try {
    await downloadFileViaBlob('/seraph-full-source.zip', 'seraph-full-source.zip');
  } catch (err) {
    console.warn('Static zip download failed, trying API:', err);
    await downloadFileViaBlob('/api/download-full-source', 'seraph-full-source.zip');
  }
}

export async function downloadWebDistZipInBrowser(): Promise<void> {
  try {
    await downloadFileViaBlob('/seraph-web-dist.zip', 'seraph-web-dist.zip');
  } catch (err) {
    console.warn('Static zip download failed, trying API:', err);
    await downloadFileViaBlob('/api/download-web-dist', 'seraph-web-dist.zip');
  }
}
