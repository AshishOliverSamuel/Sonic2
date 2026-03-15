package com.prakhar.sonic;

import android.Manifest;
import android.accounts.Account;
import android.accounts.AccountManager;
import android.accounts.AccountManagerFuture;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.os.IBinder;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import okhttp3.*;
import org.json.*;
import java.io.IOException;

@CapacitorPlugin(
    name = "YouTubeMusic",
    permissions = {
        @Permission(strings = { Manifest.permission.GET_ACCOUNTS }, alias = "accounts")
    }
)
public class YouTubeMusicPlugin extends Plugin implements MediaPlaybackService.PlaybackCallback {

    private static final OkHttpClient client = new OkHttpClient();

    // ─── Service binding ──────────────────────────────────────────────────────

    private MediaPlaybackService playbackService;
    private boolean serviceBound = false;

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            MediaPlaybackService.LocalBinder lb = (MediaPlaybackService.LocalBinder) binder;
            playbackService = lb.getService();
            playbackService.setCallback(YouTubeMusicPlugin.this);
            serviceBound = true;
        }
        @Override
        public void onServiceDisconnected(ComponentName name) {
            serviceBound = false;
            playbackService = null;
        }
    };

    @Override
    public void load() {
        // Bind to (and start) the background service when plugin loads
        Intent intent = new Intent(getContext(), MediaPlaybackService.class);
        getContext().startForegroundService(intent);
        getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
    }

    @Override
    public void handleOnDestroy() {
        if (serviceBound) {
            getContext().unbindService(serviceConnection);
            serviceBound = false;
        }
    }

    // ─── PlaybackCallback — fires events back to JavaScript ──────────────────

    @Override
    public void onPlaybackStarted() {
        notifyListeners("playbackStarted", new JSObject());
    }

    @Override
    public void onPlaybackPaused() {
        notifyListeners("playbackPaused", new JSObject());
    }

    @Override
    public void onPlaybackCompleted() {
        notifyListeners("playbackCompleted", new JSObject());
    }

    @Override
    public void onPlaybackError() {
        notifyListeners("playbackError", new JSObject());
    }

    @Override
    public void onProgressUpdate(int positionMs, int durationMs) {
        JSObject data = new JSObject();
        data.put("position", positionMs / 1000.0);
        data.put("duration", durationMs / 1000.0);
        notifyListeners("progressUpdate", data);
    }

    // ─── Plugin methods called from JavaScript ────────────────────────────────

    /**
     * Called by JS to load and play a song natively.
     * JS passes: { streamUrl, title, artist, thumbnail }
     */
    @PluginMethod
    public void loadAndPlay(PluginCall call) {
        String streamUrl   = call.getString("streamUrl");
        String title       = call.getString("title", "Unknown");
        String artist      = call.getString("artist", "");
        String thumbnail   = call.getString("thumbnail", "");

        if (streamUrl == null) { call.reject("streamUrl is required"); return; }
        if (!serviceBound || playbackService == null) { call.reject("Service not ready"); return; }

        playbackService.loadAndPlay(streamUrl, title, artist, thumbnail);
        call.resolve();
    }

    @PluginMethod
    public void play(PluginCall call) {
        if (serviceBound && playbackService != null) playbackService.play();
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (serviceBound && playbackService != null) playbackService.pause();
        call.resolve();
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Double seconds = call.getDouble("position");
        if (seconds == null) { call.reject("position required"); return; }
        if (serviceBound && playbackService != null) {
            playbackService.seekTo((int)(seconds * 1000));
        }
        call.resolve();
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        JSObject result = new JSObject();
        if (serviceBound && playbackService != null) {
            result.put("isPlaying", playbackService.isPlaying());
            result.put("position", playbackService.getCurrentPosition() / 1000.0);
            result.put("duration", playbackService.getDuration() / 1000.0);
        } else {
            result.put("isPlaying", false);
            result.put("position", 0);
            result.put("duration", 0);
        }
        call.resolve(result);
    }

    // ─── Stream URL fetching (unchanged from your original) ──────────────────

    private String getGoogleAuthToken() {
        try {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.GET_ACCOUNTS)
                    != PackageManager.PERMISSION_GRANTED) return null;

            AccountManager am = AccountManager.get(getContext());
            Account[] accounts = am.getAccountsByType("com.google");
            if (accounts.length == 0) return null;

            AccountManagerFuture<android.os.Bundle> future = am.getAuthToken(
                accounts[0], "oauth2:https://www.googleapis.com/auth/youtube",
                null, getActivity(), null, null
            );
            android.os.Bundle bundle = future.getResult();
            return bundle.getString(AccountManager.KEY_AUTHTOKEN);
        } catch (Exception e) {
            android.util.Log.e("YouTubeMusic", "Auth token error: " + e.getMessage());
            return null;
        }
    }

    @PluginMethod
    public void getStreamUrl(PluginCall call) {
        String videoId = call.getString("videoId");
        if (videoId == null) { call.reject("videoId is required"); return; }

        new Thread(() -> {
            try {
                String token = getGoogleAuthToken();
                String streamUrl = fetchStreamUrl(videoId, token);
                if (streamUrl != null) {
                    JSObject result = new JSObject();
                    result.put("streamUrl", streamUrl);
                    call.resolve(result);
                } else {
                    call.reject("Could not get stream URL");
                }
            } catch (Exception e) {
                call.reject("Error: " + e.getMessage());
            }
        }).start();
    }

    private String fetchStreamUrl(String videoId, String token) throws IOException, JSONException {
        String url = "https://music.youtube.com/youtubei/v1/player?prettyPrint=false";

        JSONObject clientObj = new JSONObject();
        clientObj.put("clientName", "ANDROID_MUSIC");
        clientObj.put("clientVersion", "6.21.52");
        clientObj.put("androidSdkVersion", 30);
        clientObj.put("hl", "en");
        clientObj.put("gl", "IN");
        clientObj.put("utcOffsetMinutes", 330);

        JSONObject contextObj = new JSONObject();
        contextObj.put("client", clientObj);

        JSONObject contentPlaybackContext = new JSONObject();
        contentPlaybackContext.put("signatureTimestamp", "20157");
        JSONObject playbackContext = new JSONObject();
        playbackContext.put("contentPlaybackContext", contentPlaybackContext);

        JSONObject bodyObj = new JSONObject();
        bodyObj.put("videoId", videoId);
        bodyObj.put("context", contextObj);
        bodyObj.put("playbackContext", playbackContext);

        Request.Builder requestBuilder = new Request.Builder()
            .url(url)
            .post(RequestBody.create(bodyObj.toString(), MediaType.parse("application/json; charset=utf-8")))
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "com.google.android.apps.youtube.music/6.21.52 (Linux; U; Android 11; en_IN; Pixel 5; Build/RQ3A.210805.001+A1) gzip")
            .addHeader("X-Goog-Api-Format-Version", "1")
            .addHeader("X-YouTube-Client-Name", "21")
            .addHeader("X-YouTube-Client-Version", "6.21.52");

        if (token != null) {
            requestBuilder.addHeader("Authorization", "Bearer " + token);
            requestBuilder.addHeader("X-Goog-AuthUser", "0");
        }

        try (Response response = client.newCall(requestBuilder.build()).execute()) {
            if (!response.isSuccessful()) return null;
            String responseBody = response.body().string();

            JSONObject data = new JSONObject(responseBody);
            JSONObject playabilityStatus = data.optJSONObject("playabilityStatus");
            if (playabilityStatus == null || !"OK".equals(playabilityStatus.optString("status"))) return null;

            JSONObject streamingData = data.optJSONObject("streamingData");
            if (streamingData == null) return null;

            JSONArray formats = streamingData.optJSONArray("adaptiveFormats");
            if (formats == null) formats = streamingData.optJSONArray("formats");
            if (formats == null) return null;

            String bestUrl = null;
            int bestBitrate = 0;
            for (int i = 0; i < formats.length(); i++) {
                JSONObject format = formats.getJSONObject(i);
                String mimeType = format.optString("mimeType", "");
                String formatUrl = format.optString("url", "");
                int bitrate = format.optInt("bitrate", 0);
                if (mimeType.startsWith("audio/") && !formatUrl.isEmpty() && bitrate > bestBitrate) {
                    bestBitrate = bitrate;
                    bestUrl = formatUrl;
                }
            }
            return bestUrl;
        }
    }
}