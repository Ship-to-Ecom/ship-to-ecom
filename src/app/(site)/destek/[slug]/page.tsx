import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HELP_ARTICLES, helpArticle } from "@/lib/help/articles";
import { HelpChrome } from "../chrome";

export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = helpArticle((await params).slug);
  return a ? { title: `${a.title} | ShipToEcom Destek`, description: a.summary } : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const a = helpArticle((await params).slug);
  if (!a) notFound();
  const related = HELP_ARTICLES.filter((x) => x.category === a.category && x.slug !== a.slug);

  return (
    <HelpChrome>
      <article className="mx-auto max-w-4xl px-4 py-10">
        <nav className="text-sm text-gray-500" aria-label="Konum">
          <Link href="/destek" className="text-indigo-600 hover:underline">Destek makaleleri</Link>
          <span className="mx-2">/</span>
          <span>{a.category}</span>
        </nav>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{a.title}</h1>
        <p className="mt-3 text-lg text-gray-600">{a.summary}</p>
        {a.path && (
          <p className="mt-4 text-sm text-gray-500">
            Paneldeki ekran: <Link href={a.path} className="font-medium text-indigo-600 hover:underline">{a.path}</Link>
          </p>
        )}

        <ol className="mt-8 space-y-4">
          {a.steps.map((s, i) => (
            <li key={i} className="flex gap-4 rounded-xl border border-gray-200 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{s.title}</h2>
                <p className="mt-1 text-gray-600">{s.text}</p>
                {s.image && (
                  <a href={s.image} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-lg border border-gray-200 shadow-sm" title="Büyütmek için tıklayın">
                    {/* eslint-disable-next-line @next/next/no-img-element -- statik ekran görüntüsü, boyut sabit */}
                    <img src={s.image} alt={`${s.title}: paneldeki ekran`} width={1280} height={820} loading="lazy" className="h-auto w-full" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>

        {a.notes?.length ? (
          <div className="mt-8 rounded-xl bg-amber-50 px-5 py-4 text-sm text-amber-900">
            <h2 className="font-semibold">Bilmeniz gerekenler</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">{a.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </div>
        ) : null}

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold">{a.category} ile ilgili diğer makaleler</h2>
            <ul className="mt-3 space-y-2">
              {related.map((r) => (
                <li key={r.slug}><Link href={`/destek/${r.slug}`} className="text-indigo-600 hover:underline">{r.title}</Link></li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 rounded-xl border border-gray-200 p-5 text-sm text-gray-600">
          Aradığınızı bulamadınız mı? <Link href="/destek" className="font-medium text-indigo-600 hover:underline">Tüm makalelerde arayın</Link>.
        </div>
      </article>
    </HelpChrome>
  );
}
