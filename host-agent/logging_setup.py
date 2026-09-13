"""에이전트가 실행 중인 콘솔 창을 닫아버려도 로그가 남아있도록 파일에도 기록한다.

버그가 생겼을 때 사용자가 이 파일(기본 agent.log)만 찾아서 보내주면 되게 하는 것이
목적이다 - 콘솔 스크롤을 놓쳤거나 창을 닫아버려도 문제 없다.
"""

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_PATH = Path(__file__).resolve().parent / "agent.log"


def setup_logging() -> logging.Logger:
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 2MB씩 3개까지 보관 (약 6MB) - 계속 켜둬도 디스크를 무한정 잡아먹지 않는다.
    file_handler = RotatingFileHandler(LOG_PATH, maxBytes=2 * 1024 * 1024, backupCount=3, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    def log_uncaught_exception(exc_type, exc_value, exc_traceback):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return
        logger.critical("처리되지 않은 예외로 에이전트가 종료됩니다.", exc_info=(exc_type, exc_value, exc_traceback))

    sys.excepthook = log_uncaught_exception

    return logger
