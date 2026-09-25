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

type Me = { firstName: string; role: 'ADMIN' | 'MANAGER' | 'WORKER' };
const meQuery = () => api<{ data: { user: Me } }>('/api/me').then((result) => result.data.user);
const platformQuery = () => api<{ data: { platformUser: { email: string } } }>('/api/platform/me').then((result) => result.data.platformUser);

function UserShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: meQuery, retry: false });
  if (me.isPending) return <p className="page-state">Chargement de votre espace…</p>;
  if (me.isError) return <Navigate to="/" replace />;
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }); queryClient.clear(); navigate('/'); };
  const isAdmin = me.data.role === 'ADMIN';
  return <div className="app-shell"><header className="app-header"><Link to="/dashboard" className="brand"><img src="/brand/symbol.svg" alt="" /><span><b>Tempo</b>Point</span></Link><nav><Link to="/dashboard">Tableau de bord</Link><Link to="/clock">Pointage</Link><Link to="/work-entries">Prestations</Link><Link to="/reports">Rapports</Link>{isAdmin && <><Link to="/admin/organization">Équipe</Link><Link to="/admin/scheduling">Organisation</Link><Link to="/admin/period-locks">Clôtures</Link><Link to="/admin/audit">Audit</Link></>}</nav><div className="user-menu"><span>{me.data.firstName} · {me.data.role}</span><button onClick={() => void logout()}>Déconnexion</button></div></header><main>{children}</main></div>;
}
function PlatformShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate(); const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['platform-me'], queryFn: platformQuery, retry: false });
  if (me.isPending) return <p className="page-state">Chargement de la plateforme…</p>;
  if (me.isError) return <Navigate to="/platform" replace />;
  const logout = async () => { await api('/api/platform-auth/logout', { method: 'POST' }); queryClient.clear(); navigate('/platform'); };
  return <div className="app-shell"><header className="app-header"><Link to="/platform/companies" className="brand"><img src="/brand/symbol.svg" alt="" /><span><b>Tempo</b>Point <small>PLATEFORME</small></span></Link><nav><Link to="/platform/companies">Entreprises & abonnements</Link></nav><div className="user-menu"><span>{me.data.email}</span><button onClick={() => void logout()}>Déconnexion</button></div></header><main>{children}</main></div>;
}
export function App() { return <Routes><Route path="/" element={<HomePage />} /><Route path="/platform" element={<PlatformLoginPage />} /><Route path="/platform/companies" element={<PlatformShell><PlatformCompaniesPage /></PlatformShell>} /><Route path="/*" element={<UserShell><Routes><Route path="dashboard" element={<DashboardPage />} /><Route path="admin/organization" element={<AdminOrganizationPage />} /><Route path="admin/scheduling" element={<SchedulingPage />} /><Route path="admin/audit" element={<AuditPage />} /><Route path="admin/period-locks" element={<PeriodLocksPage />} /><Route path="work-entries" element={<WorkEntriesPage />} /><Route path="clock" element={<ClockPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></UserShell>} /></Routes>; }
