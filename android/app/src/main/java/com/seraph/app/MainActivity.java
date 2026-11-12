package com.seraph.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.DownloadListener;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        // Handle Download in Native Android DownloadManager
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType != null && !mimeType.isEmpty() ? mimeType : "video/mp4");
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    request.setTitle("Seraph: " + fileName);
                    request.setDescription("Seraph đang tải video chất lượng cao không logo...");
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);
                        Toast.makeText(MainActivity.this, "Bắt đầu tải về: " + fileName, Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Lỗi tải: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
        });

        // Expose Android Native Bridge to Javascript for 100% Reliable Download & Clipboard & Native HTTP
        webView.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public String getClipboardText() {
                final String[] result = new String[]{""};
                try {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                                if (cm != null && cm.hasPrimaryClip() && cm.getPrimaryClip().getItemCount() > 0) {
                                    CharSequence text = cm.getPrimaryClip().getItemAt(0).coerceToText(MainActivity.this);
                                    if (text != null) {
                                        result[0] = text.toString();
                                        String script = String.format("javascript:window.__handleNativePastedText && window.__handleNativePastedText('%s')", text.toString().replace("'", "\\'").replace("\n", " "));
                                        webView.evaluateJavascript(script, null);
                                    }
                                }
                            } catch (Exception ignored) {}
                        }
                    });
                } catch (Exception ignored) {}
                return result[0];
            }

            @android.webkit.JavascriptInterface
            public void downloadFile(final String url, final String filename, final String mimeType) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                            request.setMimeType(mimeType != null && !mimeType.isEmpty() ? mimeType : "video/mp4");
                            request.setTitle("Seraph: " + filename);
                            request.setDescription("Đang tải video chất lượng cao không logo...");
                            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                            if (dm != null) {
                                dm.enqueue(request);
                                Toast.makeText(MainActivity.this, "Đã bắt đầu tải về: " + filename, Toast.LENGTH_SHORT).show();
                            }
                        } catch (Exception e) {
                            Toast.makeText(MainActivity.this, "Lỗi tải: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    }
                });
            }

            @android.webkit.JavascriptInterface
            public String nativeFetch(final String targetUrl, final String method, final String userAgent, final String headersJson) {
                try {
                    java.net.URL url = new java.net.URL(targetUrl);
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestMethod(method != null ? method : "GET");
                    conn.setConnectTimeout(12000);
                    conn.setReadTimeout(18000);
                    conn.setInstanceFollowRedirects(true);
                    if (userAgent != null && !userAgent.isEmpty()) {
                        conn.setRequestProperty("User-Agent", userAgent);
                    } else {
                        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0.0.0 Safari/537.36");
                    }
                    if (headersJson != null && !headersJson.isEmpty()) {
                        try {
                            org.json.JSONObject headers = new org.json.JSONObject(headersJson);
                            java.util.Iterator<String> keys = headers.keys();
                            while (keys.hasNext()) {
                                String key = keys.next();
                                conn.setRequestProperty(key, headers.getString(key));
                            }
                        } catch (Exception ignored) {}
                    }
                    int responseCode = conn.getResponseCode();
                    java.io.InputStream in = (responseCode >= 200 && responseCode < 400) ? conn.getInputStream() : conn.getErrorStream();
                    if (in == null) return "{\"status\":" + responseCode + ",\"body\":\"\"}";
                    java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(in, "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    reader.close();
                    org.json.JSONObject result = new org.json.JSONObject();
                    result.put("status", responseCode);
                    result.put("body", sb.toString());
                    result.put("finalUrl", conn.getURL().toString());
                    return result.toString();
                } catch (Exception e) {
                    return "{\"status\": 500, \"error\": \"" + (e.getMessage() != null ? e.getMessage().replace("\"", "\\\"") : "Network error") + "\"}";
                }
            }
        }, "AndroidBridge");

        // Load local asset or web URL
        webView.loadUrl("file:///android_asset/www/index.html");

        // Handle intent from Share menu
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (sharedText != null && webView != null) {
                String script = String.format("javascript:window.__handleIncomingShare && window.__handleIncomingShare('%s')", sharedText.replace("'", "\\'"));
                webView.evaluateJavascript(script, null);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
