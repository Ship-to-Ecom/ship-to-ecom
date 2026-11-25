// Süreç genelinde tek kopya durum. Next, sunucu aksiyonlarını, sayfaları ve API rotalarını ayrı paketler;
// modül düzeyindeki bir Map her pakette ayrı kopya olur ve örneğin webhook'tan başlayan senkron,
// panelden başlayanı göremez. Kilit ve sayaçlar bu yüzden globalThis üzerinde, adla tutulur.
const g = globalThis as unknown as { __processState?: Map<string, unknown> };
const store = (g.__processState ??= new Map());

export function processState<T>(name: string, init: () => T): T {
  if (!store.has(name)) store.set(name, init());
  return store.get(name) as T;
}
