package com.deskcontrol.app

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

/**
 * server/src/ws/signaling.js 의 /ws/client 프로토콜을 그대로 구현한다.
 * web-client/src/components/RemoteView.tsx 와 동일한 메시지 형식을 사용하므로,
 * 서버 쪽 변경 없이 웹/안드로이드가 같은 시그널링 채널을 공유한다.
 */
class SignalingClient(
    private val wsBaseUrl: String,
    private val token: String,
    private val deviceId: String,
    private val listener: Listener
) {
    interface Listener {
        fun onSessionReady()
        fun onAnswer(sdp: String)
        fun onRemoteIce(candidate: String, sdpMid: String?, sdpMLineIndex: Int?)
        fun onSessionEnd()
        fun onSocketClosed(reason: String)
    }

    private val client = OkHttpClient()
    private var socket: WebSocket? = null

    fun connect() {
        val url = "$wsBaseUrl/ws/client?token=$token&deviceId=$deviceId"
        val request = Request.Builder().url(url).build()
        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                listener.onSocketClosed(reason.ifBlank { "연결이 종료되었습니다." })
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                listener.onSocketClosed(t.message ?: "연결에 실패했습니다.")
            }
        })
    }

    private fun handleMessage(text: String) {
        val msg = runCatching { JSONObject(text) }.getOrNull() ?: return
        when (msg.optString("type")) {
            "session-ready" -> listener.onSessionReady()
            "answer" -> listener.onAnswer(msg.getString("sdp"))
            "ice" -> {
                if (msg.has("candidate") && !msg.isNull("candidate")) {
                    listener.onRemoteIce(
                        msg.getString("candidate"),
                        msg.optString("sdpMid", null),
                        if (msg.has("sdpMLineIndex") && !msg.isNull("sdpMLineIndex")) msg.getInt("sdpMLineIndex") else null
                    )
                }
            }
            "session-end" -> listener.onSessionEnd()
        }
    }

    fun sendOffer(sdp: String) {
        send(JSONObject().apply {
            put("type", "offer")
            put("sdp", sdp)
        })
    }

    fun sendIceCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int?) {
        send(JSONObject().apply {
            put("type", "ice")
            put("candidate", candidate)
            put("sdpMid", sdpMid)
            put("sdpMLineIndex", sdpMLineIndex)
        })
    }

    private fun send(json: JSONObject) {
        socket?.send(json.toString())
    }

    fun close() {
        socket?.close(1000, "closed by client")
        socket = null
    }
}
