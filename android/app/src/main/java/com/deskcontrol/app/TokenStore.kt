package com.deskcontrol.app

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * 접속 비밀번호로 받은 JWT와 서버 주소를 기기에 암호화해서 저장한다.
 * server/의 인증 모델(회원가입 없음, OWNER_PASSWORD 기반 단일 소유자)과 동일하게
 * 이 앱도 토큰 하나만 보관하면 된다.
 */
class TokenStore(context: Context) {
    private val prefs: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        prefs = EncryptedSharedPreferences.create(
            context,
            "deskcontrol_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var serverHost: String?
        get() = prefs.getString(KEY_HOST, null)
        set(value) = prefs.edit().putString(KEY_HOST, value).apply()

    var useHttps: Boolean
        get() = prefs.getBoolean(KEY_HTTPS, false)
        set(value) = prefs.edit().putBoolean(KEY_HTTPS, value).apply()

    fun clearToken() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    fun httpBaseUrl(): String = "${if (useHttps) "https" else "http"}://$serverHost"

    fun wsBaseUrl(): String = "${if (useHttps) "wss" else "ws"}://$serverHost"

    companion object {
        private const val KEY_TOKEN = "token"
        private const val KEY_HOST = "server_host"
        private const val KEY_HTTPS = "use_https"
    }
}
