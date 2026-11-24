"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiPanel } from "./ai-panel";
import { Answers } from "./answers";
import { Hero } from "./hero";
import { OverheadEditor } from "./overhead-editor";
import { ProductList } from "./product-list";
import { ProfitChart } from "./profit-chart";
import { Toast, type ToastData } from "./toast";
import { money } from "@/lib/format";
import { computeAnswer } from "@/lib/margin";
import { discountedPrice } from "@/lib/moves";
import { sampleShop } from "@/lib/sample-shop";
import type { Overhead, Product } from "@/lib/types";

type Store = { products: Product[]; overhead: Overhead | null };
const KEY = "margin:v1";

function load(): Store | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Store;
    return Array.isArray(s.products) ? s : null;
  } catch {
    return null;
  }
}

function Skeleton() {
  return (
    <div className="pt-10" aria-busy="true" aria-label="Loading your shop">
      <div className="skeleton h-5 w-56" />
      <div className="skeleton mt-3 h-16 w-72 sm:h-24" />
      <div className="skeleton mt-8 h-44 w-full sm:h-60" />
      <div className="mt-8 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export function MarginApp() {
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [store, setStore] = useState<Store>({ products: [], overhead: null });
  const [openId, setOpenId] = useState<string | null>(null);
  const [ohOpen, setOhOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastId = useRef(0);

  useEffect(() => {
    const s = load();
    if (s) setStore(s);
    setNow(new Date());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* private mode or full: app still works for this session */
    }
  }, [store, ready]);

  const { products, overhead } = store;
  const answer = useMemo(() => computeAnswer(products, overhead, now), [products, overhead, now]);

  const say = useCallback((message: string, undo?: () => void) => {
    setToast({ id: ++toastId.current, message, undo });
  }, []);

  const pulse = (k: string) => {
    setFlash(k);
    setTimeout(() => setFlash(null), 750);
  };

  const commit = (next: Store, message: string, flashKey: string) => {
    const prev = store;
    setStore(next);
    pulse(flashKey);
    say(message, () => setStore(prev));
  };

  const onSetPrice = (id: string, price: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    commit(
      { ...store, products: products.map((x) => (x.id === id ? { ...x, price, discountedFrom: undefined } : x)) },
      `${p.name} is now ${money(price, { forceCents: true })}`,
      "price",
    );
  };

  const onDiscount = (ids: string[]) => {
    commit(
      {
        ...store,
        products: products.map((x) =>
          ids.includes(x.id) ? { ...x, discountedFrom: x.price, price: discountedPrice(x) } : x,
        ),
      },
      `Discounted ${ids.length} ${ids.length === 1 ? "product" : "products"} by 20%, never below cost`,
      "dead",
    );
  };

  const onSaveProduct = (p: Product, isNew: boolean) => {
    if (isNew) {
      const id = `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item"}-${Date.now().toString(36)}`;
      setStore({ ...store, products: [{ ...p, id }, ...products] });
    } else {
      setStore({ ...store, products: products.map((x) => (x.id === p.id ? p : x)) });
    }
    setOpenId(null);
    say(isNew ? `Added ${p.name}` : `Saved ${p.name}`);
  };

  const onDelete = (id: string) => {
    const prev = store;
    const p = products.find((x) => x.id === id);
    setStore({ ...store, products: products.filter((x) => x.id !== id) });
    setOpenId(null);
    say(`Deleted ${p?.name ?? "product"}`, () => setStore(prev));
  };

  const onSaveOverhead = (o: Overhead) => {
    setOhOpen(false);
    commit({ ...store, overhead: o }, "Monthly costs saved", "overhead");
  };

  const openOverhead = () => {
    setOhOpen(true);
    requestAnimationFrame(() => document.getElementById("overhead")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const editProduct = (id: string) => {
    setOpenId(id);
    requestAnimationFrame(() => document.getElementById("prod-h")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const loadSample = () => {
    setNow(new Date());
    setStore(sampleShop(new Date()));
  };

  const startOver = () => {
    const prev = store;
    setStore({ products: [], overhead: null });
    setOpenId(null);
    setOhOpen(false);
    say("Cleared your shop", () => setStore(prev));
  };

  const empty = products.length === 0 && openId !== "new";

  return (
    <div className="mx-auto w-full max-w-[72rem] px-4 pb-24 sm:px-6 lg:px-10">
      <header className="flex min-h-16 items-center justify-between border-b border-line">
        <span className="text-lg font-semibold tracking-tight">Margin</span>
        {ready && products.length > 0 && (
          <button onClick={startOver} className="press min-h-11 rounded-full px-3 text-sm font-medium text-muted hover:text-ink">
            Start over
          </button>
        )}
      </header>

      {!ready ? (
        <Skeleton />
      ) : empty ? (
        <section className="rise mx-auto max-w-xl pt-16 text-center sm:pt-28">
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Find out what your shop really earns
          </h1>
          <p className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-muted sm:text-lg">
            Add what you sell and what it costs. Margin tells you your true profit, what to charge, and what is not selling.
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:justify-center">
            <button onClick={loadSample} className="press min-h-12 rounded-full bg-ink px-7 text-base font-semibold text-bg hover:bg-ink/85">
              Try the sample shop
            </button>
            <button onClick={() => setOpenId("new")} className="press min-h-12 rounded-full border border-line px-7 text-base font-semibold hover:bg-wash">
              Add a product
            </button>
          </div>
        </section>
      ) : (
        <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
          <main>
            {products.length > 0 && (
              <>
                <Hero answer={answer} onEditOverhead={openOverhead} />
                <ProfitChart products={products} answer={answer} />
                <Answers
                  products={products}
                  overhead={overhead}
                  answer={answer}
                  flash={flash}
                  onEditOverhead={openOverhead}
                  onSetPrice={onSetPrice}
                  onEditProduct={editProduct}
                  onDiscount={onDiscount}
                />
                <AiPanel products={products} overhead={overhead} now={now} />
              </>
            )}
          </main>
          <aside className="mt-10 space-y-8 lg:sticky lg:top-6 lg:mt-0 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:pt-10 lg:pr-1">
            <ProductList
              products={products}
              deadIds={answer.deadStock}
              now={now}
              openId={openId}
              setOpenId={setOpenId}
              onSave={onSaveProduct}
              onDelete={onDelete}
            />
            <OverheadEditor overhead={overhead} open={ohOpen} setOpen={setOhOpen} onSave={onSaveOverhead} />
          </aside>
        </div>
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
