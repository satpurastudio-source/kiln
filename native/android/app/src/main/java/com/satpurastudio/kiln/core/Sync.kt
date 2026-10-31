package com.satpurastudio.kiln.core

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class CloudRow(val data: J, val at: String?)

/** The kiln_data row, one user. An interface so the engine can be tested against a fake cloud that races it. */
interface CloudTransport {
    suspend fun pull(userId: String): CloudRow?
    /** null = the cloud no longer holds `ifAt`. */
    suspend fun update(userId: String, data: J, at: String, ifAt: String): String?
    /** null = the row already exists. */
    suspend fun insert(userId: String, data: J, at: String): String?
    suspend fun upsert(userId: String, data: J, at: String)
}

data class Base(val at: String?, val data: Snapshot)

interface BaseStore {
    fun read(userId: String): Base?
    fun write(userId: String, at: String?, data: Snapshot)
}

enum class SyncStatus { Idle, Syncing, Synced, Offline, Error }

fun isoNow(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())

/**
 * Cloud sync for one signed-in user — a port of src/sync.js. We remember the last copy the
 * cloud confirmed ("base", persisted). So changes made offline are still known to be unsynced
 * after a restart and get merged in, and a push only lands if the cloud still holds our base —
 * if another device wrote first, we pull its copy, merge, and push the merge instead.
 * Runs on one thread (the scope's dispatcher), like the JS it came from.
 */
class SyncEngine(
    val userId: String,
    private val cloud: CloudTransport,
    private val baseStore: BaseStore,
    private val scope: CoroutineScope,
    private val getLocal: () -> Snapshot,
    private val applyRemote: (Snapshot) -> Unit,
    private val onStatus: (SyncStatus) -> Unit,
    private val isOnline: () -> Boolean = { true },
    private val retryDelays: List<Long> = listOf(3000, 10000, 30000, 60000),
) {
    private class Known(val at: String?, val data: Snapshot, val json: String)

    private var base: Known? = baseStore.read(userId)?.let { Known(it.at, it.data, it.data.fingerprint) }
    private var pushing: Job? = null
    private var again = false
    private var recheck = false
    private var conflicts = 0
    private var retryJob: Job? = null
    private var retryN = 0
    private var started = false
    private var stopped = false

    private fun status(s: SyncStatus) {
        if (!stopped) onStatus(s)
    }

    val pending: Boolean get() = base == null || getLocal().fingerprint != base!!.json

    private fun setBase(data: Snapshot, at: String?) {
        base = Known(at, data, data.fingerprint)
        baseStore.write(userId, at, data)
    }

    private fun failed() {
        status(if (isOnline()) SyncStatus.Error else SyncStatus.Offline)
        retryJob?.cancel()
        val wait = retryDelays[minOf(retryN, retryDelays.size - 1)]
        retryN++
        retryJob = scope.launch {
            delay(wait)
            if (started) push() else start()
        }
    }

    /** Fold a cloud copy into local state. */
    fun absorb(data: J, at: String?) {
        if (data["projects"]?.array == null || data["tasks"]?.array == null) return
        val cloudCopy = Snapshot.of(data)
        val json = cloudCopy.fingerprint
        val local = getLocal()
        val b = base
        if (b != null && json == b.json) {
            // nothing new (often our own echo) — just track the cloud's version
            if (at != null) setBase(b.data, at)
            return
        }
        if (b == null || local.fingerprint == b.json) {
            // first sync on this device, or nothing unsynced here → cloud wins
            setBase(cloudCopy, at)
            applyRemote(cloudCopy)
            return
        }
        // both sides changed since we last agreed
        val merged = mergeSnapshots(b.data, local, cloudCopy)
        setBase(cloudCopy, at)
        if (merged.fingerprint != local.fingerprint) applyRemote(merged)
    }

    private suspend fun writeOnce(data: Snapshot): String? {
        val at = isoNow()
        if (conflicts >= 3) {
            // something keeps racing us — we've merged already, so a plain overwrite is safe enough to break the loop
            cloud.upsert(userId, data.json, at)
            return at
        }
        val ifAt = base?.at
        return if (ifAt != null) cloud.update(userId, data.json, at, ifAt) else cloud.insert(userId, data.json, at)
    }

    private suspend fun doPush() {
        val local = getLocal()
        if (base?.json == local.fingerprint) return status(SyncStatus.Synced)
        status(SyncStatus.Syncing)
        val at = writeOnce(local)
        if (at != null) {
            conflicts = 0
            retryN = 0
            setBase(local, at)
            if (pending) again = true else status(SyncStatus.Synced)
            return
        }
        // another device got there first: take its copy in, then try again
        conflicts++
        val row = cloud.pull(userId)
        if (row != null) absorb(row.data, row.at) else base = null // row vanished → next write creates it
        again = true
    }

    suspend fun push() {
        if (stopped) return
        pushing?.let {
            again = true
            it.join()
            return
        }
        retryJob?.cancel()
        val job = scope.launch {
            try {
                doPush()
            } catch (e: CloudException) {
                failed()
            }
            pushing = null
            if (stopped) return@launch
            if (again) {
                again = false
                push()
            } else if (recheck) {
                recheck = false
                refresh()
            }
        }
        pushing = job
        job.join()
    }

    suspend fun start() {
        if (stopped) return
        status(SyncStatus.Syncing)
        try {
            val row = cloud.pull(userId)
            if (stopped) return
            if (row != null) absorb(row.data, row.at)
            started = true
            retryN = 0
            push() // adopts local on a brand-new account; no-op when in step
        } catch (e: CloudException) {
            failed()
        }
    }

    /** A row change arrived over realtime. */
    suspend fun remoteChanged(data: J?, at: String?) {
        if (pushing != null) {
            recheck = true // look again once our own write has settled
            return
        }
        // large rows can arrive without their payload — fetch it instead
        if (data != null && data != J.Null) absorb(data, at) else refresh()
    }

    /** Fallback freshness for when realtime is down or the app was asleep. */
    suspend fun refresh() {
        if (stopped || !started) return start()
        if (pending) return push()
        pushing?.let { return it.join() }
        try {
            cloud.pull(userId)?.let { absorb(it.data, it.at) }
        } catch (e: CloudException) {
            failed()
        }
    }

    /** True once everything local is in the cloud; false if it's clear it can't be. */
    suspend fun flush(timeoutMs: Long = 6000): Boolean = withTimeoutOrNull(timeoutMs) {
        var i = 0
        while (i < 4 && pending) {
            push()
            i++
        }
        !pending
    } ?: false

    fun stop() {
        stopped = true
        retryJob?.cancel()
    }
}

class CloudException(message: String, val code: String? = null, val status: Int? = null, val isNetwork: Boolean = false) : Exception(message)
