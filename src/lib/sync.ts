import type { Store, StoreVariant } from "@prisma/client";
import { invalidateUser } from "./cache";
import { db } from "./db";
import { hasModule } from "./access";
import { runAutomations } from "./automation";
import { adapterFor } from "./platforms";
import type { PriceWrite, RemoteVariant } from "./platforms/types";
import { applyRule } from "./pricing";
import { notify, type NewNotification } from "./notify";
import { allocate, reconcile } from "./reconcile";
import { loadCosts, snapshotFor, trackBuyPrices } from "./finance/costs";
import { ingestReturns } from "./finance/ingest";
import { processState } from "./process-state";

// Aynı kullanıcı için eşzamanlı iki senkron çalışmaz. Çalışırken gelen istek,
// bittikten sonra bir tur daha çalıştırır. (Tek sunucu örneği varsayar; birden fazla
// örnekle yayına alınırsa veritabanı kilidine çevrilmeli.)
// Kilit süreç genelinde tektir (webhook, cron ve panel aynı kilidi görür): src/lib/process-state.ts
const running = processState("sync:running", () => new Map<string, Promise<void>>());
const rerun = processState("sync:rerun", () => new Set<string>());

export function syncUser(userId: string): Promise<void> {
  const active = running.get(userId);
  if (active) {
    rerun.add(userId);
    return active;
  }
  const p = (async () => {
    try {
      do {
        rerun.delete(userId);
        await runSync(userId);
      } while (rerun.has(userId));
    } finally {
      running.delete(userId);
      // Senkron veriyi değiştirdi: rapor/pano önbelleği hemen düşer.
      invalidateUser(userId);
    }
  })();
  running.set(userId, p);
  return p;
}

type Log = { level: string; message: string; sku?: string; storeLabel?: string };

async function runSync(userId: string) {
  const owner = await db.user.findUniqueOrThrow({ where: { id: userId } });
  // Demo mağazalar senkrona girmez (ikas'a istek yok; veriler yerel demo verisidir).
  const stores = (await db.store.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })).filter((s) => s.clientId !== "demo");
  if (!stores.length) return;
  const logs: Log[] = [];
  const loaded: { store: Store; locationId: string; rows: Map<string, StoreVariant> }[] = [];

  for (const store of stores) {
    try {
      const adapter = adapterFor(store);
      let locationId = store.stockLocationId;
      if (!locationId) {
        const locs = await adapter.listLocations(store);
        if (!locs.length) throw new Error("Mağazada stok lokasyonu bulunamadı.");
        locationId = locs[0].id;
        await db.store.update({ where: { id: store.id }, data: { stockLocationId: locationId } });
      }
      if (!store.merchantId && adapter.getMerchantId) {
        // Görsel adresleri için gerekli; alınamazsa senkronu durdurmaz.
        const merchantId = await adapter.getMerchantId(store).catch(() => null);
        if (merchantId) {
          await db.store.update({ where: { id: store.id }, data: { merchantId } });
          store.merchantId = merchantId;
        }
      }
      const remote = await adapter.listVariants(store, locationId);
      const rows = await saveVariants(store, remote, logs);
      loaded.push({ store, locationId, rows });
    } catch (e) {
      await fail(store, e, logs);
    }
  }

  // Ortak stok yalnızca tüm mağazalar başarıyla okunduysa hesaplanır;
  // biri okunamadıysa eksik veriyle stok yazmak tehlikeli olur.
  if (stores.length >= 2 && loaded.length === stores.length) {
    await reconcileStocks(userId, loaded, logs);
    // Paket kapsamıyorsa daha önce kurulmuş fiyat kuralı uygulanmaz (kural silinmez; yükseltince yeniden çalışır).
    if (hasModule(owner, "fiyat")) await applyPriceRule(loaded, logs);
  }

  const touched: string[] = [];
  for (const { store } of loaded) {
    try {
      touched.push(...(await syncOrders(store, logs)));
      await syncCarts(store, logs);
      await db.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date(), lastError: null } });
    } catch (e) {
      await fail(store, e, logs);
    }
  }

  try {
    if (hasModule(owner, "otomasyon")) await runAutomations(userId, touched);
  } catch (e) {
    logs.push({ level: "error", message: `Otomasyon çalıştırılamadı: ${e instanceof Error ? e.message : e}`.slice(0, 900) });
  }

  if (logs.length) await db.syncLog.createMany({ data: logs.map((l) => ({ ...l, userId })) });
  await db.user.update({ where: { id: userId }, data: { lastSyncAt: new Date() } });
}

async function fail(store: Store, e: unknown, logs: Log[]) {
  const message = e instanceof Error ? e.message : String(e);
  logs.push({ level: "error", storeLabel: store.label, message });
  await db.store.update({ where: { id: store.id }, data: { lastError: message.slice(0, 500) } });
}

/** Uzak varyantları DB'ye yansıtır; SKU -> satır haritası döner (tekrarlı SKU'lar hariç). */
async function saveVariants(store: Store, remote: RemoteVariant[], logs: Log[]) {
  // Elle eşleştirmeler: bu mağazadaki SKU -> ortak stokta kullanılacak anahtar.
  const alias = new Map((await db.skuAlias.findMany({ where: { storeId: store.id } })).map((a) => [a.sku, a.matchSku]));
  const keyOf = (sku: string) => alias.get(sku) ?? sku;
  const skuCount = new Map<string, number>();
  for (const v of remote) skuCount.set(keyOf(v.sku), (skuCount.get(keyOf(v.sku)) ?? 0) + 1);

  const existing = new Map((await db.storeVariant.findMany({ where: { storeId: store.id } })).map((r) => [r.variantId, r]));
  const seen = new Set<string>();
  const ops = [];
  for (const v of remote) {
    seen.add(v.variantId);
    const matchSku = keyOf(v.sku);
    const duplicateSku = (skuCount.get(matchSku) ?? 0) > 1;
    const row = existing.get(v.variantId);
    const data = {
      sku: v.sku, productId: v.productId, productName: v.productName, currentStock: v.stock, duplicateSku,
      sellPrice: v.sellPrice, discountPrice: v.discountPrice, buyPrice: v.buyPrice, imageId: v.imageId,
      barcode: v.barcode, matchSku,
    };
    if (!row) {
      ops.push(db.storeVariant.create({ data: { ...data, storeId: store.id, variantId: v.variantId } }));
    } else if (
      row.sku !== v.sku || row.currentStock !== v.stock || row.productName !== v.productName ||
      row.duplicateSku !== duplicateSku || row.productId !== v.productId ||
      row.sellPrice !== v.sellPrice || row.discountPrice !== v.discountPrice || row.buyPrice !== v.buyPrice || row.imageId !== v.imageId ||
      row.barcode !== v.barcode || row.matchSku !== matchSku
    ) {
      // SKU değiştiyse eski ortak stok bağı geçersizdir.
      ops.push(db.storeVariant.update({
        where: { id: row.id },
        data: { ...data, ...(row.sku !== v.sku || (row.matchSku && row.matchSku !== matchSku) ? { lastSeenStock: null } : {}) },
      }));
    }
  }
  const gone = [...existing.values()].filter((r) => !seen.has(r.variantId)).map((r) => r.id);
  if (gone.length) ops.push(db.storeVariant.deleteMany({ where: { id: { in: gone } } }));
  for (let i = 0; i < ops.length; i += 200) await db.$transaction(ops.slice(i, i + 200));
  // Maliyet geçmişi: alış fiyatı değişen SKU'lar için yeni dönem açılır. Hata stok senkronunu durdurmaz.
  try {
    await trackBuyPrices(store.userId, store.id, remote.map((v) => ({ sku: v.sku, productId: v.productId, buyPrice: v.buyPrice, duplicateSku: (skuCount.get(keyOf(v.sku)) ?? 0) > 1 })));
  } catch (e) {
    logs.push({ level: "warn", storeLabel: store.label, message: `Maliyet geçmişi güncellenemedi: ${e instanceof Error ? e.message : e}`.slice(0, 300) });
  }

  for (const [sku, n] of skuCount) {
    if (n > 1) logs.push({ level: "warn", sku, storeLabel: store.label, message: `Aynı SKU ${n} varyantta kullanılıyor; bu SKU senkron dışı bırakıldı.` });
  }

  const rows = new Map<string, StoreVariant>();
  for (const r of await db.storeVariant.findMany({ where: { storeId: store.id, duplicateSku: false } })) rows.set(r.matchSku, r);
  return rows;
}

async function reconcileStocks(
  userId: string,
  loaded: { store: Store; locationId: string; rows: Map<string, StoreVariant> }[],
  logs: Log[],
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const settings = new Map((await db.skuSetting.findMany({ where: { userId } })).map((x) => [x.sku, x]));
  const shared = new Map((await db.sharedItem.findMany({ where: { userId } })).map((x) => [x.sku, x]));
  const common = [...loaded[0].rows.keys()].filter((sku) => loaded.every((l) => l.rows.has(sku)));

  type Change = { sku: string; name: string; old: number | null; next: number; rows: StoreVariant[]; targets: number[]; pending: number; note: string | null; critical: boolean; wasCritical: boolean };
  // Akıllı dağıtım paket kapsamıyorsa minimum stok ve kritik mod devre dışı; yalnızca pay ve güvenlik stoğu uygulanır.
  const smart = hasModule(user, "dagitim");
  const critical = smart ? user.criticalStock : null;
  const alloc = loaded.map((l) => ({ sharePercent: l.store.stockSharePercent, minStock: smart ? l.store.minStock : 0, priority: smart && l.store.id === user.priorityStoreId }));
  const alerts: NewNotification[] = [];
  const changes: Change[] = [];
  const writes = loaded.map(() => [] as { productId: string; variantId: string; stockCount: number }[]);
  const unlink: string[] = [];

  for (const sku of common) {
    const rows = loaded.map((l) => l.rows.get(sku)!);
    const item = shared.get(sku);
    const set = settings.get(sku);
    if (set?.excluded) {
      // Senkron dışı: bağ varsa kaldırılır, mağaza stoklarına dokunulmaz.
      if (item || rows.some((r) => r.lastSeenStock !== null)) unlink.push(sku);
      continue;
    }
    const old = item ? item.sharedStock : null;
    const pending = item?.pendingDelta ?? 0;
    const next = reconcile(old, rows.map((r) => ({ current: r.currentStock, lastSeen: r.lastSeenStock })), pending);
    const safety = set?.safetyStock ?? user.safetyStock;
    const { targets, critical: isCritical } = allocate(next, safety, alloc, critical);
    const wasCritical = old !== null && allocate(old, safety, alloc, critical).critical;
    const inSync = rows.every((r, i) => r.currentStock === targets[i] && r.lastSeenStock === targets[i]);
    if (item && old === next && inSync && !pending) continue;
    changes.push({ sku, name: rows[0].productName, old, next, rows, targets, pending, note: item?.pendingNote ?? null, critical: isCritical, wasCritical });
    rows.forEach((r, i) => {
      if (r.currentStock !== targets[i]) writes[i].push({ productId: r.productId, variantId: r.variantId, stockCount: targets[i] });
    });
  }

  if (unlink.length) {
    await db.$transaction([
      db.sharedItem.deleteMany({ where: { userId, sku: { in: unlink } } }),
      db.storeVariant.updateMany({ where: { storeId: { in: loaded.map((l) => l.store.id) }, sku: { in: unlink } }, data: { lastSeenStock: null } }),
    ]);
  }
  if (!changes.length) return;

  // Mağazalara yaz. Bir mağazaya yazılamazsa o mağaza bir sonraki turda tekrar denenir.
  const written = await Promise.all(
    loaded.map(async (l, i) => {
      if (!writes[i].length) return true;
      try {
        await adapterFor(l.store).setStocks(l.store, l.locationId, writes[i]);
        return true;
      } catch (e) {
        await fail(l.store, e, logs);
        return false;
      }
    }),
  );

  const ops = [];
  const movements: { userId: string; sku: string; storeLabel: string | null; delta: number; sharedAfter: number; reason: string; note: string | null }[] = [];
  for (const c of changes) {
    ops.push(db.sharedItem.upsert({
      where: { userId_sku: { userId, sku: c.sku } },
      create: { userId, sku: c.sku, name: c.name, sharedStock: c.next },
      update: { name: c.name, sharedStock: c.next, pendingDelta: 0, pendingNote: null },
    }));
    c.rows.forEach((r, i) => {
      // Yazma başarılıysa mağaza hedef değerde; değilse farkı tükettik sayıp mevcut değerini
      // hatırlıyoruz (sonraki turda current != hedef olduğu için yeniden yazılır).
      const value = written[i] ? c.targets[i] : r.currentStock;
      ops.push(db.storeVariant.update({ where: { id: r.id }, data: { currentStock: value, lastSeenStock: value } }));
      const delta = r.lastSeenStock === null || c.old === null ? 0 : r.currentStock - r.lastSeenStock;
      if (delta) movements.push({ userId, sku: c.sku, storeLabel: loaded[i].store.label, delta, sharedAfter: c.next, reason: delta < 0 ? "sale" : "increase", note: null });
    });
    if (c.pending) movements.push({ userId, sku: c.sku, storeLabel: null, delta: c.pending, sharedAfter: c.next, reason: "panel", note: c.note });
    const detail = c.rows.map((r, i) => `${loaded[i].store.label}: ${r.currentStock}`).join(", ");
    if (c.old === null) {
      movements.push({ userId, sku: c.sku, storeLabel: null, delta: c.next, sharedAfter: c.next, reason: "link", note: detail });
      logs.push({ level: "info", sku: c.sku, message: `Ortak stoğa bağlandı → ${c.next} (${detail})` });
    } else if (c.old !== c.next) {
      logs.push({ level: "info", sku: c.sku, message: `Ortak stok ${c.old} → ${c.next} (${detail})` });
    }
    const threshold = settings.get(c.sku)?.lowStockThreshold ?? user.lowStockThreshold;
    if (threshold !== null && c.next <= threshold && (c.old === null || c.old > threshold)) {
      logs.push({ level: "warn", sku: c.sku, message: `Düşük stok: ${c.name} — ${c.next} adet kaldı (eşik ${threshold}).` });
      alerts.push({ userId, kind: "stock", title: `Düşük stok: ${c.name}`, body: `${c.sku} için ortak stok ${c.next} adede indi (eşik ${threshold}).`, link: `/stok/detay?sku=${encodeURIComponent(c.sku)}` });
    }
    if (c.critical && !c.wasCritical) {
      const only = loaded.find((l) => l.store.id === user.priorityStoreId)?.store.label ?? "öncelikli mağaza";
      logs.push({ level: "warn", sku: c.sku, message: `Kritik stok: ${c.name} yalnızca ${only} mağazasında satışta (${c.targets.reduce((a, b) => Math.max(a, b), 0)} adet).` });
      alerts.push({ userId, kind: "stock", title: `Kritik stok: ${c.name}`, body: `${c.sku} kritik seviyede; diğer mağazalarda satış durduruldu, yalnızca ${only} satıyor.`, link: `/stok/detay?sku=${encodeURIComponent(c.sku)}` });
    }
  }
  for (let i = 0; i < ops.length; i += 200) await db.$transaction(ops.slice(i, i + 200));
  if (movements.length) await db.stockMovement.createMany({ data: movements });
  await notify(alerts);
}

/**
 * Otomatik fiyat kuralı: kuralı açık olan mağazanın fiyatları, diğer (kaynak) mağazanın
 * fiyatlarından hesaplanıp yazılır. Kaynak mağazanın fiyatlarına dokunulmaz.
 */
async function applyPriceRule(
  loaded: { store: Store; locationId: string; rows: Map<string, StoreVariant> }[],
  logs: Log[],
) {
  const target = loaded.find((l) => l.store.priceRuleActive);
  const source = loaded.find((l) => l !== target);
  if (!target || !source || source.store.priceRuleActive) return;
  const rule = { percent: target.store.pricePercent, fixed: target.store.priceFixed, round: target.store.priceRound };

  const writes: (PriceWrite & { rowId: string; sku: string; old: number | null })[] = [];
  for (const [sku, src] of source.rows) {
    const row = target.rows.get(sku);
    if (!row || src.sellPrice === null) continue;
    const sellPrice = applyRule(src.sellPrice, rule);
    let discountPrice = src.discountPrice === null ? null : applyRule(src.discountPrice, rule);
    if (discountPrice !== null && discountPrice >= sellPrice) discountPrice = null;
    const same = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 0.005);
    if (same(row.sellPrice, sellPrice) && same(row.discountPrice, discountPrice)) continue;
    writes.push({ rowId: row.id, sku, old: row.sellPrice, productId: row.productId, variantId: row.variantId, sellPrice, discountPrice, buyPrice: row.buyPrice });
  }
  if (!writes.length) return;
  try {
    await adapterFor(target.store).setPrices(target.store, writes);
  } catch (e) {
    await fail(target.store, e, logs);
    return;
  }
  const ops = writes.map((w) => db.storeVariant.update({ where: { id: w.rowId }, data: { sellPrice: w.sellPrice, discountPrice: w.discountPrice } }));
  for (let i = 0; i < ops.length; i += 200) await db.$transaction(ops.slice(i, i + 200));
  for (const w of writes.slice(0, 30)) {
    logs.push({ level: "info", sku: w.sku, storeLabel: target.store.label, message: `Fiyat kuralı: ${w.old ?? "—"} → ${w.sellPrice}${w.discountPrice !== null ? ` (indirimli ${w.discountPrice})` : ""}` });
  }
  if (writes.length > 30) logs.push({ level: "info", storeLabel: target.store.label, message: `Fiyat kuralı ${writes.length - 30} SKU'da daha uygulandı.` });
}

async function syncOrders(store: Store, logs: Log[]) {
  const startedAt = new Date();
  const since = store.lastOrderSyncAt
    ? new Date(store.lastOrderSyncAt.getTime() - 5 * 60_000)
    : new Date(Date.now() - 30 * 24 * 3600_000); // ilk senkron: son 30 gün
  const { orders, rich } = await adapterFor(store).listOrders(store, since);
  if (!rich && orders.length) logs.push({ level: "warn", storeLabel: store.label, message: "Sipariş kaynak/kampanya alanları okunamadı; raporlar bu siparişler için eksik kalır." });
  const ids: string[] = [];
  const refunded: { id: string; externalId: string }[] = [];
  // Maliyet snapshot'ı: kalemler her güncellemede yeniden yazıldığı için önceki snapshot korunur (kalem kimliğiyle, yoksa SKU ile);
  // snapshot yoksa sipariş anındaki geçerli maliyet yazılır, o da yoksa boş (eksik) kalır. Toplu okunur (sipariş başına sorgu yok).
  const [costs, prevLines] = await Promise.all([
    loadCosts(store.userId, [store.id]),
    orders.length ? db.orderLine.findMany({ where: { order: { storeId: store.id, ikasOrderId: { in: orders.map((o) => o.externalId) } }, OR: [{ unitCost: { not: null } }, { listPrice: { not: null } }, { taxAmount: { not: null } }] }, select: { ikasLineId: true, sku: true, unitCost: true, costCurrency: true, costSource: true, costCapturedAt: true, listPrice: true, taxAmount: true, order: { select: { ikasOrderId: true } } } }) : [],
  ]);
  const prevOf = new Map<string, (typeof prevLines)[number]>();
  for (const l of prevLines) {
    if (l.ikasLineId) prevOf.set(`${l.order.ikasOrderId}|id|${l.ikasLineId}`, l);
    prevOf.set(`${l.order.ikasOrderId}|sku|${l.sku}`, l);
  }
  for (const o of orders) {
    const lines = o.lines.map((l) => {
      const p = (l.ikasLineId && prevOf.get(`${o.externalId}|id|${l.ikasLineId}`)) || prevOf.get(`${o.externalId}|sku|${l.sku}`);
      const snap = p?.unitCost != null ? { unitCost: p.unitCost, costCurrency: p.costCurrency, costSource: p.costSource, costCapturedAt: p.costCapturedAt } : snapshotFor(costs, store.id, l.sku, o.data.orderedAt ?? null, o.data.currency);
      // Finansal sorgu bu sefer alınamadıysa (geri düşüş) önceki senkrondaki kalem fiyatı ve vergisi korunur; kalemler yeniden yazıldığı için aksi halde silinirdi.
      const fin = l.listPrice === undefined && p ? { listPrice: p.listPrice, taxAmount: p.taxAmount } : {};
      return { ...l, ...snap, ...fin };
    });
    const saved = await db.order.upsert({
      where: { storeId_ikasOrderId: { storeId: store.id, ikasOrderId: o.externalId } },
      create: { ...o.data, storeId: store.id, ikasOrderId: o.externalId, lines: { create: lines } },
      update: { ...o.data, lines: { deleteMany: {}, create: lines } },
      select: { id: true },
    });
    ids.push(saved.id);
    if (/REFUND/.test(o.data.status) || /REFUND/.test(o.data.paymentStatus ?? "")) refunded.push({ id: saved.id, externalId: o.externalId });
  }
  // İade ödemeleri: yalnızca iade durumundaki siparişler için sorgulanır. Aynı iade tekrar gelirse kayıt güncellenir, çoğalmaz.
  const adapter = adapterFor(store);
  if (adapter.listRefunds && refunded.length) {
    try {
      const list = [];
      for (const r of refunded.slice(0, 100)) for (const x of await adapter.listRefunds(store, r.externalId)) list.push({ ...x, source: "IKAS" as const, storeId: store.id, orderId: r.id });
      if (list.length) await ingestReturns(store.userId, list);
    } catch (e) {
      logs.push({ level: "warn", storeLabel: store.label, message: `İade ödemeleri okunamadı (sipariş verisi etkilenmedi): ${e instanceof Error ? e.message : e}`.slice(0, 300) });
    }
  }
  await db.store.update({ where: { id: store.id }, data: { lastOrderSyncAt: startedAt } });
  return ids;
}

/** Terk edilmiş sepetleri çeker (platform destekliyorsa). Hata olursa senkronun geri kalanını durdurmaz. */
async function syncCarts(store: Store, logs: Log[]) {
  const adapter = adapterFor(store);
  if (!adapter.listCarts) return;
  const startedAt = new Date();
  const since = store.lastCartSyncAt ? new Date(store.lastCartSyncAt.getTime() - 5 * 60_000) : new Date(Date.now() - 30 * 24 * 3600_000);
  let carts;
  try {
    carts = await adapter.listCarts(store, since);
  } catch (e) {
    logs.push({ level: "warn", storeLabel: store.label, message: `Terk edilmiş sepetler alınamadı: ${e instanceof Error ? e.message : e}` });
    return;
  }
  for (const c of carts) {
    const data = { ...c.data, seenAt: startedAt };
    await db.abandonedCart.upsert({
      where: { storeId_ikasId: { storeId: store.id, ikasId: c.externalId } },
      create: { ...data, storeId: store.id, ikasId: c.externalId },
      update: data,
    });
  }
  await db.store.update({ where: { id: store.id }, data: { lastCartSyncAt: startedAt } });
}
