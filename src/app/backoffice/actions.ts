"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { planById } from "@/lib/plans";
import { clientIp, failBlocked, failClear, failRecord, overLimit } from "@/lib/throttle";
import { createAdminSession, destroyAdminSession, requireAdmin } from "@/lib/session";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const go = (path: string, key: "hata" | "ok", msg: string): never => redirect(`${path}?${key}=${encodeURIComponent(msg)}`);

/** İlk yönetici hesabını oluşturur; yalnızca hiç yönetici yokken ve .env'deki kurulum anahtarıyla çalışır. */
export async function adminSetup(fd: FormData) {
  if (await db.admin.count()) go("/backoffice/giris", "hata", "Yönetici hesabı zaten var.");
  // Kurulum anahtarını tahmin etmeye karşı: IP başına saatte 5 deneme.
  if (overLimit(`yonetici-kurulum:${clientIp(await headers())}`, 5, 3600_000)) go("/backoffice/giris", "hata", "Çok fazla deneme. Bir saat sonra yeniden deneyin.");
  const key = process.env.ADMIN_SETUP_KEY ?? "";
  if (!key || !safeEqual(key, str(fd, "key"))) go("/backoffice/giris", "hata", "Kurulum anahtarı hatalı.");
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) go("/backoffice/giris", "hata", "Geçerli bir e-posta girin.");
  if (password.length < 10) go("/backoffice/giris", "hata", "Şifre en az 10 karakter olmalı.");
  const admin = await db.admin.create({ data: { email, passwordHash: await bcrypt.hash(password, 12) } });
  await createAdminSession(admin.id);
  redirect("/backoffice");
}

export async function adminLogin(fd: FormData) {
  const email = str(fd, "email").toLowerCase();
  const ip = clientIp(await headers());
  // Yönetici girişi daha sıkı: e-posta başına 5, IP başına 10 hata; 30 dakika kilit.
  if (failBlocked(`yonetici:${email}`, 5) || failBlocked(`yonetici-ip:${ip}`, 10)) go("/backoffice/giris", "hata", "Çok fazla hatalı deneme. 30 dakika sonra yeniden deneyin.");
  const admin = await db.admin.findUnique({ where: { email } });
  const ok = admin && (await bcrypt.compare(String(fd.get("password") ?? ""), admin.passwordHash));
  if (!admin || !ok) {
    failRecord(`yonetici:${email}`, 30);
    failRecord(`yonetici-ip:${ip}`, 30);
    go("/backoffice/giris", "hata", "E-posta veya şifre hatalı.");
  }
  failClear(`yonetici:${email}`);
  await createAdminSession(admin!.id);
  redirect("/backoffice");
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/backoffice/giris");
}

/** Bir müşteri hesabının paketini, dönemini, ödeme bitiş tarihini ve askı durumunu günceller. */
export async function updateAccount(fd: FormData) {
  await requireAdmin();
  const plan = planById(str(fd, "plan"));
  if (!plan) go("/backoffice/hesaplar", "hata", "Paket geçersiz.");
  const paid = str(fd, "paidUntil");
  await db.user.update({
    where: { id: str(fd, "id") },
    data: {
      plan: plan!.id,
      billingPeriod: fd.get("period") === "yillik" ? "yillik" : "aylik",
      paidUntil: paid ? new Date(`${paid}T23:59:59+03:00`) : null,
      suspended: fd.get("suspended") === "on",
    },
  });
  revalidatePath("/backoffice", "layout");
  go("/backoffice/hesaplar", "ok", "Hesap güncellendi.");
}

/** Ödemeyi onaylar: hesabın paketini ayarlar ve lisans süresini uzatır. */
export async function approvePayment(fd: FormData) {
  await requireAdmin();
  const p = await db.payment.findUnique({ where: { id: str(fd, "id") }, include: { user: true } });
  if (!p || !["bekliyor", "bildirildi"].includes(p.status)) go("/backoffice/odemeler", "hata", "Sipariş bulunamadı veya zaten işlenmiş.");
  // Aktif lisans varsa bitişinden, yoksa bugünden itibaren uzat.
  const start = p!.user.paidUntil && p!.user.paidUntil.getTime() > Date.now() ? new Date(p!.user.paidUntil) : new Date();
  const periodEnd = new Date(start);
  if (p!.period === "yillik") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);
  await db.$transaction([
    db.payment.update({ where: { id: p!.id }, data: { status: "odendi", paidAt: new Date(), periodEnd } }),
    db.user.update({ where: { id: p!.userId }, data: { plan: p!.plan, billingPeriod: p!.period, paidUntil: periodEnd, suspended: false } }),
  ]);
  revalidatePath("/backoffice", "layout");
  go("/backoffice/odemeler", "ok", `${p!.reference} onaylandı; lisans ${periodEnd.toLocaleDateString("tr-TR")} tarihine kadar geçerli.`);
}

export async function rejectPayment(fd: FormData) {
  await requireAdmin();
  await db.payment.updateMany({ where: { id: str(fd, "id"), status: { in: ["bekliyor", "bildirildi"] } }, data: { status: "iptal" } });
  revalidatePath("/backoffice", "layout");
  go("/backoffice/odemeler", "ok", "Sipariş iptal edildi.");
}
