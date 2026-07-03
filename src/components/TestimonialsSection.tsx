import { Star } from "lucide-react";
import { Container } from "./ui/Container";
import { SectionHeading } from "./ui/SectionHeading";
import { Reveal } from "./ui/Reveal";

// Avis d'illustration (exemples génériques) : remplacez-les par de vrais
// avis clients vérifiés dès qu'ils sont disponibles.
const TESTIMONIALS = [
  {
    name: "Sophie",
    location: "Lyon",
    rating: 5,
    text: "Très pratique pour mon appartement, je l'utilise surtout le soir dans la chambre. L'installation a pris cinq minutes.",
  },
  {
    name: "Thomas",
    location: "Toulouse",
    rating: 5,
    text: "Je travaille de chez moi et le bureau devenait étouffant l'après-midi. Depuis, je garde une température correcte même en pleine chaleur.",
  },
  {
    name: "Lina",
    location: "Paris",
    rating: 4,
    text: "En studio, c'est exactement ce qu'il me fallait : pas de travaux, pas d'autorisation à demander, et je peux le ranger hors saison.",
  },
  {
    name: "Karim",
    location: "Marseille",
    rating: 5,
    text: "On le déplace du salon à la chambre selon le moment de la journée. Simple à utiliser, même la télécommande est intuitive.",
  },
  {
    name: "Julien",
    location: "Nantes",
    rating: 4,
    text: "Bon rapport qualité-prix comparé aux devis que j'avais reçus pour une clim fixe. Le mode nuit est discret, on dort bien.",
  },
];

function StarRating({ rating, name }: { rating: number; name: string }) {
  return (
    <div
      className="flex gap-0.5"
      role="img"
      aria-label={`Note de ${name} : ${rating} étoiles sur 5`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`h-4 w-4 ${
            value <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
          }`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section id="avis" className="relative py-20 sm:py-28">
      <Container className="flex flex-col items-center gap-14">
        <SectionHeading
          eyebrow="Ils l'utilisent"
          title="Ce qu'en disent nos clients"
          description="Des retours simples et concrets sur l'usage au quotidien, en appartement comme en maison."
        />

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <Reveal
              as="li"
              key={testimonial.name}
              delay={index * 80}
              className="flex flex-col gap-4 rounded-3xl border border-ink-900/5 bg-white p-7 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.12)]"
            >
              <StarRating rating={testimonial.rating} name={testimonial.name} />
              <blockquote className="text-sm leading-relaxed text-ink-500">
                « {testimonial.text} »
              </blockquote>
              <footer className="mt-auto flex items-center gap-3 pt-2">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500/15 to-cyan-400/15 text-sm font-semibold text-brand-700"
                  aria-hidden="true"
                >
                  {testimonial.name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{testimonial.name}</p>
                  <p className="text-xs text-ink-400">{testimonial.location}</p>
                </div>
              </footer>
            </Reveal>
          ))}
        </ul>

        <Reveal>
          <p className="text-xs text-ink-400">
            Avis présentés à titre d'illustration de cas d'usage typiques.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
