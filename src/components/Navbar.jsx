import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  PiggyBank, 
  CreditCard,
  History,
  Settings, 
  LogOut,
  Bell,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './Common';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function Navbar() {
  const { profile, logOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Kas Kelas', path: '/transactions', icon: Receipt },
    { name: 'Tabungan', path: '/savings', icon: PiggyBank },
    ...(profile?.role === 'admin' || profile?.role === 'treasurer' ? [
      { name: 'Manajemen Dana', path: '/operational', icon: CreditCard },
    ] : []),
    ...(profile?.role === 'admin' || profile?.role === 'treasurer' || profile?.role === 'staff' || profile?.role === 'class_treasurer' ? [
      { name: 'Data Siswa & Kelas', path: '/members', icon: Users },
    ] : []),
    ...(profile?.role === 'admin' || profile?.role === 'treasurer' || profile?.role === 'staff' ? [
      { name: 'Log Aktivitas', path: '/activity', icon: History }
    ] : []),
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12">
                <Receipt className="text-white w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black tracking-tighter text-slate-900 leading-none">NgitungKas Edu</span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">Sistem Tabungan Sekolah</span>
              </div>
            </Link>
            
            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all",
                    location.pathname === item.path 
                      ? "text-slate-900 bg-slate-100" 
                      : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center space-x-2">
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <Button variant="ghost" size="sm" className="relative p-2.5 bg-slate-50 rounded-2xl border border-slate-100">
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-white" />
            </Button>
            
            <div className="flex items-center space-x-4 border-l border-slate-200 pl-6">
              <div className="text-right">
                <p className="text-xs font-black text-slate-900 tracking-tight">{profile?.displayName}</p>
                <div className="flex items-center justify-end gap-1.5 mt-1">
                  <p className="text-[9px] text-indigo-600 font-black uppercase tracking-widest leading-none bg-indigo-50 px-1.5 py-0.5 rounded-full">
                    {profile?.role === 'admin' ? 'Kepala Sekolah' : 
                     profile?.role === 'treasurer' ? 'Bendahara Sekolah' : 
                     profile?.role === 'staff' ? `TU Tingkat ${profile?.assignedGrade || ''}` :
                     profile?.role === 'class_treasurer' ? `Bendahara Kelas ${profile?.className || ''}` : 'Siswa'}
                  </p>
                  {profile?.orgId && (
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none border border-slate-200 px-1.5 py-0.5 rounded-full">
                      ID: {profile.orgId}
                    </p>
                  )}
                </div>
              </div>
              <img 
                src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
                alt="Profile" 
                className="w-10 h-10 rounded-2xl object-cover ring-2 ring-slate-100"
              />
              <Button variant="ghost" size="sm" className="p-2.5 hover:bg-rose-50 hover:text-rose-600 rounded-2xl" onClick={logOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center md:hidden">
            <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-gray-100 overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-xl text-base font-medium",
                    location.pathname === item.path 
                      ? "text-gray-900 bg-gray-50" 
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </div>
                </Link>
              ))}
              <div className="pt-4 pb-2 border-t border-gray-100">
                <div className="flex items-center px-3 space-x-3 mb-3">
                  <img src={profile?.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />
                  <div>
                    <p className="text-sm font-semibold">{profile?.displayName}</p>
                    <p className="text-xs text-gray-500">{profile?.role}</p>
                  </div>
                </div>
                <Button variant="danger" size="sm" className="w-full justify-start" onClick={logOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Keluar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
