"""mss로 화면을 캡처해 aiortc VideoStreamTrack으로 인코딩한다."""

import asyncio
from concurrent.futures import ThreadPoolExecutor

import mss
import numpy as np
from aiortc import VideoStreamTrack
from av import VideoFrame


def list_monitors() -> list:
    """사용 가능한 모니터 목록을 조회한다 (index 0은 전체 화면 합산이라 제외)."""
    with mss.mss() as sct:
        return [
            {"index": i, "width": m["width"], "height": m["height"]}
            for i, m in enumerate(sct.monitors)
            if i >= 1
        ]


class ScreenCaptureTrack(VideoStreamTrack):
    def __init__(self, fps: int = 20, monitor_index: int = 1, on_frame=None):
        super().__init__()
        self._monitor_index = monitor_index
        self._frame_interval = 1 / fps
        self._sct = None  # 캡처 전담 스레드에서 최초 호출 시 생성 (아래 설명 참고)
        # mss 인스턴스는 스레드 세이프하지 않다 - 생성한 스레드에서만 grab()을
        # 호출해야 하므로, asyncio 기본 executor(스레드가 매번 바뀔 수 있음) 대신
        # 항상 같은 스레드 하나만 쓰는 전용 executor를 사용한다.
        self._executor = ThreadPoolExecutor(max_workers=1)
        # 세션 녹화 등 이 트랙이 캡처한 프레임을 함께 소비하고 싶을 때 쓰는 콜백.
        self._on_frame = on_frame

    def set_monitor(self, index: int) -> bool:
        """실행 중 캡처 대상 모니터를 변경한다 (클라이언트의 select-monitor 요청 처리용)."""
        if index < 1:
            return False
        self._monitor_index = index
        return True

    async def recv(self):
        pts, time_base = await self.next_timestamp()

        loop = asyncio.get_event_loop()
        img = await loop.run_in_executor(self._executor, self._grab)

        frame = VideoFrame.from_ndarray(img, format="bgra")
        frame = frame.reformat(format="yuv420p")
        frame.pts = pts
        frame.time_base = time_base

        if self._on_frame:
            self._on_frame(frame)

        await asyncio.sleep(self._frame_interval)
        return frame

    def _grab(self):
        # 항상 self._executor의 유일한 워커 스레드에서만 실행되므로,
        # 이 스레드에서 최초 1회만 mss 인스턴스를 만들어 재사용해도 안전하다.
        if self._sct is None:
            self._sct = mss.mss()
        monitors = self._sct.monitors
        index = self._monitor_index if self._monitor_index < len(monitors) else 1
        shot = self._sct.grab(monitors[index])
        return np.array(shot)
