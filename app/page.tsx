import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <p className="text-sm font-mono uppercase tracking-widest text-emerald-700">
          Greenscape Pro · Quote Drafter
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
          Site walk notes in. <br />
          Customer-ready proposal out.
        </h1>
        <p className="mt-4 text-zinc-600">
          Compresses Marcus&apos;s 6&ndash;9 day quote cycle to under 24 hours, while keeping every
          draft under his eyes before it goes to the customer.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/intake" className={buttonVariants({ size: "lg" })}>
          New site walk &rarr;
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Dashboard
        </Link>
      </div>
    </main>
  );
}
