import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Common';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Users, 
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  MessageCircle,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { Button } from '../components/Common';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function Dashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [stats, setStats] = useState({
    balance: 0,
    income: 0,
    expense: 0,
    members: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [members, setMembers] = useState([]);
  const [unpaidMembers, setUnpaidMembers] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (!profile?.orgId) return;

    const qAll = query(
      collection(db, 'organizations', profile.orgId, 'transactions'),
      where('isDeleted', '==', false),
      limit(500)
    );

    const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
      let income = 0;
      let expense = 0;
      const txs = snapshot.docs.map(doc => {
        const data = doc.data();
        if (data.type === 'income') income += data.amount;
        else expense += data.amount;
        return { id: doc.id, ...data };
      });
      
      setStats(prev => ({
        ...prev,
        income,
        expense,
        balance: income - expense
      }));

      // Calculate monthly aggregation for chart
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const monthly = txs.reduce((acc, tx) => {
        if (!tx.date) return acc;
        const d = tx.date.toDate();
        const mKey = months[d.getMonth()];
        if (!acc[mKey]) acc[mKey] = { month: mKey, income: 0, expense: 0 };
        acc[mKey][tx.type] += tx.amount;
        return acc;
      }, {});

      const sortedChart = Object.values(monthly).sort((a,b) => months.indexOf(a.month) - months.indexOf(b.month));
      setChartData(sortedChart.length > 0 ? sortedChart : [{ month: 'N/A', income: 0, expense: 0 }]);

      const sorted = [...txs].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
      setRecentTransactions(sorted.slice(0, 5));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `organizations/${profile.orgId}/transactions`);
    });

    // Listen to members
    const qMembers = query(
      collection(db, 'users'),
      where('orgId', '==', profile.orgId),
      limit(50)
    );

    let unsubscribePayments = null;
    const unsubscribeMembers = onSnapshot(qMembers, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() }));
      setMembers(membersData);
      setStats(prev => ({ ...prev, members: snapshot.size }));
      
      // Fetch this month's payments to compute unpaid members
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const qPayments = query(
        collection(db, 'organizations', profile.orgId, 'transactions'),
        where('category', '==', 'Iuran Rutin'),
        where('date', '>=', Timestamp.fromDate(startOfMonth)),
        where('date', '<=', Timestamp.fromDate(endOfMonth))
      );

      if (unsubscribePayments) unsubscribePayments();
      unsubscribePayments = onSnapshot(qPayments, (snap) => {
        const paidUids = snap.docs.map(d => d.data().memberId || d.data().userId);
        const unpaid = membersData.filter(m => !paidUids.includes(m.uid || m.id));
        setUnpaidMembers(unpaid);
      });

    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users`);
    });

    return () => {
      unsubscribeAll();
      unsubscribeMembers();
      if (unsubscribePayments) unsubscribePayments();
    };
  }, [profile]);

  const [onboardingMode, setOnboardingMode] = useState('select'); // 'select', 'create', 'join'

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    const orgName = e.target.orgName.value.trim();
    if (!orgName) return;

    const slug = orgName.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
    setUpdatingId('creating');

    try {
      // 1. Create Organization doc
      const { setDoc, serverTimestamp } = await import('firebase/firestore');
      await setDoc(doc(db, 'organizations', slug), {
        name: orgName,
        createdAt: serverTimestamp(),
        createdBy: profile.uid
      });

      // 2. Update User profile with both ID and Name for fast access
      const userRef = doc(db, 'users', profile.uid);
      
      await updateDoc(userRef, {
        orgId: slug,
        orgName: orgName,
        role: 'admin'
      });
      
      // Force local update if snapshot is slow
      window.location.reload(); 
    } catch (err) {
      console.error("Creation failed:", err);
      handleFirestoreError(err, OperationType.WRITE, `organizations/${slug}`);
      alert("Gagal membuat organisasi: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleJoinOrg = async (e) => {
    e.preventDefault();
    const orgId = e.target.orgId.value.trim().toLowerCase();
    if (!orgId) return;

    try {
      // Check if org exists
      const { getDoc } = await import('firebase/firestore');
      const orgSnap = await getDoc(doc(db, 'organizations', orgId));
      
      if (!orgSnap.exists()) {
        alert("Organisasi tidak ditemukan. Pastikan ID (slug) benar.");
        return;
      }

      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        orgId: orgId,
        role: 'member' // Default role when joining
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
      alert("Gagal bergabung: " + err.message);
    }
  };

  if (!profile?.orgId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-[3rem] border border-slate-200">
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mb-6">
          <Users className="w-10 h-10" />
        </div>
        
        {onboardingMode === 'select' && (
          <div className="max-w-md w-full space-y-6">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Selamat Datang!</h2>
            <p className="text-slate-500 mb-8 font-medium">Bapak/Ibu belum terdaftar di sistem sekolah. Silahkan pilih langkah selanjutnya:</p>
            <div className="grid gap-4">
              <button 
                onClick={() => setOnboardingMode('create')}
                className="flex flex-col items-center p-6 bg-indigo-600 text-white rounded-3xl hover:bg-indigo-700 transition-all text-center group"
              >
                <TrendingUp className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-black text-lg">Buat Data Sekolah Baru</span>
                <span className="text-xs text-indigo-200 font-bold uppercase tracking-widest mt-1">Hanya untuk Kepala Sekolah/Operator</span>
              </button>
              <button 
                onClick={() => setOnboardingMode('join')}
                className="flex flex-col items-center p-6 bg-slate-50 text-slate-900 border border-slate-200 rounded-3xl hover:bg-slate-100 transition-all text-center group"
              >
                <Users className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform text-indigo-600" />
                <span className="font-black text-lg">Masuk ke Sistem Sekolah</span>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Untuk Bendahara/Guru/Siswa</span>
              </button>
            </div>
          </div>
        )}

        {onboardingMode === 'create' && (
          <div className="max-w-md w-full space-y-6">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pendaftaran Operator Baru</h2>
            <p className="text-slate-500 mb-8">Buat database sekolah Bapak/Ibu untuk mulai mengelola keuangan secara digital.</p>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <input 
                name="orgName" 
                type="text" 
                required 
                placeholder="Nama Sekolah (misal: SMPN 1 Manonjaya)"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-bold text-slate-700"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOnboardingMode('select')} className="flex-1 py-4 rounded-2xl" disabled={!!updatingId}>Kembali</Button>
                <Button type="submit" variant="brand" className="flex-[2] py-4 rounded-2xl" isLoading={!!updatingId}>Buat & Masuk</Button>
              </div>
            </form>
          </div>
        )}

        {onboardingMode === 'join' && (
          <div className="max-w-md w-full space-y-6">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Masuk ke Sekolah</h2>
            <p className="text-slate-500 mb-8">Masukkan Kode Sekolah yang diberikan oleh Operator Anda.</p>
            <form onSubmit={handleJoinOrg} className="space-y-4">
              <input 
                name="orgId" 
                type="text" 
                required 
                placeholder="Kode Sekolah (misal: smpn-1-manonjaya)"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-bold text-slate-700"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOnboardingMode('select')} className="flex-1 py-4 rounded-2xl">Kembali</Button>
                <Button type="submit" variant="brand" className="flex-[2] py-4 rounded-2xl">Gabung Sekarang</Button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-end border-b border-slate-300 pb-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            {profile?.orgName || 'Sekolah Belum Terdaftar'}
          </h1>
          <p className="text-slate-500 font-medium uppercase text-xs tracking-widest mt-1">
            Sistem Tabungan Digital Sekolah • {profile?.orgName ? 'Unit Pengelola Kas' : 'Pendaftaran'}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-bold uppercase">PRO Edition</span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Main Stats Bento Row */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <StatCard 
            title="Total Tabungan Sekolah" 
            value={formatCurrency(stats.balance)} 
            icon={Wallet} 
            trend="+12.5%" 
            isPositive 
            variant="accent"
          />
          <div className="grid grid-cols-2 gap-4">
            <StatCard 
              title="Setoran Hari Ini" 
              value={formatCurrency(stats.income)} 
              icon={TrendingUp} 
              trend="+5%" 
              isPositive 
            />
            <StatCard 
              title="Penarikan Hari Ini" 
              value={formatCurrency(stats.expense)} 
              icon={TrendingDown} 
              trend="+2%" 
              isPositive={false} 
            />
          </div>
        </div>

        {/* Chart Card */}
        <Card title="Pertumbuhan Kas" subtitle="Analisis Mutasi 5 Bulan Terakhir" className="col-span-12 lg:col-span-8">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorIncome)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Members Quick List */}
        <Card 
          title="Data Siswa Terakhir" 
          className="col-span-12 lg:col-span-6"
          action={
            (isAdmin || profile?.role === 'treasurer' || profile?.role === 'teacher') && (
              <Link to="/members" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700">
                Lihat Semua Siswa
              </Link>
            )
          }
        >
           <div className="space-y-3">
             {members.length > 0 ? members.slice(0, 4).map(member => (
               <div key={member.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <img src={member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}`} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
                    <div>
                      <div className="text-sm font-bold text-slate-800">{member.displayName}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        {member.className || 'Tanpa Kelas'} • NISN: {member.nisn || '-'}
                      </div>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase",
                    member.orgId ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-200"
                  )}>
                    Joined
                  </span>
               </div>
             )) : (
               <p className="text-center text-xs text-slate-400 py-4 font-bold uppercase tracking-widest">Belum ada data siswa</p>
             )}
           </div>
        </Card>

        {/* Needs Follow Up Widget */}
        <Card 
          title="Belum Menabung" 
          subtitle="Siswa Belum Iuran Bulan Ini"
          className="col-span-12 lg:col-span-6"
          action={
            <Link to="/billing" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700">
              Lihat Detail
            </Link>
          }
        >
          <div className="space-y-3">
            {unpaidMembers.length > 0 ? unpaidMembers.slice(0, 4).map(member => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs border border-rose-200">
                    {(member.displayName || 'U').charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{member.displayName}</div>
                    <div className="text-[9px] text-rose-600 uppercase font-bold tracking-wider">Belum Lunas</div>
                  </div>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => {
                      const msg = `Halo ${member.displayName}, pengingat dari NgitungKas untuk iuran bulan ini. Mohon segera diselesaikan ya. Terima kasih!`;
                      window.open(`https://wa.me/${member.phone || ''}?text=${encodeURIComponent(msg)}`);
                    }}
                    className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            )) : (
              <div className="flex flex-col items-center py-6 text-emerald-500">
                <CheckCircle2 className="w-8 h-8 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Semua Anggota Lunas!</p>
              </div>
            )}
            {unpaidMembers.length > 4 && (
              <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest pt-2">
                +{unpaidMembers.length - 4} anggota lainnya
              </p>
            )}
          </div>
        </Card>

        {/* Activity Timeline */}
        <Card title="Aktivitas Terbaru" className="col-span-12 lg:col-span-12" variant="dark">
          <div className="space-y-4">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      tx.type === 'income' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    )}>
                      {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white truncate w-40">{tx.description}</p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <p className={cn(
                    "text-sm font-black",
                    tx.type === 'income' ? "text-emerald-400" : "text-rose-400"
                  )}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500 uppercase tracking-widest font-bold">No Records Found</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  isPositive,
  variant = 'default'
}) {
  return (
    <Card variant={variant} className="flex flex-col justify-between h-full group">
      <div className="flex justify-between items-start mb-4">
        <div className={cn(
          "w-10 h-10 rounded-2xl flex items-center justify-center",
          variant === 'accent' ? "bg-white/20" : "bg-slate-50 group-hover:bg-slate-100"
        )}>
          <Icon className={cn("w-5 h-5", variant === 'accent' ? "text-white" : "text-slate-900")} />
        </div>
        <div className={cn(
          "px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
          variant === 'accent' 
            ? "bg-white/20 text-white" 
            : isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {trend}
        </div>
      </div>
      <div>
        <h4 className={cn("text-xs font-bold uppercase tracking-widest", variant === 'accent' ? "text-indigo-100" : "text-slate-500")}>{title}</h4>
        <p className={cn("text-2xl font-black tracking-tight mt-1", variant === 'accent' ? "text-white" : "text-slate-900")}>{value}</p>
      </div>
    </Card>
  );
}
