// Kaba kuvvet ve toplu kayıt denemelerine karşı bellek içi sınırlar.
// Tek sunucu örneği varsayar (senkron kilidi ve önbellek gibi); çok örnekte paylaşımlı depoya taşınmalı.

import { processState } from "./process-state.ts";

const MAX_KEYS = 10_000;

type Fail = { n: number; until: number };
type Win = { n: number; until: number };
// Sayaçlar süreç genelinde tektir (web ve mobil giriş aynı sayacı görür): src/lib/process-state.ts
const fails = processState("throttle:fails", () => new Map<string, Fail>());
const wins = processState("throttle:wins", () => new Map<string, Win>());

function prune<T extends { until: number }>(m: Map<string, T>, now: number) {
  if (m.size > MAX_KEYS) for (const [k, v] of m) if (v.until < now) m.delete(k);
}

/** Hatalı giriş kilidi: `max` hatadan sonra son hatadan itibaren `minutes` dakika kilitli. */
export function failBlocked(key: string, max = 8) {
  const f = fails.get(key);
  if (f && f.until < Date.now()) fails.delete(key);
  return (fails.get(key)?.n ?? 0) >= max;
}
export function failRecord(key: string, minutes = 15) {
  const now = Date.now(), f = fails.get(key);
  fails.set(key, { n: (f && f.until >= now ? f.n : 0) + 1, until: now + minutes * 60_000 });
  prune(fails, now);
}
export const failClear = (key: string) => void fails.delete(key);

/** Sabit pencere sayacı: pencere içinde `max` denemeyi aşınca true döner (deneme sayılır). */
export function overLimit(key: string, max: number, windowMs: number) {
  const now = Date.now(), w = wins.get(key);
  if (!w || w.until < now) {
    wins.set(key, { n: 1, until: now + windowMs });
    prune(wins, now);
    return max < 1;
  }
  return ++w.n > max;
}

/** İsteği yapanın IP'si: vekil sunucunun eklediği x-forwarded-for'un ilk değeri. */
export function clientIp(h: { get(name: string): string | null }) {
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip")?.trim() || "yerel";
}

/** Kullanıcı girişi (web ve mobil aynı sayacı paylaşır): e-posta başına 8, IP başına 30 hata / 15 dk. */
export const loginBlocked = (email: string, ip: string) => failBlocked(`giris:${email}`, 8) || failBlocked(`giris-ip:${ip}`, 30);
export function loginFailed(email: string, ip: string) {
  failRecord(`giris:${email}`);
  failRecord(`giris-ip:${ip}`);
}
export const loginOk = (email: string) => failClear(`giris:${email}`);
