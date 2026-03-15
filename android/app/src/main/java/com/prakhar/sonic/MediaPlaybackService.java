package com.prakhar.sonic;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.IOException;
import java.net.URL;

public class MediaPlaybackService extends Service implements
        MediaPlayer.OnPreparedListener,
        MediaPlayer.OnCompletionListener,
        MediaPlayer.OnErrorListener,
        AudioManager.OnAudioFocusChangeListener {

    private static final String TAG = "MediaPlaybackService";
    private static final String CHANNEL_ID = "SonicMediaPlayback";
    private static final int NOTIFICATION_ID = 1;

    // Actions sent from the notification buttons
    public static final String ACTION_PLAY   = "com.prakhar.sonic.PLAY";
    public static final String ACTION_PAUSE  = "com.prakhar.sonic.PAUSE";
    public static final String ACTION_NEXT   = "com.prakhar.sonic.NEXT";
    public static final String ACTION_PREV   = "com.prakhar.sonic.PREV";
    public static final String ACTION_STOP   = "com.prakhar.sonic.STOP";

    // Binder so the Capacitor plugin can call methods directly
    public class LocalBinder extends Binder {
        public MediaPlaybackService getService() { return MediaPlaybackService.this; }
    }
    private final IBinder binder = new LocalBinder();

    private MediaPlayer mediaPlayer;
    private MediaSessionCompat mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;

    // Current track info (set by plugin)
    private String currentStreamUrl;
    private String currentTitle   = "Sonic";
    private String currentArtist  = "";
    private String currentThumbUrl = "";
    private boolean isPrepared    = false;
    private boolean playOnPrepare = false;

    // Callback interface so the plugin can listen to events
    public interface PlaybackCallback {
        void onPlaybackStarted();
        void onPlaybackPaused();
        void onPlaybackCompleted();
        void onPlaybackError();
        void onProgressUpdate(int position, int duration);
    }
    private PlaybackCallback callback;
    public void setCallback(PlaybackCallback cb) { this.callback = cb; }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        createNotificationChannel();
        initMediaSession();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            switch (intent.getAction()) {
                case ACTION_PLAY:  play();  break;
                case ACTION_PAUSE: pause(); break;
                case ACTION_NEXT:
                    if (callback != null) callback.onPlaybackCompleted(); // tells JS to go next
                    break;
                case ACTION_PREV:
                    // For simplicity: restart current track
                    if (mediaPlayer != null && isPrepared) mediaPlayer.seekTo(0);
                    break;
                case ACTION_STOP:  stopSelf(); break;
            }
        }
        return START_STICKY; // Restart service if killed
    }

    @Override
    public IBinder onBind(Intent intent) { return binder; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        releaseMediaPlayer();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        abandonAudioFocus();
    }

    // ─── Public API (called by YouTubeMusicPlugin) ────────────────────────────

    /**
     * Load a new stream URL and start playing.
     * Call this from the plugin when a new song is selected.
     */
    public void loadAndPlay(String streamUrl, String title, String artist, String thumbnailUrl) {
        this.currentStreamUrl  = streamUrl;
        this.currentTitle      = title;
        this.currentArtist     = artist;
        this.currentThumbUrl   = thumbnailUrl;
        this.playOnPrepare     = true;
        this.isPrepared        = false;

        releaseMediaPlayer();
        mediaPlayer = new MediaPlayer();
        mediaPlayer.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
        mediaPlayer.setAudioAttributes(
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
        );
        mediaPlayer.setOnPreparedListener(this);
        mediaPlayer.setOnCompletionListener(this);
        mediaPlayer.setOnErrorListener(this);

        try {
            mediaPlayer.setDataSource(streamUrl);
            mediaPlayer.prepareAsync(); // non-blocking
        } catch (IOException e) {
            Log.e(TAG, "setDataSource failed: " + e.getMessage());
            if (callback != null) callback.onPlaybackError();
        }

        // Update notification and lock screen metadata immediately (without artwork yet)
        updateMediaSessionMetadata(title, artist, null);
        updateNotification();

        // Load artwork in background and refresh
        if (thumbnailUrl != null && !thumbnailUrl.isEmpty()) {
            new Thread(() -> {
                try {
                    Bitmap bmp = BitmapFactory.decodeStream(new URL(thumbnailUrl).openStream());
                    updateMediaSessionMetadata(title, artist, bmp);
                    updateNotification();
                } catch (Exception e) {
                    Log.w(TAG, "Failed to load thumbnail: " + e.getMessage());
                }
            }).start();
        }
    }

    public void play() {
        if (!isPrepared || mediaPlayer == null) return;
        if (requestAudioFocus()) {
            mediaPlayer.start();
            mediaSession.setPlaybackState(buildPlaybackState(PlaybackStateCompat.STATE_PLAYING));
            updateNotification();
            if (callback != null) callback.onPlaybackStarted();
            startProgressUpdater();
        }
    }

    public void pause() {
        if (mediaPlayer == null || !mediaPlayer.isPlaying()) return;
        mediaPlayer.pause();
        mediaSession.setPlaybackState(buildPlaybackState(PlaybackStateCompat.STATE_PAUSED));
        updateNotification();
        if (callback != null) callback.onPlaybackPaused();
        stopProgressUpdater();
    }

    public void seekTo(int positionMs) {
        if (mediaPlayer != null && isPrepared) mediaPlayer.seekTo(positionMs);
    }

    public boolean isPlaying() {
        return mediaPlayer != null && mediaPlayer.isPlaying();
    }

    public int getCurrentPosition() {
        return (mediaPlayer != null && isPrepared) ? mediaPlayer.getCurrentPosition() : 0;
    }

    public int getDuration() {
        return (mediaPlayer != null && isPrepared) ? mediaPlayer.getDuration() : 0;
    }

    // ─── MediaPlayer callbacks ────────────────────────────────────────────────

    @Override
    public void onPrepared(MediaPlayer mp) {
        isPrepared = true;
        if (playOnPrepare) play();
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        stopProgressUpdater();
        mediaSession.setPlaybackState(buildPlaybackState(PlaybackStateCompat.STATE_STOPPED));
        if (callback != null) callback.onPlaybackCompleted();
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        Log.e(TAG, "MediaPlayer error: what=" + what + " extra=" + extra);
        isPrepared = false;
        if (callback != null) callback.onPlaybackError();
        return true;
    }

    // ─── Audio Focus ──────────────────────────────────────────────────────────

    private boolean requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build())
                .setOnAudioFocusChangeListener(this)
                .build();
            return audioManager.requestAudioFocus(audioFocusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
        return true;
    }

    private void abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        }
    }

    @Override
    public void onAudioFocusChange(int focusChange) {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                pause();
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                if (mediaPlayer != null) mediaPlayer.setVolume(0.2f, 0.2f);
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                if (mediaPlayer != null) {
                    mediaPlayer.setVolume(1f, 1f);
                    play();
                }
                break;
        }
    }

    // ─── MediaSession ─────────────────────────────────────────────────────────

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, TAG);
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay()  { play(); }
            @Override public void onPause() { pause(); }
            @Override public void onSkipToNext()     { if (callback != null) callback.onPlaybackCompleted(); }
            @Override public void onSkipToPrevious() { if (mediaPlayer != null && isPrepared) mediaPlayer.seekTo(0); }
            @Override public void onSeekTo(long pos) { seekTo((int) pos); }
        });
        mediaSession.setPlaybackState(buildPlaybackState(PlaybackStateCompat.STATE_NONE));
        mediaSession.setActive(true);
    }

    private void updateMediaSessionMetadata(String title, String artist, Bitmap artwork) {
        MediaMetadataCompat.Builder meta = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Sonic");
        if (artwork != null) {
            meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
        }
        if (mediaSession != null) mediaSession.setMetadata(meta.build());
    }

    private PlaybackStateCompat buildPlaybackState(int state) {
        long actions = PlaybackStateCompat.ACTION_PLAY |
                       PlaybackStateCompat.ACTION_PAUSE |
                       PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                       PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                       PlaybackStateCompat.ACTION_SEEK_TO;
        return new PlaybackStateCompat.Builder()
            .setState(state, getCurrentPosition(), 1f)
            .setActions(actions)
            .build();
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Sonic Music Playback", NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Keeps music playing in the background");
        channel.setShowBadge(false);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(channel);
    }

    private PendingIntent makeActionIntent(String action) {
        Intent i = new Intent(this, MediaPlaybackService.class);
        i.setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, action.hashCode(), i, flags);
    }

    private Notification buildNotification() {
        boolean playing = isPlaying();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            // Previous
            .addAction(android.R.drawable.ic_media_previous, "Previous", makeActionIntent(ACTION_PREV))
            // Play / Pause
            .addAction(
                playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                playing ? "Pause" : "Play",
                makeActionIntent(playing ? ACTION_PAUSE : ACTION_PLAY)
            )
            // Next
            .addAction(android.R.drawable.ic_media_next, "Next", makeActionIntent(ACTION_NEXT))
            // MediaStyle — this is what shows lock screen controls
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2) // show all 3 in compact
            );

        return builder.build();
    }

    private void updateNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
    }

    // ─── Progress updater (tells JS the current position) ────────────────────

    private Thread progressThread;
    private volatile boolean progressRunning = false;

    private void startProgressUpdater() {
        stopProgressUpdater();
        progressRunning = true;
        progressThread = new Thread(() -> {
            while (progressRunning) {
                try { Thread.sleep(500); } catch (InterruptedException e) { break; }
                if (mediaPlayer != null && mediaPlayer.isPlaying() && callback != null) {
                    callback.onProgressUpdate(mediaPlayer.getCurrentPosition(), mediaPlayer.getDuration());
                }
            }
        });
        progressThread.start();
    }

    private void stopProgressUpdater() {
        progressRunning = false;
        if (progressThread != null) progressThread.interrupt();
    }

    // ─── Cleanup ──────────────────────────────────────────────────────────────

    private void releaseMediaPlayer() {
        stopProgressUpdater();
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
            } catch (Exception ignored) {}
            mediaPlayer.reset();
            mediaPlayer.release();
            mediaPlayer = null;
        }
        isPrepared = false;
    }
}