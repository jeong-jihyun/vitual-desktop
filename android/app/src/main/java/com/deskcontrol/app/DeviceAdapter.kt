package com.deskcontrol.app

import android.graphics.PorterDuff
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.deskcontrol.app.databinding.ItemDeviceBinding

class DeviceAdapter(
    private val onConnect: (Device) -> Unit,
    private val onRemove: (Device) -> Unit
) : RecyclerView.Adapter<DeviceAdapter.ViewHolder>() {

    private val devices = mutableListOf<Device>()

    fun submitList(newDevices: List<Device>) {
        devices.clear()
        devices.addAll(newDevices)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemDeviceBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(devices[position])
    }

    override fun getItemCount() = devices.size

    inner class ViewHolder(private val binding: ItemDeviceBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(device: Device) {
            binding.textDeviceName.text = device.name
            binding.textDeviceStatus.text = binding.root.context.getString(
                if (device.isOnline) R.string.status_online else R.string.status_offline
            )
            val dotColor = if (device.isOnline) R.color.deskcontrol_accent else R.color.deskcontrol_ink_muted
            binding.viewStatusDot.background.mutate().setColorFilter(
                ContextCompat.getColor(binding.root.context, dotColor),
                PorterDuff.Mode.SRC_IN
            )

            binding.buttonConnect.isEnabled = device.isOnline
            binding.buttonConnect.setOnClickListener { onConnect(device) }
            binding.buttonRemove.setOnClickListener { onRemove(device) }
        }
    }
}
