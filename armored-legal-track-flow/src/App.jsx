import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProcessList from './pages/ProcessList.jsx';
import ProcessDetail from './pages/ProcessDetail';
import CalendarView from './pages/CalendarView';
import CommercialManagement from './pages/CommercialManagement';
import ClientDetail from './pages/ClientDetail';
import Referrals from './pages/Referrals';
import TreasuryModule from './pages/TreasuryModule';
import ContractTemplates from './pages/ContractTemplates';
import ContractEditor from './pages/ContractEditor';
import GeneratedContracts from './pages/GeneratedContracts';
import MetricsDashboard from './pages/MetricsDashboard';
import BillingResolutions from './pages/BillingResolutions';
import FinancingModule from './pages/FinancingModule';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminStatesPanel from './pages/AdminStatesPanel';
import ReportesControl from './pages/ReportesControl';
import DirectorioEntidades from './pages/DirectorioEntidades';
import CommissionsPanel from './pages/CommissionsPanel';
import ReferralRequest from './pages/ReferralRequest';
import ClientActivityExpanded from './pages/ClientActivityExpanded';
import ClientResumenPage from './pages/ClientResumenPage';
import ManualFunciones from './pages/ManualFunciones';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/processes" element={<ProcessList />} />
          <Route path="/process/:id" element={<ProcessDetail />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/commercial" element={<CommercialManagement />} />
          <Route path="/client/:id" element={<ClientDetail />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/treasury" element={<TreasuryModule />} />
          <Route path="/financing" element={<FinancingModule />} />
          <Route path="/contracts" element={<GeneratedContracts />} />
          <Route path="/contracts/templates" element={<ContractTemplates />} />
          <Route path="/contracts/new" element={<ContractEditor />} />
          <Route path="/metrics" element={<MetricsDashboard />} />
          <Route path="/billing-resolutions" element={<BillingResolutions />} />
          <Route path="/admin/states" element={<AdminStatesPanel />} />
          <Route path="/reportes" element={<ReportesControl />} />
          <Route path="/directorio-entidades" element={<DirectorioEntidades />} />
          <Route path="/commissions" element={<CommissionsPanel />} />
          <Route path="/manual" element={<ManualFunciones />} />
        </Route>
      </Route>
      <Route path="/referral" element={<ReferralRequest />} />
      <Route path="/client/:id/actividad" element={<ClientActivityExpanded />} />
      <Route path="/client/:id/resumen" element={<ClientResumenPage />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>

          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App