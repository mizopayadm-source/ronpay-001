package com.ronpay.app;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
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

        // CRITICAL FOR CAMERA: Allow autoplay without requiring a prior touch event
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Allow mixed content if needed
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Set custom user agent with RonPayApp identifier
        String defaultUa = settings.getUserAgentString();
        settings.setUserAgentString(defaultUa + " RonPayApp/1.0");

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
        });
    }

    private void setupWebViewClient() {
        webView.setWebViewClient(new WebViewClient() {

            // Handle UPI URLs (upi://pay?...), WhatsApp (whatsapp://), PhonePe, Paytm, etc.
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return handleExternalOrUpiScheme(url);
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalOrUpiScheme(url);
            }

            private boolean handleExternalOrUpiScheme(String url) {
                if (url == null) return false;

                // Open external app schemes directly (UPI, WhatsApp, Telephone, Email, Intent)
                if (url.startsWith("upi:") ||
                    url.startsWith("phonepe:") ||
                    url.startsWith("paytmmp:") ||
                    url.startsWith("gpay:") ||
                    url.startsWith("whatsapp:") ||
                    url.startsWith("intent:") ||
                    url.startsWith("tel:") ||
                    url.startsWith("mailto:")) {
                    try {
                        Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                        if (intent != null) {
                            intent.addCategory(Intent.CATEGORY_BROWSABLE);
                            intent.setComponent(null);
                            intent.setSelector(null);
                            startActivity(intent);
                            return true;
                        }
                    } catch (Exception e) {
                        // If specific app is not found
                        if (url.startsWith("whatsapp:")) {
                            Toast.makeText(MainActivity.this, "WhatsApp app hmuh a ni lo", Toast.LENGTH_SHORT).show();
                        } else if (url.startsWith("upi:")) {
                            Toast.makeText(MainActivity.this, "UPI app (Google Pay/PhonePe/Paytm) hmuh a ni lo", Toast.LENGTH_SHORT).show();
                        }
                    }
                    return true;
                }

                // Normal HTTP / HTTPS links stay inside WebView
                return false;
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

                byte[] pdfAsBytes = Base64.decode(pureBase64, Base64.DEFAULT);

                // Save to app external cache or public directory
                File outputDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (outputDir == null) {
                    outputDir = context.getCacheDir();
                }

                File pdfFile = new File(outputDir, fileName);
                FileOutputStream os = new FileOutputStream(pdfFile, false);
                os.write(pdfAsBytes);
                os.flush();
                os.close();

                runOnUiThread(() -> {
                    Toast.makeText(context, "PDF File download fel a ni: " + fileName, Toast.LENGTH_LONG).show();
                    // Open the downloaded PDF
                    try {
                        Uri contentUri = FileProvider.getUriForFile(
                                context,
                                context.getPackageName() + ".fileprovider",
                                pdfFile
                        );
                        Intent openIntent = new Intent(Intent.ACTION_VIEW);
                        openIntent.setDataAndType(contentUri, mimeType);
                        openIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(openIntent);
                    } catch (Exception ex) {
                        // PDF viewer not found, file still safely saved
                    }
                });

            } catch (IOException e) {
                runOnUiThread(() -> Toast.makeText(context, "PDF Save theih loh: " + e.getMessage(), Toast.LENGTH_SHORT).show());
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
                    shareIntent.setType(mimeType);
                    shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    if (summaryText != null && !summaryText.isEmpty()) {
                        shareIntent.putExtra(Intent.EXTRA_TEXT, summaryText);
                    }
                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

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
                            context.startActivity(Intent.createChooser(shareIntent, "Share Receipt via"));
                        }
                    }
                });

            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(context, "WhatsApp Share theih loh: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }
    }
}
