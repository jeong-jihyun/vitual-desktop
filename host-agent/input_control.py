"""웹/Android 클라이언트에서 전달된 입력 이벤트를 실제 마우스/키보드로 주입한다."""

from pynput.mouse import Controller as MouseController, Button
from pynput.keyboard import Controller as KeyboardController, Key

mouse = MouseController()
keyboard = KeyboardController()

# 브라우저 KeyboardEvent.code -> pynput 특수키 매핑
_SPECIAL_KEYS = {
    "Enter": Key.enter,
    "Backspace": Key.backspace,
    "Tab": Key.tab,
    "Escape": Key.esc,
    "Space": Key.space,
    "ArrowUp": Key.up,
    "ArrowDown": Key.down,
    "ArrowLeft": Key.left,
    "ArrowRight": Key.right,
    "Delete": Key.delete,
    "ShiftLeft": Key.shift,
    "ShiftRight": Key.shift_r,
    "ControlLeft": Key.ctrl,
    "ControlRight": Key.ctrl_r,
    "AltLeft": Key.alt,
    "AltRight": Key.alt_r,
    "MetaLeft": Key.cmd,
    "MetaRight": Key.cmd,
    "CapsLock": Key.caps_lock,
    "Home": Key.home,
    "End": Key.end,
    "PageUp": Key.page_up,
    "PageDown": Key.page_down,
    "F1": Key.f1, "F2": Key.f2, "F3": Key.f3, "F4": Key.f4,
    "F5": Key.f5, "F6": Key.f6, "F7": Key.f7, "F8": Key.f8,
    "F9": Key.f9, "F10": Key.f10, "F11": Key.f11, "F12": Key.f12,
}

_MOUSE_BUTTONS = {0: Button.left, 1: Button.middle, 2: Button.right}


def _resolve_key(code: str, key: str):
    if code in _SPECIAL_KEYS:
        return _SPECIAL_KEYS[code]
    if len(key) == 1:
        return key
    return None


def apply_input_event(event: dict, screen_size: tuple[int, int]) -> None:
    """event: 웹 클라이언트가 보낸 JSON 딕셔너리.
    screen_size: (width, height) - 클라이언트가 보내는 정규화 좌표(0~1)를 실제 픽셀로 변환하기 위함.
    """
    kind = event.get("type")

    if kind == "mousemove":
        x = int(event["x"] * screen_size[0])
        y = int(event["y"] * screen_size[1])
        mouse.position = (x, y)

    elif kind == "mousedown":
        btn = _MOUSE_BUTTONS.get(event.get("button", 0))
        if btn:
            mouse.press(btn)

    elif kind == "mouseup":
        btn = _MOUSE_BUTTONS.get(event.get("button", 0))
        if btn:
            mouse.release(btn)

    elif kind == "wheel":
        mouse.scroll(0, -event.get("deltaY", 0) / 100)

    elif kind == "keydown":
        key = _resolve_key(event.get("code", ""), event.get("key", ""))
        if key is not None:
            keyboard.press(key)

    elif kind == "keyup":
        key = _resolve_key(event.get("code", ""), event.get("key", ""))
        if key is not None:
            keyboard.release(key)
