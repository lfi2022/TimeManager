import { Link, Route, Routes } from 'react-router';
import { HomePage } from '../pages/HomePage';
import { SchedulingPage } from '../pages/SchedulingPage';
import { WorkEntriesPage } from '../pages/WorkEntriesPage';
import { ClockPage } from '../pages/ClockPage';
import {
  AdminOrganizationPage,
  PlatformCompaniesPage,
} from '../pages/OrganizationPages';
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin/organization" element={<AdminOrganizationPage />} />
      <Route path="/platform/companies" element={<PlatformCompaniesPage />} />
      <Route path="/admin/scheduling" element={<SchedulingPage />} />
      <Route path="/work-entries" element={<WorkEntriesPage />} />
      <Route path="/clock" element={<ClockPage />} />
      <Route
        path="*"
        element={
          <main className="mx-auto max-w-xl px-6 py-24">
            <p className="eyebrow">TEMPOPOINT</p>
            <h1 className="mt-5 text-4xl font-semibold">Page introuvable</h1>
            <p className="mt-5 text-slate-600">
              Cette page n'est pas disponible.
            </p>
            <Link className="action mt-8 inline-flex" to="/">
              Retour a l'accueil
            </Link>
          </main>
        }
      />
    </Routes>
  );
}
