import React, { useState, useEffect } from 'react';
import { Card, Button } from '../components/Common';
import { PiggyBank, Search, Plus, ArrowUpCircle, ArrowDownCircle, History, X, Loader2 } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  writeBatch, 
  doc, 
  serverTimestamp, 
  getDoc,
  limit 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { ConfirmModal } from '../components/ConfirmModal';

export default function Savings() {
  const { profile, loading: authLoading } = useAuth();
  const [savings, setSavings] = useState([]);
  const [members, setMembers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [modalType, setModalType] = useState('deposit'); // 'deposit' or 'withdraw'
  const [error, setError] = useState(null);
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (authLoading || !profile?.orgId) return;

    let unsubscribeSavings = null;
    let unsubscribeMembers = null;

    try {
      // Listen to current balances
      const q = query(
        collection(db, 'organizations', profile.orgId, 'savings'),
        orderBy('balance', 'desc')
      );
      unsubscribeSavings = onSnapshot(q, (snapshot) => {
        const stats = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          balance: Number(doc.data().balance) || 0 
        }));
        setSavings(stats);
      }, (err) => {
        if (err.code !== 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, `organizations/${profile.orgId}/savings`);
          setError("Gagal memuat data saldo tabungan.");
        }
      });

      // Listen to organization members
      const qMembers = query(
        collection(db, 'users'),
        where('orgId', '==', profile.orgId)
      );
      unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          uid: doc.id,
          ...doc.data() 
        }));
        setMembers(users);
      }, (err) => {
        if (err.code !== 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, `users`);
          setError("Gagal memuat data anggota.");
        }
      });

    } catch (err) {
      console.error("Setup error in Savings:", err);
      setError("Terjadi kesalahan sistem saat inisialisasi.");
    }

    return () => {
      if (unsubscribeSavings) unsubscribeSavings();
      if (unsubscribeMembers) unsubscribeMembers();
    };
  }, [profile?.orgId, authLoading]);

  const handleTransaction = async (e) => {
    e.preventDefault();
    if (!profile?.orgId || !profile?.uid) return;
    
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const userId = formData.get('userId');
    const amount = Number(formData.get('amount'));
    const description = formData.get('description');

    if (amount <= 0 || !userId) {
      alert("Data tidak valid");
      setIsLoading(false);
      return;
    }

    try {
      const batch = writeBatch(db);
      const savingRef = doc(db, 'organizations', profile.orgId, 'savings', userId);
      const logRef = doc(collection(db, 'organizations', profile.orgId, 'savings_logs'));
      
      const snap = await getDoc(savingRef);
      const currentBalance = snap.exists() ? (Number(snap.data().balance) || 0) : 0;
      
      if (modalType === 'withdraw' && currentBalance < amount) {
        alert("Saldo tidak mencukupi!");
        setIsLoading(false);
        return;
      }

      const newBalance = modalType === 'deposit' 
        ? currentBalance + amount 
        : currentBalance - amount;

      const userName = members.find(m => (m.uid || m.id) === userId)?.displayName || 'Unknown';
      const actionTitle = modalType === 'deposit' ? 'Setoran Tabungan' : 'Penarikan Tabungan';

      // 1. Update/Set Balance State
      batch.set(savingRef, {
        userId,
        name: userName,
        balance: newBalance,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      // 2. Add Savings Audit Log (Specific for Savings page)
      batch.set(logRef, {
        userId,
        name: userName,
        type: modalType,
        amount,
        prevBalance: currentBalance,
        newBalance: newBalance,
        description,
        createdAt: serverTimestamp(),
        createdBy: profile.uid
      });

      // 3. Add Global Activity Log
      const globalLogRef = doc(collection(db, 'organizations', profile.orgId, 'activity_logs'));
      batch.set(globalLogRef, {
        actorId: profile.uid,
        actorName: profile.displayName,
        targetUserId: userId,
        targetUserName: userName,
        action: 'savings',
        txTitle: `${actionTitle}: ${description || 'Tanpa keterangan'}`,
        amount,
        orgId: profile.orgId,
        timestamp: serverTimestamp()
      });

      await batch.commit();
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `organizations/${profile.orgId}/savings batch`);
      alert("Gagal memproses transaksi: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Menyiapkan Brankas Tabungan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-[3rem] border border-slate-200">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mb-6">
          <X className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Terjadi Masalah</h2>
        <p className="text-slate-500 max-w-sm mb-6">{error}</p>
        <Button onClick={() => window.location.reload()} variant="brand" size="sm">Coba Lagi</Button>
      </div>
    );
  }

  if (!profile?.orgId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-[3rem] border border-slate-200">
        <PiggyBank className="w-16 h-16 text-slate-200 mb-6" />
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Akses Terbatas</h2>
        <p className="text-slate-500 max-w-sm mb-6">Anda harus bergabung ke organisasi untuk mengelola tabungan.</p>
        <Button href="/dashboard" variant="brand" size="sm">Kembali ke Dashboard</Button>
      </div>
    );
  }

  const totalBalance = savings.reduce((acc, s) => acc + (Number(s.balance) || 0), 0);
  const avgBalance = savings.length > 0 ? totalBalance / savings.length : 0;
  const maxBalance = savings.length > 0 ? Math.max(...savings.map(s => Number(s.balance) || 0)) : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-300 pb-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Tabungan Anggota</h1>
          <p className="text-slate-500 font-medium uppercase text-xs tracking-widest mt-1">
            Simpanan Mandiri • Kas {profile?.orgId?.replace('_', ' ')}
          </p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'treasurer') && (
          <Button size="sm" variant="brand" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Setor Baru
          </Button>
        )}
      </header>

      <div className="grid grid-cols-12 gap-4">
        <Card variant="dark" className="col-span-12 lg:col-span-5 relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-1">Total Tabungan</p>
            <p className="text-4xl font-black tracking-tight">{formatCurrency(totalBalance)}</p>
            <div className="mt-6 flex items-center text-[10px] text-emerald-400 font-black uppercase tracking-wider bg-white/5 py-2 px-3 rounded-xl border border-white/10 w-fit">
              <ArrowUpCircle className="w-3 h-3 mr-1.5" />
              Anggota Aktif: {savings.length}
            </div>
          </div>
          <PiggyBank className="absolute -right-6 -bottom-6 w-40 h-40 text-white/5 transform -rotate-12 group-hover:scale-110 group-hover:rotate-0 transition-all duration-500" />
        </Card>

        <div className="col-span-12 lg:col-span-7 grid grid-cols-2 gap-4">
          <Card className="flex flex-col justify-center bg-white">
            <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Rata-rata Saldo</h4>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(avgBalance)}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Per Anggota Aktif</p>
          </Card>

          <Card className="flex flex-col justify-center bg-white">
            <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Kas Terbesar</h4>
            <p className="text-2xl font-black text-emerald-600 tracking-tight">{formatCurrency(maxBalance)}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Saldo Tertinggi</p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card title="Daftar Saldo Per Anggota" className="col-span-12 lg:col-span-8 p-0 overflow-hidden">
          <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari nama anggota..." 
                className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
            <div className="flex gap-2">
               <span className="text-[8px] font-black tracking-widest uppercase bg-slate-200 text-slate-500 px-2 py-1 rounded-md">{savings.length} Terdata</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 min-h-[300px]">
            {savings.length > 0 ? savings.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-5 px-8 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs uppercase">
                    {s.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{s.name || 'Member'}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Update: {formatDate(s.lastUpdated)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-900 tracking-tight">{formatCurrency(s.balance)}</p>
                  </div>
                  {(profile?.role === 'admin' || profile?.role === 'treasurer') && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                      <Button variant="ghost" size="sm" onClick={() => { setModalType('deposit'); setIsModalOpen(true); }} className="p-2 border border-slate-100 rounded-xl hover:bg-emerald-50 hover:border-emerald-100">
                        <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setModalType('withdraw'); setIsModalOpen(true); }} className="p-2 border border-slate-100 rounded-xl hover:bg-rose-50 hover:border-rose-100">
                        <ArrowDownCircle className="w-5 h-5 text-rose-600" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="py-20 text-center">
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Belum Ada Saldo Tabungan</p>
              </div>
            )}
          </div>
        </Card>

        <Card title="Log Aktivitas" variant="accent" className="col-span-12 lg:col-span-4">
           <SavingsLogList orgId={profile?.orgId} />
        </Card>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="z-[110] bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative border border-slate-200"
            >
              <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight text-center uppercase tracking-tighter">
                {modalType === 'deposit' ? 'Setor Tabungan' : 'Tarik Tabungan'}
              </h2>
              
              <form onSubmit={handleTransaction} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Pilih Anggota</label>
                  <div className="relative">
                    <select name="userId" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-bold text-slate-700 appearance-none">
                      <option value="">-- Pilih Nama --</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.displayName || m.email}</option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ArrowDownCircle className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Nominal (IDR)</label>
                  <input name="amount" type="number" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-black text-xl text-slate-900" placeholder="0" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Keterangan</label>
                  <textarea name="description" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-medium text-slate-700" rows={2} placeholder="Opsional..." />
                </div>
                
                <div className="pt-6 flex gap-4">
                  <Button type="button" variant="ghost" className="flex-1 bg-slate-100 hover:bg-slate-200" onClick={() => setIsModalOpen(false)}>Batal</Button>
                  <Button type="submit" variant={modalType === 'deposit' ? 'brand' : 'outline'} isLoading={isLoading} className="flex-[2]">
                    {modalType === 'deposit' ? 'Konfirmasi Setor' : 'Konfirmasi Tarik'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        variant={modalType === 'withdraw' ? 'danger' : 'indigo'}
        confirmText={modalType === 'withdraw' ? 'Tarik Dana' : 'Simpan Dana'}
      />
    </div>
  );
}

function SavingsLogList({ orgId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'organizations', orgId, 'savings_logs'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        amount: Number(doc.data().amount) || 0
      })));
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, `organizations/${orgId}/savings_logs`);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orgId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 opacity-50">
        <Loader2 className="w-6 h-6 animate-spin text-white mb-2" />
        <p className="text-[8px] font-black uppercase tracking-widest text-white">Memuat Log...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {logs.length > 0 ? logs.map((log) => (
        <SavingLogItem 
          key={log.id}
          type={log.type} 
          name={log.name} 
          amount={log.amount} 
          date={formatDate(log.createdAt)} 
          isDark
        />
      )) : (
        <p className="text-center text-xs font-black text-white/40 uppercase py-10">Belum Ada Aktivitas</p>
      )}
      <Button variant="ghost" size="sm" className="w-full bg-white/10 hover:bg-white/20 text-white border-none py-4 rounded-2xl">
        <History className="w-4 h-4 mr-2" /> Riwayat Lengkap
      </Button>
    </div>
  );
}

function SavingLogItem({ type, name, amount, date, isDark }) {
  return (
    <div className="flex items-start gap-4">
      <div className={cn(
        "mt-1 w-2.5 h-2.5 rounded-full ring-4 shadow-sm",
        type === 'deposit' 
          ? "bg-emerald-400 ring-emerald-400/20" 
          : "bg-rose-400 ring-rose-400/20"
      )} />
      <div className="flex-1">
        <p className={cn(
          "text-sm font-bold tracking-tight",
          isDark ? "text-white" : "text-slate-900"
        )}>
          <span className="font-medium mr-1 opacity-70">{name}</span>
          <span className={cn(
            "font-black mx-1 uppercase text-[10px] tracking-widest",
            type === 'deposit' ? "text-emerald-400" : "text-rose-400"
          )}>{type === 'deposit' ? 'setor' : 'tarik'}</span>
          <br />
          <span className="text-lg font-black">{formatCurrency(amount)}</span>
        </p>
        <p className={cn(
          "text-[10px] font-black uppercase tracking-widest mt-1",
          isDark ? "text-white/40" : "text-slate-400"
        )}>{date}</p>
      </div>
    </div>
  );
}
