package com.deskcontrol.app

data class Device(
    val id: String,
    val name: String,
    val status: String, // "online" | "offline"
    val lastSeenAt: String?,
    val createdAt: String
) {
    val isOnline: Boolean get() = status == "online"
}
