import { useQuery } from '@tanstack/react-query';
type Entry = {
  id: string;
  date: string;
  workedMinutes: number;
  expectedMinutes: number;
  differenceMinutes: number;
  status: string;
  note: string | null;
  rejectionReason: string | null;
  user?: { firstName: string; lastName: string };
};
async function entries() {
  const r = await fetch('/api/work-entries', { credentials: 'include' });
  if (!r.ok) throw new Error();
  return ((await r.json()) as { data: { entries: Entry[] } }).data.entries;
}
export function WorkEntriesPage() {
  const q = useQuery({ queryKey: ['work-entries'], queryFn: entries });
  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:px-10">
      <p className="eyebrow">TEMPOPOINT · PRESTATIONS</p>
      <h1 className="mt-3 text-3xl font-semibold">Mes prestations</h1>
      <p className="mt-3 text-slate-600">
        Saisissez vos heures, suivez leur statut et consultez les éventuels
        motifs de rejet.
      </p>
      {q.isError ? (
        <p className="mt-6 text-sm text-slate-600">
          Connectez-vous pour consulter vos prestations.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {q.data?.map((x) => (
            <li
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              key={x.id}
            >
              <div className="flex justify-between gap-3">
                <strong>{new Date(x.date).toLocaleDateString('fr-BE')}</strong>
                <span className="text-sm text-emerald-800">{x.status}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {x.workedMinutes} min prestées · {x.expectedMinutes} min prévues
                · écart {x.differenceMinutes} min
              </p>
              {x.user && (
                <p className="mt-1 text-sm text-slate-500">
                  {x.user.firstName} {x.user.lastName}
                </p>
              )}
              {x.rejectionReason && (
                <p className="mt-2 text-sm text-red-700">
                  Motif : {x.rejectionReason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
