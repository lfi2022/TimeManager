import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../lib/api';

export function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 1,
  });

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7 sm:px-10">
        <a
          href="/"
          aria-label="TempoPoint, accueil"
          className="flex items-center gap-3 font-semibold tracking-tight"
        >
          <span aria-hidden="true" className="brand-mark">
            T
          </span>
          <span>
            Tempo<span className="font-normal text-slate-500">Point</span>
          </span>
        </a>
        <span className="rounded-full border border-emerald-900/15 px-3 py-1 text-xs font-medium text-emerald-900">
          En préparation
        </span>
      </header>
      <main className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:px-10 sm:py-24 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <section>
          <p className="eyebrow">LE TEMPS DE VOS ÉQUIPES, SIMPLEMENT</p>
          <h1 className="mt-6 max-w-2xl text-5xl leading-[1.1] font-semibold tracking-tight sm:text-6xl">
            Moins de papier.
            <br />
            <span className="text-emerald-800">Plus de clarté.</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-relaxed text-slate-600">
            Les heures de vos équipes, sans les tableaux Excel.
          </p>
          <p className="mt-4 max-w-lg leading-relaxed text-slate-600">
            Un espace pour le terrain et le bureau. TempoPoint se prépare à
            simplifier le suivi de vos journées.
          </p>
          <div className="mt-10 flex items-center gap-3 text-sm text-slate-600">
            <span aria-hidden="true" className="h-px w-10 bg-emerald-800" />
            Pensé pour les PME et leurs équipes de terrain.
          </div>
        </section>
        <aside
          className="rounded-3xl bg-white p-8 shadow-[0_20px_80px_-35px_rgba(18,61,53,0.25)] ring-1 ring-emerald-900/10 sm:p-10"
          aria-labelledby="welcome-title"
        >
          <div aria-hidden="true" className="clock-face">
            <span />
          </div>
          <p className="eyebrow mt-8">BIENVENUE</p>
          <h2 id="welcome-title" className="mt-3 text-2xl font-semibold">
            Une journée bien suivie commence ici.
          </h2>
          <p className="mt-4 leading-relaxed text-slate-600">
            L’application est en cours de construction. Les fonctionnalités
            seront disponibles progressivement.
          </p>
          <div className="mt-8 border-t border-slate-100 pt-5">
            <p role="status" className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={
                  'h-2 w-2 rounded-full ' +
                  (health.isSuccess ? 'bg-emerald-600' : 'bg-amber-500')
                }
              />
              {health.isPending
                ? 'Connexion au service…'
                : health.isError
                  ? 'Service momentanément indisponible'
                  : 'Service disponible'}
            </p>
          </div>
        </aside>
      </main>
      <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-slate-500 sm:px-10">
        TempoPoint · Une solution LFINFO
      </footer>
    </div>
  );
}
