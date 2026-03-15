package com.prakhar.sonic;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import okhttp3.*;
import org.json.*;
import java.io.IOException;

@CapacitorPlugin(name = "YouTubeMusic")
public class YouTubeMusicPlugin extends Plugin {

    private static final OkHttpClient client = new OkHttpClient();

    @PluginMethod
    public void getStreamUrl(PluginCall call) {
        String videoId = call.getString("videoId");
        if (videoId == null) {
            call.reject("videoId is required");
            return;
        }
android.util.Log.d("YouTubeMusic", "getStreamUrl called for videoId: " + videoId);
        new Thread(() -> {
            try {
                String streamUrl = fetchStreamUrl(videoId);
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

    private String fetchStreamUrl(String videoId) throws IOException, JSONException {
        // YouTube Music InnerTube API - called from Android device so not blocked
        String url = "https://music.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
        
        JSONObject context = new JSONObject();
        JSONObject client = new JSONObject();
        client.put("clientName", "ANDROID_MUSIC");
        client.put("clientVersion", "6.21.52");
        client.put("androidSdkVersion", 30);
        client.put("hl", "en");
        client.put("gl", "IN");
        context.put("client", client);

        JSONObject body = new JSONObject();
        body.put("videoId", videoId);
        body.put("context", context);

        RequestBody requestBody = RequestBody.create(
            body.toString(),
            MediaType.parse("application/json")
        );

        Request request = new Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "com.google.android.apps.youtube.music/6.21.52 (Linux; U; Android 11) gzip")
            .addHeader("X-Goog-Api-Format-Version", "1")
            .build();

        try (Response response = this.client.newCall(request).execute()) {
            if (!response.isSuccessful()) return null;
            
            String responseBody = response.body().string();
            JSONObject data = new JSONObject(responseBody);
            
            // Check playability
            String status = data.optJSONObject("playabilityStatus")
                .optString("status");
            if (!"OK".equals(status)) return null;

            // Get best audio format
            JSONArray formats = data.optJSONObject("streamingData")
                .optJSONArray("adaptiveFormats");
            
            String bestUrl = null;
            int bestBitrate = 0;

            for (int i = 0; i < formats.length(); i++) {
                JSONObject format = formats.getJSONObject(i);
                String mimeType = format.optString("mimeType");
                String formatUrl = format.optString("url");
                int bitrate = format.optInt("bitrate", 0);

                if (mimeType.startsWith("audio/") && 
                    !formatUrl.isEmpty() && 
                    bitrate > bestBitrate) {
                    bestBitrate = bitrate;
                    bestUrl = formatUrl;
                }
            }

            return bestUrl;
        }
    }
}
