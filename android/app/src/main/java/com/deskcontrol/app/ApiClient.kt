package com.deskcontrol.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class ApiException(message: String, val requireTotp: Boolean = false) : Exception(message)

/**
 * server/src/routes/*.js 에 정의된 REST API를 그대로 호출하는 얇은 클라이언트.
 * 웹 클라이언트(web-client/src/api.ts)와 동일한 엔드포인트/응답 형식을 사용한다.
 */
class ApiClient(private val tokenStore: TokenStore) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json".toMediaType()

    private suspend fun request(
        path: String,
        method: String = "GET",
        body: JSONObject? = null,
        auth: Boolean = false
    ): JSONObject = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("${tokenStore.httpBaseUrl()}$path")
        if (auth) {
            val token = tokenStore.token ?: throw ApiException("로그인이 필요합니다.")
            builder.addHeader("Authorization", "Bearer $token")
        }
        val requestBody = body?.toString()?.toRequestBody(jsonMediaType)
        when (method) {
            "POST" -> builder.post(requestBody ?: JSONObject().toString().toRequestBody(jsonMediaType))
            "DELETE" -> builder.delete()
            else -> builder.get()
        }

        client.newCall(builder.build()).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val error = runCatching { JSONObject(text) }.getOrNull()
                val message = error?.optString("error") ?: "요청 실패 (${response.code})"
                val requireTotp = error?.optBoolean("requireTotp", false) ?: false
                throw ApiException(message, requireTotp)
            }
            if (text.isBlank()) JSONObject() else JSONObject(text)
        }
    }

    suspend fun login(password: String, totp: String? = null): String {
        val body = JSONObject().apply {
            put("password", password)
            if (!totp.isNullOrBlank()) put("totp", totp)
        }
        return request("/api/auth/login", "POST", body).getString("token")
    }

    suspend fun listDevices(): List<Device> {
        val res = request("/api/devices", auth = true)
        val arr = res.getJSONArray("devices")
        return (0 until arr.length()).map { i ->
            val d = arr.getJSONObject(i)
            Device(
                id = d.getString("id"),
                name = d.getString("name"),
                status = d.getString("status"),
                lastSeenAt = d.optString("lastSeenAt", null),
                createdAt = d.getString("createdAt")
            )
        }
    }

    suspend fun claimDevice(code: String, name: String) {
        val body = JSONObject().apply {
            put("code", code)
            put("name", name)
        }
        request("/api/devices/pair/claim", "POST", body, auth = true)
    }

    suspend fun removeDevice(id: String) {
        request("/api/devices/$id", "DELETE", auth = true)
    }

    suspend fun redeemGuestPin(code: String): Pair<String, String> {
        val body = JSONObject().put("code", code)
        val res = request("/api/sessions/pin/redeem", "POST", body)
        return res.getString("guestToken") to res.getString("deviceId")
    }
}
