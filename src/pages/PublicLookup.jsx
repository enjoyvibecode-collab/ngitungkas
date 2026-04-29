import React, { useState } from 'react';
import { 
  Search, 
  Wallet, 
  History, 
  ArrowLeft, 
  FileSpreadsheet, 
  Download,
  GraduationCap,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { Button, Card, Badge } from '../components/Common';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function PublicLookup() {
  const [nisn, setNisn] = useState('');
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [savingsHistory, setSavingsHistory] = useState([]);
  const [bills, setBills] = useState([]);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!nisn) return;

    setLoading(true);
    setError(null);
    setStudent(null);
    
    try {
      // 1. Find Student by NISN
      const studentQuery = query(
        collection(db, 'users'), 
        where('nisn', '==', nisn.trim()),
        limit(1)
      );
      
      const studentSnap = await getDocs(studentQuery);
      
      if (studentSnap.empty) {
        throw new Error("Data siswa dengan NISN tersebut tidak ditemukan.");
      }

      const rawStudentData = { id: studentSnap.docs[0].id, ...studentSnap.docs[0].data() };
      
      // 2. Fetch Organization Name
      const orgSnap = await getDoc(doc(db, 'organizations', rawStudentData.orgId));
      const orgName = orgSnap.exists() ? orgSnap.data().name : 'Organisasi Pendidikan';

      // 3. Fetch Real-time Balance from savings subcollection
      const savingsRef = doc(db, 'organizations', rawStudentData.orgId, 'savings', rawStudentData.id);
      const savingsDoc = await getDoc(savingsRef);
      const savingsData = savingsDoc.exists() ? savingsDoc.data() : { balance: 0 };

      const studentData = { 
        ...rawStudentData, 
        orgName,
        actualBalance: Number(savingsData.balance) || 0,
        pendingWithdrawal: !!savingsData.pendingWithdrawal,
        pendingAmount: Number(savingsData.pendingAmount) || 0
      };
      
      setStudent(studentData);

      // 4. Fetch Savings History (Logs)
      const savingsQuery = query(
        collection(db, 'organizations', studentData.orgId, 'savings_logs'),
        where('userId', '==', studentData.id),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const savingsSnap = await getDocs(savingsQuery);
      setSavingsHistory(savingsSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        amount: Number(doc.data().amount) || 0
      })));

      // 5. Fetch Bills
      const billsQuery = query(
        collection(db, 'organizations', studentData.orgId, 'student_bills'),
        where('studentId', '==', studentData.id),
        limit(200)
      );
      const billsSnap = await getDocs(billsQuery);
      setBills(billsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatIDR = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);
  };

  const exportSavings = () => {
    if (!student) return;
    const wsData = savingsHistory.map(h => ({
      'Tanggal': h.createdAt?.toDate ? h.createdAt.toDate().toLocaleString('id-ID') : '-',
      'Tipe': h.type === 'deposit' ? 'Setoran' : 'Penarikan',
      'Jumlah': h.amount,
      'Status': h.status === 'pending' ? 'Menunggu Persetujuan' : 'Sukses',
      'Keterangan': h.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat_Tabungan");
    XLSX.writeFile(wb, `Tabungan_${student.displayName}_${nisn}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Publik */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">NgitungKas <span className="text-indigo-600">Edu</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Cek Tabungan Siswa</p>
            </div>
          </Link>
          <Link to="/login">
            <Button variant="ghost" size="sm" className="hidden sm:flex rounded-xl font-black text-[10px] uppercase tracking-widest">
              Login Admin / Bendahara
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {!student ? (
          <div className="max-w-md mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto">
                <Search className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Cek Tabungan & Tagihan</h2>
              <p className="text-slate-500 font-medium">Masukkan NISN kamu untuk melihat data tabungan dan tagihan sekolah terbaru.</p>
            </motion.div>

            <form onSubmit={handleSearch} className="space-y-4">
              <div className="relative">
                <input 
                  type="text" 
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  placeholder="Masukkan nomor NISN siswa..."
                  className="w-full px-6 py-5 bg-white border-2 border-slate-200 rounded-[2rem] outline-none focus:border-indigo-600 transition-all font-black text-center text-xl shadow-xl shadow-slate-200/50"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full py-5 rounded-[2rem] shadow-xl shadow-indigo-200" 
                disabled={loading}
              >
                {loading ? 'Mencari data...' : 'Cek Sekarang'}
              </Button>
            </form>

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-sm font-bold"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="space-y-8 pb-20">
            {/* Navigasi Balik */}
            <button 
              onClick={() => setStudent(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-black text-[11px] uppercase tracking-widest transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Cari NISN Lain
            </button>

            {/* Profil Siswa Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="col-span-1 md:col-span-2 p-8 border-none bg-white shadow-xl shadow-slate-200/50 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-indigo-50 rounded-full opacity-50" />
                <div className="w-24 h-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center font-black text-3xl text-white shadow-xl shadow-indigo-200 shrink-0">
                  {student.displayName?.charAt(0)}
                </div>
                <div className="text-center sm:text-left space-y-1 relative">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">{student.orgName}</p>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">{student.displayName}</h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                    <Badge variant="brand" className="px-4 py-1.5">{student.className || 'Tanpa Kelas'}</Badge>
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full text-[11px] font-black uppercase text-slate-500 tracking-widest">
                      <Calendar className="w-3 h-3" />
                      NISN: {student.nisn}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-8 border-none bg-indigo-600 text-white shadow-xl shadow-indigo-100 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -left-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Total Tabungan</p>
                  <h3 className="text-3xl font-black leading-none">{formatIDR(student.actualBalance)}</h3>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <div className="flex items-center gap-2 p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                    <Wallet className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Saldo Aktif</span>
                  </div>
                  {student.pendingWithdrawal && (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl backdrop-blur-sm text-amber-200">
                      <AlertCircle className="w-4 h-4" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 text-amber-300">Penarikan Pending</span>
                        <span className="text-[10px] font-bold">-{formatIDR(student.pendingAmount)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Tagihan Siswa */}
            {bills.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Tagihan Sekolah</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {bills.map(bill => (
                    <Card key={bill.id} className="p-6 border-none bg-white shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{bill.status === 'paid' ? 'Lunas' : 'Menunggu'}</p>
                          <h4 className="font-black text-slate-900">{bill.billName}</h4>
                        </div>
                        <Badge variant={bill.status === 'paid' ? 'success' : 'danger'}>
                          {bill.status === 'paid' ? 'Sudah Lunas' : 'Belum Lunas'}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400">Total Tagihan</span>
                          <span className="text-slate-900">{formatIDR(bill.targetAmount)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-400">Sudah Terbayar</span>
                          <span className="text-emerald-600">{formatIDR(bill.paidAmount)}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full", bill.status === 'paid' ? 'bg-emerald-500' : 'bg-rose-500')}
                            style={{ width: `${(bill.paidAmount / bill.targetAmount) * 100}%` }}
                          />
                        </div>
                        {bill.remainingAmount > 0 && (
                          <div className="flex justify-between text-xs font-black pt-2 border-t border-slate-50">
                            <span className="text-slate-500 uppercase tracking-widest">Sisa Piutang</span>
                            <span className="text-rose-600">{formatIDR(bill.remainingAmount)}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Riwayat Tabungan */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Riwayat Tabungan</h3>
                </div>
                <Button variant="ghost" size="sm" className="rounded-xl border border-slate-200" onClick={exportSavings}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Excel</span>
                </Button>
              </div>

              <Card className="overflow-hidden border-none shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Tanggal</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Tipe</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Jumlah</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      {savingsHistory.length > 0 ? (
                        savingsHistory.map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <p className="text-sm font-black text-slate-900">
                                {h.createdAt?.toDate ? h.createdAt.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <Badge variant={h.type === 'deposit' ? 'success' : 'danger'}>
                                  {h.type === 'deposit' ? 'Setoran' : 'Tarik'}
                                </Badge>
                                {h.status === 'pending' && (
                                  <span className="text-[8px] font-black uppercase bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 w-fit">
                                    Pending Approval
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className={cn("text-sm font-black", h.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600')}>
                                {h.type === 'deposit' ? '+' : '-'}{formatIDR(h.amount)}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{h.description || '-'}</p>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold italic text-sm">
                            Belum ada riwayat transaksi tabungan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
