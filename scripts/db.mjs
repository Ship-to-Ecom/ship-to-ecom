// Prisma'yı DATABASE_URL'e göre doğru sağlayıcıyla çalıştırır.
// Yerelde SQLite (prisma/schema.prisma olduğu gibi), yayında PostgreSQL:
// DATABASE_URL "postgres" ile başlıyorsa şemanın sağlayıcısı değiştirilmiş bir kopyası
// (prisma/schema.postgres.prisma, depoya girmez) üretilir ve komutlar o kopyayla çalışır.
//
//   node scripts/db.mjs generate   -> prisma generate (postinstall)
//   node scripts/db.mjs deploy     -> yalnızca PostgreSQL'de: generate + db push (start öncesi)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = join(root, "prisma", "schema.prisma");
const pgSchema = join(root, "prisma", "schema.postgres.prisma");
const isPostgres = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");

function schemaPath() {
  if (!isPostgres) return base;
  const src = readFileSync(base, "utf8");
  const out = src.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  if (out === src) throw new Error('prisma/schema.prisma içinde provider = "sqlite" satırı bulunamadı.');
  writeFileSync(pgSchema, out);
  return pgSchema;
}

function prisma(...args) {
  const bin = join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  execFileSync(bin, args, { cwd: root, stdio: "inherit" });
}

const cmd = process.argv[2];
if (cmd === "generate") {
  prisma("generate", "--schema", schemaPath());
} else if (cmd === "deploy") {
  if (!isPostgres) {
    console.log("db deploy: DATABASE_URL PostgreSQL değil, atlandı.");
  } else {
    // Hata uygulamanın açılmasını engellemez: sonuç /api/durum ucundan okunabilsin diye kaydedilir.
    let adim = "sema";
    let ok = true;
    try {
      const schema = schemaPath();
      adim = "generate";
      prisma("generate", "--schema", schema);
      adim = "db push";
      // Veri kaybına yol açacak değişikliklerde durur (--accept-data-loss verilmez).
      prisma("db", "push", "--schema", schema, "--skip-generate");
    } catch (e) {
      ok = false;
      console.error(`db deploy: "${adim}" adımı başarısız oldu.`, e?.message ?? e);
    }
    writeFileSync(join(tmpdir(), "shiptoecom-db-deploy.json"), JSON.stringify({ ok, adim, zaman: new Date().toISOString() }));
  }
} else {
  console.error("Kullanım: node scripts/db.mjs <generate|deploy>");
  process.exit(1);
}
