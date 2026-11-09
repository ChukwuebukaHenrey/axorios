import { t } from "@/lib/messages";

const d = t.dashboard;
const o = t.app.orders;

export const STATUS_LABEL: Record<string, string> = {
  paid: d.statusPaid,
  approved: d.statusConfirming,
  failed: d.statusFailed,
  refunded: o.statusRefunded,
  partially_refunded: o.statusPartial,
};

export const STATUS_STYLE: Record<string, string> = {
  paid: "bg-lime/15 text-lime",
  approved: "bg-accent/15 text-accent",
  failed: "bg-red-500/15 text-red-300",
  refunded: "bg-panel-3 text-cream/80",
  partially_refunded: "bg-amber-400/15 text-amber-200",
};

export const CHANNEL_LABEL: Record<string, string> = {
  web: d.channelWeb,
  telegram: d.channelTelegram,
  whatsapp: d.channelWhatsApp,
  instagram: d.channelInstagram,
  facebook: d.channelFacebook,
  tiktok: d.channelTiktok,
  google: d.channelGoogle,
  shopify: d.channelShopify,
};

export const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
