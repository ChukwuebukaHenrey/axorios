import { Logo } from "@/components/logo";
import { SignInForm } from "@/components/sign-in-form";
import { t } from "@/lib/messages";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col bg-primary px-4 py-6 text-white sm:px-8">
      <header className="flex items-center gap-2 text-white">
        <Logo className="size-8" />
        <span className="text-lg font-semibold">AxoriOS</span>
      </header>
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 py-10 md:flex-row md:items-center md:justify-between md:gap-16">
        <div className="max-w-xl">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">{t.landing.headline}</h1>
          <p className="mt-5 text-lg text-white/80">{t.landing.subhead}</p>
        </div>
        <SignInForm linkFailed={error === "link"} />
      </section>
    </main>
  );
}
