import { Snowflake, Wind, Moon, Droplets } from "lucide-react";

/**
 * Mockup produit stylisé en CSS pur (pas d'image externe) :
 * climatiseur mobile posé sur une carte verre, halo froid,
 * flux d'air animé et badge température flottant.
 */
export function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      {/* Halo froid en arrière-plan */}
      <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-brand-400/25 via-cyan-300/15 to-transparent blur-2xl animate-pulse-glow" />

      {/* Carte verre principale */}
      <div className="glass relative rounded-[2.5rem] border border-white/60 p-8 shadow-[0_24px_60px_-20px_rgba(37,99,235,0.25)] sm:p-10">
        {/* Particules d'air frais */}
        <span className="absolute left-8 top-10 h-2 w-2 rounded-full bg-brand-400/50 animate-drift" />
        <span className="absolute right-12 top-16 h-1.5 w-1.5 rounded-full bg-cyan-400/50 animate-drift [animation-delay:2s]" />
        <span className="absolute left-16 top-24 h-1 w-1 rounded-full bg-brand-500/40 animate-drift [animation-delay:4s]" />

        {/* Badge température flottant */}
        <div className="glass absolute -right-3 top-8 z-10 flex items-center gap-2 rounded-2xl border border-white/70 px-4 py-2.5 shadow-lg shadow-brand-600/10 animate-float sm:-right-6">
          <Snowflake className="h-4 w-4 text-brand-500" />
          <div className="leading-tight">
            <p className="text-lg font-semibold text-ink-900">22°C</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
              Pièce fraîche
            </p>
          </div>
        </div>

        {/* Badge mode nuit flottant */}
        <div className="glass absolute -left-3 bottom-24 z-10 flex items-center gap-2 rounded-2xl border border-white/70 px-3.5 py-2 shadow-lg shadow-brand-600/10 animate-float-slow sm:-left-6">
          <Moon className="h-4 w-4 text-brand-600" />
          <p className="text-xs font-semibold text-ink-700">Mode nuit</p>
        </div>

        {/* Corps du climatiseur */}
        <div className="relative mx-auto w-56 sm:w-64">
          {/* Vagues d'air frais au-dessus de la sortie */}
          <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-8 w-1 rounded-full bg-gradient-to-t from-brand-400/60 to-transparent animate-pulse-glow"
                style={{ animationDelay: `${i * 0.6}s` }}
              />
            ))}
          </div>

          <div className="rounded-[2rem] bg-gradient-to-b from-white to-slate-100 p-1.5 shadow-[0_20px_40px_-16px_rgba(15,23,42,0.3)] ring-1 ring-ink-900/5">
            <div className="rounded-[1.7rem] bg-gradient-to-b from-slate-50 to-slate-200/80 px-6 pb-6 pt-5">
              {/* Grille de ventilation supérieure */}
              <div className="mb-5 space-y-1.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-1 rounded-full bg-slate-300/80" />
                ))}
              </div>

              {/* Écran digital */}
              <div className="mb-5 rounded-2xl bg-ink-900 px-4 py-4 text-center shadow-inner">
                <p className="bg-gradient-to-r from-brand-400 to-cyan-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
                  22°
                </p>
                <div className="mt-2 flex items-center justify-center gap-3 text-slate-400">
                  <Snowflake className="h-3.5 w-3.5 text-brand-400" />
                  <Wind className="h-3.5 w-3.5" />
                  <Droplets className="h-3.5 w-3.5" />
                  <Moon className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Boutons de contrôle */}
              <div className="mb-5 flex items-center justify-center gap-3">
                <span className="h-8 w-8 rounded-full bg-white shadow-sm ring-1 ring-ink-900/5" />
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-400 shadow-md shadow-brand-600/30">
                  <Snowflake className="h-4.5 w-4.5 text-white" />
                </span>
                <span className="h-8 w-8 rounded-full bg-white shadow-sm ring-1 ring-ink-900/5" />
              </div>

              {/* Grille de ventilation inférieure */}
              <div className="space-y-1.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-1 rounded-full bg-slate-300/70" />
                ))}
              </div>
            </div>
          </div>

          {/* Roulettes */}
          <div className="mx-8 flex justify-between">
            <span className="h-3 w-6 rounded-b-full bg-slate-300" />
            <span className="h-3 w-6 rounded-b-full bg-slate-300" />
          </div>

          {/* Ombre au sol */}
          <div className="mx-auto mt-2 h-3 w-4/5 rounded-full bg-ink-900/10 blur-md" />
        </div>
      </div>
    </div>
  );
}
