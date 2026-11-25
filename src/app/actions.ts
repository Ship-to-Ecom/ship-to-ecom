"use server";

import { assertModule, hasModule } from "@/lib/access";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { encrypt, randomToken } from "@/lib/crypto";
import { invalidateUser } from "@/lib/cache";
import { db } from "@/lib/db";
import { TRIAL_DAYS, hasBiggerPlan, planById, storeLimitOf } from "@/lib/plans";
import { fetchToken, normalizeStoreName, registerWebhooks } from "@/lib/ikas";
import { createSession, destroySession, requireUser } from "@/lib/session";
import { syncUser } from "@/lib/sync";
import { clientIp, loginBlocked, loginFailed, loginOk, overLimit } from "@/lib/throttle";

// Mağaza bağlama ve yönetimi Entegrasyonlar sayfasında.
const STORES = "/entegrasyonlar";
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (path: string, key: "hata" | "ok", msg: string): never =>
  redirect(`${path}?${key}=${encodeURIComponent(msg)}`);

export async function register(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("/kayit", "hata", "Geçerli bir e-posta girin.");
  if (password.length < 8) back("/kayit", "hata", "Şifre en az 8 karakter olmalı.");
  // Toplu hesap açmaya karşı: IP başına saatte 5 kayıt denemesi.
  if (overLimit(`kayit:${clientIp(await headers())}`, 5, 3600_000)) back("/kayit", "hata", "Çok fazla kayıt denemesi. Bir saat sonra yeniden deneyin.");
  if (await db.user.findUnique({ where: { email } })) back("/kayit", "hata", "Bu e-posta zaten kayıtlı.");
  const plan = planById(str(fd, "paket"))?.id ?? "baslangic";
  const user = await db.user.create({
    data: {
      email, passwordHash: await bcrypt.hash(password, 10),
      plan, billingPeriod: str(fd, "donem") === "yillik" ? "yillik" : "aylik",
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 3600_000),
    },
  });
  await createSession(user.id);
  redirect(STORES);
}

export async function login(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const ip = clientIp(await headers());
  if (loginBlocked(email, ip)) back("/giris", "hata", "Çok fazla hatalı deneme. 15 dakika sonra yeniden deneyin.");
  const user = await db.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(String(fd.get("password") ?? ""), user.passwordHash));
  if (!user || !ok) {
    loginFailed(email, ip);
    back("/giris", "hata", "E-posta veya şifre hatalı.");
  }
  loginOk(email);
  if (user!.suspended) back("/giris", "hata", "Hesabınız askıya alınmış. Destek ile iletişime geçin.");
  await createSession(user!.id);
  redirect("/panel");
}

export async function logout() {
  await destroySession();
  redirect("/giris");
}

// ───────────── ikas mağaza bağlantısı ─────────────
type IkasInput = { label: string; storeName: string; clientId: string; clientSecret: string };

/** Formu ve hesap sınırlarını denetler (mağaza hakkı, aynı mağazanın ikinci kez eklenmesi). */
async function checkIkas(userId: string, plan: string, fd: FormData): Promise<{ error: string } | { input: IkasInput }> {
  const input = { label: str(fd, "label"), storeName: normalizeStoreName(str(fd, "storeName")), clientId: str(fd, "clientId"), clientSecret: str(fd, "clientSecret") };
  if (!input.label || !input.storeName || !input.clientId || !input.clientSecret) return { error: "Tüm alanları doldurun." };
  if (!/^[a-z0-9-]+$/.test(input.storeName)) return { error: "Mağaza adı geçersiz (örnek: magazam)." };
  // Mağaza hakkı pakete göre; sayfadaki düğme gizlense de sınır burada uygulanır.
  const limit = storeLimitOf(plan);
  if ((await db.store.count({ where: { userId } })) >= limit)
    return { error: hasBiggerPlan(plan)
      ? `${planById(plan)?.name ?? "Mevcut"} paketinde en fazla ${limit} mağaza bağlanabilir. Daha fazla mağaza için lütfen paketinizi değiştirin.`
      : `Paketinizin mağaza hakkı (${limit}) doldu. Daha fazla mağaza için destek ile iletişime geçin.` };
  if (await db.store.findUnique({ where: { userId_storeName: { userId, storeName: input.storeName } } })) return { error: "Bu mağaza zaten bağlı." };
  return { input };
}

export type ConnectState = { ok?: boolean; done?: boolean; message?: string; at?: number } | null;

/** Bilgileri kaydetmeden ikas'tan token alarak bağlantıyı dener. */
export async function testIkasConnection(_prev: ConnectState, fd: FormData): Promise<ConnectState> {
  const user = await requireUser();
  const c = await checkIkas(user.id, user.plan, fd);
  if ("error" in c) return { ok: false, message: c.error };
  try {
    await fetchToken(c.input.storeName, c.input.clientId, c.input.clientSecret);
    return { ok: true, message: `Bağlantı başarılı: ${c.input.storeName}.myikas.com. Kaydetmek için “Mağazayı bağla”ya basın.`, at: Date.now() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "ikas bağlantısı kurulamadı." };
  }
}

/** Bağlantıyı doğrular ve mağazayı kaydeder. Client Secret şifreli saklanır, sayfaya geri gönderilmez. */
export async function connectIkas(_prev: ConnectState, fd: FormData): Promise<ConnectState> {
  const user = await requireUser();
  const c = await checkIkas(user.id, user.plan, fd);
  if ("error" in c) return { ok: false, message: c.error };
  let token;
  try {
    token = await fetchToken(c.input.storeName, c.input.clientId, c.input.clientSecret);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "ikas bağlantısı kurulamadı." };
  }
  try {
    await db.store.create({
      data: {
        userId: user.id, platform: "ikas", label: c.input.label, storeName: c.input.storeName, clientId: c.input.clientId,
        clientSecretEnc: encrypt(c.input.clientSecret), accessToken: token.accessToken,
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000), webhookSecret: randomToken(),
      },
    });
  } catch {
    return { ok: false, message: "Bu mağaza zaten bağlı." }; // eşzamanlı iki gönderimde tekil anahtar korur
  }
  invalidateUser(user.id);
  revalidatePath("/", "layout");
  return { ok: true, done: true, message: `${c.input.label} bağlandı. Stokların eşitlenmesi için “Şimdi senkronize et”e basın.`, at: Date.now() };
}

/** Eski form (JS olmadan gönderim) için: hata da başarı da sayfaya yönlendirilir. */
export async function addStore(fd: FormData) {
  const r = await connectIkas(null, fd);
  back(STORES, r?.ok ? "ok" : "hata", r?.message ?? "ikas bağlantısı kurulamadı.");
}

export async function deleteStore(fd: FormData) {
  const user = await requireUser();
  const id = str(fd, "id");
  // Mağaza ayrılınca ortak stok bağları sıfırlanır; yeniden bağlanınca baştan kurulur.
  await db.$transaction([
    db.store.deleteMany({ where: { id, userId: user.id } }),
    db.sharedItem.deleteMany({ where: { userId: user.id } }),
    db.storeVariant.updateMany({ where: { store: { userId: user.id } }, data: { lastSeenStock: null } }),
  ]);
  invalidateUser(user.id);
  back(STORES, "ok", "Mağaza kaldırıldı.");
}

export async function setupWebhooks(fd: FormData) {
  const user = await requireUser();
  const store = await db.store.findFirst({ where: { id: str(fd, "id"), userId: user.id } });
  if (!store) back(STORES, "hata", "Mağaza bulunamadı.");
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (!base.startsWith("https://")) back(STORES, "hata", "Webhook için APP_URL https adresi olmalı (yayına alınca çalışır).");
  try {
    await registerWebhooks(store!, `${base}/api/webhooks/ikas/${store!.id}/${store!.webhookSecret}`);
  } catch (e) {
    back(STORES, "hata", e instanceof Error ? e.message : "Webhook kurulamadı.");
  }
  await db.store.update({ where: { id: store!.id }, data: { webhooksActive: true } });
  back(STORES, "ok", "Webhook'lar kuruldu; sipariş ve stok değişiklikleri anında işlenecek.");
}

export async function syncNow(fd: FormData) {
  const user = await requireUser();
  const path = str(fd, "path") || "/panel";
  try {
    await syncUser(user.id);
  } catch (e) {
    back(path, "hata", e instanceof Error ? e.message : "Senkron başarısız.");
  }
  revalidatePath("/", "layout");
  back(path, "ok", "Senkron tamamlandı.");
}

// ───────────── Otomatik fiyat kuralı ─────────────
export async function savePriceRule(fd: FormData) {
  const user = await requireUser();
  assertModule(user, "fiyat");
  const targetId = str(fd, "storeId");
  const n = (k: string) => Number(str(fd, k).replace(",", ".")) || 0;
  const percent = n("percent");
  const round = ["none", "1", "0.90", "0.99"].includes(str(fd, "round")) ? str(fd, "round") : "none";
  if (percent <= -100) back("/urunler", "hata", "Yüzde -100'den büyük olmalı.");
  const stores = await db.store.findMany({ where: { userId: user.id } });
  if (targetId && !stores.some((s) => s.id === targetId)) back("/urunler", "hata", "Mağaza bulunamadı.");
  if (targetId && stores.length < 2) back("/urunler", "hata", "Fiyat kuralı için iki mağaza bağlı olmalı.");
  await db.$transaction([
    db.store.updateMany({ where: { userId: user.id }, data: { priceRuleActive: false } }),
    ...(targetId
      ? [db.store.update({ where: { id: targetId }, data: { priceRuleActive: true, pricePercent: percent, priceFixed: n("fixed"), priceRound: round } })]
      : []),
  ]);
  if (!targetId) back("/urunler", "ok", "Otomatik fiyat kuralı kapatıldı. Mevcut fiyatlara dokunulmadı.");
  try {
    await syncUser(user.id);
  } catch (e) {
    back("/urunler", "hata", e instanceof Error ? e.message : "Senkron başarısız.");
  }
  revalidatePath("/", "layout");
  back("/urunler", "ok", "Fiyat kuralı kaydedildi ve uygulandı.");
}

// ───────────── Stok ayarları ─────────────
const optNum = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(",", ".");
  const n = Number(v);
  return v === "" || !Number.isFinite(n) || n < 0 ? null : n;
};

async function syncThen(userId: string, path: string, okMsg: string): Promise<never> {
  try {
    await syncUser(userId);
  } catch (e) {
    back(path, "hata", e instanceof Error ? e.message : "Senkron başarısız.");
  }
  revalidatePath("/", "layout");
  return back(path, "ok", okMsg);
}

export async function saveStockSettings(fd: FormData) {
  const user = await requireUser();
  const stores = await db.store.findMany({ where: { userId: user.id } });
  // Akıllı dağıtım alanları (minimum stok, kritik seviye, öncelikli mağaza) yalnızca paket kapsıyorsa değiştirilir.
  const smart = hasModule(user, "dagitim");
  const shares = stores.map((s) => ({ id: s.id, pct: optNum(fd, `share_${s.id}`) ?? 100, min: smart ? optNum(fd, `min_${s.id}`) ?? 0 : s.minStock }));
  if (shares.some((s) => s.pct > 100)) back("/stok", "hata", "Mağaza payı %100'ü geçemez.");
  // Öncelikli mağaza yalnızca kullanıcının kendi mağazalarından biri olabilir.
  const priorityStoreId = !smart ? user.priorityStoreId : stores.some((s) => s.id === str(fd, "priorityStoreId")) ? str(fd, "priorityStoreId") : null;
  const criticalStock = smart ? optNum(fd, "criticalStock") : user.criticalStock;
  if (criticalStock !== null && !priorityStoreId) back("/stok", "hata", "Kritik stok modu için öncelikli mağaza seçin.");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { safetyStock: optNum(fd, "safetyStock") ?? 0, lowStockThreshold: optNum(fd, "lowStockThreshold"), criticalStock, priorityStoreId } }),
    ...shares.map((s) => db.store.update({ where: { id: s.id }, data: { stockSharePercent: s.pct, minStock: s.min } })),
  ]);
  await syncThen(user.id, "/stok", "Stok ayarları kaydedildi ve mağazalara uygulandı.");
}

const detailPath = (sku: string) => `/stok/detay?sku=${encodeURIComponent(sku)}`;
// back() sorgu ekler; detay yolunda zaten "?" olduğu için ayrı yardımcı.
const backDetail = (sku: string, key: "hata" | "ok", msg: string): never =>
  redirect(`${detailPath(sku)}&${key}=${encodeURIComponent(msg)}`);

export async function saveSkuSettings(fd: FormData) {
  const user = await requireUser();
  const sku = str(fd, "sku");
  if (!sku) back("/stok", "hata", "SKU eksik.");
  const data = { excluded: fd.get("excluded") === "on", safetyStock: optNum(fd, "safetyStock"), lowStockThreshold: optNum(fd, "lowStockThreshold") };
  await db.skuSetting.upsert({ where: { userId_sku: { userId: user.id, sku } }, create: { userId: user.id, sku, ...data }, update: data });
  try {
    await syncUser(user.id);
  } catch (e) {
    backDetail(sku, "hata", e instanceof Error ? e.message : "Senkron başarısız.");
  }
  revalidatePath("/", "layout");
  backDetail(sku, "ok", "SKU ayarları kaydedildi.");
}

export async function adjustStock(fd: FormData) {
  const user = await requireUser();
  const sku = str(fd, "sku");
  const target = optNum(fd, "stock");
  if (target === null) backDetail(sku, "hata", "Geçerli bir stok adedi girin.");
  const item = await db.sharedItem.findUnique({ where: { userId_sku: { userId: user.id, sku } } });
  if (!item) backDetail(sku, "hata", "Bu SKU ortak stoğa bağlı değil; stok mağaza panelinden değiştirilmeli.");
  // Düzeltme, yarış olmaması için bir sonraki senkron turunda (kilit altında) uygulanır.
  await db.sharedItem.update({
    where: { id: item!.id },
    data: { pendingDelta: target! - item!.sharedStock, pendingNote: str(fd, "note").slice(0, 200) || null },
  });
  try {
    await syncUser(user.id);
  } catch (e) {
    backDetail(sku, "hata", e instanceof Error ? e.message : "Senkron başarısız.");
  }
  revalidatePath("/", "layout");
  backDetail(sku, "ok", "Stok güncellendi ve mağazalara yazıldı.");
}
