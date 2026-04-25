import React, { useState } from 'react';
import { Card, Button } from '../components/Common';
import { CheckCircle2, Circle, Search, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';

export default function Contributions() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Mock members data
  const members = [
    { id: '1', name: 'Andi Wijaya', status: { 0: 'paid', 1: 'paid', 2: 'paid', 3: 'pending' } },
    { id: '2', name: 'Budi Santoso', status: { 0: 'paid', 1: 'paid', 2: 'pending', 3: 'pending' } },
    { id: '3', name: 'Citra Kirana', status: { 0: 'paid', 1: 'paid', 2: 'paid', 3: 'paid' } },
    { id: '4', name: 'Dedi Kurniawan', status: { 0: 'pending', 1: 'pending', 2: 'pending', 3: 'pending' } },
    { id: '5', name: 'Eka Sari', status: { 0: 'paid', 1: 'paid', 2: 'paid', 3: 'pending' } },
  ];

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
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-4 flex items-center space-x-3 min-w-[160px] justify-center">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-900">{months[currentMonth]}</span>
          </div>
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex flex-col items-center justify-center text-center py-6">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Target Iuran</p>
          <p className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(50000)}</p>
          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-tighter">Flat Rate / Bulan</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center py-6">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Sudah Bayar</p>
          <p className="text-2xl font-black text-emerald-600 tracking-tight">{members.filter(m => m.status[currentMonth] === 'paid').length}</p>
          <p className="text-[10px] text-emerald-600/60 font-bold mt-2 uppercase tracking-tighter">Anggota Terverifikasi</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center py-6">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Belum Bayar</p>
          <p className="text-2xl font-black text-rose-600 tracking-tight">{members.filter(m => m.status[currentMonth] !== 'paid').length}</p>
          <p className="text-[10px] text-rose-600/60 font-bold mt-2 uppercase tracking-tighter">Menunggu Konfirmasi</p>
        </Card>
        <Card variant="dark" className="flex flex-col items-center justify-center text-center py-6">
          <p className="text-[10px] text-indigo-300 font-black uppercase tracking-widest mb-1">Total Koleksis</p>
          <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(members.filter(m => m.status[currentMonth] === 'paid').length * 50000)}</p>
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
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>
          <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
             Urutkan: Nama (A-Z)
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-5 px-8 hover:bg-slate-50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs uppercase">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{member.name}</p>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em]">Verified Member</p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right hidden sm:block">
                  <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest mb-0.5">Status Ledger</p>
                  <p className={cn(
                    "text-xs font-black uppercase tracking-tighter",
                    member.status[currentMonth] === 'paid' ? "text-emerald-500" : "text-amber-500"
                  )}>
                    {member.status[currentMonth] === 'paid' ? 'Paid In Full' : 'Outstanding'}
                  </p>
                </div>

                <div className="flex items-center">
                  {member.status[currentMonth] === 'paid' ? (
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 font-black text-[10px] uppercase tracking-widest px-4 py-2.5">
                      Verify
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
