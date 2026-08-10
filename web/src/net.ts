import os from "node:os";
import QRCode from "qrcode";
import { ACCESS_TOKEN } from "./auth.js";
import { PORT } from "./config.js";

/** Non-internal IPv4 addresses — the ones a phone on the same Wi-Fi can reach. */
export function lanAddresses(): string[] {
  const found: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) found.push(entry.address);
    }
  }
  // Prefer the usual home-network ranges; a docker0 or VPN address is rarely
  // the one the phone can see.
  return found.sort((a, b) => Number(preferred(b)) - Number(preferred(a)));
}

function preferred(address: string): boolean {
  return address.startsWith("192.168.") || address.startsWith("10.");
}

export function mobileUrl(host = lanAddresses()[0]): string | undefined {
  if (!host) return undefined;
  const suffix = ACCESS_TOKEN ? `/?k=${ACCESS_TOKEN}` : "/";
  return `http://${host}:${PORT}${suffix}`;
}

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}

export async function qrTerminal(url: string): Promise<string> {
  return QRCode.toString(url, { type: "terminal", small: true });
}
