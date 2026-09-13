package com.deskcontrol.app

import android.content.Context
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.inputmethod.InputMethodManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.deskcontrol.app.databinding.ActivityRemoteControlBinding
import org.json.JSONObject
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.MediaStreamTrack
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.VideoTrack
import java.nio.ByteBuffer

/**
 * web-client/src/components/RemoteView.tsx 의 WebRTC 로직을 안드로이드 네이티브로
 * 동일하게 구현한다: 클라이언트가 offer를 만들고, video는 recvonly, 입력은
 * "input"이라는 이름의 DataChannel로 host-agent/input_control.py가 그대로 이해하는
 * JSON 스키마({type, x, y, button, code, key})로 전송한다.
 */
class RemoteControlActivity : AppCompatActivity() {

    private lateinit var binding: ActivityRemoteControlBinding
    private lateinit var tokenStore: TokenStore
    private lateinit var signalingClient: SignalingClient

    private lateinit var eglBase: EglBase
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var dataChannel: DataChannel? = null

    private var lastNormX = 0.5
    private var lastNormY = 0.5

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRemoteControlBinding.inflate(layoutInflater)
        setContentView(binding.root)

        tokenStore = TokenStore(this)
        val deviceId = intent.getStringExtra(EXTRA_DEVICE_ID) ?: return finishWithError("잘못된 접속 정보입니다.")
        val deviceName = intent.getStringExtra(EXTRA_DEVICE_NAME) ?: "PC"
        val token = intent.getStringExtra(EXTRA_TOKEN) ?: return finishWithError("잘못된 접속 정보입니다.")
        val isGuest = intent.getBooleanExtra(EXTRA_IS_GUEST, false)

        binding.textDeviceName.text = deviceName + if (isGuest) " (게스트)" else ""
        binding.textStatus.text = getString(R.string.status_connecting)

        setupWebRtc()
        setupTouchInput()
        setupKeyboardInput()

        binding.buttonClose.setOnClickListener { finish() }

        signalingClient = SignalingClient(
            wsBaseUrl = tokenStore.wsBaseUrl(),
            token = token,
            deviceId = deviceId,
            listener = signalingListener
        )
        signalingClient.connect()
    }

    // ---------- WebRTC ----------

    private fun setupWebRtc() {
        if (!factoryInitialized) {
            PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(applicationContext)
                    .createInitializationOptions()
            )
            factoryInitialized = true
        }

        eglBase = EglBase.create()
        binding.surfaceRenderer.init(eglBase.eglBaseContext, null)

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .createPeerConnectionFactory()
    }

    private val signalingListener = object : SignalingClient.Listener {
        override fun onSessionReady() {
            runOnUiThread { startPeerConnection() }
        }

        override fun onAnswer(sdp: String) {
            peerConnection?.setRemoteDescription(
                SimpleSdpObserver(),
                SessionDescription(SessionDescription.Type.ANSWER, sdp)
            )
        }

        override fun onRemoteIce(candidate: String, sdpMid: String?, sdpMLineIndex: Int?) {
            peerConnection?.addIceCandidate(IceCandidate(sdpMid ?: "", sdpMLineIndex ?: 0, candidate))
        }

        override fun onSessionEnd() {
            runOnUiThread {
                binding.textStatus.text = "세션이 종료되었습니다."
            }
        }

        override fun onSocketClosed(reason: String) {
            runOnUiThread {
                binding.textStatus.text = reason
            }
        }
    }

    private fun startPeerConnection() {
        val rtcConfig = PeerConnection.RTCConfiguration(
            listOf(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())
        )

        val pc = peerConnectionFactory!!.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                signalingClient.sendIceCandidate(candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex)
            }

            override fun onAddTrack(receiver: RtpReceiver, streams: Array<out MediaStream>) {
                val track = receiver.track()
                if (track is VideoTrack) {
                    runOnUiThread { track.addSink(binding.surfaceRenderer) }
                }
            }

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {
                runOnUiThread { binding.textStatus.text = "연결 상태: $state" }
            }

            override fun onSignalingChange(state: PeerConnection.SignalingState) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) {}
            override fun onAddStream(stream: MediaStream) {}
            override fun onRemoveStream(stream: MediaStream) {}
            override fun onDataChannel(channel: DataChannel) {}
            override fun onRenegotiationNeeded() {}
        }) ?: return finishWithError("PeerConnection을 생성하지 못했습니다.")

        peerConnection = pc
        pc.addTransceiver(
            MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO,
            RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.RECV_ONLY)
        )

        dataChannel = pc.createDataChannel("input", DataChannel.Init())

        pc.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription) {
                pc.setLocalDescription(SimpleSdpObserver(), sdp)
                signalingClient.sendOffer(sdp.description)
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String) {
                runOnUiThread { Toast.makeText(this@RemoteControlActivity, "offer 생성 실패: $error", Toast.LENGTH_SHORT).show() }
            }
            override fun onSetFailure(error: String) {}
        }, MediaConstraints())
    }

    // ---------- 입력 전송 (host-agent/input_control.py 스키마와 동일) ----------

    private fun sendInput(json: JSONObject) {
        val channel = dataChannel ?: return
        if (channel.state() != DataChannel.State.OPEN) return
        val bytes = json.toString().toByteArray(Charsets.UTF_8)
        channel.send(DataChannel.Buffer(ByteBuffer.wrap(bytes), false))
    }

    private fun setupTouchInput() {
        binding.surfaceRenderer.setOnTouchListener { view, event ->
            val x = (event.x / view.width).coerceIn(0f, 1f).toDouble()
            val y = (event.y / view.height).coerceIn(0f, 1f).toDouble()
            lastNormX = x
            lastNormY = y

            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    sendInput(JSONObject().put("type", "mousemove").put("x", x).put("y", y))
                    sendInput(JSONObject().put("type", "mousedown").put("button", 0))
                }
                MotionEvent.ACTION_MOVE -> {
                    sendInput(JSONObject().put("type", "mousemove").put("x", x).put("y", y))
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    sendInput(JSONObject().put("type", "mouseup").put("button", 0))
                }
            }
            true
        }

        binding.buttonRightClick.setOnClickListener {
            sendInput(JSONObject().put("type", "mousedown").put("button", 2))
            sendInput(JSONObject().put("type", "mouseup").put("button", 2))
        }
    }

    private fun sendKey(code: String, key: String) {
        sendInput(JSONObject().put("type", "keydown").put("code", code).put("key", key))
        sendInput(JSONObject().put("type", "keyup").put("code", code).put("key", key))
    }

    private fun setupKeyboardInput() {
        binding.buttonToggleKeyboard.setOnClickListener {
            binding.editHiddenInput.requestFocus()
            val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(binding.editHiddenInput, InputMethodManager.SHOW_IMPLICIT)
        }
        binding.buttonEnter.setOnClickListener { sendKey("Enter", "Enter") }
        binding.buttonBackspace.setOnClickListener { sendKey("Backspace", "Backspace") }

        // 소프트 키보드로 입력된 문자를 한 글자씩 캡처해 전송하고 즉시 비운다.
        // (code는 물리 키가 없어 특수키 매핑 없이 문자 자체를 key로만 보내며,
        // host-agent의 input_control._resolve_key가 len(key)==1인 경우를 문자로 처리한다.)
        binding.editHiddenInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val text = s?.toString().orEmpty()
                if (text.isNotEmpty()) {
                    text.forEach { ch -> sendKey("", ch.toString()) }
                    s?.clear()
                }
            }
        })
        binding.editHiddenInput.setOnKeyListener { _, keyCode, event ->
            if (event.action == KeyEvent.ACTION_DOWN && keyCode == KeyEvent.KEYCODE_DEL) {
                sendKey("Backspace", "Backspace")
                true
            } else {
                false
            }
        }
    }

    private fun finishWithError(message: String): Nothing {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        finish()
        throw IllegalStateException(message)
    }

    override fun onDestroy() {
        super.onDestroy()
        dataChannel?.close()
        peerConnection?.close()
        peerConnectionFactory?.dispose()
        if (::binding.isInitialized) binding.surfaceRenderer.release()
        if (::eglBase.isInitialized) eglBase.release()
        if (::signalingClient.isInitialized) signalingClient.close()
    }

    private class SimpleSdpObserver : SdpObserver {
        override fun onCreateSuccess(sdp: SessionDescription) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(error: String) {}
        override fun onSetFailure(error: String) {}
    }

    companion object {
        const val EXTRA_DEVICE_ID = "extra_device_id"
        const val EXTRA_DEVICE_NAME = "extra_device_name"
        const val EXTRA_TOKEN = "extra_token"
        const val EXTRA_IS_GUEST = "extra_is_guest"

        private var factoryInitialized = false
    }
}
