/**
 * In-memory client downloader for the HTML5 APK-ready ZIP.
 * Has index.html at root, ready to upload directly to online APK converter sites.
 */
export async function downloadApkReadyZip(): Promise<void> {
  const { APK_READY_ZIP_BASE64 } = await import('./apkReadyZipBundle.ts');

  const binaryString = atob(APK_READY_ZIP_BASE64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: 'application/zip' });
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = 'omnisnap-apk-ready.zip';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  }, 2000);
}
