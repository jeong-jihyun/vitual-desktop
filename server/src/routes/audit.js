import { Router } from "express";
import { db } from "../db.js";
import { requireUser } from "../middleware.js";

export const auditRouter = Router();

// 최근 활동 로그 (최신순). 개인용 소규모 도구이므로 단순 페이지네이션만 지원.
auditRouter.get("/", requireUser, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const entries = [...db.state.auditLog].reverse().slice(0, limit);
  res.json({ entries });
});
