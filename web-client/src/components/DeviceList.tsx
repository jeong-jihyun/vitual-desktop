import type { Device } from "../types";

interface Props {
  devices: Device[];
  onConnect: (device: Device) => void;
  onRemove: (id: string) => void;
}

export function DeviceList({ devices, onConnect, onRemove }: Props) {
  if (devices.length === 0) {
    return <p className="hint">등록된 PC가 없습니다. 아래에서 새 PC를 등록하세요.</p>;
  }

  return (
    <ul className="device-list">
      {devices.map((d) => (
        <li key={d.id}>
          <span className={`status-dot ${d.status}`} aria-hidden="true" />
          <span className="device-name">{d.name}</span>
          <span className="device-status">{d.status === "online" ? "온라인" : "오프라인"}</span>
          <button disabled={d.status !== "online"} onClick={() => onConnect(d)}>
            접속
          </button>
          <button className="link danger" onClick={() => onRemove(d.id)}>
            삭제
          </button>
        </li>
      ))}
    </ul>
  );
}
