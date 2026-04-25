import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button } from '../components/Common';
import { CheckCircle2, Search, Calendar, ChevronLeft, ChevronRight, UserPlus, Receipt } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  Timestamp,
  doc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

export default function Contributions() {
  const { profile } = useAuth();
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const feePerMonth = 50000; // Fixed fee for now

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Fetch Members
  useEffect(() => {
    if (!profile?.orgId) return;

    const q = query(
      collection(db, 'users'),
      where('orgId', '==', profile.orgId),
      orderBy('displayName', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMembers(membersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [profile?.orgId]);

  // Fetch Transactions for current month/year to determine payment status
  useEffect(() => {
    if (!profile?.orgId) return;

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    const q = query(
      collection(db, 'organizations', profile.orgId, 'transactions'),
      where('date', '>=', Timestamp.fromDate(startOfMonth)),
      where('date', '<=', Timestamp.fromDate(endOfMonth)),
      where('category', '==', 'Iuran Rutin')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTransactions(txData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${profile.orgId}/transactions`);
    });

    return () => unsubscribe();
  }, [profile?.orgId, currentMonth, currentYear]);

  // Calculate payment map
  const paymentMap = useMemo(() => {
    const map = {};
    transactions.forEach(tx => {
      if (tx.memberId) {
        map[tx.memberId] = true;
      } else if (tx.userId) {
         // Fallback if userId is used instead of memberId
         map[tx.userId] = true;
      }
    });
    return map;
  }, [transactions]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [members, searchTerm]);

  const paidCount = members.filter(m => paymentMap[m.uid || m.id]).length;
  const unpaidCount = members.length - paidCount;

  const handleManualVerify = async (member) => {
     if (!profile?.orgId) return;
     if (profile.role !== 'admin' && profile.role !== 'treasurer') {
       alert("Hanya Admin atau Bendahara yang bisa verifikasi iuran.");
       return;
     }

     if (window.confirm(`Verifikasi pembayaran Iuran Rutin untuk ${member.displayName}?`)) {
       try {
         const txRef = collection(db, 'organizations', profile.orgId, 'transactions');
         await addDoc(txRef, {
           title: `Iuran Rutin - ${months[currentMonth]} ${currentYear}`,
           amount: feePerMonth,
           type: 'income',
           category: 'Iuran Rutin',
           date: Timestamp.fromDate(new Date(currentYear, currentMonth, 15)),
           memberId: member.uid || member.id,
           memberName: member.displayName,
           createdBy: profile.uid,
           createdAt: serverTimestamp(),
           orgId: profile.orgId
         });
       } catch (err) {
         handleFirestoreError(err, OperationType.CREATE, `organizations/${profile.orgId}/transactions`);
       }
     }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  if (!profile?.orgId) {
    return (
      <div className="p-12 text-center bg-white rounded-[3rem] border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900">Belum Ada Organisasi</h2>
        <p className="mt-2 text-slate-500">Silahkan buat atau gabung organisasi di Dashboard terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-300 pb-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Iuran Rutin</h1>
          <p className="text-slate-500 font-medium uppercase text-xs tracking-widest mt-1">
            Membership Ledger • Tahun Buku {currentYear}
          </p>
        </div>
        
        <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-4 flex items-center space-x-3 min-w-[160px] justify-center">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-900">{months[currentMonth]} {currentYear}</span>
          </div>
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex flex-col items-center justify-center text-center py-6">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Target Iuran</p>
          <p className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(feePerMonth)}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Flat Rate / Bulan</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center py-6">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Sudah Bayar</p>
          <p className="text-2xl font-black text-emerald-600 tracking-tight">{paidCount}</p>
          <p className="text-[10px] text-emerald-600/60 font-bold mt-2 uppercase tracking-tighter">Anggota Terverifikasi</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center py-6">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Belum Bayar</p>
          <p className="text-2xl font-black text-rose-600 tracking-tight">{unpaidCount}</p>
          <p className="text-[10px] text-rose-600/60 font-bold mt-2 uppercase tracking-tighter">Menunggu Konfirmasi</p>
        </Card>
        <Card variant="dark" className="flex flex-col items-center justify-center text-center py-6">
          <p className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mb-1">Total Koleksis</p>
          <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(paidCount * feePerMonth)}</p>
          <p className="text-[10px] text-white/40 font-bold mt-2 uppercase tracking-tighter">Bulan {months[currentMonth]}</p>
        </Card>
      </div>

      <Card title="Status Pembayaran Anggota" className="p-0 overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari nama anggota..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>
          <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
             Total: {filteredMembers.length} Anggota
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {loading ? (
             <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Memuat data anggota...</div>
          ) : filteredMembers.length === 0 ? (
             <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada anggota ditemukan</div>
          ) : filteredMembers.map((member) => {
            const isPaid = paymentMap[member.uid || member.id];
            return (
              <div key={member.id} className="flex items-center justify-between p-5 px-8 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                    {member.photoURL ? (
                       <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">
                         {(member.displayName || 'U').charAt(0)}
                       </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{member.displayName || 'Unnamed Member'}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">{member.role || 'Member'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right hidden sm:block">
                    <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Status Ledger</p>
                    <p className={cn(
                      "text-xs font-black uppercase tracking-tighter",
                      isPaid ? "text-emerald-500" : "text-amber-500"
                    )}>
                      {isPaid ? 'Paid In Full' : 'Outstanding'}
                    </p>
                  </div>

                  <div className="flex items-center">
                    {isPaid ? (
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleManualVerify(member)}
                        className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 font-black text-[10px] uppercase tracking-widest px-4 py-2.5"
                      >
                        Verify
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
