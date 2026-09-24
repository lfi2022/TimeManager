import { useQuery, useQueryClient } from '@tanstack/react-query';
async function request(path: string, method = 'GET') {
  const csrf = await fetch('/api/auth/csrf').then((r) => r.json());
  const r = await fetch(path, {
    method,
    credentials: 'include',
    headers: method === 'GET' ? {} : { 'x-csrf-token': csrf.data.csrfToken },
  });
  if (!r.ok) throw new Error();
  return r.json();
}
export function ClockPage() {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ['clock'],
    queryFn: () => request('/api/clock/status'),
  });
  const active = q.data?.data.session;
  const action = async () => {
    await request(active ? '/api/clock/stop' : '/api/clock/start', 'POST');
    await client.invalidateQueries({ queryKey: ['clock'] });
  };
  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <p className="eyebrow">TEMPOPOINT · POINTAGE</p>
      <h1 className="mt-3 text-3xl font-semibold">
        {active ? 'Pointage en cours' : 'Prêt à commencer'}
      </h1>
      <p className="mt-4 text-slate-600">
        {active
          ? 'Terminez votre prestation lorsque votre journée est finie.'
          : 'Démarrez votre pointage en un geste.'}
      </p>
      <button className="action mt-8 w-full" onClick={() => void action()}>
        {active ? 'Terminer' : 'Débuter'}
      </button>
    </main>
  );
}
