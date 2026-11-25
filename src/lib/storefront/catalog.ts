// Flash Ürünler, Fiyat Altı İndirimi ve Ürün Etiketleri için ortak katalog yardımcıları.
// Fiyat, stok ve görsel: ortak stok senkronunun ikas'tan aldığı StoreVariant kayıtları.
// Vitrin bağlantısı (slug), kategoriler ve eklenme tarihi: ProductMeta (ikas listProduct), en fazla 6 saatte bir yenilenir.
import type { Store } from "@prisma/client";
import { db } from "../db";
import { listProductMeta } from "../ikas";
import { imageUrl } from "../pricing";
import { processState } from "../process-state";

const STALE_MS = 6 * 3600_000;
// Eşzamanlı iki yenileme birbirinin kayıtlarını silmesin diye kilit süreç genelinde tektir.
const running = processState("catalog:running", () => new Map<string, Promise<number>>());

/** ProductMeta'yı ikas'tan yeniler (aynı mağaza için eşzamanlı tek istek). Dönen: ürün sayısı. */
export function refreshProductMeta(store: Store): Promise<number> {
  const cur = running.get(store.id);
  if (cur) return cur;
  const p = (async () => {
    const list = await listProductMeta(store);
    const now = new Date();
    await db.$transaction([
      ...list.map((r) =>
        db.productMeta.upsert({
          where: { storeId_productId: { storeId: store.id, productId: r.id } },
          create: { storeId: store.id, productId: r.id, name: r.name, slug: r.metaData?.slug ?? "", categoryIds: JSON.stringify(r.categoryIds ?? []), createdAt: r.createdAt ? new Date(r.createdAt) : null, syncedAt: now },
          update: { name: r.name, slug: r.metaData?.slug ?? "", categoryIds: JSON.stringify(r.categoryIds ?? []), createdAt: r.createdAt ? new Date(r.createdAt) : null, syncedAt: now },
        }),
      ),
      db.productMeta.deleteMany({ where: { storeId: store.id, syncedAt: { lt: now } } }),
    ]);
    return list.length;
  })().finally(() => running.delete(store.id));
  running.set(store.id, p);
  return p;
}

/** Bilgi eskiyse arka planda yeniler; vitrin isteğini bekletmez. */
export async function refreshIfStale(storeId: string) {
  const last = await db.productMeta.findFirst({ where: { storeId }, orderBy: { syncedAt: "desc" }, select: { syncedAt: true } });
  if (last && Date.now() - last.syncedAt.getTime() < STALE_MS) return;
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (store) refreshProductMeta(store).catch((e) => console.warn("ürün bilgisi yenilenemedi", e instanceof Error ? e.message : e));
}

export type Meta = { productId: string; name: string; slug: string; categoryIds: string[]; createdAt: Date | null };
export async function metas(storeId: string): Promise<Meta[]> {
  const rows = await db.productMeta.findMany({ where: { storeId } });
  return rows.map((r) => {
    let c: string[] = [];
    try {
      c = JSON.parse(r.categoryIds);
    } catch {}
    return { productId: r.productId, name: r.name, slug: r.slug, categoryIds: c, createdAt: r.createdAt };
  });
}

const ids = (v: unknown) => String(v ?? "").split(",").filter(Boolean);
/** Kapsamdaki ürün kimlikleri: all → tümü, products → seçilenler, categories → o kategorilerdeki ürünler. */
export function inScope(all: Meta[], scope: unknown, productIds: unknown, categoryIds: unknown): Set<string> {
  if (scope === "products") return new Set(ids(productIds));
  if (scope === "categories") {
    const want = new Set(ids(categoryIds));
    return new Set(all.filter((m) => m.categoryIds.some((c) => want.has(c))).map((m) => m.productId));
  }
  return new Set(all.map((m) => m.productId));
}

export type Card = { productId: string; name: string; slug: string; image: string | null; sellPrice: number; discountPrice: number | null; stock: number };

/** Ürün kartları: varyantlar ürün bazında toplanır (en düşük fiyatlı varyant, toplam stok, ilk görsel). */
export async function cards(store: Pick<Store, "id" | "merchantId">, productIds: string[], metaList: Meta[]): Promise<Card[]> {
  if (!productIds.length) return [];
  const vs = await db.storeVariant.findMany({ where: { storeId: store.id, productId: { in: productIds } }, select: { productId: true, productName: true, sellPrice: true, discountPrice: true, currentStock: true, imageId: true } });
  const bySlug = new Map(metaList.map((m) => [m.productId, m]));
  const out = new Map<string, Card>();
  for (const v of vs) {
    const price = v.sellPrice ?? 0;
    const eff = (x: { sellPrice: number; discountPrice: number | null }) => x.discountPrice ?? x.sellPrice;
    const c = out.get(v.productId);
    const cand = { sellPrice: price, discountPrice: v.discountPrice != null && v.discountPrice < price ? v.discountPrice : null };
    if (!c) out.set(v.productId, { productId: v.productId, name: bySlug.get(v.productId)?.name ?? v.productName, slug: bySlug.get(v.productId)?.slug ?? "", image: imageUrl(store.merchantId, v.imageId, 360), ...cand, stock: Math.max(0, v.currentStock) });
    else {
      c.stock += Math.max(0, v.currentStock);
      if (!c.image) c.image = imageUrl(store.merchantId, v.imageId, 360);
      if (price > 0 && eff(cand) < eff(c)) Object.assign(c, cand);
    }
  }
  return [...out.values()].filter((c) => c.slug && c.sellPrice > 0);
}
