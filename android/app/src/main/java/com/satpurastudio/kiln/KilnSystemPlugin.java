package com.satpurastudio.kiln;

import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Opens kiln's notification page in Android settings. Once someone says no to
// the permission dialog, Android stops showing it, so this is the only way
// back to reminders. Called from src/reminders.js.
@CapacitorPlugin(name = "KilnSystem")
public class KilnSystemPlugin extends Plugin {

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getActivity().startActivity(intent);
        call.resolve();
    }
}
