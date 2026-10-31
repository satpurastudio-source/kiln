package com.satpurastudio.kiln

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.satpurastudio.kiln.ui.KilnRoot
import kotlinx.coroutines.CompletableDeferred

class MainActivity : ComponentActivity() {
    private var store: Store? = null
    private var ready by mutableStateOf(false)
    private var permissionResult: CompletableDeferred<Boolean>? = null
    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { permissionResult?.complete(it) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(SystemBarStyle.dark(0), SystemBarStyle.dark(0))
        setContent {
            LaunchedEffect(Unit) {
                if (Migration.needed(this@MainActivity)) Migration.run(this@MainActivity) { open() } else open()
            }
            if (ready) {
                KilnRoot(store!!) { dark ->
                    val bars = if (dark) SystemBarStyle.dark(0) else SystemBarStyle.light(0, 0)
                    enableEdgeToEdge(bars, bars)
                }
            }
        }
    }

    private fun open() {
        val s = Store.get(this)
        s.askNotificationPermission = {
            if (Build.VERSION.SDK_INT < 33) false
            else {
                val d = CompletableDeferred<Boolean>()
                permissionResult = d
                permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                d.await()
            }
        }
        store = s
        ready = true
        s.onForeground()
    }

    override fun onStart() {
        super.onStart()
        store?.onForeground()
    }

    override fun onStop() {
        store?.onBackground()
        super.onStop()
    }
}
