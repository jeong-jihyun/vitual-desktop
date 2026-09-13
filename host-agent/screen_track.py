"""mss로 화면을 캡처해 aiortc VideoStreamTrack으로 인코딩한다."""

import asyncio

import mss
import numpy as np
from aiortc import VideoStreamTrack
from av import VideoFrame


class ScreenCaptureTrack(VideoStreamTrack):
    def __init__(self, fps: int = 20, monitor_index: int = 1):
        super().__init__()
        self._sct = mss.mss()
        self._monitor = self._sct.monitors[monitor_index]
        self._frame_interval = 1 / fps

    async def recv(self):
        pts, time_base = await self.next_timestamp()

        loop = asyncio.get_event_loop()
        img = await loop.run_in_executor(None, self._grab)

        frame = VideoFrame.from_ndarray(img, format="bgra")
        frame = frame.reformat(format="yuv420p")
        frame.pts = pts
        frame.time_base = time_base

        await asyncio.sleep(self._frame_interval)
        return frame

    def _grab(self):
        shot = self._sct.grab(self._monitor)
        return np.array(shot)
