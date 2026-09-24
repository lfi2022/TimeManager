import { useQuery } from '@tanstack/react-query';

type Company = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  timezone: string;
  locale: string;
};
type Team = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  members: {
    id: string;
    isManager: boolean;
    user: { firstName: string; lastName: string; role: string };
  }[];
};
type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
};
async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Accès indisponible.');
  return response.json() as Promise<T>;
}
function State({ error }: { error: unknown }) {
  return (
    <p className="mt-4 text-sm text-slate-600">
      {error
        ? 'Connectez-vous avec un compte autorisé pour afficher ces données.'
        : 'Chargement…'}
    </p>
  );
}
export function AdminOrganizationPage() {
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api<{ data: { users: User[] } }>('/api/admin/users'),
  });
  const teams = useQuery({
    queryKey: ['admin-teams'],
    queryFn: () => api<{ data: { teams: Team[] } }>('/api/admin/teams'),
  });
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-10">
      <p className="eyebrow">TEMPOPOINT · ADMINISTRATION</p>
      <h1 className="mt-3 text-3xl font-semibold">Utilisateurs et équipes</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Gérez les membres de votre entreprise et leurs équipes.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">Utilisateurs</h2>
          {users.isPending || users.isError ? (
            <State error={users.error} />
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {users.data.data.users.map((user) => (
                <li
                  className="flex items-center justify-between gap-3 py-3"
                  key={user.id}
                >
                  <span>
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    <small className="block text-slate-500">{user.email}</small>
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                    {user.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-semibold">Équipes</h2>
          {teams.isPending || teams.isError ? (
            <State error={teams.error} />
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {teams.data.data.teams.map((team) => (
                <li className="py-3" key={team.id}>
                  <strong>{team.name}</strong>
                  <small className="block text-slate-500">
                    {team.members.length} membre(s) ·{' '}
                    {team.active ? 'Active' : 'Inactive'}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
export function PlatformCompaniesPage() {
  const companies = useQuery({
    queryKey: ['platform-companies'],
    queryFn: () =>
      api<{ data: { companies: Company[] } }>('/api/platform/companies'),
  });
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-10">
      <p className="eyebrow">TEMPOPOINT · PLATEFORME</p>
      <h1 className="mt-3 text-3xl font-semibold">Entreprises</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Suivez les entreprises clientes et leur état d’accès.
      </p>
      <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 px-5 py-3 text-sm font-medium text-slate-500">
          <span>Entreprise</span>
          <span>État</span>
        </div>
        {companies.isPending || companies.isError ? (
          <State error={companies.error} />
        ) : (
          <ul>
            {companies.data.data.companies.map((company) => (
              <li
                className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 px-5 py-4 last:border-0"
                key={company.id}
              >
                <span>
                  <strong>{company.name}</strong>
                  <small className="block text-slate-500">
                    {company.slug} · {company.timezone}
                  </small>
                </span>
                <span
                  className={
                    'self-center rounded-full px-2 py-1 text-xs ' +
                    (company.active
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-slate-100 text-slate-600')
                  }
                >
                  {company.active ? 'Active' : 'Désactivée'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
