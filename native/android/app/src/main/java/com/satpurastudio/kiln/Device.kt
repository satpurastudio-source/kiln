package com.satpurastudio.kiln

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Build
import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.satpurastudio.kiln.core.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.DelicateCoroutinesApi
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Small device-local values, under the same keys the web app used. */
class Prefs(context: Context) {
    private val p: SharedPreferences = context.getSharedPreferences("kiln", Context.MODE_PRIVATE)
    fun string(k: String): String? = p.getString(k, null)
    fun set(k: String, v: String) = p.edit().putString(k, v).apply()
    fun remove(k: String) = p.edit().remove(k).apply()
    fun wipeLocal() = listOf("kiln-focus", "kiln-tips", "kiln-reminders", "kiln-whatsnew-seen", "kiln-pending-name", "kiln-auth-intent").forEach(::remove)
}

/** One JSON file for the state (the web app's `zenith-v1` shape), written atomically. */
class Disk(context: Context) {
    private val dir = context.filesDir
    val stateFile = File(dir, "state.json")
    val baseFile = File(dir, "sync-base.json")

    fun loadState(): AppState {
        if (!stateFile.exists()) return AppState.seed()
        val text = try {
            stateFile.readText()
        } catch (_: Exception) {
            return AppState.seed()
        }
        J.parse(text)?.let(AppState::decode)?.let { return it }
        // Never silently replace unreadable data — park a copy so it can be recovered by hand.
        File(dir, "state-unreadable-${Clock.ms}.json").writeText(text)
        return AppState.seed()
    }

    fun write(file: File, text: String) {
        val tmp = File(file.path + ".tmp")
        tmp.writeText(text)
        if (!tmp.renameTo(file)) {
            file.delete()
            tmp.renameTo(file)
        }
    }

    fun wipe() {
        stateFile.delete()
        baseFile.delete()
    }

    inner class BaseFile : BaseStore {
        override fun read(userId: String): Base? {
            if (!baseFile.exists()) return null
            val b = J.parse(baseFile.readText()) ?: return null
            if (b["userId"]?.string != userId) return null
            val data = b["data"] ?: return null
            return Base(b["at"]?.string, Snapshot.of(data))
        }

        override fun write(userId: String, at: String?, data: Snapshot) {
            write(baseFile, jsonOf("userId" to J.Str(userId), "at" to at.j(), "data" to data.json).stable)
        }
    }
}

/** Sign-in tokens, encrypted with a key that never leaves this phone's keystore. */
class KeystoreSessionStore(context: Context) : SessionStore {
    private val file = File(context.filesDir, "session.bin")

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey("kiln-session", null) as? SecretKey)?.let { return it }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(
            KeyGenParameterSpec.Builder("kiln-session", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build(),
        )
        return g.generateKey()
    }

    override fun load(): AuthSession? = try {
        val bytes = file.readBytes()
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, 12))
        AuthSession.of(J.parse(String(c.doFinal(bytes, 12, bytes.size - 12))))
    } catch (_: Exception) {
        null
    }

    override fun save(s: AuthSession) {
        try {
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.ENCRYPT_MODE, key())
            file.writeBytes(c.iv + c.doFinal(s.json.stable.toByteArray()))
        } catch (_: Exception) {
            file.delete()
        }
    }

    override fun clear() {
        file.delete()
    }
}

/** The web app's little synth, rendered once to WAV. No audio assets. */
class Sound(private val context: Context) {
    var enabled = true
    private var pool: SoundPool? = null
    private val ids = HashMap<String, Int>()

    private class Tone(val freq: Double, val to: Double? = null, val time: Double, val triangle: Boolean = false, val gain: Double, val delay: Double = 0.0)

    private fun render(tones: List<Tone>): File {
        val rate = 44100
        val total = tones.maxOf { it.delay + it.time + 0.05 }
        val pcm = DoubleArray((total * rate).toInt())
        for (t in tones) {
            var phase = 0.0
            val start = (t.delay * rate).toInt()
            val n = (t.time * rate).toInt()
            for (i in 0 until n) {
                if (start + i >= pcm.size) break
                val p = i.toDouble() / n
                val sec = i.toDouble() / rate
                val f = if (t.to != null) t.freq * Math.pow(t.to / t.freq, p) else t.freq
                phase += 2 * Math.PI * f / rate
                val wave = if (t.triangle) 2 / Math.PI * Math.asin(Math.sin(phase)) else Math.sin(phase)
                val env = if (sec < 0.008) t.gain * sec / 0.008 else t.gain * Math.pow(0.0001 / t.gain, (sec - 0.008) / maxOf(0.001, t.time - 0.008))
                pcm[start + i] += wave * env
            }
        }
        val size = pcm.size * 2
        val b = ByteBuffer.allocate(44 + size).order(ByteOrder.LITTLE_ENDIAN)
        b.put("RIFF".toByteArray()).putInt(36 + size).put("WAVEfmt ".toByteArray()).putInt(16).putShort(1).putShort(1)
            .putInt(rate).putInt(rate * 2).putShort(2).putShort(16).put("data".toByteArray()).putInt(size)
        for (s in pcm) b.putShort((s.coerceIn(-1.0, 1.0) * 32767).toInt().toShort())
        return File.createTempFile("kiln", ".wav", context.cacheDir).apply { writeBytes(b.array()) }
    }

    /** Off the main thread after launch, so a first tap sounds at once and startup never waits. */
    @OptIn(DelicateCoroutinesApi::class)
    fun prepare() {
        GlobalScope.launch(Dispatchers.Default) {
            val sp = SoundPool.Builder().setMaxStreams(3).setAudioAttributes(
                AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(),
            ).build()
            val sounds = mapOf(
                "complete" to listOf(Tone(587.0, 880.0, 0.1, gain = 0.06), Tone(880.0, 1175.0, 0.16, gain = 0.05, delay = 0.07)),
                "add" to listOf(Tone(440.0, 660.0, 0.08, gain = 0.045)),
                "pop" to listOf(Tone(320.0, 180.0, 0.09, true, 0.05)),
                "fanfare" to listOf(Tone(523.0, null, 0.14, gain = 0.05), Tone(659.0, null, 0.14, gain = 0.05, delay = 0.09), Tone(784.0, null, 0.2, gain = 0.055, delay = 0.18), Tone(1046.0, null, 0.3, gain = 0.05, delay = 0.27)),
            )
            for ((k, v) in sounds) {
                val f = render(v)
                ids[k] = sp.load(f.path, 1)
                f.deleteOnExit()
            }
            pool = sp
        }
    }

    private fun play(k: String) {
        if (enabled) ids[k]?.let { pool?.play(it, 1f, 1f, 1, 0, 1f) }
    }

    fun complete() = play("complete")
    fun add() = play("add")
    fun pop() = play("pop")
    fun fanfare() = play("fanfare")
}

/**
 * Real OS notifications that fire with the app closed. Exact timing only where Android
 * already allows it: asking for more would throw people into a settings screen after
 * every edit, and without it a reminder is at worst a few minutes late.
 */
object Reminders {
    private const val CHANNEL = "kiln-reminders"
    private const val PLAN = "kiln-reminder-plan"

    fun granted(c: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        return (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).areNotificationsEnabled()
    }

    fun openSettings(c: Context) {
        val i = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        c.startActivity(i)
    }

    private fun pending(c: Context, id: Int, title: String = "", body: String = ""): PendingIntent {
        val i = Intent(c, ReminderReceiver::class.java).setAction("kiln.$id").putExtra("id", id).putExtra("title", title).putExtra("body", body)
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun arm(c: Context, r: PlannedReminder) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pending(c, r.id, r.title, r.body)
        val exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
        try {
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.atMs, pi)
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.atMs, pi)
        } catch (_: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, r.atMs, pi)
        }
    }

    fun rebuild(c: Context, prefs: Prefs, tasks: List<KTask>) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        J.parse(prefs.string(PLAN) ?: "[]")?.array.orEmpty().forEach { old ->
            old["id"]?.number?.toInt()?.let { am.cancel(pending(c, it)) }
        }
        val plan = if (prefs.string("kiln-reminders") == "1" && granted(c)) planReminders(tasks) else emptyList()
        plan.forEach { arm(c, it) }
        prefs.set(PLAN, J.Arr(plan.map { jsonOf("id" to it.id.j(), "title" to J.Str(it.title), "body" to J.Str(it.body), "at" to J.Num(it.atMs.toDouble())) }).stable)
    }

    /** Alarms don't survive a reboot or an app update, so the saved plan is armed again. */
    fun rearm(c: Context, prefs: Prefs) {
        if (prefs.string("kiln-reminders") != "1" || !granted(c)) return
        val now = System.currentTimeMillis()
        J.parse(prefs.string(PLAN) ?: "[]")?.array.orEmpty().forEach { r ->
            val at = r["at"]?.number?.toLong() ?: return@forEach
            if (at > now) arm(c, PlannedReminder(r["id"]!!.number!!.toInt(), r["title"]?.string ?: "kiln", r["body"]?.string ?: "", at))
        }
    }

    fun sendTest(c: Context, body: String) {
        arm(c, PlannedReminder(TEST_REMINDER_ID, "kiln", body, System.currentTimeMillis() + 5000))
    }

    fun show(c: Context, id: Int, title: String, body: String) {
        val nm = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, "Task reminders", NotificationManager.IMPORTANCE_HIGH))
        val open = PendingIntent.getActivity(c, 0, Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE)
        nm.notify(
            id,
            NotificationCompat.Builder(c, CHANNEL).setSmallIcon(R.drawable.ic_stat_kiln).setColor(0xFFC8643C.toInt()).setContentTitle(title).setContentText(body)
                .setContentIntent(open).setAutoCancel(true).setPriority(NotificationCompat.PRIORITY_HIGH).build(),
        )
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (Reminders.granted(c)) Reminders.show(c, i.getIntExtra("id", 1), i.getStringExtra("title") ?: "kiln", i.getStringExtra("body") ?: "")
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) = Reminders.rearm(c, Prefs(c))
}

/** Counts app opens on stats.satpurastudio.com, as the web beacon did: no cookies, and the
 *  visitor id is random and replaced every day (IST). */
object Analytics {
    @OptIn(DelicateCoroutinesApi::class)
    fun countOpen(c: Context, prefs: Prefs, cloud: Cloud) {
        if (c.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) return
        val f = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
        val today = f.format(java.util.Date(System.currentTimeMillis() + 19_800_000L))
        val parts = (prefs.string("satpura:v") ?: "").split("|")
        val visitor = if (parts.size == 2 && parts[0] == today) parts[1] else UUID.randomUUID().toString()
        prefs.set("satpura:v", "$today|$visitor")
        GlobalScope.launch(Dispatchers.IO) {
            try {
                cloud.request(
                    "POST", "/rest/v1/page_views",
                    jsonOf("product" to J.Str("kiln"), "path" to J.Str("/"), "referrer" to J.Null, "device" to J.Str("app"), "visitor" to J.Str(visitor)),
                    mapOf("Prefer" to "return=minimal"), authed = false,
                )
            } catch (_: CloudException) {
                // a missed count doesn't matter
            }
        }
    }
}
