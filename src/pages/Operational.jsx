import React, { useState, useEffect } from 'react';
import { Card, Button } from '../components/Common';
import { 
  Users, 
  ArrowRight, 
  Wallet, 
  History, 
  ArrowUpRight, 
  ArrowDownRight, 
  MoreVertical,
  Plus,
  RefreshCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  addDoc, 
  increment,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export default function Operational() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [modalType, setModalType] = useState('topup'); // 'topup' or 'settlement'
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!profile?.orgId) return;

    // Listen to Staff
    const qStaff = query(
      collection(db, 'users'),
      where('orgId', '==', profile.orgId),
      where('role', '==', 'staff')
    );
    const unsubscribeStaff = onSnapshot(qStaff, (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to Recent Transfers
    const qTransfers = query(
      collection(db, 'organizations', profile.orgId, 'operational_transfers'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribeTransfers = onSnapshot(qTransfers, (snapshot) => {
      setTransfers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeStaff();
      unsubscribeTransfers();
    };
  }, [profile]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!selectedStaff || !profile?.orgId) return;
    
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const note = formData.get('note');

    if (amount <= 0) {
      alert("Masukkan nominal yang valid");
      setIsLoading(false);
      return;
    }

    try {
      // 1. Create Transfer Record
      await addDoc(collection(db, 'organizations', profile.orgId, 'operational_transfers'), {
        fromId: profile.uid,
        toId: selectedStaff.id,
        toName: selectedStaff.displayName,
        amount,
        type: modalType,
        status: 'completed',
        note,
        createdAt: serverTimestamp()
      });

      // 2. Update Staff Cash on Hand
      const staffRef = doc(db, 'users', selectedStaff.id);
      await updateDoc(staffRef, {
        cashOnHand: increment(modalType === 'topup' ? amount : -amount),
        updatedAt: serverTimestamp()
      });

      setIsModalOpen(false);
      setSelectedStaff(null);
    } catch (err) {
      console.error("Transfer failed:", err);
      alert("Gagal memproses dana: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-300 pb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Manajemen Dana</h1>
          <p className="text-slate-500 font-medium uppercase text-xs tracking-widest mt-1">
            Distribusi Operasional TU • {profile?.orgName || 'Sekolah'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: Staff Distribution */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {staff.map((s) => (
               <Card key={s.id} className="relative group overflow-hidden border-slate-200 hover:border-indigo-400 hover:shadow-xl transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl font-black">
                      {s.displayName?.charAt(0)}
                    </div>
                    <div className="text-right">
                       <span className="inline-block px-2 py-1 bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest rounded-lg mb-1">TINGKAT {s.assignedGrade || '?'}</span>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Saldo Fisik Pegangan</p>
                    </div>
                  </div>
                  
                  <div className="mb-8">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{s.displayName}</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-tighter truncate">{s.email}</p>
                    <p className="text-3xl font-black text-indigo-600 mt-4 tracking-tighter">{formatCurrency(s.cashOnHand || 0)}</p>
                  </div>

                  <div className="flex gap-2">
                     <Button 
                        variant="brand" 
                        size="sm" 
                        className="flex-1 rounded-xl"
                        onClick={() => {
                          setSelectedStaff(s);
                          setModalType('topup');
                          setIsModalOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Top Up
                     </Button>
                     <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 rounded-xl border-slate-200"
                        onClick={() => {
                          setSelectedStaff(s);
                          setModalType('settlement');
                          setIsModalOpen(true);
                        }}
                      >
                        <RefreshCcw className="w-4 h-4 mr-2" /> Setor
                     </Button>
                  </div>
               </Card>
             ))}
             {staff.length === 0 && (
               <div className="col-span-2 py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Belum ada staff TU terdaftar</p>
                  <Link to="/members" className="text-indigo-600 text-[10px] font-black uppercase tracking-widest mt-2 block hover:underline">Kelola Anggota & Role</Link>
               </div>
             )}
          </div>
        </div>

        {/* Right Column: History */}
        <div className="col-span-12 lg:col-span-4">
           <Card title="Riwayat Transfer" className="h-full bg-slate-900 border-slate-800">
              <div className="space-y-6">
                 {transfers.length > 0 ? transfers.map((t) => (
                   <div key={t.id} className="flex items-start gap-4 p-4 rounded-3xl bg-white/5 border border-white/10 group hover:bg-white/10 transition-colors">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        t.type === 'topup' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                      )}>
                        {t.type === 'topup' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-start">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t.type === 'topup' ? 'Pemberian Dana' : 'Penyetoran Dana'}</p>
                            <p className="text-[8px] text-white/30 font-bold uppercase">{formatDate(t.createdAt)}</p>
                         </div>
                         <p className="text-white text-sm font-bold tracking-tight mb-2">
                           {t.type === 'topup' ? 'Ke' : 'Dari'} <span className="text-indigo-300">{t.toName}</span>
                         </p>
                         <p className="text-lg font-black text-white">{formatCurrency(t.amount)}</p>
                         {t.note && (
                           <p className="text-[9px] text-white/40 italic mt-2 leading-relaxed">"{t.note}"</p>
                         )}
                      </div>
                   </div>
                 )) : (
                   <div className="text-center py-20 opacity-30">
                      <History className="w-10 h-10 text-white mx-auto mb-4" />
                      <p className="text-[10px] font-black text-white uppercase tracking-widest">Belum Ada Riwayat Transfer</p>
                   </div>
                 )}
              </div>
           </Card>
        </div>
      </div>

      {/* Modal for Transfer */}
      <AnimatePresence>
        {isModalOpen && selectedStaff && (
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
                <div className="text-center mb-8">
                  <div className={cn(
                    "w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6",
                    modalType === 'topup' ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"
                  )}>
                    {modalType === 'topup' ? <ArrowUpRight className="w-10 h-10" /> : <RefreshCcw className="w-10 h-10" />}
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                    {modalType === 'topup' ? 'Top Up Saldo' : 'Setor Saldo'}
                  </h2>
                  <p className="text-slate-500 font-medium mt-2">
                    {modalType === 'topup' ? 'Berikan dana operasional kepada' : 'Tarik/Terima setoran dana dari'} <strong>{selectedStaff.displayName}</strong>
                  </p>
                </div>

                <form onSubmit={handleTransfer} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Nominal Dana (IDR)</label>
                    <input name="amount" type="number" required autoFocus className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-100 font-black text-3xl text-slate-900 text-center" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Keterangan / Catatan</label>
                    <input name="note" type="text" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 font-bold text-sm text-slate-700" placeholder="Opsional..." />
                  </div>
                  
                  {modalType === 'settlement' && selectedStaff.cashOnHand < 0 && (
                    <div className="p-4 bg-rose-50 rounded-2xl flex items-start gap-3">
                       <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                       <p className="text-[10px] font-bold text-rose-800 leading-relaxed uppercase tracking-tighter">
                         Perhatian: Staff ini memiliki saldo pegangan negatif. Pastikan nominal setoran benar untuk menyeimbangkan box fisik.
                       </p>
                    </div>
                  )}

                  <div className="pt-6 flex gap-4">
                    <Button type="button" variant="ghost" className="flex-1 bg-slate-100" onClick={() => setIsModalOpen(false)}>Batal</Button>
                    <Button type="submit" variant="brand" className="flex-[2]" isLoading={isLoading}>Konfirmasi Dana</Button>
                  </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
