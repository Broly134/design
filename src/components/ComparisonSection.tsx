import { Check, Minus, X } from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

type Level = "yes" | "no" | "partial";

interface Criterion {
  label: string;
  fan: Level;
  fixed: Level;
  mobile: Level;
  fanNote?: string;
  fixedNote?: string;
}

const CRITERIA: Criterion[] = [
  { label: "Refroidit vraiment l'air", fan: "no", fixed: "yes", mobile: "yes" },
  { label: "Installation facile", fan: "yes", fixed: "no", mobile: "yes" },
  { label: "Sans travaux", fan: "yes", fixed: "no", mobile: "yes" },
  { label: "Prix abordable", fan: "yes", fixed: "no", mobile: "yes" },
  { label: "Déplaçable de pièce en pièce", fan: "yes", fixed: "no", mobile: "yes" },
  { label: "Adapté location / appartement", fan: "yes", fixed: "partial", mobile: "yes" },
];

function LevelIcon({ level, highlighted = false }: { level: Level; highlighted?: boolean }) {
  if (level === "yes") {
    return (
      <span
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
          highlighted ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-600"
        }`}
        aria-label="Oui"
      >
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (level === "partial") {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-600"
        aria-label="Partiellement"
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/10 text-rose-500"
      aria-label="Non"
    >
      <X className="h-4 w-4" strokeWidth={2.5} />
    </span>
  );
}

export function ComparisonSection() {
  return (
    <section className="relative bg-white py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Comparaison"
          title="Le meilleur compromis pour rafraîchir votre logement"
          description="Chaque solution a ses forces. Le climatiseur mobile combine l'efficacité d'une vraie climatisation et la simplicité d'un ventilateur."
        />

        <Reveal className="w-full">
          <div className="overflow-x-auto rounded-[2rem] border border-ink-900/5 bg-frost-50 p-2 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.08)]">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
              <caption className="sr-only">
                Comparaison entre ventilateur classique, climatisation fixe et climatiseur mobile
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="rounded-tl-3xl px-6 py-5 text-sm font-medium text-ink-400">
                    Critère
                  </th>
                  <th scope="col" className="px-6 py-5 text-center text-sm font-semibold text-ink-700">
                    Ventilateur classique
                  </th>
                  <th scope="col" className="px-6 py-5 text-center text-sm font-semibold text-ink-700">
                    Climatisation fixe
                  </th>
                  <th
                    scope="col"
                    className="rounded-t-3xl bg-gradient-to-b from-brand-600 to-brand-500 px-6 py-5 text-center text-sm font-semibold text-white shadow-lg shadow-brand-600/20"
                  >
                    Notre climatiseur mobile
                  </th>
                </tr>
              </thead>
              <tbody>
                {CRITERIA.map((criterion, index) => {
                  const isLast = index === CRITERIA.length - 1;
                  return (
                    <tr key={criterion.label} className="group">
                      <th
                        scope="row"
                        className={`border-t border-ink-900/5 bg-white px-6 py-4 text-sm font-medium text-ink-700 ${
                          isLast ? "rounded-bl-3xl" : ""
                        }`}
                      >
                        {criterion.label}
                      </th>
                      <td className="border-t border-ink-900/5 bg-white px-6 py-4 text-center">
                        <LevelIcon level={criterion.fan} />
                      </td>
                      <td className="border-t border-ink-900/5 bg-white px-6 py-4 text-center">
                        <LevelIcon level={criterion.fixed} />
                      </td>
                      <td
                        className={`border-t border-white/20 bg-gradient-to-b from-brand-500 to-brand-500 px-6 py-4 text-center ${
                          isLast ? "rounded-b-3xl bg-gradient-to-b from-brand-500 to-brand-600" : ""
                        }`}
                      >
                        <LevelIcon level={criterion.mobile} highlighted />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-center text-xs text-ink-400">
            Le ventilateur brasse l'air sans le refroidir. La climatisation fixe est efficace mais
            nécessite des travaux et un budget nettement supérieur.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
