import { useQuery } from '@tanstack/react-query';
async function dashboard() {
  const r = await fetch('/api/dashboard', { credentials: 'include' });
  if (!r.ok) throw new Error();
  return r.json() as Promise<{
    data: {
      totalMinutes: number;
      pending: number;
      missing: number;
      anomalies: number;
      balanceMinutes: number;
    };
  }>;
}
export function DashboardPage() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: dashboard });
  const d = q.data?.data;
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-10">
      <p className="eyebrow">TEMPOPOINT · SUPERVISION</p>
      <h1 className="mt-3 text-3xl font-semibold">Équipe aujourd’hui</h1>
      {d ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Minutes', d.totalMinutes],
            ['À valider', d.pending],
            ['Anomalies', d.anomalies],
            ['Pot', d.balanceMinutes],
          ].map(([l, v]) => (
            <section
              key={String(l)}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <p className="text-sm text-slate-500">{l}</p>
              <strong className="mt-2 block text-3xl">{v}</strong>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-slate-600">
          Connectez-vous pour afficher le tableau de bord.
        </p>
      )}
    </main>
  );
}
