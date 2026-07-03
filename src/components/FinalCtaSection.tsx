import { ArrowRight } from "lucide-react";
import { Container } from "./ui/Container";
import { Reveal } from "./ui/Reveal";

export function FinalCtaSection() {
  return (
    <section id="commander" className="relative overflow-hidden py-20 sm:py-28">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-ink-900 via-[#0f2547] to-brand-700 px-8 py-16 text-center shadow-[0_32px_80px_-32px_rgba(15,23,42,0.5)] sm:px-16 sm:py-20">
            {/* Halos décoratifs */}
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Préparez votre intérieur avant les fortes chaleurs.
              </h2>
              <p className="text-balance text-lg leading-relaxed text-slate-300">
                Profitez d'une solution mobile, puissante et abordable pour retrouver une pièce
                fraîche quand vous en avez besoin.
              </p>
              <a
                href="#offre"
                className="group mt-2 inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-base font-semibold text-ink-900 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
              >
                Commander maintenant
                <ArrowRight className="h-4.5 w-4.5 text-brand-600 transition-transform group-hover:translate-x-0.5" />
              </a>
              <p className="text-sm font-medium text-slate-400">
                Installation simple • Prix accessible • Livraison en France
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
