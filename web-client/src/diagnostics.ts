// 개발자도구를 열 줄 몰라도, 버튼 하나로 문제 상황을 저(Claude)에게 그대로
// 붙여넣을 수 있게 하기 위한 최소한의 진단 정보 수집기.
// 서버로 전송하지 않는다 - 이 브라우저 메모리 안에만 보관하고, 사용자가
// 직접 복사해서 대화창에 붙여넣는 방식이다.

const MAX_ENTRIES = 50;
const entries: string[] = [];

function record(line: string) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  entries.push(stamped);
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function recordEvent(line: string): void {
  record(line);
}

export function installGlobalErrorReporter(): void {
  window.addEventListener("error", (e) => {
    record(`JS 오류: ${e.message} (${e.filename}:${e.lineno}:${e.colno})`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    record(`처리 안 된 Promise 거부: ${String(e.reason)}`);
  });
}

export function getDiagnosticReport(): string {
  const lines = [
    "=== 가상PC 원격제어 - 진단 정보 ===",
    `시각: ${new Date().toString()}`,
    `주소: ${location.href}`,
    `브라우저: ${navigator.userAgent}`,
    `화면 크기: ${window.innerWidth}x${window.innerHeight}`,
    `보안 컨텍스트(HTTPS/localhost 여부): ${window.isSecureContext}`,
    "",
    "최근 기록 (오래된 것부터):",
    ...(entries.length ? entries : ["(기록된 이벤트 없음)"]),
  ];
  return lines.join("\n");
}
