/**
 * Utility to download the full app ZIP bundle directly from memory in browser.
 * Bypasses all server redirects, auth cookies, or Cloud Run 302/404 issues.
 */
export async function downloadZipInBrowser(): Promise<void> {
  const { ZIP_BASE64 } = await import('./zipBundle.ts');

  // Convert Base64 to ArrayBuffer
  const binaryString = atob(ZIP_BASE64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create real ZIP Blob
  const blob = new Blob([bytes], { type: 'application/zip' });
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = 'omnisnap-video-downloader.zip';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 2000);
}
