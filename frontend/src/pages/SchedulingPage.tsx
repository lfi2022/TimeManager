import { useQuery } from '@tanstack/react-query';
async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'include' });
  if (!r.ok) throw new Error('Accès requis');
  return r.json() as Promise<T>;
}
type Worksite = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
};
type Schedule = {
  id: string;
  name: string;
  weeklyMinutes: number | null;
  active: boolean;
  days: { id: string; dayOfWeek: number; expectedMinutes: number }[];
};
export function SchedulingPage() {
  const worksites = useQuery({
    queryKey: ['worksites'],
    queryFn: () =>
      get<{ data: { worksites: Worksite[] } }>('/api/admin/worksites'),
  });
  const schedules = useQuery({
    queryKey: ['schedules'],
    queryFn: () =>
      get<{ data: { schedules: Schedule[] } }>('/api/admin/schedules'),
  });
  const empty = worksites.isError || schedules.isError;
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-10">
      <p className="eyebrow">TEMPOPOINT · ADMINISTRATION</p>
      <h1 className="mt-3 text-3xl font-semibold">Chantiers et horaires</h1>
      <p className="mt-3 text-slate-600">
        Définissez les lieux de travail et les minutes attendues de votre
        entreprise.
      </p>
      {empty ? (
        <p className="mt-6 text-sm text-slate-600">
          Connectez-vous avec un compte administrateur pour consulter ces
          données.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold">Chantiers</h2>
            {worksites.isPending ? (
              <p className="mt-4 text-sm text-slate-500">Chargement…</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {worksites.data?.data.worksites.map((x) => (
                  <li key={x.id} className="flex justify-between py-3">
                    <span>
                      <strong>{x.name}</strong>
                      <small className="block text-slate-500">
                        {x.code ?? 'Sans code'}
                      </small>
                    </span>
                    <span className="text-sm text-slate-500">
                      {x.active ? 'Actif' : 'Archivé'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-semibold">Horaires</h2>
            {schedules.isPending ? (
              <p className="mt-4 text-sm text-slate-500">Chargement…</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {schedules.data?.data.schedules.map((x) => (
                  <li key={x.id} className="py-3">
                    <strong>{x.name}</strong>
                    <small className="block text-slate-500">
                      {x.weeklyMinutes ?? 0} min/semaine · {x.days.length}{' '}
                      jour(s)
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
