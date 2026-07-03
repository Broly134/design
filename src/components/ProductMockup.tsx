import { Snowflake, Moon } from "lucide-react";
import studioImg from "../assets/climatiseur-studio.webp";

/**
 * Visuel produit du hero : packshot studio sur carte verre,
 * halo froid, flux d'air animé et badges flottants.
 */
export function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Halo froid en arrière-plan */}
      <div
        className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-brand-400/25 via-cyan-300/15 to-transparent blur-2xl animate-pulse-glow"
        aria-hidden="true"
      />

      {/* Carte verre principale */}
      <div className="glass relative rounded-[2.5rem] border border-white/60 p-5 shadow-[0_24px_60px_-20px_rgba(37,99,235,0.25)] sm:p-6">
        {/* Particules d'air frais */}
        <span
          className="absolute left-8 top-10 z-10 h-2 w-2 rounded-full bg-brand-400/50 animate-drift"
          aria-hidden="true"
        />
        <span
          className="absolute right-12 top-16 z-10 h-1.5 w-1.5 rounded-full bg-cyan-400/50 animate-drift [animation-delay:2s]"
          aria-hidden="true"
        />
        <span
          className="absolute left-16 top-24 z-10 h-1 w-1 rounded-full bg-brand-500/40 animate-drift [animation-delay:4s]"
          aria-hidden="true"
        />

        {/* Badge température flottant */}
        <div
          className="glass absolute -right-3 top-8 z-10 flex items-center gap-2 rounded-2xl border border-white/70 px-4 py-2.5 shadow-lg shadow-brand-600/10 animate-float sm:-right-6"
          aria-hidden="true"
        >
          <Snowflake className="h-4 w-4 text-brand-500" />
          <div className="leading-tight">
            <p className="text-lg font-semibold text-ink-900">22°C</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
              Pièce fraîche
            </p>
          </div>
        </div>

        {/* Badge mode nuit flottant */}
        <div
          className="glass absolute -left-3 bottom-16 z-10 flex items-center gap-2 rounded-2xl border border-white/70 px-3.5 py-2 shadow-lg shadow-brand-600/10 animate-float-slow sm:-left-6"
          aria-hidden="true"
        >
          <Moon className="h-4 w-4 text-brand-600" />
          <p className="text-xs font-semibold text-ink-700">Mode nuit</p>
        </div>

        {/* Photo produit */}
        <img
          src={studioImg}
          alt="Climatiseur mobile blanc au design compact, écran digital affichant 22 degrés"
          width={840}
          height={1043}
          fetchPriority="high"
          className="w-full rounded-[1.9rem] object-cover"
        />
      </div>
    </div>
  );
}
