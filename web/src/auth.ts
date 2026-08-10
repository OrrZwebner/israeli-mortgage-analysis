import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { MOBILE } from "./config.js";

const COOKIE = "mortgage_web_token";

/**
 * A fresh token per start. Nothing persists it, so closing the server revokes
 * every phone that was paired with it.
 */
export const ACCESS_TOKEN = MOBILE ? randomBytes(18).toString("base64url") : undefined;

function matches(candidate: string): boolean {
  if (!ACCESS_TOKEN) return true;
  const a = Buffer.from(candidate);
  const b = Buffer.from(ACCESS_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
}

/**
 * Loopback is always trusted — on a desktop-only run there is nothing to gate.
 * Anything arriving over the network needs the token, once: the first request
 * carries `?k=…` (that is what the QR code encodes) and gets a cookie back, so
 * later asset, API, and EventSource requests authenticate on their own.
 */
export function accessControl(req: Request, res: Response, next: NextFunction): void {
  if (!ACCESS_TOKEN) {
    next();
    return;
  }

  const address = req.socket.remoteAddress ?? "";
  if (address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1") {
    next();
    return;
  }

  const fromQuery = typeof req.query.k === "string" ? req.query.k : undefined;
  if (fromQuery && matches(fromQuery)) {
    res.cookie(COOKIE, ACCESS_TOKEN, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 12 * 60 * 60 * 1000,
    });
    next();
    return;
  }

  const fromCookie = readCookie(req.headers.cookie, COOKIE);
  const fromHeader = req.get("x-access-token");
  if ((fromCookie && matches(fromCookie)) || (fromHeader && matches(fromHeader))) {
    next();
    return;
  }

  res
    .status(401)
    .type("text/html; charset=utf-8")
    .send(
      `<!DOCTYPE html><html lang="he" dir="rtl"><meta charset="utf-8">
       <meta name="viewport" content="width=device-width, initial-scale=1">
       <body style="font-family:system-ui;padding:2rem;line-height:1.6;color:#123a6b">
       <h1 style="font-size:1.25rem">נדרשת סריקה של קוד ה-QR</h1>
       <p>הכתובת הזו פתוחה רק דרך הקישור שמופיע במסוף שבו הופעל השרת, או דרך קוד ה-QR שבדף במחשב.</p>
       </body></html>`,
    );
}
