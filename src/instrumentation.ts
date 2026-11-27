// Uygulama içi zamanlayıcı: yayında ayrı bir cron servisi gerekmeden /api/cron/sync'i düzenli çağırır.
// Yalnızca INTERNAL_CRON_MINUTES tanımlıysa çalışır (yerelde tanımsız: kapalı). Tek sunucu örneği varsayar;
// birden fazla örnekte her örnek ayrı çağırır ve senkron kilidi örnekler arasında geçerli değildir.
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const minutes = Number(process.env.INTERNAL_CRON_MINUTES);
  const secret = process.env.CRON_SECRET;
  if (!Number.isFinite(minutes) || minutes < 1 || !secret) return;

  const url = `http://127.0.0.1:${process.env.PORT || 3000}/api/cron/sync`;
  let busy = false;
  const tick = async () => {
    if (busy) return; // önceki tur sürüyorsa atla
    busy = true;
    try {
      const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(10 * 60_000) });
      if (!res.ok) console.error("iç cron", res.status);
    } catch (e) {
      console.error("iç cron", e instanceof Error ? e.message : e);
    } finally {
      busy = false;
    }
  };
  // İlk tur sunucu ayağa kalktıktan biraz sonra; sonra her `minutes` dakikada bir.
  setTimeout(tick, 60_000).unref();
  setInterval(tick, minutes * 60_000).unref();
  console.log(`iç cron: her ${minutes} dakikada bir /api/cron/sync`);
}
