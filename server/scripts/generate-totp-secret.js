// 2FA(TOTP)를 켜고 싶을 때 1회 실행하는 헬퍼.
// 실행 결과로 나온 secret을 .env의 TOTP_SECRET에 넣고 서버를 재시작하면
// 로그인 시 비밀번호 + 인증앱 6자리 코드를 함께 요구한다.
import * as OTPAuth from "otpauth";

const secret = new OTPAuth.Secret({ size: 20 });
const totp = new OTPAuth.TOTP({
  issuer: "DeskControl",
  label: "owner",
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  secret,
});

console.log("아래 값을 server/.env 의 TOTP_SECRET 에 붙여넣고 서버를 재시작하세요:\n");
console.log(`TOTP_SECRET=${secret.base32}\n`);
console.log("Google Authenticator / Authy 등에 아래 주소를 '수동 입력'하거나,");
console.log("QR 코드 생성 사이트에 아래 URI를 붙여넣어 스캔하세요:\n");
console.log(totp.toString());
