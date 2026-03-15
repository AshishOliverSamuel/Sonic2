package com.prakhar.sonic;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(YouTubeMusicPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Request GET_ACCOUNTS permission
        ActivityCompat.requestPermissions(this,
            new String[]{ Manifest.permission.GET_ACCOUNTS },
            1001
        );

        // Start background service
        Intent serviceIntent = new Intent(this, MediaPlaybackService.class);
        startForegroundService(serviceIntent);
    }
}
