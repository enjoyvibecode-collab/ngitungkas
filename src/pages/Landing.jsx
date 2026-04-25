import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../components/Common';
import { useAuth } from '../hooks/useAuth';
import { Receipt, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { motion } from 'motion/react';

export default function Landing() {
  const { user, signIn, loading } = useAuth();

  const features = [
    { 
      title: 'Multi-User & Role', 
      desc: 'Kelola kas bersama admin, bendahara, dan anggota dengan hak akses terproteksi.',
      icon: ShieldCheck
    },
    { 
      title: 'Pencatatan Real-time', 
      desc: 'Catat setiap pemasukan dan pengeluaran secara transparan dan instan.',
      icon: Receipt
    },
    { 
      title: 'Laporan Visual', 
      desc: 'Pantau kesehatan keuangan organisasi melalui dashboard grafik yang intuitif.',
      icon: TrendingUp
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 selection:bg-slate-900 selection:text-white text-center">
      <div className="max-w-5xl w-full space-y-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Transparansi Digital V2.0</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 leading-[0.9]">
            Ngitung KAS <br/>
            <span className="text-slate-300">Tanpa Ribet.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
            Sistem akuntansi ledger-based untuk organisasi modern. <br className="hidden md:block"/>
            Pantau saldo, iuran, dan tabungan dengan satu klik.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {user ? (
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" variant="brand" className="w-full shadow-2xl shadow-indigo-200">
                Buka Dashboard
              </Button>
            </Link>
          ) : (
            <Button size="lg" variant="brand" onClick={signIn} isLoading={loading} className="w-full sm:w-auto shadow-2xl shadow-indigo-200">
              Mulai Sekarang
            </Button>
          )}
          <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white">
            Dokumentasi
          </Button>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4 pt-12">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            >
              <Card className="text-left h-full group hover:bg-slate-900 hover:text-white transition-all duration-500 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">
                    <f.icon className="w-6 h-6 text-slate-900 group-hover:text-white" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-2 group-hover:text-white tracking-tight">{f.title}</h3>
                  <p className="text-sm text-slate-500 group-hover:text-slate-400 leading-relaxed font-medium">{f.desc}</p>
                </div>
                <div className="mt-8 text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover:text-white/20">
                  Core Module
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        <footer className="pt-20 pb-10">
          <div className="flex flex-col items-center gap-4">
             <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Privacy</span>
                <span>Terms</span>
                <span>Audit Log</span>
             </div>
             <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">&copy; 2026 Ngitung KAS Platform. Powered by LedgerCoreX.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
