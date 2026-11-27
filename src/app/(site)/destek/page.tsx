import type { Metadata } from "next";
import { HELP_ARTICLES, HELP_CATEGORIES, buildHelpIndex } from "@/lib/help/articles";
import { HelpChrome } from "./chrome";
import { HelpSearch } from "./search";

export const metadata: Metadata = {
  title: "Destek makaleleri | ShipToEcom",
  description: "ShipToEcom özelliklerinin nasıl bağlandığını ve kullanıldığını adım adım anlatan kılavuzlar.",
};

export default function Page() {
  return (
    <HelpChrome>
      <section className="border-b border-gray-100 bg-gradient-to-b from-indigo-50/60 to-white px-4 pb-6 pt-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Destek makaleleri</h1>
        <p className="mx-auto mt-3 max-w-2xl text-gray-600">
          Hangi özelliğin nasıl bağlandığını ve kullanıldığını adım adım anlatan {HELP_ARTICLES.length} kılavuz. Yaşadığınız sorunu yazın, ilgili makale hemen çıksın.
        </p>
        <HelpSearch index={buildHelpIndex()} categories={HELP_CATEGORIES} />
      </section>
      <div className="h-16" />
    </HelpChrome>
  );
}
