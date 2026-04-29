import React from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useLocation
} from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Savings from './pages/Savings';
import Members from './pages/Members';
import ActivityLogs from './pages/ActivityLogs';
import PublicLookup from './pages/PublicLookup';
import { Navbar } from './components/Navbar';

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPublicRoute = location.pathname === '/' || location.pathname === '/cek-tabungan';

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative">
          <div className="w-16 h-16 border-8 border-slate-200 border-t-indigo-600 rounded-[2rem] animate-spin mb-6" />
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-2 h-2 bg-slate-900 rounded-full animate-pulse" />
          </div>
        </div>
        <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Syncing Database</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-900 selection:text-white">
      {!user || isPublicRoute ? (
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/cek-tabungan" element={<PublicLookup />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      ) : (
        <>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:ml-0 transition-all duration-300">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/savings" element={<Savings />} />
              <Route path="/members" element={<Members />} />
              <Route path="/activity" element={<ActivityLogs />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </main>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
