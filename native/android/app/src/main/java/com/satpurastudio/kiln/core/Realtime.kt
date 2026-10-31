package com.satpurastudio.kiln.core

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

/**
 * Live row changes over Supabase Realtime's Phoenix websocket, so a task finished on one
 * device shows on the other within a second. Sync still works without it.
 */
class RealtimeChannel(
    private val userId: String,
    private val http: OkHttpClient,
    private val scope: CoroutineScope,
    private val token: suspend () -> String?,
    private val onChange: (J?, String?) -> Unit,
) {
    private var socket: WebSocket? = null
    private var heartbeat: Job? = null
    private var reconnect: Job? = null
    private var ref = 0
    private var attempts = 0
    private var stopped = true
    private val topic get() = "realtime:kiln-sync-$userId"

    fun start() {
        stopped = false
        connect()
    }

    fun stop() {
        stopped = true
        reconnect?.cancel()
        heartbeat?.cancel()
        socket?.close(1000, null)
        socket = null
    }

    private fun send(topic: String, event: String, payload: J) {
        socket?.send(jsonOf("topic" to J.Str(topic), "event" to J.Str(event), "payload" to payload, "ref" to J.Str((++ref).toString())).stable)
    }

    private fun connect() {
        if (stopped || socket != null) return
        val url = Backend.URL.replace("https://", "wss://") + "/realtime/v1/websocket?apikey=${Backend.ANON_KEY}&vsn=1.0.0"
        socket = http.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                scope.launch { joined() }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val msg = J.parse(text) ?: return
                scope.launch {
                    attempts = 0
                    if (msg["event"]?.string == "postgres_changes") {
                        val record = msg["payload"]?.get("data")?.get("record")
                        onChange(record?.get("data"), record?.get("updated_at")?.string)
                    }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                scope.launch { dropped() }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                scope.launch { dropped() }
            }
        })
    }

    private suspend fun joined() {
        val access = token() ?: return
        val config = jsonOf(
            "broadcast" to jsonOf("self" to J.Bool(false)),
            "presence" to jsonOf("key" to J.Str("")),
            "postgres_changes" to J.Arr(listOf(jsonOf("event" to J.Str("*"), "schema" to J.Str("public"), "table" to J.Str("kiln_data"), "filter" to J.Str("user_id=eq.$userId")))),
        )
        send(topic, "phx_join", jsonOf("config" to config, "access_token" to J.Str(access)))
        heartbeat?.cancel()
        heartbeat = scope.launch {
            while (isActive) {
                delay(25_000)
                send("phoenix", "heartbeat", J.Obj(emptyMap()))
                token()?.let { send(topic, "access_token", jsonOf("access_token" to J.Str(it))) }
            }
        }
    }

    private fun dropped() {
        heartbeat?.cancel()
        socket = null
        if (stopped) return
        attempts++
        reconnect?.cancel()
        reconnect = scope.launch {
            delay(minOf(30_000L, 1000L shl minOf(attempts, 5)))
            connect()
        }
    }
}
