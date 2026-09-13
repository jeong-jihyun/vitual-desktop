package com.deskcontrol.app

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.deskcontrol.app.databinding.ActivityDeviceListBinding
import com.deskcontrol.app.databinding.DialogPairDeviceBinding
import kotlinx.coroutines.launch

class DeviceListActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDeviceListBinding
    private lateinit var tokenStore: TokenStore
    private lateinit var apiClient: ApiClient
    private lateinit var adapter: DeviceAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDeviceListBinding.inflate(layoutInflater)
        setContentView(binding.root)

        tokenStore = TokenStore(this)
        apiClient = ApiClient(tokenStore)

        binding.toolbar.inflateMenu(R.menu.menu_device_list)
        binding.toolbar.setOnMenuItemClickListener {
            if (it.itemId == R.id.action_logout) {
                tokenStore.clearToken()
                startActivity(Intent(this, LoginActivity::class.java))
                finish()
                true
            } else {
                false
            }
        }

        adapter = DeviceAdapter(
            onConnect = { device ->
                val intent = Intent(this, RemoteControlActivity::class.java).apply {
                    putExtra(RemoteControlActivity.EXTRA_DEVICE_ID, device.id)
                    putExtra(RemoteControlActivity.EXTRA_DEVICE_NAME, device.name)
                    putExtra(RemoteControlActivity.EXTRA_TOKEN, tokenStore.token)
                    putExtra(RemoteControlActivity.EXTRA_IS_GUEST, false)
                }
                startActivity(intent)
            },
            onRemove = { device -> removeDevice(device) }
        )
        binding.recyclerDevices.layoutManager = LinearLayoutManager(this)
        binding.recyclerDevices.adapter = adapter

        binding.swipeRefresh.setOnRefreshListener { refreshDevices() }
        binding.buttonAddDevice.setOnClickListener { showPairDialog() }

        refreshDevices()
    }

    override fun onResume() {
        super.onResume()
        refreshDevices()
    }

    private fun refreshDevices() {
        binding.swipeRefresh.isRefreshing = true
        lifecycleScope.launch {
            try {
                val devices = apiClient.listDevices()
                adapter.submitList(devices)
                binding.textEmpty.visibility = if (devices.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE
            } catch (e: Exception) {
                Toast.makeText(this@DeviceListActivity, e.message ?: "목록을 불러오지 못했습니다.", Toast.LENGTH_SHORT).show()
            } finally {
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun removeDevice(device: Device) {
        lifecycleScope.launch {
            try {
                apiClient.removeDevice(device.id)
                refreshDevices()
            } catch (e: Exception) {
                Toast.makeText(this@DeviceListActivity, e.message ?: "삭제에 실패했습니다.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun showPairDialog() {
        val dialogBinding = DialogPairDeviceBinding.inflate(LayoutInflater.from(this))
        AlertDialog.Builder(this)
            .setTitle(R.string.action_add_device)
            .setView(dialogBinding.root)
            .setPositiveButton(R.string.action_register) { _, _ ->
                val code = dialogBinding.editPairCode.text.toString()
                val name = dialogBinding.editDeviceName.text.toString().ifBlank { "Windows PC" }
                lifecycleScope.launch {
                    try {
                        apiClient.claimDevice(code, name)
                        refreshDevices()
                    } catch (e: Exception) {
                        Toast.makeText(this@DeviceListActivity, e.message ?: "등록에 실패했습니다.", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }
}
