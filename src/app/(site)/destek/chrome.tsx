import Link from "next/link";
import { hasValidSession } from "@/lib/session";
import { Logo } from "../../(panel)/logo";

// Destek sayfalarının üst ve alt çerçevesi (ana sayfayla aynı görünüm).
export async function HelpChrome({ children }: { children: React.ReactNode }) {
  const loggedIn = await hasValidSession();
  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link href="/"><Logo /></Link>
          <nav className="hidden flex-1 gap-6 text-sm font-medium text-gray-600 md:flex">
            <Link href="/" className="hover:text-gray-900">Ana sayfa</Link>
            <Link href="/destek" className="text-gray-900">Destek makaleleri</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {loggedIn ? (
              <Link href="/panel" className="btn">Panele git</Link>
            ) : (
              <>
                <Link href="/giris" className="btn-ghost">Giriş yap</Link>
                <Link href="/kayit" className="btn hidden sm:inline-flex">Ücretsiz dene</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <span>© ShipToEcom. Adı geçen e-ticaret altyapıları kendi sahiplerinin markasıdır; ShipToEcom bağımsız bir üründür.</span>
          <Link href="/" className="font-medium text-indigo-600 hover:underline">Ana sayfa</Link>
        </div>
      </footer>
    </div>
  );
}
