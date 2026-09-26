import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { HomePage } from '../pages/HomePage';
import { SchedulingPage } from '../pages/SchedulingPage';
import { WorkEntriesPage } from '../pages/WorkEntriesPage';
import { ClockPage } from '../pages/ClockPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AuditPage, PeriodLocksPage, ReportsPage } from '../pages/AuditReportsPages';
import { AdminOrganizationPage, PlatformCompaniesPage, PlatformLoginPage } from '../pages/OrganizationPages';

type Me = { firstName: string; role: 'ADMIN' | 'MANAGER' | 'WORKER'; forcePasswordChange: boolean };
const meQuery = () => api<{ data: { user: Me } }>('/api/me').then((result) => result.data.user);
const platformQuery = () => api<{ data: { platformUser: { email: string } } }>('/api/platform/me').then((result) => result.data.platformUser);

function UserShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const me = useQuery({ queryKey: ['me'], queryFn: meQuery, retry: false });
  if (me.isPending) return <p className="page-state">Chargement de votre espace…</p>;
  if (me.isError) return <Navigate to="/" replace />;
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }); queryClient.clear(); navigate('/'); };
  if (me.data.forcePasswordChange) return <ForcedPasswordChange />;
  const isAdmin = me.data.role === 'ADMIN';
  return <div className="app-shell"><header className="app-header"><Link to="/dashboard" className="brand"><img src="/brand/symbol.svg" alt="" /><span><b>Tempo</b>Point</span></Link><button type="button" className="mobile-menu-toggle" aria-controls="user-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Menu</button><nav id="user-navigation" className={menuOpen ? "is-open" : ""} onClick={() => setMenuOpen(false)}><Link to="/dashboard">{me.data.role === 'WORKER' ? 'Ma journée' : 'Pilotage équipe'}</Link>{me.data.role === 'WORKER' ? <><Link to="/clock">Pointage</Link><Link to="/work-entries">Mes prestations</Link></> : <><Link to="/work-entries">Prestations équipe</Link><Link to="/reports">Rapports</Link></>}{isAdmin && <><Link to="/admin/organization">Équipe</Link><Link to="/admin/scheduling">Organisation</Link><Link to="/admin/period-locks">Clôtures</Link><Link to="/admin/audit">Audit</Link></>}</nav><div className="user-menu"><span>{me.data.firstName} · {me.data.role}</span><button onClick={() => void logout()}>Déconnexion</button></div></header><main>{children}</main></div>;
}
function ForcedPasswordChange() { const navigate=useNavigate(); const client=useQueryClient(); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const submit=async(e:React.FormEvent)=>{e.preventDefault();try{await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({password})});client.clear();navigate('/')}catch(err){setError(err instanceof Error?err.message:'Modification impossible.')}}; return <main className="auth-page"><section className="auth-card"><h1>Choisissez un nouveau mot de passe</h1><p>Votre administrateur ou le support impose cette modification.</p><form className="form-grid" onSubmit={submit}><label>Nouveau mot de passe<input type="password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p className="form-error">{error}</p>}<button className="action">Mettre a jour</button></form></section></main>; }

function PlatformShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const me = useQuery({ queryKey: ['platform-me'], queryFn: platformQuery, retry: false });
  if (me.isPending) return <p className="page-state">Chargement de la plateforme…</p>;
  if (me.isError) return <Navigate to="/platform" replace />;
  const logout = async () => { await api('/api/platform-auth/logout', { method: 'POST' }); queryClient.clear(); navigate('/platform'); };
  return <div className="app-shell"><header className="app-header"><Link to="/platform/companies" className="brand"><img src="/brand/symbol.svg" alt="" /><span><b>Tempo</b>Point <small>PLATEFORME</small></span></Link><button type="button" className="mobile-menu-toggle" aria-controls="platform-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Menu</button><nav id="platform-navigation" className={menuOpen ? "is-open" : ""} onClick={() => setMenuOpen(false)}><Link to="/platform/companies">Entreprises & abonnements</Link></nav><div className="user-menu"><span>{me.data.email}</span><button onClick={() => void logout()}>Déconnexion</button></div></header><main>{children}</main></div>;
}
export function App() { return <Routes><Route path="/" element={<HomePage />} /><Route path="/platform" element={<PlatformLoginPage />} /><Route path="/platform/companies" element={<PlatformShell><PlatformCompaniesPage /></PlatformShell>} /><Route path="/*" element={<UserShell><Routes><Route path="dashboard" element={<DashboardPage />} /><Route path="admin/organization" element={<AdminOrganizationPage />} /><Route path="admin/scheduling" element={<SchedulingPage />} /><Route path="admin/audit" element={<AuditPage />} /><Route path="admin/period-locks" element={<PeriodLocksPage />} /><Route path="work-entries" element={<WorkEntriesPage />} /><Route path="clock" element={<ClockPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></UserShell>} /></Routes>; }
