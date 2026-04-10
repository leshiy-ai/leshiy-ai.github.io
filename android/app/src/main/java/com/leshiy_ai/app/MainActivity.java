package com.leshiy_ai.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Регистрация плагинов вручную (на всякий случай)
        //registerPlugin(com.capacitorjs.plugins.app.AppPlugin.class);
        //registerPlugin(com.capacitorjs.plugins.browser.BrowserPlugin.class);
        //registerPlugin(com.capacitorjs.plugins.toast.ToastPlugin.class);
        super.onCreate(savedInstanceState);
    }
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}