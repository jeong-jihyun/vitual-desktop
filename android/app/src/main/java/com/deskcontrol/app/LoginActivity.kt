package com.deskcontrol.app

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.deskcontrol.app.databinding.ActivityLoginBinding
import kotlinx.coroutines.launch

/**
 * 회원가입 없음: server/의 OWNER_PASSWORD 하나로 로그인한다 (web-client의
 * LoginForm과 동일한 흐름). 서버가 TOTP_SECRET을 설정해뒀다면(선택) 비밀번호
 * 확인 후 인증앱 코드 입력란이 나타난다.
 */
class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var tokenStore: TokenStore
    private lateinit var apiClient: ApiClient
    private var needsTotp = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        tokenStore = TokenStore(this)
        apiClient = ApiClient(tokenStore)

        binding.editServerAddress.setText(tokenStore.serverHost.orEmpty())
        binding.checkUseHttps.isChecked = tokenStore.useHttps

        // 이미 로그인된 토큰이 있으면 바로 목록 화면으로
        if (!tokenStore.token.isNullOrBlank() && !tokenStore.serverHost.isNullOrBlank()) {
            goToDeviceList()
            return
        }

        binding.buttonLogin.setOnClickListener { onLoginClicked() }
        binding.buttonGuestLogin.setOnClickListener { onGuestLoginClicked() }
    }

    private fun saveServerConfig() {
        tokenStore.serverHost = binding.editServerAddress.text.toString().trim()
        tokenStore.useHttps = binding.checkUseHttps.isChecked
    }

    private fun onLoginClicked() {
        val password = binding.editPassword.text.toString()
        if (binding.editServerAddress.text.isNullOrBlank() || password.isBlank()) {
            showError("서버 주소와 비밀번호를 입력해주세요.")
            return
        }
        saveServerConfig()

        val totp = if (needsTotp) binding.editTotp.text.toString() else null
        binding.buttonLogin.isEnabled = false

        lifecycleScope.launch {
            try {
                val token = apiClient.login(password, totp)
                tokenStore.token = token
                goToDeviceList()
            } catch (e: ApiException) {
                if (e.requireTotp) {
                    needsTotp = true
                    binding.layoutTotp.visibility = android.view.View.VISIBLE
                    binding.editPassword.isEnabled = false
                }
                showError(e.message ?: "로그인에 실패했습니다.")
            } catch (e: Exception) {
                showError("서버에 연결할 수 없습니다: ${e.message}")
            } finally {
                binding.buttonLogin.isEnabled = true
            }
        }
    }

    private fun onGuestLoginClicked() {
        val code = binding.editGuestCode.text.toString()
        if (binding.editServerAddress.text.isNullOrBlank() || code.isBlank()) {
            showError("서버 주소와 접속 코드를 입력해주세요.")
            return
        }
        saveServerConfig()
        binding.buttonGuestLogin.isEnabled = false

        lifecycleScope.launch {
            try {
                val (guestToken, deviceId) = apiClient.redeemGuestPin(code)
                val intent = Intent(this@LoginActivity, RemoteControlActivity::class.java).apply {
                    putExtra(RemoteControlActivity.EXTRA_DEVICE_ID, deviceId)
                    putExtra(RemoteControlActivity.EXTRA_DEVICE_NAME, "원격 PC")
                    putExtra(RemoteControlActivity.EXTRA_TOKEN, guestToken)
                    putExtra(RemoteControlActivity.EXTRA_IS_GUEST, true)
                }
                startActivity(intent)
            } catch (e: Exception) {
                showError(e.message ?: "접속에 실패했습니다.")
            } finally {
                binding.buttonGuestLogin.isEnabled = true
            }
        }
    }

    private fun goToDeviceList() {
        startActivity(Intent(this, DeviceListActivity::class.java))
        finish()
    }

    private fun showError(message: String) {
        binding.textLoginError.text = message
        binding.textLoginError.visibility = android.view.View.VISIBLE
    }
}
