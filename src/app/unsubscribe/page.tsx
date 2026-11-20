import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = { title: "Unsubscribe | Foodeez", robots: { index: false, follow: false } };

// Public. Opening the link only shows a button: mail scanners open links on their own, so only the POST unsubscribes.
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.slice(0, 200) : "";
  const message = params.done
    ? "You are unsubscribed. Foodeez will not send you marketing emails again."
    : params.invalid
      ? "This unsubscribe link is not valid. Reply to the email or use the contact form on foodeez.ch and we will remove you by hand."
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <Image src="/images/Logo/LogoFoodeezMain.svg" alt="Foodeez" width={126} height={40} className="mx-auto" priority />
        <h1 className="mt-6 text-2xl font-semibold text-gray-950">Unsubscribe</h1>
        {message ? (
          <p role="status" className="mt-3 text-sm text-gray-600">{message}</p>
        ) : token ? (
          <form method="post" action="/api/marketing/unsubscribe" className="mt-6 space-y-4">
            <p className="text-sm text-gray-600">Stop receiving marketing emails from Foodeez at this address.</p>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="from" value="page" />
            <button type="submit" className="h-10 w-full rounded-md bg-foodeez-primary px-5 text-sm font-medium text-white shadow-xs hover:bg-foodeez-primary/90">
              Unsubscribe
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-gray-600">Open the unsubscribe link from one of our emails.</p>
        )}
      </div>
    </main>
  );
}
