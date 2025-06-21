package com.example.dynamictvboard;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;
import org.json.JSONArray;

import java.io.IOException;
import java.util.Random; // Will be used for pairing code generation later

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

// Note to user/developer: Ensure you have the OkHttp dependency in your app-level build.gradle:
// dependencies {
//     implementation("com.squareup.okhttp3:okhttp:4.9.3") // Or the latest version
// }
// Also, ensure you have internet permission in your AndroidManifest.xml:
// <uses-permission android:name="android.permission.INTERNET" />

public class MainActivity extends Activity {

    private static final String TAG = "DynamicTVBoard";
    private WebView webView;
    private OkHttpClient httpClient;
    private Handler pollingHandler;
    private String currentDisplayId; // Will be generated dynamically
    // Use 10.0.2.2 for localhost when running in Android emulator connecting to a server on the host machine
    private String backendBaseUrl = "http://10.0.2.2:3000";
    private static final long POLLING_INTERVAL_MS = 10000; // 10 seconds
    private Random random = new Random();


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);

        // For debugging WebView content in Chrome:
        WebView.setWebContentsDebuggingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d(TAG, "Page finished loading: " + url);
                // Generate and display pairing code
                generateAndDisplayPairingCode();
                // Initial status until first data fetch
                callJavaScript("AndroidTVInterface.setStatus", "Page loaded. Initializing data fetch for Display ID: " + currentDisplayId);
                // Start fetching data once the page and JS interface are ready
                startPolling();
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Log.e(TAG, "WebView error: " + description + " (code " + errorCode + ") on URL " + failingUrl);
                Toast.makeText(MainActivity.this, "WebView Error: " + description, Toast.LENGTH_LONG).show();
                callJavaScript("AndroidTVInterface.setStatus", "Error loading page: " + description);
            }
        });

        setContentView(webView);
        webView.loadUrl("file:///android_asset/table_display.html");
        Log.d(TAG, "Attempting to load table_display.html");

        httpClient = new OkHttpClient();
        pollingHandler = new Handler(Looper.getMainLooper());

        // Initial generation of pairing code in onCreate as a fallback,
        // but it's better tied to onPageFinished or a specific "generate" action
        // if we want to ensure JS interface is ready.
        // For now, generate it here, and onPageFinished will display it and use it.
        // generateAndDisplayPairingCode(); // Moved to onPageFinished
    }

    private void generateAndDisplayPairingCode() {
        // Generate a 6-digit random number as a string
        int randomNumber = 100000 + random.nextInt(900000); // Ensures 6 digits
        currentDisplayId = String.valueOf(randomNumber);
        Log.i(TAG, "Generated Pairing Code (Display ID): " + currentDisplayId);

        // Display this code in the WebView
        callJavaScript("AndroidTVInterface.setPairingCode", currentDisplayId);
    }

    private void fetchDataForDisplay() {
        if (currentDisplayId == null || currentDisplayId.isEmpty()) {
            Log.w(TAG, "No display ID generated yet. Skipping fetch. This should not happen if generateAndDisplayPairingCode was called.");
            callJavaScript("AndroidTVInterface.setStatus", "Error: Display ID not generated.");
            String errorJson = "{\"headers\":[\"Error\"],\"rows\":[[\"Display ID not generated.\"]]}";
            callJavaScript("AndroidTVInterface.setTableData", errorJson);
            return;
        }

        String url = backendBaseUrl + "/display/" + currentDisplayId;
        Request request = new Request.Builder().url(url).build();

        callJavaScript("AndroidTVInterface.setStatus", "Fetching data for " + currentDisplayId + "...");

        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Failed to fetch data: ", e);
                runOnUiThread(() -> {
                    // Update WebView with error message
                    String errorJson = "{\"headers\":[\"Error\"],\"rows\":[[\"Failed to connect to backend: " + e.getMessage().replace("'", "\\'") + "\"]]}";
                    callJavaScript("AndroidTVInterface.setTableData", errorJson);
                    callJavaScript("AndroidTVInterface.setStatus", "Error fetching data. Retrying soon...");
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (response.isSuccessful() && response.body() != null) {
                    final String jsonData = response.body().string();
                    Log.d(TAG, "Data fetched successfully: " + jsonData);
                    runOnUiThread(() -> {
                        callJavaScript("AndroidTVInterface.setTableData", jsonData);
                        callJavaScript("AndroidTVInterface.setStatus", "Data updated successfully for " + currentDisplayId);
                    });
                } else {
                    Log.e(TAG, "Failed to fetch data, server responded with: " + response.code());
                    final String errorDetail = response.body() != null ? response.body().string() : "Unknown error";
                    runOnUiThread(() -> {
                        String errorJson = "{\"headers\":[\"Error\"],\"rows\":[[\"Backend error: " + response.code() + " - " + errorDetail.replace("'", "\\'") + "\"]]}";
                        callJavaScript("AndroidTVInterface.setTableData", errorJson);
                        callJavaScript("AndroidTVInterface.setStatus", "Error from backend: " + response.code());
                    });
                }
            }
        });
    }

    private void callJavaScript(String functionName, String... args) {
        StringBuilder script = new StringBuilder("javascript:");
        script.append(functionName).append("(");
        for (int i = 0; i < args.length; i++) {
            // Escape single quotes and backslashes in arguments
            String escapedArg = args[i].replace("\\", "\\\\").replace("'", "\\'");
            script.append("'").append(escapedArg).append("'");
            if (i < args.length - 1) {
                script.append(",");
            }
        }
        script.append(");");

        if (webView != null) {
            webView.evaluateJavascript(script.toString(), value -> {
                // You can log the result of the JS call if needed
                // Log.d(TAG, "JS " + functionName + " executed, result: " + value);
            });
        }
    }

    private final Runnable pollingRunnable = new Runnable() {
        @Override
        public void run() {
            fetchDataForDisplay();
            pollingHandler.postDelayed(this, POLLING_INTERVAL_MS);
        }
    };

    private void startPolling() {
        Log.d(TAG, "Starting polling for display data.");
        // Remove any existing callbacks to prevent multiple polling loops
        pollingHandler.removeCallbacks(pollingRunnable);
        // Start immediately and then repeat
        pollingHandler.post(pollingRunnable);
    }

    private void stopPolling() {
        Log.d(TAG, "Stopping polling.");
        pollingHandler.removeCallbacks(pollingRunnable);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // If page is already loaded (e.g. returning to app), ensure polling starts
        // The onPageFinished callback handles the initial start if the page loads fresh
        if (webView.getUrl() != null && !pollingHandler.hasCallbacks(pollingRunnable)) {
             // A bit of delay to ensure WebView JS interface is ready if resuming quickly
            // pollingHandler.postDelayed(this::startPolling, 500);
            // For now, let onPageFinished handle the initial start. If issues arise with resume,
            // this is a place to consider. For now, let's assume onPageFinished will trigger.
            // If we want to be more robust on resume:
            // if (webView.getProgress() == 100) { // Check if page is fully loaded
            //     startPolling();
            // }
        }
         // For now, let's simplify and rely on onPageFinished for the first start,
         // and onResume/onPause for stopping/restarting to avoid complexity unless needed.
         // If polling was stopped in onPause, restart it.
         // This might cause an immediate fetch if onPageFinished also triggers.
         // A more robust solution would use a flag to see if initial load fetch occurred.
         // Let's keep it simple: if polling was active, it will restart here.
         // The `startPolling` method itself removes previous callbacks, so it's safe to call.
         startPolling(); // Restart polling when the activity is resumed
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopPolling(); // Stop polling when the activity is not visible
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopPolling(); // Ensure polling is stopped
        if (webView != null) {
            webView.destroy();
        }
    }
}
