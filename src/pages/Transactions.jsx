import React, { useState, useEffect } from 'react';
import { Card, Button } from '../components/Common';
import { 
  Search, 
  Plus, 
  Filter, 
  Download,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  X
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Transactions() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!profile?.orgId) return;

    const q = query(
      collection(db, 'organizations', profile.orgId, 'transactions'),
      where('isDeleted', '==', false),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(txs);
    });

    return () => unsubscribe();
  }, [profile]);

  const filteredTransactions = transactions.filter(tx => 
    filter === 'all' ? true : tx.type === filter
  );

  const softDeleteTransaction = async (id) => {
    if (!profile?.orgId) return;
    try {
      const txRef = doc(db, 'organizations', profile.orgId, 'transactions', id);
      await updateDoc(txRef, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-300 pb-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Arsip Kas</h1>
          <p className="text-slate-500 font-medium uppercase text-xs tracking-widest mt-1">
            Riwayat Ledger • {filteredTransactions.length} Rekaman
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          {(profile?.role === 'admin' || profile?.role === 'treasurer') && (
            <Button size="sm" variant="brand" onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Catat Kas
            </Button>
          )}
        </div>
      </header>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-col md:flex-row gap-4 p-6 bg-slate-50 border-b border-slate-200 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari deskripsi transaksi..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 focus:outline-none text-sm font-medium"
            />
          </div>
          
          <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Semua</FilterButton>
            <FilterButton active={filter === 'income'} onClick={() => setFilter('income')}>Masuk</FilterButton>
            <FilterButton active={filter === 'expense'} onClick={() => setFilter('expense')}>Keluar</FilterButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-100">
                <th className="px-8 py-5">Deskripsi</th>
                <th className="px-8 py-5">Kategori</th>
                <th className="px-8 py-5">Tanggal</th>
                <th className="px-8 py-5 text-right">Jumlah</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-4">
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110",
                        tx.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{tx.description}</p>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">REF: {tx.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                      {tx.category}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase">
                    {formatDate(tx.date)}
                  </td>
                  <td className={cn(
                    "px-8 py-5 text-sm font-black text-right",
                    tx.type === 'income' ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="relative group/menu inline-block">
                      <Button variant="ghost" size="sm" className="p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                      <div className="hidden group-hover/menu:block absolute right-0 top-full mt-2 w-32 bg-white border border-slate-200 rounded-2xl shadow-xl z-10 py-2">
                        <button 
                          onClick={() => softDeleteTransaction(tx.id)}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                        >
                          Hapus (Soft)
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && (
            <div className="px-8 py-16 text-center">
               <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Data Kosong</p>
            </div>
          )}
        </div>
      </Card>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
              className="z-[70] bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative border border-slate-200"
            >
              <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Catat Baru</h2>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                setIsLoading(true);
                const formData = new FormData(e.currentTarget);
                const amount = Number(formData.get('amount'));
                const description = formData.get('description');
                
                if (amount <= 0 || !description) {
                  alert("Data tidak valid");
                  setIsLoading(false);
                  return;
                }

                const data = {
                  amount,
                  type: formData.get('type'),
                  category: formData.get('category'),
                  description,
                  date: serverTimestamp(),
                  createdBy: profile?.uid,
                  creatorName: profile?.displayName,
                  updatedAt: null,
                  updatedBy: null,
                  isDeleted: false,
                };

                try {
                   await addDoc(collection(db, 'organizations', profile.orgId, 'transactions'), data);
                   setIsModalOpen(false);
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsLoading(false);
                }
              }} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Jenis Arus</label>
                  <select name="type" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-bold text-slate-700 appearance-none">
                    <option value="income">Pemasukan (+)</option>
                    <option value="expense">Pengeluaran (-)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Nominal (IDR)</label>
                  <input name="amount" type="number" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-black text-xl text-slate-900" placeholder="0" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Kategori Transaksi</label>
                  <input name="category" type="text" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-bold text-slate-700" placeholder="Contoh: Iuran Bulanan" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Keterangan</label>
                  <textarea name="description" required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none font-medium text-slate-700" rows={3} placeholder="Membayar..." />
                </div>
                
                <div className="pt-6 flex gap-4">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>Batal</Button>
                  <Button type="submit" variant="brand" isLoading={isLoading} className="flex-[2]">Simpan Data</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterButton({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border border-transparent",
        active ? "bg-slate-900 text-white shadow-xl scale-105" : "bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 border-slate-200"
      )}
    >
      {children}
    </button>
  );
}
