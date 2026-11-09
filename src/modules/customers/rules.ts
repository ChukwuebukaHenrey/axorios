/**
 * Pure rules for Customers (spec v2, Customers): system labels, duplicate suggestions and the label delete guard.
 */

export const SYSTEM_LABELS = ["customer", "lead"] as const;

/** `customer` with one or more paid orders, otherwise `lead`. Computed, never stored by hand. */
export function systemLabel(
  contactId: string,
  buyers: Set<string>,
): "customer" | "lead" {
  return buyers.has(contactId) ? "customer" : "lead";
}

export const normEmail = (e: string | null | undefined) =>
  e ? e.trim().toLowerCase() : "";
/** Digits only, with a leading 0 read as Nigeria's 234 so 0803… and +234803… match. */
export function normPhone(p: string | null | undefined): string {
  if (!p) return "";
  let d = p.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = `234${d.slice(1)}`;
  return d.length >= 7 ? d : "";
}

type DupContact = {
  id: string;
  email: string | null;
  phone: string | null;
  merged_into: string | null;
  first_seen_at: string;
};

/** Groups of live contacts sharing an email or phone. The oldest contact in each group is the suggested one to keep. */
export function duplicateGroups<T extends DupContact>(
  contacts: T[],
): { reason: "email" | "phone"; value: string; contacts: T[] }[] {
  const live = contacts.filter((c) => !c.merged_into);
  const out: { reason: "email" | "phone"; value: string; contacts: T[] }[] = [];
  const seen = new Set<string>();
  for (const reason of ["email", "phone"] as const) {
    const by = new Map<string, T[]>();
    for (const c of live) {
      const key = reason === "email" ? normEmail(c.email) : normPhone(c.phone);
      if (key) by.set(key, [...(by.get(key) ?? []), c]);
    }
    for (const [value, group] of by) {
      if (group.length < 2) continue;
      const ids = group
        .map((c) => c.id)
        .sort()
        .join("|");
      if (seen.has(ids)) continue;
      seen.add(ids);
      out.push({
        reason,
        value,
        contacts: [...group].sort((a, b) =>
          a.first_seen_at < b.first_seen_at ? -1 : 1,
        ),
      });
    }
  }
  return out;
}

type GuardCampaign = {
  id: string;
  name: string;
  status: string;
  segment: string[];
};

/** Scheduled campaigns that target the label. Non-empty means the label can't be deleted. */
export function labelDeleteBlockers(
  labelId: string,
  campaigns: GuardCampaign[],
): GuardCampaign[] {
  return campaigns.filter(
    (c) => c.status === "scheduled" && c.segment.includes(labelId),
  );
}
