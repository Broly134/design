import { useState } from "react";
import { BedDouble, Sofa, Briefcase, Home, Ruler } from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";
import { PRODUCT } from "../lib/constants";

// Estimations indicatives : ajustez selon la puissance réelle du produit.
const ROOM_OPTIONS = [
  {
    id: "chambre",
    icon: BedDouble,
    label: "Chambre",
    size: "10–15 m²",
    verdict: "Parfaitement adapté",
    detail:
      "Pour une chambre, le climatiseur mobile atteint rapidement une température confortable. Le mode nuit maintient la fraîcheur en toute discrétion pendant votre sommeil.",
  },
  {
    id: "bureau",
    icon: Briefcase,
    label: "Bureau",
    size: "10–20 m²",
    verdict: "Parfaitement adapté",
    detail:
      "Idéal en télétravail : la pièce reste fraîche pendant vos heures de travail, et le minuteur permet de programmer l'arrêt automatique en fin de journée.",
  },
  {
    id: "salon",
    icon: Sofa,
    label: "Salon",
    size: "20–30 m²",
    verdict: "Bien adapté",
    detail:
      `Pour un salon, l'appareil est efficace jusqu'à environ ${PRODUCT.surfaceM2} m². Fermez les portes des pièces adjacentes pour concentrer la fraîcheur là où vous êtes.`,
  },
  {
    id: "studio",
    icon: Home,
    label: "Studio",
    size: "15–30 m²",
    verdict: "Bien adapté",
    detail:
      "En studio, un seul appareil suffit pour l'ensemble de l'espace de vie. Sa mobilité permet de l'orienter vers le coin nuit le soir venu.",
  },
];

export function RoomCalculator() {
  const [selectedId, setSelectedId] = useState(ROOM_OPTIONS[0].id);
  const selected = ROOM_OPTIONS.find((option) => option.id === selectedId) ?? ROOM_OPTIONS[0];

  return (
    <section className="relative py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-12">
        <SectionHeading
          eyebrow="Estimation rapide"
          title="Quelle taille de pièce voulez-vous rafraîchir ?"
          description="Sélectionnez votre type de pièce pour vérifier en quelques secondes si le climatiseur mobile est adapté."
        />

        <Reveal className="w-full max-w-3xl">
          <div className="glass rounded-[2rem] border border-white/70 p-6 shadow-[0_24px_60px_-24px_rgba(37,99,235,0.2)] sm:p-8">
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4" role="tablist" aria-label="Type de pièce">
              {ROOM_OPTIONS.map((option) => {
                const isActive = option.id === selectedId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setSelectedId(option.id)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? "border-transparent bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-600/25"
                        : "border-ink-900/10 bg-white text-ink-500 hover:border-brand-500/30 hover:text-ink-900"
                    }`}
                  >
                    <option.icon className="h-5 w-5" strokeWidth={1.75} />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink-900/5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-700">
                  <Ruler className="h-3.5 w-3.5" />
                  {selected.size}
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {selected.verdict}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink-500">{selected.detail}</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
