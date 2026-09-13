export interface MonitorInfo {
  index: number;
  width: number;
  height: number;
}

interface Props {
  monitors: MonitorInfo[];
  selected: number;
  onSelect: (index: number) => void;
}

// 모니터가 1개뿐이면 굳이 선택 UI를 보여줄 필요가 없다.
export function MonitorSelector({ monitors, selected, onSelect }: Props) {
  if (monitors.length <= 1) return null;

  return (
    <div className="monitor-selector">
      {monitors.map((m) => (
        <button
          key={m.index}
          className={m.index === selected ? "monitor-button active" : "monitor-button"}
          onClick={() => onSelect(m.index)}
        >
          모니터 {m.index} ({m.width}x{m.height})
        </button>
      ))}
    </div>
  );
}
