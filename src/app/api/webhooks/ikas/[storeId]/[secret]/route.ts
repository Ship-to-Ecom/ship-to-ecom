import { after } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { syncUser } from "@/lib/sync";
import { clientIp, failBlocked, failRecord } from "@/lib/throttle";

// ikas webhook'u yalnızca "bir şey değişti" sinyali olarak kullanılır: gövdesi okunmaz
// ve saklanmaz (içinde müşteri verisi olabilir). Gerçek veri API'den yeniden çekilir.
// Kimlik doğrulama, URL'deki mağazaya özel gizli anahtarla yapılır.
// Anahtar tahminine karşı: IP başına 15 dakikada 20 hatalı çağrıdan sonra istek veritabanına inmeden reddedilir.
// Geçerli çağrılar sayılmaz; art arda gelen geçerli sinyaller syncUser içinde tek senkronda birleşir.
export async function POST(req: Request, ctx: { params: Promise<{ storeId: string; secret: string }> }) {
  const ip = clientIp(req.headers);
  if (failBlocked(`webhook-ip:${ip}`, 20)) return new Response("too many requests", { status: 429 });
  const { storeId, secret } = await ctx.params;
  const store = await db.store.findUnique({ where: { id: storeId } });
  if (!store || !safeEqual(store.webhookSecret, secret)) {
    failRecord(`webhook-ip:${ip}`);
    return new Response("not found", { status: 404 });
  }
  after(() => syncUser(store.userId).catch((e) => console.error("webhook sync", e)));
  return new Response("ok");
}
