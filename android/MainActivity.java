package com.ronpay.app;

import android.Manifest;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    // Set your target URL (Both ronpay.app and vercel url will work seamlessly)
    private static final String APP_URL = "https://ronpay.app";
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> fileUploadCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Initialize WebView programmatically or via layout
        webView = new WebView(this);
        setContentView(webView);

        // Check & request initial runtime permissions (Camera & Storage)
        checkAndRequestAppPermissions();

        // Configure WebView settings for full Camera, PWA, and HTML5 support
        setupWebViewSettings();

        // Register WebChromeClient for Camera permissions and File upload chooser
        setupWebChromeClient();

        // Register WebViewClient for UPI deeplinks (GPay, PhonePe, Paytm, WhatsApp)
        setupWebViewClient();

        // Setup DownloadListener for direct HTTP / HTTPS report streams
        setupDownloadListener();

        // Attach JavaScript Bridge for PDF downloads & WhatsApp sharing
        RonPayNativeBridge bridge = new RonPayNativeBridge(this);
        webView.addJavascriptInterface(bridge, "RonPayBridge");
        webView.addJavascriptInterface(bridge, "AndroidBlobDownloader");
        webView.addJavascriptInterface(bridge, "AndroidDownloader");

        // Load the app URL
        webView.loadUrl(APP_URL);
    }

    private void setupWebViewSettings() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Support window.open and target="_blank" for Payment Gateways (PhonePe, etc.)
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        // CRITICAL FOR CAMERA: Allow autoplay without requiring a prior touch event
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Allow mixed content if needed
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Configure User Agent: Remove embedded WebView identifiers (; wv and Version/X.X)
        // This ensures Payment Gateways (PhonePe, Razorpay, etc.) recognize full Chrome Mobile capabilities
        // and render native UPI Apps (PhonePe, Google Pay, Paytm) instead of fallback QR screenshot prompts.
        String defaultUa = settings.getUserAgentString();
        String cleanUa = defaultUa.replace("; wv", "")
                                  .replaceAll("Version\\/\\d+\\.\\d+\\s?", "");
        settings.setUserAgentString(cleanUa);

        // Performance & cache settings
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    }

    private void setupWebChromeClient() {
        webView.setWebChromeClient(new WebChromeClient() {

            // =========================================================================
            // 1. CRITICAL: Grant Camera & Audio Stream Permissions to Web (getUserMedia)
            // =========================================================================
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    // Check if native Android Camera permission is granted
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                            == PackageManager.PERMISSION_GRANTED) {
                        // Grant requested web permissions (Camera video / audio)
                        request.grant(request.getResources());
                    } else {
                        // Request native camera permission first
                        ActivityCompat.requestPermissions(
                                MainActivity.this,
                                new String[]{Manifest.permission.CAMERA},
                                PERMISSION_REQUEST_CODE
                        );
                        // Grant Web access
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public void onPermissionRequestCanceled(PermissionRequest request) {
                super.onPermissionRequestCanceled(request);
            }

            // =========================================================================
            // 2. Handle <input type="file"> for Photo upload & Camera capture
            // =========================================================================
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE);
                } catch (ActivityNotFoundException e) {
                    fileUploadCallback = null;
                    Toast.makeText(MainActivity.this, "File browser hmuh a ni lo", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }

            // =========================================================================
            // 3. Handle window.open & target="_blank" for Payment Gateways (PhonePe, etc.)
            // =========================================================================
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                WebView newWebView = new WebView(MainActivity.this);
                newWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        String targetUrl = request.getUrl().toString();
                        if (handleExternalOrUpiScheme(view, targetUrl)) {
                            return true;
                        }
                        view.loadUrl(targetUrl);
                        return true;
                    }

                    @SuppressWarnings("deprecation")
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, String targetUrl) {
                        if (handleExternalOrUpiScheme(view, targetUrl)) {
                            return true;
                        }
                        view.loadUrl(targetUrl);
                        return true;
                    }
                });

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(newWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });
    }

    private void setupWebViewClient() {
        webView.setWebViewClient(new WebViewClient() {

            // Handle UPI URLs (upi://pay?...), WhatsApp (whatsapp://), PhonePe, Paytm, etc.
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return handleExternalOrUpiScheme(view, url);
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalOrUpiScheme(view, url);
            }
        });
    }

    private boolean handleExternalOrUpiScheme(WebView view, String url) {
        if (url == null) return false;

        // 1. Payment Gateway Intent schemes (PhonePe, GPay, Paytm intent://)
        if (url.startsWith("intent:")) {
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                if (intent != null) {
                    PackageManager pm = getPackageManager();
                    if (intent.resolveActivity(pm) != null) {
                        startActivity(intent);
                        return true;
                    }

                    // If targeted app is not installed, fallback to browser_fallback_url
                    String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                    if (fallbackUrl != null && !fallbackUrl.isEmpty()) {
                        view.loadUrl(fallbackUrl);
                        return true;
                    }

                    // Fallback to generic upi:// if scheme is upi
                    String dataUri = intent.getDataString();
                    if (dataUri != null && dataUri.startsWith("upi:")) {
                        Intent genericUpi = new Intent(Intent.ACTION_VIEW, Uri.parse(dataUri));
                        genericUpi.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        if (genericUpi.resolveActivity(pm) != null) {
                            startActivity(genericUpi);
                            return true;
                        }
                    }
                }
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "UPI app hawn theih a ni lo", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        // 2. Direct UPI & Communication app schemes
        if (url.startsWith("upi:") ||
            url.startsWith("phonepe:") ||
            url.startsWith("paytmmp:") ||
            url.startsWith("gpay:") ||
            url.startsWith("tez:") ||
            url.startsWith("whatsapp:") ||
            url.startsWith("tel:") ||
            url.startsWith("mailto:")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException e) {
                if (url.startsWith("upi:") || url.startsWith("phonepe:") || url.startsWith("gpay:") || url.startsWith("tez:")) {
                    Toast.makeText(MainActivity.this, "UPI app (PhonePe / Google Pay / Paytm) hmuh a ni lo", Toast.LENGTH_SHORT).show();
                } else if (url.startsWith("whatsapp:")) {
                    Toast.makeText(MainActivity.this, "WhatsApp app hmuh a ni lo", Toast.LENGTH_SHORT).show();
                }
                return true;
            } catch (Exception ex) {
                return true;
            }
        }

        // Normal HTTP / HTTPS links stay inside WebView
        return false;
    }

    // Setup DownloadListener for direct HTTP / HTTPS report streams
    private void setupDownloadListener() {
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType != null ? mimeType : "application/octet-stream");
                    String cookies = CookieManager.getInstance().getCookie(url);
                    if (cookies != null) {
                        request.addRequestHeader("cookie", cookies);
                    }
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setDescription("RonPay Report download mek a ni...");
                    String guessFileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    request.setTitle(guessFileName);
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, guessFileName);

                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);
                        Toast.makeText(MainActivity.this, "Download tan a ni: " + guessFileName, Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Download error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    // Handle file chooser activity result
    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return;

            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                String dataString = data.getDataString();
                if (dataString != null) {
                    results = new Uri[]{Uri.parse(dataString)};
                } else if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                }
            }
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        }
    }

    // Check and request runtime permissions on app launch
    private void checkAndRequestAppPermissions() {
        List<String> permissionsNeeded = new ArrayList<>();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES)
                    != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.READ_MEDIA_IMAGES);
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
            }
        }

        if (!permissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(
                    this,
                    permissionsNeeded.toArray(new String[0]),
                    PERMISSION_REQUEST_CODE
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            // Permissions handled, reload page or proceed smoothly
        }
    }

    // Hardware Back Button: navigate web history first before closing app
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // =========================================================================
    // JavaScript Interface: PDF Receipt Downloader & Direct WhatsApp Sharing
    // =========================================================================
    public class RonPayNativeBridge {
        private final Context context;

        public RonPayNativeBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void getBase64FromBlobData(String base64Data, String mimeType, String fileName) {
            try {
                // Strip Data URI prefix if present (e.g. data:application/pdf;base64,)
                String pureBase64 = base64Data;
                if (base64Data.contains(",")) {
                    pureBase64 = base64Data.substring(base64Data.indexOf(",") + 1);
                }

                byte[] fileBytes = Base64.decode(pureBase64, Base64.DEFAULT);

                // Ensure clean filename
                String cleanName = (fileName != null && !fileName.trim().isEmpty())
                        ? fileName.trim()
                        : "RonPay_Report_" + System.currentTimeMillis();

                Uri targetUri = null;
                File targetFile = null;

                // 1. Android 10+ (API 29+): Save directly to Public MediaStore Downloads folder
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, cleanName);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType != null ? mimeType : "application/octet-stream");
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                        ContentResolver resolver = context.getContentResolver();
                        targetUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                        if (targetUri != null) {
                            OutputStream os = resolver.openOutputStream(targetUri);
                            if (os != null) {
                                os.write(fileBytes);
                                os.flush();
                                os.close();
                            }
                        }
                    } catch (Exception qEx) {
                        targetUri = null;
                    }
                }

                // 2. Android 9 and older: Save to public external Downloads directory
                if (targetUri == null) {
                    try {
                        File publicDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        if (publicDownloads != null) {
                            if (!publicDownloads.exists()) {
                                publicDownloads.mkdirs();
                            }
                            targetFile = new File(publicDownloads, cleanName);
                            FileOutputStream os = new FileOutputStream(targetFile, false);
                            os.write(fileBytes);
                            os.flush();
                            os.close();

                            // Register with Android MediaScanner so file appears immediately in Files/Downloads app
                            MediaScannerConnection.scanFile(
                                    context,
                                    new String[]{targetFile.getAbsolutePath()},
                                    new String[]{mimeType},
                                    null
                            );
                        }
                    } catch (Exception legacyEx) {
                        targetFile = null;
                    }
                }

                // 3. Fallback: Save to App's external downloads directory if public storage is restricted
                if (targetUri == null && targetFile == null) {
                    File outputDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (outputDir == null) {
                        outputDir = context.getCacheDir();
                    }
                    targetFile = new File(outputDir, cleanName);
                    FileOutputStream os = new FileOutputStream(targetFile, false);
                    os.write(fileBytes);
                    os.flush();
                    os.close();
                }

                // 4. Also keep a cache copy so FileProvider can always safely open/view/share the file
                File cacheFile = new File(context.getCacheDir(), cleanName);
                FileOutputStream cacheOs = new FileOutputStream(cacheFile, false);
                cacheOs.write(fileBytes);
                cacheOs.flush();
                cacheOs.close();

                final Uri finalTargetUri = targetUri;
                final File finalTargetFile = targetFile;

                runOnUiThread(() -> {
                    Toast.makeText(
                            context,
                            "Report download fel a ni! (Phone > Downloads > " + cleanName + ")",
                            Toast.LENGTH_LONG
                    ).show();

                    // Automatically attempt to open the file with the default PDF/Spreadsheet viewer
                    try {
                        Uri openUri;
                        if (finalTargetUri != null) {
                            openUri = finalTargetUri;
                        } else {
                            File fToOpen = finalTargetFile != null ? finalTargetFile : cacheFile;
                            openUri = FileProvider.getUriForFile(
                                    context,
                                    context.getPackageName() + ".fileprovider",
                                    fToOpen
                            );
                        }

                        Intent openIntent = new Intent(Intent.ACTION_VIEW);
                        openIntent.setDataAndType(openUri, mimeType);
                        openIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(openIntent);
                    } catch (Exception ex) {
                        // Viewer app not installed; file is still safely in Phone Downloads
                    }
                });

            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(context, "Report Save theih loh: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface
        public void shareFileToWhatsApp(String base64Data, String mimeType, String fileName, String summaryText) {
            try {
                String pureBase64 = base64Data;
                if (base64Data.contains(",")) {
                    pureBase64 = base64Data.substring(base64Data.indexOf(",") + 1);
                }

                byte[] pdfAsBytes = Base64.decode(pureBase64, Base64.DEFAULT);
                File cacheDir = new File(context.getCacheDir(), "shared_receipts");
                if (!cacheDir.exists()) cacheDir.mkdirs();

                File pdfFile = new File(cacheDir, fileName);
                FileOutputStream os = new FileOutputStream(pdfFile, false);
                os.write(pdfAsBytes);
                os.flush();
                os.close();

                Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        pdfFile
                );

                runOnUiThread(() -> {
                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    shareIntent.setType(mimeType != null && !mimeType.isEmpty() ? mimeType : "application/pdf");
                    shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    if (summaryText != null && !summaryText.isEmpty()) {
                        shareIntent.putExtra(Intent.EXTRA_TEXT, summaryText);
                    }
                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                    try {
                        context.grantUriPermission("com.whatsapp", contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        context.grantUriPermission("com.whatsapp.w4b", contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } catch (Exception ignored) {}

                    // Try direct WhatsApp package first
                    shareIntent.setPackage("com.whatsapp");
                    try {
                        context.startActivity(shareIntent);
                    } catch (ActivityNotFoundException e1) {
                        try {
                            // Try WhatsApp Business
                            shareIntent.setPackage("com.whatsapp.w4b");
                            context.startActivity(shareIntent);
                        } catch (ActivityNotFoundException e2) {
                            // Fallback to standard system share chooser
                            shareIntent.setPackage(null);
                            Intent chooser = Intent.createChooser(shareIntent, "Share Report via");
                            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            context.startActivity(chooser);
                        }
                    }
                });

            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(context, "WhatsApp Share theih loh: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface
        public void openInExternalBrowser(String url) {
            try {
                if (url != null && !url.trim().isEmpty()) {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(browserIntent);
                }
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(context, "Browser hawn theih a ni lo: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }
    }
}
