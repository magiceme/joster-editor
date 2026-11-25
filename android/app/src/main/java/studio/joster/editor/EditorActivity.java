package studio.joster.editor;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.transformer.Composition;
import androidx.media3.transformer.ExportException;
import androidx.media3.transformer.ExportResult;
import androidx.media3.transformer.Transformer;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.util.Collections;

import org.json.JSONObject;

@UnstableApi
public final class EditorActivity extends Activity {
    private static final String ORIGIN = "https://editor.joster.local";
    private static final int PICK = 10;
    private static final int MICROPHONE = 11;
    private static final int SAVE = 12;
    private static String assetType(String path) {
        if ("/index.html".equals(path)) return "text/html";
        if ("/editor.js".equals(path) || "/noise-gate.js".equals(path)) return "text/javascript";
        if ("/manifest.webmanifest".equals(path)) return "application/manifest+json";
        if ("/icon-192.png".equals(path) || "/icon-512.png".equals(path)) return "image/png";
        return null;
    }

    private WebView web;
    private ValueCallback<Uri[]> picker;
    private PermissionRequest microphone;
    private final ExportBridge bridge = new ExportBridge();
    private Transformer transformer;
    private File pendingFile;
    private boolean saving;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(true);
        web.addJavascriptInterface(bridge, "JosterAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "editor.joster.local".equals(uri.getHost())) {
                    String path = uri.getPath();
                    String mime = assetType(path);
                    if (mime != null) {
                        try {
                            return new WebResourceResponse(mime, mime.startsWith("image/") ? null : "UTF-8",
                                getAssets().open(path.substring(1)));
                        } catch (IOException ignored) {
                            // Fall through to the explicit error response.
                        }
                    }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                       FileChooserParams params) {
                if (picker != null) picker.onReceiveValue(null);
                picker = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK);
                } catch (RuntimeException e) {
                    picker.onReceiveValue(null);
                    picker = null;
                }
                return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request) {
                if (!"editor.joster.local".equals(request.getOrigin().getHost())
                    || request.getResources().length != 1
                    || !PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(request.getResources()[0])) {
                    request.deny();
                    return;
                }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[] {PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    if (microphone != null) microphone.deny();
                    microphone = request;
                    requestPermissions(new String[] {Manifest.permission.RECORD_AUDIO}, MICROPHONE);
                }
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (microphone == request) microphone = null;
            }
        });
        web.loadUrl(ORIGIN + "/index.html");
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code != MICROPHONE || microphone == null) return;
        if (results.length == 1 && results[0] == PackageManager.PERMISSION_GRANTED) {
            microphone.grant(new String[] {PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else microphone.deny();
        microphone = null;
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == PICK && picker != null) {
            Uri[] files = WebChromeClient.FileChooserParams.parseResult(result, data);
            if (result == RESULT_OK && data != null && data.getClipData() != null) {
                files = new Uri[data.getClipData().getItemCount()];
                for (int i = 0; i < files.length; i++) files[i] = data.getClipData().getItemAt(i).getUri();
            }
            picker.onReceiveValue(files);
            picker = null;
        } else if (code == SAVE && pendingFile != null) {
            File file = pendingFile;
            pendingFile = null;
            if (result != RESULT_OK || data == null || data.getData() == null) {
                file.delete();
                finishSave("Save cancelled");
                return;
            }
            Uri uri = data.getData();
            new Thread(() -> {
                String message;
                try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new IOException("Destination unavailable");
                    Files.copy(file.toPath(), out);
                    message = "File saved";
                } catch (IOException e) {
                    message = "Save failed: " + e.getMessage();
                } finally {
                    file.delete();
                }
                String finalMessage = message;
                runOnUiThread(() -> finishSave(finalMessage));
            }).start();
        }
    }

    private void finishSave(String message) {
        saving = false;
        web.evaluateJavascript("window.josterSaveResult?.(" + JSONObject.quote(message) + ")", null);
    }

    private void chooseDestination(File file, String name, String type) {
        pendingFile = file;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE).setType(type).putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(intent, SAVE);
        } catch (RuntimeException e) {
            pendingFile = null;
            file.delete();
            finishSave("No file picker available");
        }
    }

    private void save(File file, String name, String type, boolean transcode) {
        if (saving) {
            file.delete();
            web.evaluateJavascript("window.josterSaveResult?.('Another save is in progress')", null);
            return;
        }
        saving = true;
        if (!transcode) {
            chooseDestination(file, name, type);
            return;
        }
        try {
            File mp4 = File.createTempFile("render-", ".mp4", getCacheDir());
            mp4.delete();
            transformer = new Transformer.Builder(this)
                .setVideoMimeType(MimeTypes.VIDEO_H264)
                .setAudioMimeType(MimeTypes.AUDIO_AAC)
                .addListener(new Transformer.Listener() {
                    @Override public void onCompleted(Composition c, ExportResult result) {
                        file.delete();
                        transformer = null;
                        chooseDestination(mp4, name, "video/mp4");
                    }
                    @Override public void onError(Composition c, ExportResult result, ExportException error) {
                        file.delete();
                        mp4.delete();
                        transformer = null;
                        finishSave("MP4 conversion failed. Try WebM or a lower resolution.");
                    }
                }).build();
            transformer.start(MediaItem.fromUri(Uri.fromFile(file)), mp4.getAbsolutePath());
        } catch (IOException | RuntimeException e) {
            file.delete();
            transformer = null;
            finishSave("MP4 conversion could not start");
        }
    }

    private final class ExportBridge {
        private FileOutputStream stream;
        private File file;

        @JavascriptInterface public synchronized boolean begin() {
            abort();
            try {
                file = File.createTempFile("export-", ".webm", getCacheDir());
                stream = new FileOutputStream(file);
                return true;
            } catch (IOException e) {
                abort();
                return false;
            }
        }
        @JavascriptInterface public synchronized boolean append(String base64) {
            if (stream == null || base64.length() > 400000) return false;
            try {
                stream.write(Base64.decode(base64, Base64.NO_WRAP));
                return true;
            } catch (IOException | IllegalArgumentException e) {
                abort();
                return false;
            }
        }
        @JavascriptInterface public synchronized boolean finish(String name, String type, boolean transcode) {
            if (stream == null) return false;
            try {
                stream.close();
                File completed = file;
                stream = null;
                file = null;
                runOnUiThread(() -> save(completed, name, type, transcode));
                return true;
            } catch (IOException e) {
                abort();
                return false;
            }
        }
        @JavascriptInterface public synchronized void abort() {
            if (stream != null) try { stream.close(); } catch (IOException ignored) {}
            if (file != null) file.delete();
            stream = null;
            file = null;
        }
    }

    @Override protected void onDestroy() {
        if (transformer != null) transformer.cancel();
        bridge.abort();
        if (pendingFile != null) pendingFile.delete();
        web.destroy();
        super.onDestroy();
    }
}
