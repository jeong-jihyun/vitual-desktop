"""접속 세션 화면을 로컬 mp4 파일로 저장한다.

aiortc가 이미 의존하는 PyAV(av 패키지)를 그대로 재사용해 별도의 무거운
영상 라이브러리(OpenCV 등)를 추가하지 않는다. ScreenCaptureTrack이 스트리밍용으로
만든 프레임(yuv420p)을 그대로 넘겨받아 인코딩하므로 화면을 두 번 캡처하지 않는다.
"""

import logging
import os
import time
from fractions import Fraction

import av

logger = logging.getLogger(__name__)

RECORDINGS_DIR = os.environ.get("DESKCONTROL_RECORDINGS_DIR", "recordings")


class SessionRecorder:
    def __init__(self, fps: int = 20, output_dir: str = RECORDINGS_DIR):
        self._fps = fps
        self._output_dir = output_dir
        self._container = None
        self._stream = None
        self._frame_count = 0
        os.makedirs(self._output_dir, exist_ok=True)

    @property
    def is_recording(self) -> bool:
        return self._container is not None

    def start(self, session_id: str, width: int, height: int) -> str:
        filename = f"{time.strftime('%Y%m%d-%H%M%S')}_{session_id[:8]}.mp4"
        path = os.path.join(self._output_dir, filename)

        self._container = av.open(path, mode="w")
        self._stream = self._container.add_stream("h264", rate=self._fps)
        self._stream.width = width
        self._stream.height = height
        self._stream.pix_fmt = "yuv420p"
        # add_stream 직후에는 codec_context.time_base가 아직 비어있어 직접 지정해야
        # frame.time_base를 설정할 때 에러가 나지 않는다.
        self._stream.codec_context.time_base = Fraction(1, self._fps)
        self._time_base = self._stream.codec_context.time_base
        self._frame_count = 0

        logger.info("[세션 녹화 시작] %s", path)
        return path

    def write_frame(self, frame) -> None:
        if not self._container:
            return
        try:
            # 스트리밍용 프레임은 WebRTC 자체 타임스탬프(pts/time_base)를 갖고 있어
            # 그대로 이 파일의 컨테이너에 먹싱하면 안 된다 - 녹화 파일 전용으로
            # 프레임 순번 기반의 새 pts를 매긴다.
            recording_frame = frame.reformat(format="yuv420p")
            recording_frame.pts = self._frame_count
            recording_frame.time_base = self._time_base

            for packet in self._stream.encode(recording_frame):
                self._container.mux(packet)
            self._frame_count += 1
        except Exception:
            # 녹화 실패로 화면 스트리밍 자체(세션)까지 끊기면 안 되므로 여기서 막는다.
            logger.exception("녹화 프레임 인코딩 중 오류 발생 - 이번 프레임은 건너뜀")

    def stop(self) -> None:
        if not self._container:
            return
        for packet in self._stream.encode(None):  # 인코더에 남은 프레임 flush
            self._container.mux(packet)
        self._container.close()
        logger.info("[세션 녹화 종료] 총 %d 프레임", self._frame_count)
        self._container = None
        self._stream = None
        self._frame_count = 0
