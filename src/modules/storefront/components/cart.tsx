"use client";

import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { t } from "@/lib/messages";
import { formatMinor } from "@/lib/money";

// Loaded only at the payment step, so browsing a store doesn't pay for PayPal's script.
const PayPalCheckout = dynamic(() => import("./paypal-checkout"), { ssr: false });

const BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-store px-6 font-semibold transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50";
const ICON_BUTTON = "inline-flex size-11 items-center justify-center rounded-store border border-current/25";

export type CartProduct = { id: string; name: string; priceMinor: number; currency: string; stock: number };
type Quantities = Record<string, number>;

/** Kept in memory as well, so the cart still works where the browser blocks storage. */
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function readCart(key: string): string {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return window.localStorage.getItem(key) ?? "{}";
  } catch {
    return "{}";
  }
}

function writeCart(key: string, quantities: Quantities) {
  const value = JSON.stringify(quantities);
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The in-memory copy still serves this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function parseCart(raw: string): Quantities {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Quantities) : {};
  } catch {
    return {};
  }
}

type CartState = {
  lines: { product: CartProduct; quantity: number }[];
  add: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  /** The cart dialog, opened from the floating button or the store header's bag. */
  dialog: RefObject<HTMLDialogElement | null>;
};

const CartContext = createContext<CartState | null>(null);

export function CartProvider({
  slug,
  products,
  children,
}: {
  slug: string;
  products: CartProduct[];
  children: ReactNode;
}) {
  const key = `axorios-cart-${slug}`;
  const dialog = useRef<HTMLDialogElement>(null);
  const raw = useSyncExternalStore(
    subscribe,
    () => readCart(key),
    () => "{}",
  );

  const value = useMemo<CartState>(() => {
    const quantities = parseCart(raw);
    // Products come fresh from the server, so a removed product or an old price can't survive in a saved cart.
    const lines = products.flatMap((product) => {
      const quantity = Math.min(Number(quantities[product.id]) || 0, product.stock);
      return quantity > 0 ? [{ product, quantity }] : [];
    });
    const setQuantity = (productId: string, quantity: number) => {
      const next = { ...parseCart(readCart(key)) };
      if (quantity > 0) next[productId] = quantity;
      else delete next[productId];
      writeCart(key, next);
    };
    return {
      lines,
      setQuantity,
      add: (productId) => setQuantity(productId, (Number(parseCart(readCart(key))[productId]) || 0) + 1),
      clear: () => writeCart(key, {}),
      dialog,
    };
  }, [raw, products, key]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Null outside a store page with checkout, such as the builder preview or the order page. */
export function useCart() {
  return useContext(CartContext);
}

/** With no cart around it, as in the builder's preview, the button shows but does nothing. */
export function AddToCart({ productId, className = "" }: { productId: string; className?: string }) {
  const cart = useContext(CartContext);
  return (
    <button
      type="button"
      onClick={() => cart?.add(productId)}
      className={`${BUTTON} bg-store-secondary text-store-on-secondary ${className}`}
    >
      <Plus className="size-4" aria-hidden="true" /> {t.cart.add}
    </button>
  );
}

type Checkout = {
  key: string;
  orderId: string;
  paypalOrderId: string;
  totalMinor: number;
  currency: string;
  chargeMinor: number;
  chargeCurrency: string;
};

const ERRORS: Record<string, string> = {
  product_unavailable: t.cart.errorUnavailable,
  not_enough_stock: t.cart.errorStock,
  currency_not_supported: t.cart.errorCurrency,
};

export function CartBar({ slug, paypalClientId, locale }: { slug: string; paypalClientId: string; locale: string }) {
  const cart = useContext(CartContext);
  const router = useRouter();
  const [deliveryNote, setDeliveryNote] = useState("");
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!cart || cart.lines.length === 0) return null;
  const { lines, setQuantity, clear, dialog } = cart;

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const currency = lines[0].product.currency;
  const shownTotal = lines.reduce((sum, line) => sum + line.product.priceMinor * line.quantity, 0);
  const cartKey = JSON.stringify(lines.map((line) => [line.product.id, line.quantity]));
  // A checkout belongs to the exact cart it was priced for. Changing the cart asks for a new one.
  const active = checkout?.key === cartKey ? checkout : null;

  async function startCheckout() {
    if (!deliveryNote.trim()) {
      setError(t.cart.errorDelivery);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          deliveryNote,
          items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        }),
      });
      const body = (await res.json()) as Omit<Checkout, "key"> & { error?: string };
      if (!res.ok) {
        setError(ERRORS[body.error ?? ""] ?? t.cart.errorGeneric);
        return;
      }
      setCheckout({ ...body, key: cartKey });
    } catch {
      setError(t.cart.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`${BUTTON} fixed right-4 bottom-4 z-30 bg-store-primary text-store-on-primary shadow-lg`}
      >
        <ShoppingBag className="size-5" aria-hidden="true" />
        {t.cart.open.replace("{count}", String(count))} · {formatMinor(shownTotal, currency, locale)}
      </button>

      <dialog
        ref={dialog}
        aria-label={t.cart.title}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-store bg-store-paper p-5 text-store-ink backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-store-heading text-2xl font-bold">{t.cart.title}</h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label={t.cart.close} className={ICON_BUTTON}>
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-current/15">
          {lines.map(({ product, quantity }) => (
            <li key={product.id} className="py-3">
              <div className="flex justify-between gap-4">
                <p className="font-semibold">{product.name}</p>
                <p className="shrink-0 font-semibold">{formatMinor(product.priceMinor * quantity, currency, locale)}</p>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity(product.id, quantity - 1)}
                  aria-label={t.cart.less.replace("{name}", product.name)}
                  className={ICON_BUTTON}
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span aria-live="polite" className="min-w-6 text-center font-semibold">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(product.id, quantity + 1)}
                  disabled={quantity >= Math.min(product.stock, 99)}
                  aria-label={t.cart.more.replace("{name}", product.name)}
                  className={`${ICON_BUTTON} disabled:opacity-40`}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-3 flex justify-between border-t border-current/25 pt-3 text-lg font-bold">
          <span>{t.cart.total}</span>
          <span>{formatMinor(active?.totalMinor ?? shownTotal, currency, locale)}</span>
        </p>

        {active ? (
          <div className="mt-4">
            {active.chargeCurrency !== active.currency && (
              <p className="mb-3 rounded-store border border-current/25 p-3 font-semibold">
                {t.cart.chargedAs
                  .replace("{amount}", formatMinor(active.chargeMinor, active.chargeCurrency, locale))
                  .replace("{currency}", active.chargeCurrency)}
              </p>
            )}
            <PayPalCheckout
              clientId={paypalClientId}
              currency={active.chargeCurrency}
              paypalOrderId={active.paypalOrderId}
              onApproved={() => {
                clear();
                router.push(`/s/${slug}/order/${active.orderId}`);
              }}
              onError={() => setError(t.cart.errorGeneric)}
            />
          </div>
        ) : (
          <div className="mt-4">
            <label htmlFor="delivery-note" className="font-semibold">
              {t.cart.deliveryLabel}
            </label>
            <textarea
              id="delivery-note"
              value={deliveryNote}
              onChange={(event) => setDeliveryNote(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t.cart.deliveryPlaceholder}
              className="mt-2 w-full rounded-store border border-current/25 bg-transparent p-3"
            />
            <button
              type="button"
              onClick={startCheckout}
              disabled={busy}
              className={`${BUTTON} mt-3 w-full bg-store-secondary text-store-on-secondary`}
            >
              {busy ? t.cart.working : t.cart.continue}
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 font-semibold">
            {error}
          </p>
        )}
      </dialog>
    </>
  );
}
