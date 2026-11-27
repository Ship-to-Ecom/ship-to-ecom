// Destek makaleleri: arama ve veri bütünlüğü.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { HELP_ARTICLES, HELP_CATEGORIES, buildHelpIndex, normalizeTr, searchHelp } from "../src/lib/help/articles.ts";

assert.equal(normalizeTr("Şifre İŞLEMİ, Çğü ıö!"), "sifre islemi cgu io");

const slugs = new Set<string>();
for (const a of HELP_ARTICLES) {
  assert.match(a.slug, /^[a-z0-9-]+$/, a.slug);
  assert.ok(!slugs.has(a.slug), `tekrarlanan slug ${a.slug}`);
  slugs.add(a.slug);
  assert.ok((HELP_CATEGORIES as readonly string[]).includes(a.category), `${a.slug}: kategori`);
  assert.ok(a.steps.length > 0, `${a.slug}: adım yok`);
  for (const st of a.steps) if (st.image) assert.ok(existsSync(new URL(`../public${st.image}`, import.meta.url)), `${a.slug}: görsel yok ${st.image}`);
  for (const t of [a.title, a.summary, ...a.steps.flatMap((s) => [s.title, s.text]), ...(a.notes ?? [])]) assert.ok(!t.includes("—"), `${a.slug}: uzun tire`);
}

const idx = buildHelpIndex();
const top = (q: string) => searchHelp(idx, q)[0]?.slug;
assert.equal(searchHelp(idx, "").length, HELP_ARTICLES.length);
assert.equal(top("webhook"), "anlik-bildirim-webhook");
assert.equal(top("SIFRE"), "giris-sorunlari");
assert.equal(top("havale"), "lisans-ve-odeme");
assert.equal(top("sku eşleşmiyor"), "sku-eslestirme");
assert.equal(top("stok farklı"), "stok-yanlis");
assert.equal(top("ikas client secret"), "ikas-magaza-baglama");
assert.equal(top("google analytics"), "google-analytics-4");
assert.deepEqual(searchHelp(idx, "zzqqxx"), []);
console.log(`destek: ${HELP_ARTICLES.length} makale, arama testleri tamam`);
