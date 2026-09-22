import os from 'node:os';
import { execFileSync } from 'node:child_process';

/** IPv4 адреса всех активных интерфейсов (без loopback). */
export function listLanIPv4(): Array<{ iface: string; address: string }> {
  const out: Array<{ iface: string; address: string }> = [];
  const ifaces = os.networkInterfaces();
  for (const [name, entries] of Object.entries(ifaces)) {
    if (!entries) continue;
    for (const e of entries) {
      if (e.internal) continue;
      if (e.family !== 'IPv4' && (e.family as unknown) !== 4) continue;
      out.push({ iface: name, address: e.address });
    }
  }
  return out;
}

export function primaryLanIPv4(): string | null {
  const preferred = ['en0', 'en1', 'eth0', 'wlan0'];
  const all = listLanIPv4();
  for (const name of preferred) {
    const hit = all.find((a) => a.iface === name);
    if (hit) return hit.address;
  }
  return all[0]?.address ?? null;
}

/** Имя Wi‑Fi на macOS (если есть). */
export function readMacWifiSsid(): string | null {
  if (process.platform !== 'darwin') return null;
  try {
    const raw = execFileSync('networksetup', ['-getairportnetwork', 'en0'], {
      encoding: 'utf8',
      timeout: 2000,
    }).trim();
    if (raw.startsWith('Current Wi-Fi Network:')) {
      return raw.replace('Current Wi-Fi Network:', '').trim() || null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function networkHint() {
  const addresses = listLanIPv4();
  const wifi = readMacWifiSsid();
  const primary = primaryLanIPv4();
  const label = wifi
    ? `Wi‑Fi «${wifi}»`
    : primary
      ? `Локальная сеть · ${primary}`
      : 'Сеть не определена';
  return {
    label,
    wifiSsid: wifi,
    primary,
    addresses,
    port: Number(process.env.PORT || 4000),
  };
}
