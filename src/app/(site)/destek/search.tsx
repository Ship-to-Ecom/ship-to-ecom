"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchHelp, type HelpIndexEntry } from "@/lib/help/articles";

// Anlık arama: yazdıkça sonuçlar süzülür; Türkçe karakter ve büyük/küçük harf farkı gözetilmez.
export function HelpSearch({ index, categories }: { index: HelpIndexEntry[]; categories: readonly string[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Adres çubuğundaki ?q= ile gelen aramayı uygula (ör. /destek?q=stok bağlantısı).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("q");
    if (v) setQ(v);
  }, []);

  const results = useMemo(() => {
    const r = searchHelp(index, q);
    return cat ? r.filter((e) => e.category === cat) : r;
  }, [index, q, cat]);

  const searching = q.trim().length > 0;
  const groups = categories.map((c) => [c, results.filter((e) => e.category === c)] as const).filter(([, l]) => l.length);

  return (
    <>
      <form className="relative mx-auto mt-8 max-w-2xl" role="search" onSubmit={(e) => { e.preventDefault(); input.current?.blur(); }}>
        <label htmlFor="destek-ara" className="sr-only">Destek makalelerinde ara</label>
        <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id="destek-ara"
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          autoComplete="off"
          placeholder="Sorununuzu yazın: ör. stok farklı, webhook, havale, sku eşleşmiyor"
          className="w-full rounded-xl border border-gray-300 bg-white py-4 pl-12 pr-28 text-base shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button type="submit" className="btn absolute right-2 top-1/2 -translate-y-1/2">Ara</button>
      </form>

      <div className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-2">
        <button type="button" onClick={() => setCat(null)} className={`rounded-full border px-3 py-1 text-sm ${cat === null ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>Tümü</button>
        {categories.map((c) => (
          <button key={c} type="button" onClick={() => setCat(cat === c ? null : c)} className={`rounded-full border px-3 py-1 text-sm ${cat === c ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{c}</button>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-4xl text-left" aria-live="polite">
        {searching && <p className="mb-4 text-sm text-gray-500">&quot;{q.trim()}&quot; için {results.length} makale bulundu</p>}
        {results.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center">
            <p className="font-medium">Bu aramayla eşleşen makale yok.</p>
            <p className="mt-1 text-sm text-gray-500">Daha kısa ya da farklı bir kelime deneyin (ör. &quot;stok&quot;, &quot;giriş&quot;, &quot;reklam&quot;) veya kategori filtresini kaldırın.</p>
          </div>
        ) : searching ? (
          <ul className="space-y-3">{results.map((e) => <Item key={e.slug} e={e} showCat />)}</ul>
        ) : (
          <div className="space-y-10">
            {groups.map(([c, list]) => (
              <section key={c}>
                <h2 className="mb-3 text-lg font-semibold">{c}</h2>
                <ul className="grid gap-3 sm:grid-cols-2">{list.map((e) => <Item key={e.slug} e={e} />)}</ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Item({ e, showCat }: { e: HelpIndexEntry; showCat?: boolean }) {
  const href = `/destek/${e.slug}`;
  return (
    <li>
      <Link href={href} className="block h-full rounded-xl border border-gray-200 p-4 transition hover:border-indigo-300 hover:shadow-sm">
        {showCat && <span className="text-xs font-medium text-indigo-600">{e.category}</span>}
        <span className="block font-medium text-gray-900">{e.title}</span>
        <span className="mt-1 block text-sm text-gray-500">{e.summary}</span>
      </Link>
    </li>
  );
}
