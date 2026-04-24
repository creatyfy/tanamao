package com.tanamao.delivery;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Habilita edge-to-edge: o app ocupa toda a tela
        // O CSS usa env(safe-area-inset-*) para compensar as barras do sistema
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
