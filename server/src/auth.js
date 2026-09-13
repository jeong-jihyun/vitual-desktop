import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === "change-me-to-a-long-random-string") {
  throw new Error(
    "JWT_SECRET 환경변수를 안전한 무작위 값으로 설정해주세요 (.env.example 참고)."
  );
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// 소유자 계정 토큰 - 웹 클라이언트가 상시 사용 (계정 기반 등록 기기 접근)
export function signUserToken(user) {
  return jwt.sign({ sub: user.id, type: "user" }, JWT_SECRET, { expiresIn: "30d" });
}

// 호스트 에이전트가 페어링 완료 후 영구 보관하는 토큰
export function signDeviceToken(device) {
  return jwt.sign({ sub: device.id, type: "device" }, JWT_SECRET, { expiresIn: "3650d" });
}

// 1회성 PIN 코드로 발급되는 단기 게스트 토큰 (계정 로그인 없이 1회 접속)
export function signGuestToken(deviceId) {
  return jwt.sign({ sub: deviceId, type: "guest" }, JWT_SECRET, { expiresIn: "2m" });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
