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
    private static final String MOBILE_BUILD_TAG = "25.0.2";

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

        /*
         * Always load the production app fresh.
         *
         * We deliberately do not restore WebView state here because an old
         * restored state can retain an outdated runtime API configuration.
         */
        loadApp();
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
        settings.setMixedContentMode(
                WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        );

        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        settings.setUserAgentString(
                settings.getUserAgentString()
                        + " SIH26238Mobile/"
                        + MOBILE_BUILD_TAG
        );

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(
                webView,
                true
        );

        webView.setBackgroundColor(0xFFF8FAFC);
        webView.setOverScrollMode(
                View.OVER_SCROLL_NEVER
        );

        webView.setWebViewClient(
                new SihWebViewClient()
        );

        webView.setWebChromeClient(
                new SihChromeClient()
        );

        webView.setDownloadListener(
                new SihDownloadListener()
        );
    }

    private void loadApp() {
        /*
         * Remove stale cached web resources while keeping cookies and
         * localStorage intact.
         */
        webView.clearCache(true);
        webView.clearHistory();

        String url = appUrl;

        List<String> queryParts = new ArrayList<>();

        if (!BuildConfig.MOBILE_OPS_URL.isEmpty()) {
            queryParts.add(
                    Uri.encode("sihMobileOps")
                            + "="
                            + Uri.encode(
                            BuildConfig.MOBILE_OPS_URL
                    )
            );
        }

        if (!BuildConfig.MOBILE_VERIFICATION_URL.isEmpty()) {
            queryParts.add(
                    Uri.encode("sihMobileVerification")
                            + "="
                            + Uri.encode(
                            BuildConfig.MOBILE_VERIFICATION_URL
                    )
            );
        }

        queryParts.add(
                Uri.encode("sihMobileBuild")
                        + "="
                        + Uri.encode(MOBILE_BUILD_TAG)
        );

        if (!queryParts.isEmpty()) {
            url =
                    url
                            + (url.contains("?") ? "&" : "?")
                            + String.join("&", queryParts);
        }

        webView.loadUrl(url);
    }

    /**
     * Hardens the Android wrapper against stale/wrong frontend API routing.
     *
     * The hosted Student App remains the UI authority, but Android must never
     * silently send API calls to localhost or an obsolete Operations service.
     *
     * This guard:
     * - pins the production Operations URL in localStorage;
     * - pins the production Verification URL in localStorage;
     * - rewrites /api/v1 requests from localhost or another origin to the
     *   exact production Operations service;
     * - patches both fetch() and XMLHttpRequest.
     */
    private void installProductionApiGuard(WebView view) {
        final String operationsUrl =
                jsQuote(BuildConfig.MOBILE_OPS_URL);

        final String verificationUrl =
                jsQuote(BuildConfig.MOBILE_VERIFICATION_URL);

        String script =
                "(function(){"
                        + "try{"

                        + "var OPS="
                        + operationsUrl
                        + ";"

                        + "var VER="
                        + verificationUrl
                        + ";"

                        + "var OPS_ORIGIN="
                        + "new URL(OPS).origin;"
                        + ""

                        + "localStorage.setItem("
                        + "'sih26238.runtime.rijvan_api_url',"
                        + "OPS"
                        + ");"

                        + "localStorage.setItem("
                        + "'sih26238.runtime.verification_api_url',"
                        + "VER"
                        + ");"

                        + "window.__SIH26238_NATIVE_CONFIG__="
                        + "{"
                        + "operations:OPS,"
                        + "verification:VER,"
                        + "build:'"
                        + MOBILE_BUILD_TAG
                        + "'"
                        + "};"

                        + "function rewriteUrl(raw){"
                        + "try{"

                        + "if(!raw)return raw;"

                        + "var u="
                        + "new URL("
                        + "String(raw),"
                        + "window.location.href"
                        + ");"

                        + "var path=u.pathname||'';"

                        + "var isApiV1="
                        + "path.indexOf('/api/v1/')===0"
                        + "||path==='/api/v1';"

                        + "var host="
                        + "(u.hostname||'').toLowerCase();"

                        + "var isLocal="
                        + "host==='localhost'"
                        + "||host==='127.0.0.1'"
                        + "||host==='0.0.0.0';"

                        + "if("
                        + "isApiV1"
                        + "&&"
                        + "(isLocal||u.origin!==OPS_ORIGIN)"
                        + "){"

                        + "var suffix="
                        + "path.indexOf('/api/v1')===0"
                        + "?path.substring(7)"
                        + ":path;"

                        + "return OPS+suffix+u.search;"
                        + "}"

                        + "}catch(e){}"

                        + "return String(raw);"
                        + "}"

                        + "if(!window.__SIH26238_FETCH_GUARD__){"

                        + "var nativeFetch="
                        + "window.fetch.bind(window);"

                        + "window.fetch="
                        + "function(input,init){"

                        + "try{"

                        + "var raw="
                        + "input&&input.url"
                        + "?input.url"
                        + ":String(input||'');"

                        + "var rewritten="
                        + "rewriteUrl(raw);"

                        + "if("
                        + "rewritten!==raw"
                        + "&&"
                        + "typeof Request!=='undefined'"
                        + "&&"
                        + "input instanceof Request"
                        + "){"

                        + "return nativeFetch("
                        + "new Request(rewritten,input),"
                        + "init"
                        + ");"
                        + "}"

                        + "return nativeFetch("
                        + "rewritten,"
                        + "init"
                        + ");"

                        + "}catch(e){"

                        + "return nativeFetch(input,init);"

                        + "}"
                        + "};"

                        + "if("
                        + "typeof XMLHttpRequest!=='undefined'"
                        + "){"

                        + "var nativeOpen="
                        + "XMLHttpRequest.prototype.open;"

                        + "XMLHttpRequest.prototype.open="
                        + "function(){"

                        + "try{"

                        + "if(arguments.length>1){"

                        + "arguments[1]="
                        + "rewriteUrl(arguments[1]);"

                        + "}"

                        + "}catch(e){}"

                        + "return nativeOpen.apply("
                        + "this,"
                        + "arguments"
                        + ");"
                        + "};"

                        + "}"

                        + "window.__SIH26238_FETCH_GUARD__=true;"

                        + "}"

                        + "}catch(e){}"
                        + "})();";

        view.evaluateJavascript(
                script,
                null
        );
    }

    private String jsQuote(String value) {
        if (value == null) {
            return "\"\"";
        }

        return "\""
                + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "\\r")
                .replace("\n", "\\n")
                + "\"";
    }

    private String sanitizeUrl(String raw) {
        String url = raw == null
                ? ""
                : raw.trim();

        if (
                url.startsWith("https://")
                        || url.startsWith("http://")
        ) {
            return url;
        }

        return "about:blank";
    }

    private void openExternalScheme(Uri uri) {
        try {
            startActivity(
                    new Intent(
                            Intent.ACTION_VIEW,
                            uri
                    )
            );
        } catch (ActivityNotFoundException e) {
            Toast.makeText(
                    this,
                    "No compatible app is installed for this link.",
                    Toast.LENGTH_SHORT
            ).show();
        }
    }

    private void loadOfflinePage() {
        try (
                InputStream in =
                        getAssets().open("offline.html");

                BufferedReader reader =
                        new BufferedReader(
                                new InputStreamReader(
                                        in,
                                        StandardCharsets.UTF_8
                                )
                        )
        ) {
            StringBuilder html =
                    new StringBuilder();

            String line;

            while (
                    (line = reader.readLine())
                            != null
            ) {
                html.append(line)
                        .append('\n');
            }

            String quoted =
                    "'"
                            + appUrl
                            .replace("\\", "\\\\")
                            .replace("'", "\\'")
                            + "'";

            webView.loadDataWithBaseURL(
                    appUrl,
                    html.toString()
                            .replace(
                                    "__START_URL__",
                                    quoted
                            ),
                    "text/html",
                    "UTF-8",
                    appUrl
            );

        } catch (IOException ignored) {
            webView.loadData(
                    "<h3 style='font-family:sans-serif;text-align:center;margin-top:40vh'>SIH26238 is offline.</h3>",
                    "text/html",
                    "UTF-8"
            );
        }
    }

    private class SihWebViewClient
            extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(
                WebView view,
                WebResourceRequest request
        ) {
            Uri uri =
                    request.getUrl();

            String scheme =
                    uri.getScheme() == null
                            ? ""
                            : uri.getScheme()
                            .toLowerCase();

            if (
                    "http".equals(scheme)
                            || "https".equals(scheme)
            ) {
                return false;
            }

            if (
                    "intent".equals(scheme)
                            || "mailto".equals(scheme)
                            || "tel".equals(scheme)
                            || "upi".equals(scheme)
                            || "whatsapp".equals(scheme)
            ) {
                openExternalScheme(uri);
                return true;
            }

            return false;
        }

        @Override
        public void onPageStarted(
                WebView view,
                String url,
                Bitmap favicon
        ) {
            super.onPageStarted(
                    view,
                    url,
                    favicon
            );
        }

        @Override
        public void onPageFinished(
                WebView view,
                String url
        ) {
            super.onPageFinished(
                    view,
                    url
            );

            /*
             * The page is interactive only after this point, so the API guard
             * is installed before the user can submit the login form.
             */
            installProductionApiGuard(view);
        }

        @Override
        public void onReceivedError(
                WebView view,
                WebResourceRequest request,
                WebResourceError error
        ) {
            super.onReceivedError(
                    view,
                    request,
                    error
            );

            if (request.isForMainFrame()) {
                loadOfflinePage();
            }
        }

        @Override
        public void onReceivedHttpError(
                WebView view,
                WebResourceRequest request,
                WebResourceResponse errorResponse
        ) {
            super.onReceivedHttpError(
                    view,
                    request,
                    errorResponse
            );
        }
    }

    private class SihChromeClient
            extends WebChromeClient {

        @Override
        public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> callback,
                FileChooserParams fileChooserParams
        ) {
            if (
                    filePathCallback != null
            ) {
                filePathCallback
                        .onReceiveValue(null);
            }

            filePathCallback = callback;

            Intent chooser =
                    new Intent(
                            Intent.ACTION_OPEN_DOCUMENT
                    );

            chooser.addCategory(
                    Intent.CATEGORY_OPENABLE
            );

            chooser.setType("*/*");

            chooser.putExtra(
                    Intent.EXTRA_ALLOW_MULTIPLE,
                    true
            );

            String[] acceptTypes =
                    fileChooserParams
                            .getAcceptTypes();

            if (acceptTypes != null) {
                ArrayList<String> mimeTypes =
                        new ArrayList<>();

                for (
                        String type
                        : acceptTypes
                ) {
                    if (
                            type != null
                                    && !type.trim().isEmpty()
                    ) {
                        mimeTypes.add(
                                type.trim()
                        );
                    }
                }

                if (!mimeTypes.isEmpty()) {
                    chooser.putExtra(
                            Intent.EXTRA_MIME_TYPES,
                            mimeTypes.toArray(
                                    new String[0]
                            )
                    );
                }
            }

            try {
                startActivityForResult(
                        chooser,
                        FILE_CHOOSER_REQUEST
                );
            } catch (ActivityNotFoundException e) {
                filePathCallback = null;

                callback.onReceiveValue(
                        null
                );

                Toast.makeText(
                        MainActivity.this,
                        "No file picker is available.",
                        Toast.LENGTH_SHORT
                ).show();
            }

            return true;
        }

        @Override
        public boolean onJsAlert(
                WebView view,
                String url,
                String message,
                JsResult result
        ) {
            Toast.makeText(
                    MainActivity.this,
                    message,
                    Toast.LENGTH_LONG
            ).show();

            result.cancel();

            return true;
        }
    }

    private class SihDownloadListener
            implements DownloadListener {

        @Override
        public void onDownloadStart(
                String url,
                String userAgent,
                String contentDisposition,
                String mimeType,
                long contentLength
        ) {
            try {
                startActivity(
                        new Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse(url)
                        )
                );
            } catch (ActivityNotFoundException e) {
                Toast.makeText(
                        MainActivity.this,
                        "No app can open this download.",
                        Toast.LENGTH_SHORT
                ).show();
            }
        }
    }

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data
    ) {
        super.onActivityResult(
                requestCode,
                resultCode,
                data
        );

        if (
                requestCode != FILE_CHOOSER_REQUEST
                        || filePathCallback == null
        ) {
            return;
        }

        Uri[] results = null;

        if (resultCode == RESULT_OK) {

            if (
                    data != null
                            && data.getClipData() != null
            ) {
                int count =
                        data.getClipData()
                                .getItemCount();

                results =
                        new Uri[count];

                for (
                        int i = 0;
                        i < count;
                        i++
                ) {
                    results[i] =
                            data.getClipData()
                                    .getItemAt(i)
                                    .getUri();
                }

            } else if (
                    data != null
                            && data.getData() != null
            ) {
                results =
                        new Uri[]{
                                data.getData()
                        };
            }
        }

        filePathCallback
                .onReceiveValue(results);

        filePathCallback = null;
    }

    @Override
    protected void onPause() {
        CookieManager
                .getInstance()
                .flush();

        super.onPause();
    }

    @Override
    public boolean onKeyDown(
            int keyCode,
            KeyEvent event
    ) {
        if (
                keyCode == KeyEvent.KEYCODE_BACK
                        && webView != null
                        && webView.canGoBack()
        ) {
            webView.goBack();
            return true;
        }

        return super.onKeyDown(
                keyCode,
                event
        );
    }
}
