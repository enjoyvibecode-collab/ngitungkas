import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button } from '../components/Common';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  CheckCircle2, 
  Search, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  UserPlus, 
  Receipt,
  FileDown,
  FileSpreadsheet,
  MessageCircle,
  Share2
} from 'lucide-react';
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
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Contributions() {
  const { profile } = useAuth();
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

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
    return members.filter(m => {
      const matchesSearch = m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || m.nisn?.includes(searchTerm);
      const matchesClass = selectedClass === 'Semua Kelas' || m.className === selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [members, searchTerm, selectedClass]);

  const classes = useMemo(() => {
    return ['Semua Kelas', ...new Set(members.map(m => m.className || 'Tanpa Kelas'))].sort();
  }, [members]);

  const paidCount = members.filter(m => paymentMap[m.uid || m.id]).length;
  const unpaidCount = members.length - paidCount;

  const exportUnpaidToExcel = () => {
    const unpaidData = members
      .filter(m => !paymentMap[m.uid || m.id])
      .map(m => ({
        Nama: m.displayName || 'Unnamed',
        Email: m.email || '-',
        Peran: m.role || 'Member',
        Status: 'BELUM BAYAR',
        Bulan: `${months[currentMonth]} ${currentYear}`
      }));

    const ws = XLSX.utils.json_to_sheet(unpaidData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Belum Bayar");
    XLSX.writeFile(wb, `Laporan_Unpaid_${months[currentMonth]}_${currentYear}.xlsx`);
  };

  const generatePDFReport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text('Laporan Keuangan Iuran Rutin', 14, 22);
    doc.setFontSize(11);
    doc.text(`Periode: ${months[currentMonth]} ${currentYear}`, 14, 30);
    doc.text(`Organisasi: ${profile?.orgId?.replace('-', ' ').toUpperCase()}`, 14, 37);

    // Summary
    const summaryData = [
      ['Total Anggota', members.length.toString()],
      ['Lunas', paidCount.toString()],
      ['Belum Lunas', unpaidCount.toString()],
      ['Total Terkumpul', formatCurrency(paidCount * feePerMonth)]
    ];

    doc.autoTable({
      startY: 45,
      head: [['Ringkasan', 'Jumlah']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    // Detailed List
    const tableData = members.map(m => [
      m.displayName || '-',
      m.role || '-',
      paymentMap[m.uid || m.id] ? 'LUNAS' : 'BELUM BAYAR',
      paymentMap[m.uid || m.id] ? formatCurrency(feePerMonth) : 'Rp 0'
    ]);

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 15,
      head: [['Nama Anggota', 'Peran', 'Status', 'Jumlah Kolektif']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`Laporan_Iuran_${months[currentMonth]}_${currentYear}.pdf`);
  };

  const sendReminder = async (member) => {
    const msg = `Halo ${member.displayName}, mohon maaf mengganggu. Ini adalah pengingat dari pengurus KAS untuk iuran bulan ${months[currentMonth]} ${currentYear}. Status Bapak/Ibu saat ini masih BELUM LUNAS. Mohon bantuannya untuk segera melakukan setoran. Terima kasih!`;
    const waUrl = `https://wa.me/${member.phone || ''}?text=${encodeURIComponent(msg)}`;
    
    try {
      const logRef = collection(db, 'organizations', profile.orgId, 'activity_logs');
      await addDoc(logRef, {
        actorId: profile.uid,
        actorName: profile.displayName,
        targetUserId: member.uid || member.id,
        targetUserName: member.displayName,
        action: 'reminder_sent',
        month: months[currentMonth],
        year: currentYear,
        orgId: profile.orgId,
        timestamp: serverTimestamp()
      });
      window.open(waUrl, '_blank');
    } catch (err) {
      console.error("Failed to log reminder:", err);
      window.open(waUrl, '_blank');
    }
  };

  const handleManualVerify = (member) => {
     if (!profile?.orgId) return;
     if (profile.role !== 'admin' && profile.role !== 'treasurer' && profile.role !== 'teacher') {
       alert("Hanya Pimpinan, Bendahara, atau Wali Kelas yang bisa verifikasi iuran.");
       return;
     }

     setConfirmModal({
       isOpen: true,
       title: 'Verifikasi Iuran',
       description: `Apakah Bapak/Ibu ingin menandai iuran bulan ${months[currentMonth]} ${currentYear} untuk ${member.displayName} sebagai LUNAS? Transaksi pendapatan akan otomatis tercatat.`,
       onConfirm: async () => {
         try {
           const batch = writeBatch(db);
           const txRef = doc(collection(db, 'organizations', profile.orgId, 'transactions'));
           const txTitle = `Iuran Siswa - ${months[currentMonth]} ${currentYear}`;
           
           batch.set(txRef, {
             title: txTitle,
             amount: feePerMonth,
             type: 'income',
             category: 'Iuran Rutin',
             date: Timestamp.fromDate(new Date(currentYear, currentMonth, 15)),
             memberId: member.uid || member.id,
             memberName: member.displayName,
             memberClass: member.className || '?',
             createdBy: profile.uid,
             createdAt: serverTimestamp(),
             orgId: profile.orgId
           });

           const logRef = doc(collection(db, 'organizations', profile.orgId, 'activity_logs'));
           batch.set(logRef, {
             actorId: profile.uid,
             actorName: profile.displayName,
             targetUserId: member.uid || member.id,
             targetUserName: member.displayName,
             action: 'transaction',
             txTitle,
             orgId: profile.orgId,
             timestamp: serverTimestamp()
           });

           await batch.commit();
         } catch (err) {
           handleFirestoreError(err, OperationType.CREATE, `organizations/${profile.orgId}/transactions`);
         }
       }
     });
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
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Iuran Bulanan</h1>
          <p className="text-slate-500 font-medium uppercase text-xs tracking-widest mt-1">
            SPP & Iuran Sekolah • SMP Negeri 1 Manonjaya
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
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

          <div className="flex gap-2">
            <Button 
               variant="outline" 
               size="sm" 
               onClick={generatePDFReport}
               className="rounded-2xl flex items-center gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden md:inline font-bold text-[10px] uppercase">PDF</span>
            </Button>
            <Button 
               variant="outline" 
               size="sm" 
               onClick={exportUnpaidToExcel}
               className="rounded-2xl flex items-center gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden md:inline font-bold text-[10px] uppercase">Excel</span>
            </Button>
          </div>
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

      <Card title="Status Pembayaran Siswa" className="p-0 overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-1 gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari Nama / NISN..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
            <select 
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-slate-900 outline-none min-w-[120px]"
            >
              {classes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
             Total: {filteredMembers.length} Siswa
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {loading ? (
             <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Memuat data...</div>
          ) : filteredMembers.length === 0 ? (
             <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Tidak ada data ditemukan</div>
          ) : filteredMembers.map((member) => {
            const isPaid = paymentMap[member.uid || member.id];
            return (
              <div key={member.id} className="flex items-center justify-between p-5 px-8 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                    {member.photoURL ? (
                       <img src={member.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
                         {(member.displayName || 'U').charAt(0)}
                       </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{member.displayName || 'Unnamed Student'}</p>
                      <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black uppercase">{member.className || 'N/A'}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">NISN: {member.nisn || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Status Ledger</p>
                    <p className={cn(
                      "text-xs font-black uppercase tracking-tighter",
                      isPaid ? "text-emerald-500" : "text-amber-500"
                    )}>
                      {isPaid ? 'Paid In Full' : 'Outstanding'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isPaid && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => sendReminder(member)}
                        className="rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 p-2.5 sm:p-2 shadow-sm"
                        title="Kirim Pengingat WA"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    )}
                    
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

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        variant="indigo"
        confirmText="Verifikasi Lunas"
      />
    </div>
  );
}
