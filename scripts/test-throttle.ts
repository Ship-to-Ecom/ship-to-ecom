// Giriş, kayıt ve webhook deneme sınırları (src/lib/throttle.ts).
import assert from "node:assert/strict";
import { clientIp, failBlocked, failClear, failRecord, loginBlocked, loginFailed, loginOk, overLimit } from "../src/lib/throttle.ts";

// E-posta başına 8 hata kilitler; başarılı giriş e-posta sayacını sıfırlar.
for (let i = 0; i < 7; i++) loginFailed("a@x.com", "1.1.1.1");
assert.equal(loginBlocked("a@x.com", "1.1.1.1"), false);
loginFailed("a@x.com", "1.1.1.1");
assert.equal(loginBlocked("a@x.com", "9.9.9.9"), true, "başka IP'den de aynı e-posta kilitli");
loginOk("a@x.com");
assert.equal(loginBlocked("a@x.com", "9.9.9.9"), false);

// IP başına 30 hata: farklı e-postalar denense de kilitlenir, başka IP etkilenmez.
for (let i = 0; i < 30; i++) loginFailed(`u${i}@x.com`, "2.2.2.2");
assert.equal(loginBlocked("yeni@x.com", "2.2.2.2"), true);
assert.equal(loginBlocked("yeni@x.com", "3.3.3.3"), false);

// Kilit süresi dolunca sayaç sıfırdan başlar.
const now = Date.now;
failRecord("k", 15); failRecord("k", 15);
assert.equal(failBlocked("k", 2), true);
Date.now = () => now() + 16 * 60_000;
assert.equal(failBlocked("k", 2), false);
failRecord("k", 15);
assert.equal(failBlocked("k", 2), false, "eski hatalar yeni pencereye taşınmaz");
Date.now = now;
failClear("k");

// Sabit pencere: 5 deneme serbest, 6. reddedilir; pencere bitince yeniden açılır.
for (let i = 0; i < 5; i++) assert.equal(overLimit("kayit:1", 5, 3600_000), false);
assert.equal(overLimit("kayit:1", 5, 3600_000), true);
Date.now = () => now() + 3601_000;
assert.equal(overLimit("kayit:1", 5, 3600_000), false);
Date.now = now;

// IP: x-forwarded-for ilk değeri, yoksa x-real-ip, yoksa "yerel".
const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
assert.equal(clientIp(h({ "x-forwarded-for": " 5.5.5.5 , 10.0.0.1" })), "5.5.5.5");
assert.equal(clientIp(h({ "x-real-ip": "6.6.6.6" })), "6.6.6.6");
assert.equal(clientIp(h({})), "yerel");

console.log("deneme sınırları: tüm testler geçti");
