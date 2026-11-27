import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "@/lib/db";

// Yayın teşhisi: veritabanı bağlantısı ve tabloların durumu. Gizli değer döndürmez;
// yalnızca hangi ortam değişkenlerinin tanımlı olduğunu ve Prisma hata kodunu bildirir.
function hata(e: unknown) {
  const x = e as { name?: string; code?: string; errorCode?: string };
  return { ad: x?.name ?? "Error", kod: x?.code ?? x?.errorCode ?? null };
}

export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const saglayici = /^postgres(ql)?:\/\//.test(url) ? "postgresql" : url.startsWith("file:") ? "sqlite" : url ? "bilinmiyor" : "tanimsiz";
  const degiskenler = Object.fromEntries(
    ["DATABASE_URL", "APP_SECRET", "APP_URL", "CRON_SECRET", "ADMIN_SETUP_KEY"].map((k) => [k, Boolean(process.env[k])]),
  );

  let baglanti: unknown = "tamam";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (e) {
    baglanti = hata(e);
  }

  let tablolar: unknown = "tamam";
  try {
    await db.user.count();
  } catch (e) {
    tablolar = hata(e);
  }

  let kurulum: unknown = null;
  try {
    kurulum = JSON.parse(readFileSync(join(tmpdir(), "shiptoecom-db-deploy.json"), "utf8"));
  } catch {
    // Kurulum adımı bu örnekte çalışmamış.
  }

  const tamam = baglanti === "tamam" && tablolar === "tamam";
  return Response.json({ tamam, saglayici, degiskenler, baglanti, tablolar, kurulum }, { status: tamam ? 200 : 503 });
}
