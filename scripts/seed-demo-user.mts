// Creates or updates the judge demo seller. Prints no credentials.
// Run: npx tsx --env-file=.env.local scripts/seed-demo-user.mts
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const email = process.env.DEMO_SELLER_EMAIL!;
const password = process.env.DEMO_SELLER_PASSWORD!;

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const existing = list.users.find((u) => u.email === email);

const { error } = existing
  ? await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
  : await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
console.log(existing ? "PASS demo seller updated" : "PASS demo seller created");
