import * as OTPAuth from "otpauth";

// 2FA는 선택 기능이다. .env에 TOTP_SECRET을 설정한 경우에만 로그인 시
// 인증앱(Google Authenticator 등) 6자리 코드를 추가로 요구한다.
// 설정하지 않으면 기존처럼 비밀번호만으로 로그인한다 (하위 호환).

export function isTotpEnabled() {
  return Boolean(process.env.TOTP_SECRET);
}

export function verifyTotp(code) {
  const secret = process.env.TOTP_SECRET;
  if (!secret) return true; // 2FA 비활성화 상태

  const totp = new OTPAuth.TOTP({
    issuer: "DeskControl",
    label: "owner",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  // 시계 오차를 감안해 앞뒤 1스텝(±30초)까지 허용
  const delta = totp.validate({ token: String(code || ""), window: 1 });
  return delta !== null;
}
