import { useEffect, useState } from "react";
import { api } from "./api";
import type { Device } from "./types";
import { LoginForm } from "./components/LoginForm";
import { GuestAccess } from "./components/GuestAccess";
import { DeviceList } from "./components/DeviceList";
import { PairDevice } from "./components/PairDevice";
import { RemoteView } from "./components/RemoteView";
import { AuditLog } from "./components/AuditLog";

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("deskcontrol-token"));
  const [devices, setDevices] = useState<Device[]>([]);
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);
  const [guestSession, setGuestSession] = useState<{ token: string; deviceId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshDevices(t: string) {
    try {
      const { devices } = await api.listDevices(t);
      setDevices(devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "기기 목록을 불러오지 못했습니다.");
      setToken(null);
      localStorage.removeItem("deskcontrol-token");
    }
  }

  useEffect(() => {
    if (token) refreshDevices(token);
  }, [token]);

  if (guestSession) {
    return (
      <RemoteView
        device={{ id: guestSession.deviceId, name: "원격 PC", status: "online", lastSeenAt: null, createdAt: "" }}
        wsToken={guestSession.token}
        isGuest
        onClose={() => setGuestSession(null)}
      />
    );
  }

  if (activeDevice && token) {
    return (
      <RemoteView device={activeDevice} wsToken={token} isGuest={false} onClose={() => setActiveDevice(null)} />
    );
  }

  if (!token) {
    return (
      <div className="app-shell">
        <h1>가상PC 원격제어</h1>
        <LoginForm onAuthenticated={setToken} />
        <div className="divider">또는</div>
        <GuestAccess onConnected={(t, deviceId) => setGuestSession({ token: t, deviceId })} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header>
        <h1>가상PC 원격제어</h1>
        <button
          className="link"
          onClick={() => {
            localStorage.removeItem("deskcontrol-token");
            setToken(null);
          }}
        >
          로그아웃
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      <section className="panel">
        <h2>내 PC</h2>
        <DeviceList
          devices={devices}
          onConnect={setActiveDevice}
          onRemove={async (id) => {
            await api.removeDevice(token, id);
            refreshDevices(token);
          }}
        />
      </section>
      <PairDevice token={token} onPaired={() => refreshDevices(token)} />
      <AuditLog token={token} />
    </div>
  );
}
