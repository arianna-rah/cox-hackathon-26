import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/landing/Hero";
import { StatsBar } from "@/components/landing/StatsBar";
import { ProcessSteps } from "@/components/landing/ProcessSteps";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-canopy-bg">
      <Hero />
      <StatsBar />
      <ProcessSteps />

      {/* Bottom CTA */}
      <section className="relative overflow-hidden border-t border-canopy-border px-6 py-24 text-center">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[40vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-canopy-green/10 blur-[120px]" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-canopy-text sm:text-4xl">
            One rooftop decision. Neighbourhood-scale impact.
          </h2>
          <Link
            href="/map"
            className="group mt-8 inline-flex items-center gap-2 rounded-full bg-canopy-green px-7 py-3.5 text-base font-semibold text-canopy-bg transition-colors hover:bg-canopy-green-dim"
          >
            Start With Your Building
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-10 text-xs text-canopy-muted">
            Canopy · Cox &ldquo;Play with Purpose&rdquo; · Track 03: Places &amp; Spaces ·
            Sponsored by the City of Atlanta
          </p>
        </div>
      </section>
    </main>
  );
}
