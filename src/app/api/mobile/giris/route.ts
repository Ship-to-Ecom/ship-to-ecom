import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiError, createMobileToken, loginBlocked, loginFailed, loginOk } from "@/lib/mobile";
import { planById } from "@/lib/plans";
import { clientIp } from "@/lib/throttle";

// POST { email, password } → { token, kullanici }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) return apiError(400, "E-posta ve şifre gerekli.");
  const ip = clientIp(req.headers);
  if (loginBlocked(email, ip)) return apiError(429, "Çok fazla hatalı deneme. 15 dakika sonra yeniden deneyin.");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    loginFailed(email, ip);
    return apiError(401, "E-posta veya şifre hatalı.");
  }
  if (user.suspended) return apiError(403, "Hesabınız askıya alınmış. Destek ile iletişime geçin.");
  loginOk(email);
  return Response.json({ token: await createMobileToken(user.id), kullanici: { email: user.email, paket: planById(user.plan)?.name ?? user.plan } });
}
