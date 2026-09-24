import { Link, Route, Routes } from 'react-router';
import { HomePage } from '../pages/HomePage';
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="*"
        element={
          <main className="mx-auto max-w-xl px-6 py-24">
            <p className="eyebrow">LFINFO HOURS</p>
            <h1 className="mt-5 text-4xl font-semibold">Page introuvable</h1>
            <p className="mt-5 text-slate-600">
              Cette page n’est pas disponible.
            </p>
            <Link className="action mt-8 inline-flex" to="/">
              Retour à l’accueil
            </Link>
          </main>
        }
      />
    </Routes>
  );
}
