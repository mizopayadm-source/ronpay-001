<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e4a186be-c3d8-44aa-9fa6-dc4fd0647c8b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Android Studio (APK) WebView Setup: Camera & File Upload

When embedding RonPay into an Android Studio native app with a `WebView`, follow these steps to ensure the **Camera Live Stream** and **Photo Uploads** function properly:

### 1. In `AndroidManifest.xml`
Add permissions inside `<manifest>`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

<uses-feature android:name="android.hardware.camera" android:required="false" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

### 2. In `MainActivity.java`
Configure your `WebView` with `WebChromeClient` to grant camera permissions and support file chooser:
```java
WebView webView = findViewById(R.id.webView);
WebSettings settings = webView.getSettings();
settings.setJavaScriptEnabled(true);
settings.setDomStorageEnabled(true);
settings.setAllowFileAccess(true);
settings.setMediaPlaybackRequiresUserGesture(false);

webView.setWebChromeClient(new WebChromeClient() {
    // 1. Grant Camera Stream Permission (getUserMedia) to Web app
    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        request.grant(request.getResources());
    }
});
```

### 3. Web Camera HTTPS Security Requirement
Modern mobile and desktop browsers (Chrome, Safari, Firefox) **only allow camera access over HTTPS (or localhost)**. Ensure your deployed production URL starts with `https://`.
