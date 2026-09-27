package in.sih26238.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 41001;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String appUrl;

    @SuppressLint({"SetJavaScriptEnabled"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        appUrl = sanitizeUrl(BuildConfig.STUDENT_APP_URL);

        webView = new WebView(this);
        setContentView(webView);
        configureWebView();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            loadApp();
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString() + " SIH26238Mobile/25");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.setBackgroundColor(0xFFF8FAFC);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setWebViewClient(new SihWebViewClient());
        webView.setWebChromeClient(new SihChromeClient());
        webView.setDownloadListener(new SihDownloadListener());
    }

    private void loadApp() {
        String url = appUrl;
        if (!BuildConfig.MOBILE_OPS_URL.isEmpty() || !BuildConfig.MOBILE_VERIFICATION_URL.isEmpty()) {
            url = appendQuery(url,
                    "sihMobileOps", BuildConfig.MOBILE_OPS_URL,
                    "sihMobileVerification", BuildConfig.MOBILE_VERIFICATION_URL);
        }
        webView.loadUrl(url);
    }

    private String appendQuery(String base, String k1, String v1, String k2, String v2) {
        List<String> parts = new ArrayList<>();
        if (v1 != null && !v1.isEmpty()) parts.add(Uri.encode(k1) + "=" + Uri.encode(v1));
        if (v2 != null && !v2.isEmpty()) parts.add(Uri.encode(k2) + "=" + Uri.encode(v2));
        if (parts.isEmpty()) return base;
        return base + (base.contains("?") ? "&" : "?") + String.join("&", parts);
    }

    private String sanitizeUrl(String raw) {
        String url = raw == null ? "" : raw.trim();
        if (url.startsWith("https://") || url.startsWith("http://")) return url;
        return "about:blank";
    }

    private void openExternalScheme(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No compatible app is installed for this link.", Toast.LENGTH_SHORT).show();
        }
    }

    private void loadOfflinePage() {
        try (InputStream in = getAssets().open("offline.html");
             BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            StringBuilder html = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) html.append(line).append('\n');
            String quoted = "'" + appUrl.replace("\\", "\\\\").replace("'", "\\'") + "'";
            webView.loadDataWithBaseURL(appUrl, html.toString().replace("__START_URL__", quoted), "text/html", "UTF-8", appUrl);
        } catch (IOException ignored) {
            webView.loadData("<h3 style='font-family:sans-serif;text-align:center;margin-top:40vh'>SIH26238 is offline.</h3>", "text/html", "UTF-8");
        }
    }

    private class SihWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
            if ("http".equals(scheme) || "https".equals(scheme)) {
                // Keep HTTPS/HTTP web navigation inside the app. This is important for
                // DigiLocker-style OAuth redirects and for preserving the web app's session.
                return false;
            }
            if ("intent".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)
                    || "upi".equals(scheme) || "whatsapp".equals(scheme)) {
                openExternalScheme(uri);
                return true;
            }
            return false;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request.isForMainFrame()) loadOfflinePage();
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
        }
    }

    private class SihChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                         FileChooserParams fileChooserParams) {
            if (filePathCallback != null) filePathCallback.onReceiveValue(null);
            filePathCallback = callback;

            Intent chooser = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            chooser.addCategory(Intent.CATEGORY_OPENABLE);
            chooser.setType("*/*");
            chooser.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);

            String[] acceptTypes = fileChooserParams.getAcceptTypes();
            if (acceptTypes != null) {
                ArrayList<String> mimeTypes = new ArrayList<>();
                for (String type : acceptTypes) {
                    if (type != null && !type.trim().isEmpty()) mimeTypes.add(type.trim());
                }
                if (!mimeTypes.isEmpty()) {
                    chooser.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toArray(new String[0]));
                }
            }

            try {
                startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
            } catch (ActivityNotFoundException e) {
                filePathCallback = null;
                callback.onReceiveValue(null);
                Toast.makeText(MainActivity.this, "No file picker is available.", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
            Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
            result.cancel();
            return true;
        }
    }

    private class SihDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition,
                                    String mimeType, long contentLength) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (ActivityNotFoundException e) {
                Toast.makeText(MainActivity.this, "No app can open this download.", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;

        Uri[] results = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) results[i] = data.getClipData().getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
