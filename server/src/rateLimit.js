// 개인용 소규모 도구 기준의 단순 in-memory 레이트 리미터.
// 여러 서버 인스턴스로 수평 확장할 계획이 없으므로 별도 저장소(Redis 등) 없이
// 메모리에 IP별 시도 횟수만 기록한다.

const attempts = new Map(); // ip -> { count, windowStart }

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// windowMs 안에 maxAttempts번 넘게 실패하면 이후 요청을 차단한다.
// 성공 시 recordSuccess(req)로 카운터를 초기화해야 한다.
export function loginRateLimiter({ windowMs = 10 * 60 * 1000, maxAttempts = 5 } = {}) {
  return (req, res, next) => {
    const ip = clientIp(req);
    const now = Date.now();
    const entry = attempts.get(ip);

    if (entry && now - entry.windowStart < windowMs && entry.count >= maxAttempts) {
      const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.set("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        error: `로그인 시도가 너무 많습니다. ${retryAfterSec}초 후 다시 시도해주세요.`,
      });
    }

    req.recordLoginFailure = () => {
      const current = attempts.get(ip);
      if (!current || now - current.windowStart >= windowMs) {
        attempts.set(ip, { count: 1, windowStart: now });
      } else {
        current.count += 1;
      }
    };
    req.recordLoginSuccess = () => {
      attempts.delete(ip);
    };

    next();
  };
}
