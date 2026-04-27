import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/Common';
import { 
  History, 
  UserPlus, 
  UserMinus, 
  ShieldCheck, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft,
  Filter,
  Calendar,
  Clock,
  MessageCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { cn, formatDate } from '../lib/utils';
import { motion } from 'motion/react';

export default function ActivityLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    if (!profile?.orgId) return;

    const q = query(
      collection(db, 'organizations', profile.orgId, 'activity_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${profile.orgId}/activity_logs`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.orgId]);

  const filteredLogs = useMemo(() => {
    if (activeFilter === 'all') return logs;
    if (activeFilter === 'roles') return logs.filter(l => l.action === 'role_change' || l.action === 'promote');
    if (activeFilter === 'membership') return logs.filter(l => l.action === 'remove' || l.action === 'join');
    if (activeFilter === 'finance') return logs.filter(l => l.action === 'transaction' || l.action === 'savings');
    return logs;
  }, [logs, activeFilter]);

  const getActionIcon = (action) => {
    switch (action) {
      case 'role_change':
      case 'promote':
        return <ShieldCheck className="w-4 h-4 text-indigo-600" />;
      case 'remove':
        return <UserMinus className="w-4 h-4 text-rose-600" />;
      case 'join':
        return <UserPlus className="w-4 h-4 text-emerald-600" />;
      case 'transaction':
        return <CreditCard className="w-4 h-4 text-amber-600" />;
      case 'reminder_sent':
        return <MessageCircle className="w-4 h-4 text-sky-600" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  const getActionStyles = (action) => {
    switch (action) {
      case 'role_change': return "bg-indigo-50 border-indigo-100";
      case 'remove': return "bg-rose-50 border-rose-100";
      case 'join': return "bg-emerald-50 border-emerald-100";
      case 'transaction': return "bg-amber-50 border-amber-100";
      case 'reminder_sent': return "bg-sky-50 border-sky-100";
      default: return "bg-slate-50 border-slate-100";
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="p-12 text-center bg-white rounded-[3rem] border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 leading-tight">Akses Terbatas</h2>
        <p className="mt-2 text-slate-500 font-medium max-w-xs mx-auto">Hanya Kepala Sekolah (Tingkat Pimpinan) yang dapat melihat Audit Logs sistem.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-10">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Log Aktivitas Sekolah</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            Pemantauan Digital Real-time
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200 overflow-x-auto whitespace-nowrap">
          <button 
            onClick={() => setActiveFilter('all')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeFilter === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Semua
          </button>
          <button 
            onClick={() => setActiveFilter('roles')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeFilter === 'roles' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Peran
          </button>
          <button 
            onClick={() => setActiveFilter('membership')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeFilter === 'membership' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Keanggotaan
          </button>
          <button 
            onClick={() => setActiveFilter('finance')}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeFilter === 'finance' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Keuangan
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {loading ? (
          <div className="flex flex-col gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-[2rem] border border-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-20 text-center bg-white rounded-[4rem] border border-slate-200 border-dashed">
            <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Belum ada aktivitas tercatat</p>
          </div>
        ) : (
          <div className="space-y-6 relative before:absolute before:left-8 md:before:left-12 before:top-4 before:bottom-4 before:w-px before:bg-slate-100">
            {filteredLogs.map((log, index) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                key={log.id} 
                className="relative flex gap-6 md:gap-10 group"
              >
                {/* Timeline Icon */}
                <div className={cn(
                  "w-16 h-16 md:w-24 md:h-24 shrink-0 rounded-3xl border-2 border-white shadow-xl flex items-center justify-center z-10 transition-transform group-hover:scale-110",
                  getActionStyles(log.action)
                )}>
                  {getActionIcon(log.action)}
                </div>

                {/* Content Card */}
                <Card className="flex-1 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 group-hover:shadow-indigo-100/50">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{log.actorName}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{(log?.action || 'Aktivitas').replace('_', ' ')}</span>
                    </div>
                    
                    <h4 className="text-sm md:text-base font-black text-slate-900 leading-snug">
                      {log.action === 'role_change' && (
                        <span>Mengubah peran <span className="text-indigo-600">{log.targetUserName}</span> dari <span className="uppercase">{log.oldRole}</span> menjadi <span className="uppercase text-emerald-600">{log.newRole}</span></span>
                      )}
                      {log.action === 'remove' && (
                        <span>Mencabut akses dan mengeluarkan <span className="text-rose-600">{log.targetUserName}</span> dari sistem sekolah</span>
                      )}
                      {log.action === 'join' && (
                        <span>Berhasil bergabung dalam sistem sekolah sebagai pengguna terverifikasi</span>
                      )}
                      {log.action === 'transaction' && (
                        <span>Mencatat transaksi keuangan baru: <span className="text-emerald-600">{log.txTitle}</span></span>
                      )}
                      {log.action === 'reminder_sent' && (
                        <span>Mengirimkan pengingat WhatsApp kepada <span className="text-sky-600">{log.targetUserName}</span> untuk iuran {log.month} {log.year}</span>
                      )}
                      {!['role_change', 'remove', 'join', 'transaction', 'reminder_sent'].includes(log.action) && (
                        <span>Melakukan aktivitas sistem: {log.action}</span>
                      )}
                    </h4>

                    <div className="flex items-center gap-4 pt-2">
                       <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                         <Calendar className="w-3 h-3" />
                         {formatDate(log.timestamp)}
                       </div>
                       <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                         <Clock className="w-3 h-3" />
                         {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                       </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex -space-x-3">
                    <img 
                      src={`https://ui-avatars.com/api/?name=${log.actorName}&background=4f46e5&color=fff`} 
                      alt="" 
                      className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm"
                      title={`Actor: ${log.actorName}`}
                    />
                    {log.targetUserName && (
                      <img 
                        src={`https://ui-avatars.com/api/?name=${log.targetUserName}&background=f1f5f9&color=64748b`} 
                        alt="" 
                        className="w-10 h-10 rounded-2xl border-2 border-white shadow-sm"
                        title={`Target: ${log.targetUserName}`}
                      />
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
