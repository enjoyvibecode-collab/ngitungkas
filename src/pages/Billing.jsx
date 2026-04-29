import React, { useState, useEffect, useMemo } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  Calendar,
  Wallet,
  Receipt,
  Download,
  Send,
  Trash2,
  Edit2,
  XCircle,
  GraduationCap,
  History,
  FileSpreadsheet,
  ArrowRightLeft
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  writeBatch,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Button, Card, Badge } from '../components/Common';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

export default function Billing() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('all_bills');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data States
  const [billTypes, setBillTypes] = useState([]);
  const [studentBills, setStudentBills] = useState([]);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [members, setMembers] = useState([]);
  
  // UI States
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [targetType, setTargetType] = useState('all');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedStudentBill, setSelectedStudentBill] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('Semua Kelas');
  const [billFilter, setBillFilter] = useState('Semua Tagihan');
  const [statusFilter, setStatusFilter] = useState('Semua Status');

  // Stats
  const stats = useMemo(() => {
    const totalTarget = studentBills.reduce((acc, b) => acc + (b.targetAmount || 0), 0);
    const totalPaid = studentBills.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
    const totalReceivable = totalTarget - totalPaid;
    const delinquentCount = studentBills.filter(b => b.status === 'unpaid' || b.status === 'partial').length;

    return [
      { label: 'Total Tagihan Aktif', value: totalTarget, icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { label: 'Sudah Dibayar', value: totalPaid, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Sisa Piutang', value: totalReceivable, icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50' },
      { label: 'Siswa Menunggak', value: delinquentCount, isCount: true, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' }
    ];
  }, [studentBills]);

  const classes = ['Semua Kelas', '7A', '7B', '7C', '7D', '7E', '7F', '7G', '7H', '7I', '7J', '7K', '8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H', '8I', '8J', '8K', '9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H', '9I', '9J', '9K'];

  useEffect(() => {
    if (!profile?.orgId) return;

    const orgRef = doc(db, 'organizations', profile.orgId);
    
    // Subscriptions
    const unsubTypes = onSnapshot(collection(orgRef, 'billing_types'), (snap) => {
      setBillTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubBills = onSnapshot(query(collection(orgRef, 'student_bills'), limit(200)), (snap) => {
      setStudentBills(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPayments = onSnapshot(query(collection(orgRef, 'payment_logs'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      setPaymentLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubMembers = onSnapshot(query(collection(db, 'users'), where('orgId', '==', profile.orgId), limit(500)), (snap) => {
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }));
      setMembers(filtered);
      setIsLoading(false);
    });

    return () => {
      unsubTypes();
      unsubBills();
      unsubPayments();
      unsubMembers();
    };
  }, [profile?.orgId]);

  const handleCreateBillType = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      category: formData.get('category'),
      schoolYear: formData.get('schoolYear'),
      targetType: formData.get('targetType'), // 'all', 'grade7', 'grade8', 'grade9', 'classes', 'students'
      targetAmount: Number(formData.get('targetAmount')),
      allowInstallment: formData.get('allowInstallment') === 'on',
      active: true,
      createdAt: serverTimestamp(),
      createdBy: profile?.uid
    };

    try {
      const billTypeRef = await addDoc(collection(db, 'organizations', profile.orgId, 'billing_types'), data);
      
      const targetClassName = formData.get('targetClassName');
      
      // Bulk generation for student_bills
      let targetStudents = [];
      if (data.targetType === 'all') {
        targetStudents = members;
      } else if (data.targetType === 'grade7') {
        targetStudents = members.filter(m => m.className?.startsWith('7'));
      } else if (data.targetType === 'grade8') {
        targetStudents = members.filter(m => m.className?.startsWith('8'));
      } else if (data.targetType === 'grade9') {
        targetStudents = members.filter(m => m.className?.startsWith('9'));
      } else if (data.targetType === 'class' && targetClassName) {
        targetStudents = members.filter(m => m.className === targetClassName);
      }

      if (targetStudents.length > 0) {
        const batch = writeBatch(db);
        targetStudents.forEach(student => {
          const docRef = doc(collection(db, 'organizations', profile.orgId, 'student_bills'));
          batch.set(docRef, {
            studentId: student.id,
            studentName: student.displayName,
            className: student.className || '?',
            billId: billTypeRef.id,
            billName: data.name,
            targetAmount: data.targetAmount,
            paidAmount: 0,
            remainingAmount: data.targetAmount,
            status: 'unpaid',
            isAlumni: student.className?.startsWith('9') && student.isAlumni,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }

      setIsBillModalOpen(false);
      alert('Master tagihan berhasil dibuat ' + (targetStudents.length > 0 ? `dan dikirim ke ${targetStudents.length} siswa.` : ''));
    } catch (err) {
      console.error(err);
      alert('Gagal membuat tagihan: ' + err.message);
    }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const amount = Number(formData.get('amount'));
    const method = formData.get('method');
    const note = formData.get('note');

    if (!selectedStudentBill || !amount) return;

    try {
      const batch = writeBatch(db);
      
      // 1. Update Student bill
      const newPaidAmount = (selectedStudentBill.paidAmount || 0) + amount;
      const newRemaining = selectedStudentBill.targetAmount - newPaidAmount;
      const newStatus = newRemaining <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid');

      const billRef = doc(db, 'organizations', profile.orgId, 'student_bills', selectedStudentBill.id);
      batch.update(billRef, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemaining,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // 2. Create Payment Log
      const logRef = doc(collection(db, 'organizations', profile.orgId, 'payment_logs'));
      batch.set(logRef, {
        studentBillId: selectedStudentBill.id,
        studentId: selectedStudentBill.studentId,
        studentName: selectedStudentBill.studentName,
        billName: selectedStudentBill.billName,
        amount: amount,
        method: method,
        note: note,
        createdAt: serverTimestamp(),
        createdBy: profile?.uid,
        orgId: profile?.orgId
      });

      // 3. Optional: Create Transaction Record (Income)
      const txRef = doc(collection(db, 'organizations', profile.orgId, 'transactions'));
      batch.set(txRef, {
        title: `Pembayaran ${selectedStudentBill.billName} - ${selectedStudentBill.studentName}`,
        amount: amount,
        type: 'income',
        category: 'Tagihan',
        date: new Date().toISOString(),
        createdBy: profile?.uid,
        isDeleted: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      setIsPaymentModalOpen(false);
      setSelectedStudentBill(null);
    } catch (err) {
      console.error(err);
      alert('Pembayaran gagal: ' + err.message);
    }
  };

  const filteredBills = useMemo(() => {
    return studentBills.filter(b => {
      const matchesSearch = b.studentName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = classFilter === 'Semua Kelas' || b.className === classFilter;
      const matchesType = billFilter === 'Semua Tagihan' || b.billName === billFilter;
      const matchesStatus = statusFilter === 'Semua Status' || 
                           (statusFilter === 'Lunas' && b.status === 'paid') ||
                           (statusFilter === 'Cicil' && b.status === 'partial') ||
                           (statusFilter === 'Belum Bayar' && b.status === 'unpaid');
      
      if (activeTab === 'delinquent') return matchesSearch && matchesClass && matchesType && (b.status !== 'paid');
      if (activeTab === 'alumni') return matchesSearch && matchesType && b.isAlumni;
      return matchesSearch && matchesClass && matchesType && matchesStatus;
    });
  }, [studentBills, activeTab, searchTerm, classFilter, billFilter, statusFilter]);

  const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  const exportToExcel = () => {
    const wsData = filteredBills.map(b => ({
      'Nama Siswa': b.studentName,
      'Kelas': b.className,
      'Tagihan': b.billName,
      'Target': b.targetAmount,
      'Dibayar': b.paidAmount,
      'Sisa': b.remainingAmount,
      'Status': b.status.toUpperCase(),
      'Tanggal': b.createdAt?.toDate().toLocaleDateString('id-ID')
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan_Tagihan");
    XLSX.writeFile(wb, `Laporan_Tagihan_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (isLoading) return (
    <div className="flex h-96 items-center justify-center">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-indigo-600 rounded-2xl">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Tagihan Sekolah</h1>
          </div>
          <p className="text-slate-500 font-medium">Sistem Administrasi Pembayaran • {profile?.orgName || 'NgitungKas Edu'}</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="rounded-2xl border-slate-200 bg-white shadow-sm" onClick={exportToExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-widest">Eksport</span>
          </Button>
          {(profile?.role === 'admin' || profile?.role === 'treasurer' || profile?.role === 'staff' || profile?.role === 'teacher') && (
            <Button className="rounded-2xl shadow-lg shadow-indigo-200" onClick={() => setIsBillModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">Buat Tagihan</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="p-6 border-none shadow-sm overflow-hidden relative group">
              <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-125", stat.bg)} />
              <div className="flex flex-col">
                <div className={cn("p-3 rounded-2xl w-fit mb-4", stat.bg)}>
                  <stat.icon className={cn("w-5 h-5", stat.color)} />
                </div>
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{stat.label}</p>
                <h3 className="text-2xl font-black text-slate-900">
                  {stat.isCount ? stat.value : formatIDR(stat.value)}
                </h3>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs Control */}
      <div className="flex p-1.5 bg-slate-100 rounded-3xl w-fit overflow-x-auto no-scrollbar">
        {[
          { id: 'all_bills', label: 'Semu Tagihan', icon: CreditCard },
          { id: 'payments', label: 'Pembayaran', icon: Receipt },
          { id: 'delinquent', label: 'Tunggakan', icon: AlertCircle },
          { id: 'history', label: 'Riwayat Log', icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] transition-all",
              activeTab === tab.id 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Filters and Search */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-center">
          <div className="relative col-span-1 lg:col-span-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari Murid..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none text-sm font-bold text-slate-700 shadow-sm"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 col-span-1 lg:col-span-3">
            <select 
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none text-[11px] font-black uppercase tracking-widest text-slate-600 shadow-sm"
            >
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            
            <select 
              value={billFilter}
              onChange={(e) => setBillFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none text-[11px] font-black uppercase tracking-widest text-slate-600 shadow-sm"
            >
              <option value="Semua Tagihan">Semua Tagihan</option>
              {billTypes.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>

            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none text-[11px] font-black uppercase tracking-widest text-slate-600 shadow-sm"
            >
              {['Semua Status', 'Lunas', 'Cicil', 'Belum Bayar'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* List Content */}
        <div className="grid grid-cols-1 gap-3">
          {activeTab === 'all_bills' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {billTypes.map((type, idx) => {
                const typeBills = studentBills.filter(b => b.billId === type.id);
                const totalTarget = typeBills.reduce((acc, b) => acc + b.targetAmount, 0);
                const totalPaid = typeBills.reduce((acc, b) => acc + b.paidAmount, 0);
                const progress = totalTarget > 0 ? (totalPaid / totalTarget) * 100 : 0;

                return (
                  <Card key={type.id} className="p-6 hover:border-indigo-200 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                        <CreditCard className="w-5 h-5 text-slate-600 group-hover:text-indigo-600" />
                      </div>
                      <Badge variant={type.active ? 'success' : 'secondary'}>{type.active ? 'Aktif' : 'Tutup'}</Badge>
                    </div>
                    
                    <div className="mb-6">
                      <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight mb-1">{type.name}</h4>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-[10px] font-black uppercase tracking-widest">{type.category}</span>
                        <span className="w-1 h-1 bg-slate-200 rounded-full" />
                        <p className="text-[10px] font-black uppercase tracking-widest">{type.schoolYear}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                        <span>Pencapaian</span>
                        <span className="text-slate-900">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sudah Masuk</p>
                          <p className="text-sm font-black text-slate-900">{formatIDR(totalPaid)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Siswa</p>
                          <p className="text-sm font-black text-slate-900">{typeBills.length}</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {(activeTab === 'payments' || activeTab === 'delinquent' || activeTab === 'alumni') && (
            <Card className="overflow-hidden border-none shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Siswa</th>
                      <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Tagihan</th>
                      <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Target</th>
                      <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Terbayar</th>
                      <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Sisa</th>
                      <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                      <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {filteredBills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-600">
                              {bill.className}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 leading-none mb-1">{bill.studentName}</p>
                              <p className="text-[10px] font-bold text-slate-400 lowercase">{bill.isAlumni ? 'Alumni' : 'Siswa Aktif'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-700">{bill.billName}</p>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-600">{formatIDR(bill.targetAmount)}</td>
                        <td className="px-6 py-4 text-sm font-bold text-emerald-600">{formatIDR(bill.paidAmount)}</td>
                        <td className="px-6 py-4">
                          <p className={cn("text-sm font-bold", bill.remainingAmount > 0 ? "text-rose-600" : "text-slate-300")}>
                            {formatIDR(bill.remainingAmount)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={bill.status === 'paid' ? 'success' : bill.status === 'partial' ? 'warning' : 'danger'}>
                            {bill.status === 'paid' ? 'Lunas' : bill.status === 'partial' ? 'Cicil' : 'Belum Bayar'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                             {(profile?.role === 'admin' || profile?.role === 'treasurer' || profile?.role === 'staff' || profile?.role === 'teacher') && bill.status !== 'paid' && (
                               <Button 
                                size="sm" 
                                className="rounded-xl h-9 px-4" 
                                onClick={() => {
                                  setSelectedStudentBill(bill);
                                  setIsPaymentModalOpen(true);
                                }}
                               >
                                 <Plus className="w-3.5 h-3.5 mr-1.5" />
                                 <span className="text-[10px] font-black uppercase tracking-widest leading-none">Bayar</span>
                               </Button>
                             )}
                             {bill.status !== 'paid' && (
                               <Button variant="ghost" size="sm" className="bg-emerald-50 text-emerald-600 rounded-xl w-9 h-9 p-0 hover:bg-emerald-100" title="Reminder WA">
                                 <Send className="w-3.5 h-3.5" />
                               </Button>
                             )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === 'history' && (
            <Card className="p-0 overflow-hidden border-none shadow-sm">
               <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Siswa / Tagihan</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Jumlah</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Metode</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paymentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-slate-900">{log.studentName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{log.billName}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-black text-emerald-600">+{formatIDR(log.amount)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                            {log.method}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-medium text-slate-400">
                            {log.createdAt?.toDate().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal Buat Tagihan */}
      <AnimatePresence>
        {isBillModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsBillModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="px-8 pt-8 pb-6 bg-slate-50/50 border-b border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Buat Tagihan Baru</h2>
                    <p className="text-slate-500 font-medium text-sm">Master data untuk dikirim ke siswa pilihan</p>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-2xl" onClick={() => setIsBillModalOpen(false)}>
                    <MoreVertical className="w-5 h-5 text-slate-400" />
                  </Button>
                </div>
              </div>

              <form onSubmit={handleCreateBillType} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest px-1">Nama Tagihan</label>
                    <input name="name" required placeholder="Contoh: Seragam Olahraga 2026" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest px-1">Kategori</label>
                    <select name="category" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold">
                      <option>Awal Tahun</option>
                      <option>Akhir Tahun</option>
                      <option>Seragam</option>
                      <option>Buku</option>
                      <option>Kegiatan</option>
                      <option>Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest px-1">Tahun Ajaran</label>
                    <input name="schoolYear" required defaultValue="2025/2026" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest px-1">Nominal (Sama Semua)</label>
                    <input name="targetAmount" type="number" required placeholder="Rp 0" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold italic" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest px-1">Tujuan Distribusi</label>
                    <select name="targetType" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" onChange={(e) => setTargetType(e.target.value)}>
                      <option value="all">Semua Siswa Aktif</option>
                      <option value="grade7">Hanya Kelas 7</option>
                      <option value="grade8">Hanya Kelas 8</option>
                      <option value="grade9">Hanya Kelas 9</option>
                      <option value="class">Pilih Kelas Spesifik</option>
                      <option value="manual">Manual (Pilih Nanti)</option>
                    </select>
                  </div>
                  {targetType === 'class' && (
                    <div className="col-span-2">
                       <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest px-1">Pilih Nama Kelas</label>
                       <select name="targetClassName" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold">
                         {classes.filter(c => c !== 'Semua Kelas').map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <input type="checkbox" name="allowInstallment" id="installment" defaultChecked className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                  <label htmlFor="installment" className="text-xs font-bold text-slate-600 cursor-pointer">Izinkan pembayaran dicicil</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="ghost" className="flex-1 rounded-2xl py-4" onClick={() => setIsBillModalOpen(false)}>Batal</Button>
                  <Button type="submit" className="flex-1 rounded-2xl py-4 shadow-xl shadow-indigo-100">Buat Tagihan</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Bayar */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedStudentBill && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsPaymentModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 bg-indigo-600 text-white relative">
                 <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Receipt className="w-32 h-32 rotate-12" />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-80">Konfirmasi Pembayaran</p>
                 <h2 className="text-3xl font-black tracking-tight mb-6">{selectedStudentBill.studentName}</h2>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/5">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Nama Tagihan</p>
                        <p className="text-sm font-black truncate">{selectedStudentBill.billName}</p>
                    </div>
                    <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/5">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Sisa Tagihan</p>
                        <p className="text-sm font-black">{formatIDR(selectedStudentBill.remainingAmount)}</p>
                    </div>
                 </div>
              </div>

              <form onSubmit={handlePayment} className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest px-1">Jumlah Bayar</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">Rp</span>
                    <input 
                      name="amount" 
                      type="number" 
                      required 
                      autoFocus
                      defaultValue={selectedStudentBill.remainingAmount}
                      className="w-full pl-16 pr-5 py-6 bg-slate-50 border border-slate-200 rounded-[2rem] outline-none focus:ring-2 focus:ring-indigo-600 text-3xl font-black text-slate-900" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest px-1">Metode</label>
                    <select name="method" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold">
                        <option>Tunai</option>
                        <option>Transfer</option>
                        <option>QRIS</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest px-1">Keterangan</label>
                    <input name="note" placeholder="Catatan..." className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="ghost" className="flex-1 rounded-2xl py-4" onClick={() => setIsPaymentModalOpen(false)}>Batal</Button>
                  <Button type="submit" className="flex-1 rounded-2xl py-4 shadow-xl shadow-indigo-100">Konfirmasi Bayar</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
