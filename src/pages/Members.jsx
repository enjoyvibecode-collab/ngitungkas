import React, { useState, useEffect } from 'react';
import { Card, Button } from '../components/Common';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  Users, 
  Shield, 
  ShieldCheck, 
  UserMinus, 
  UserCheck,
  Search,
  MoreVertical,
  AlertCircle,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc,
  addDoc,
  serverTimestamp,
  writeBatch,
  getDocs,
  setDoc,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Members() {
  const { profile } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('Semua Kelas');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editingRole, setEditingRole] = useState('member');
  const [isImporting, setIsImporting] = useState(false);
  
  const downloadTemplate = () => {
    const templateData = [
      {
        "Nama Lengkap": "Ahmad Riza",
        "NISN": "0012345678",
        "Email": "ahmad.riza@example.com",
        "Kelas": "7A",
        "WA Siswa": "6281234567890",
        "WA Orang Tua": "6289876543210"
      },
      {
        "Nama Lengkap": "Siti Aminah",
        "NISN": "0098765432",
        "Email": "siti.aminah@example.com",
        "Kelas": "7A",
        "WA Siswa": "628111222333",
        "WA Orang Tua": "628555444333"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Format Impor Siswa");
    
    // Set column widths
    const wscols = [
      {wch: 30}, // Nama
      {wch: 15}, // NISN
      {wch: 30}, // Email
      {wch: 10}, // Kelas
      {wch: 20}, // WA Siswa
      {wch: 20}  // WA Ortu
    ];
    ws['!cols'] = wscols;

    const safeOrgName = (profile?.orgName || 'Sekolah').replace(/\s+/g, '_');
    XLSX.writeFile(wb, `Format_Impor_Siswa_${safeOrgName}.xlsx`);
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      console.log("Excel Import - SheetNames:", workbook.SheetNames);
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error("File Excel tidak memiliki lembar kerja (sheet).");
      }

      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      console.log("Excel Import - Rows detected:", jsonData.length);
      if (jsonData.length > 0) {
        console.log("Excel Import - Sample headers:", Object.keys(jsonData[0]));
      }

      if (jsonData.length === 0) {
        alert("Template kosong atau tidak ada data yang ditemukan.");
        setIsImporting(false);
        return;
      }

      // Helper to find column by multiple possible header names
      const findValue = (row, possibleHeaders) => {
        const keys = Object.keys(row);
        for (const header of possibleHeaders) {
          const match = keys.find(k => k.trim().toLowerCase() === header.toLowerCase());
          if (match) return row[match];
        }
        return null;
      };

      // Confirmation
      if (!window.confirm(`Sistem mendeteksi ${jsonData.length} baris data. Lanjutkan impor ke database sekolah?`)) {
        setIsImporting(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const failures = [];
      const batchSize = 400;
      
      // Process in chunks to respect Firestore limits
      for (let i = 0; i < jsonData.length; i += batchSize) {
        const chunk = jsonData.slice(i, i + batchSize);
        const batch = writeBatch(db);
        let batchCount = 0;

        for (let j = 0; j < chunk.length; j++) {
          const row = chunk[j];
          const rowIndex = i + j + 2; // +2 for header row and 1-based index

          // Flexible header matching
          const displayName = findValue(row, ["Nama Lengkap", "Nama", "Full Name", "Name"])?.toString().trim();
          const nisn = findValue(row, ["NISN", "ID Siswa", "Student ID"])?.toString().trim();
          const email = findValue(row, ["Email", "Surel"])?.toString().trim();
          const className = findValue(row, ["Kelas", "Class"])?.toString().trim();
          const phone = findValue(row, ["WA Siswa", "WhatsApp Siswa", "No HP", "Phone"])?.toString().trim();
          const parentPhone = findValue(row, ["WA Orang Tua", "WhatsApp Orang Tua", "WA Ortu", "Parent Phone"])?.toString().trim();

          // Validation: Name is mandatory
          if (!displayName) {
            failCount++;
            failures.push(`Baris ${rowIndex}: Nama Lengkap kosong`);
            continue;
          }

          // Generate deterministic ID or random if no NISN
          const docId = `imported_${profile.orgId}_${nisn || Math.random().toString(36).substring(7)}`;
          const userRef = doc(db, 'users', docId);

          batch.set(userRef, {
            displayName,
            nisn: nisn || "",
            email: email || `${nisn || Math.random().toString(36).substring(7)}@no-email.edu`,
            className: className || "",
            phone: phone || "",
            parentPhone: parentPhone || "",
            orgId: profile.orgId,
            role: 'member',
            isImported: true,
            createdAt: serverTimestamp()
          }, { merge: true });
          
          successCount++;
          batchCount++;
        }

        if (batchCount > 0) {
          await batch.commit();
        }
      }

      // Final Report
      let report = `Impor Selesai!\n`;
      report += `-------------------\n`;
      report += `Total Baris: ${jsonData.length}\n`;
      report += `Berhasil: ${successCount}\n`;
      report += `Gagal: ${failCount}\n`;
      
      if (failures.length > 0) {
        report += `\nDetail Kegagalan (10 pertama):\n`;
        report += failures.slice(0, 10).join('\n');
        if (failures.length > 10) report += `\n...dan ${failures.length - 10} lainnya`;
      }

      alert(report);
    } catch (err) {
      console.error("Import error detail:", err);
      // Kolom template tidak dikenali check
      if (err.message && err.message.includes("Cannot find any sheet")) {
        alert("Format Excel rusak: Kolom template tidak dikenali atau lembar kerja tidak terbaca.");
      } else {
        alert("Gagal memproses file Excel: " + err.message);
      }
    } finally {
      setIsImporting(false);
      e.target.value = ""; 
    }
  };
  
  // Modal states
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
    variant: 'danger',
    confirmText: 'Konfirmasi'
  });

  useEffect(() => {
    if (!profile?.orgId) return;

    const q = query(
      collection(db, 'users'),
      where('orgId', '==', profile.orgId),
      limit(50)
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
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.orgId]);

  const updateUserRole = async (member, newRole) => {
    if (member.uid === profile.uid) {
      alert("Anda tidak bisa mengubah peran Anda sendiri.");
      return;
    }

    const isPromotingToAdmin = newRole === 'admin';
    
    setConfirmModal({
      isOpen: true,
      title: isPromotingToAdmin ? 'Promosi Administrator' : 'Ubah Peran Anggota',
      description: isPromotingToAdmin 
        ? `Apakah Bapak/Ibu yakin ingin memberikan hak akses ADMINISTRATOR kepada ${member.displayName}? Admin baru akan memiliki kontrol penuh terhadap seluruh data keuangan organisasi.`
        : `Ubah peran ${member.displayName} menjadi ${newRole.toUpperCase()}?`,
      variant: isPromotingToAdmin ? 'danger' : 'indigo',
      confirmText: 'Ubah Peran',
      onConfirm: async () => {
        setUpdatingId(member.id);
        try {
          const batch = writeBatch(db);
          const userRef = doc(db, 'users', member.id);
          
          batch.update(userRef, { role: newRole });
          
          const logRef = doc(collection(db, 'organizations', profile.orgId, 'activity_logs'));
          batch.set(logRef, {
            actorId: profile.uid,
            actorName: profile.displayName,
            targetUserId: member.uid,
            targetUserName: member.displayName,
            action: 'role_change',
            oldRole: member.role,
            newRole: newRole,
            orgId: profile.orgId,
            timestamp: serverTimestamp()
          });

          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${member.id}`);
          alert("Gagal mengubah peran: Akses ditolak.");
        } finally {
          setUpdatingId(null);
        }
      }
    });
  };

  const removeMember = async (member) => {
    if (member.uid === profile.uid) {
      alert("Anda tidak bisa mengeluarkan diri Anda sendiri.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Keluarkan Anggota',
      description: `PERINGATAN: Apakah Bapak/Ibu yakin ingin mengeluarkan ${member.displayName} dari sistem sekolah? Akses keuangan orang ini akan dicabut seketika dan mereka tidak lagi bisa melihat laporan.`,
      variant: 'danger',
      confirmText: 'Keluarkan Sekarang',
      onConfirm: async () => {
        setUpdatingId(member.id);
        try {
          const batch = writeBatch(db);
          const userRef = doc(db, 'users', member.id);
          
          batch.update(userRef, { 
            orgId: null,
            role: 'member'
          });

          const logRef = doc(collection(db, 'organizations', profile.orgId, 'activity_logs'));
          batch.set(logRef, {
            actorId: profile.uid,
            actorName: profile.displayName,
            targetUserId: member.uid,
            targetUserName: member.displayName,
            action: 'remove',
            oldRole: member.role,
            orgId: profile.orgId,
            timestamp: serverTimestamp()
          });

          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${member.id}`);
          alert("Gagal mengeluarkan anggota.");
        } finally {
          setUpdatingId(null);
        }
      }
    });
  };

  const isAdmin = profile?.role === 'admin';
  const classes = ['Semua Kelas', ...new Set(members.map(m => m.className || 'Tanpa Kelas'))].sort();

  const filteredMembers = members.filter(m => {
    // Role based filtering for Teacher (Wali Kelas)
    if (profile?.role === 'teacher' && m.className !== profile?.className) return false;

    const matchesSearch = m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.nisn?.includes(searchTerm);
    const matchesClass = selectedClass === 'Semua Kelas' || m.className === selectedClass;
    return matchesSearch && matchesClass;
  });

  const handleSaveMember = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updates = {
      className: formData.get('className') || null,
      nisn: formData.get('nisn') || null,
      parentPhone: formData.get('parentPhone') || null,
      phone: formData.get('phone') || null,
      displayName: formData.get('displayName'),
      role: formData.get('role'),
      assignedGrade: formData.get('assignedGrade') || null,
      email: formData.get('email')
    };

    // Form Validation
    if (!updates.displayName || !updates.email) {
      return alert("Nama Lengkap dan Email wajib diisi!");
    }

    setUpdatingId(editingMember?.id || 'new');
    try {
      if (editingMember) {
        // Update Existing
        await updateDoc(doc(db, 'users', editingMember.id), updates);
      } else {
        // Create New
        // Use a deterministic ID based on Org and Email to avoid duplicates before auth
        const docId = `manual_${profile.orgId}_${updates.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        await setDoc(doc(db, 'users', docId), {
          ...updates,
          orgId: profile.orgId,
          orgName: profile.orgName,
          savingsBalance: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isManualCreated: true
        }, { merge: true });
        alert("Akun berhasil didaftarkan. Staf bisa login menggunakan email tersebut.");
      }
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Save failed:", err);
      alert("Gagal menyimpan data: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (!profile?.orgId) {
    return (
      <div className="p-12 text-center bg-white rounded-[3rem] border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 leading-tight">Akses Terbatas</h2>
        <p className="mt-2 text-slate-500 font-medium max-w-xs mx-auto">Silahkan buat atau gabung organisasi untuk mengelola anggota.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Anggota Komunitas</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Keamanan Tingkat Tinggi Aktif
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {isAdmin && (
            <Button 
              className="rounded-2xl shadow-lg shadow-indigo-200 h-full px-6"
              onClick={() => {
                setEditingMember(null);
                setEditingRole('member');
                setIsEditModalOpen(true);
              }}
            >
              <Users className="w-4 h-4 mr-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">Akun Baru</span>
            </Button>
          )}
          {(isAdmin || profile?.role === 'treasurer') && (
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={downloadTemplate}
                className="rounded-2xl border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm whitespace-nowrap h-full px-4"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="text-[10px] font-black uppercase tracking-widest">Unduh Format</span>
              </Button>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleImportExcel} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  title="Impor Excel" 
                  disabled={isImporting}
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  isLoading={isImporting}
                  className="rounded-2xl border-indigo-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shadow-sm whitespace-nowrap h-full px-4 w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Impor Excel</span>
                </Button>
              </div>
            </div>
          )}
          <select 
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 outline-none min-w-[140px] shadow-sm"
          >
            {classes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari Nama / NISN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 outline-none w-full sm:min-w-[240px] shadow-sm"
            />
          </div>
          <div className="px-5 py-3 bg-slate-900 text-white rounded-2xl flex items-center gap-3 shadow-lg shadow-slate-200">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-black uppercase tracking-widest">{filteredMembers.length} Siswa</span>
          </div>
        </div>
      </header>

      {/* Table for Desktop, Cards for Mobile */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-0 overflow-hidden border-slate-200 shadow-sm transition-all hover:shadow-md">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Data Siswa</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">NISN & Kelas</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Jabatan</th>
                  {(isAdmin || profile?.role === 'treasurer') && <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Opsi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-2xl" />
                          <div className="space-y-2">
                             <div className="h-3 w-32 bg-slate-100 rounded" />
                             <div className="h-2 w-20 bg-slate-50 rounded" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3} className="px-8 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <Users className="w-8 h-8 text-slate-300" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tidak ada anggota yang cocok</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredMembers.map((member) => (
                  <tr key={member.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img 
                            src={member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}`} 
                            alt="" 
                            className="w-10 h-10 rounded-2xl border border-slate-200 object-cover shadow-sm" 
                          />
                          {member.uid === profile.uid && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white flex items-center justify-center">
                              <ShieldCheck className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{member.displayName}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">{member.className || 'Belum Diatur'}</span>
                        <span className="text-sm font-bold text-slate-700 tracking-tight">{member.nisn ? `NISN: ${member.nisn}` : '-'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2.5">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
                          member.role === 'admin' ? "bg-rose-50 text-rose-600 border-rose-100" : 
                          member.role === 'treasurer' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                          member.role === 'staff' ? "bg-purple-50 text-purple-600 border-purple-100" :
                          member.role === 'class_treasurer' ? "bg-sky-50 text-sky-600 border-sky-100" :
                          "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {member.role === 'admin' ? 'Kepala Sekolah' : 
                           member.role === 'treasurer' ? 'Bendahara Sekolah' : 
                           member.role === 'staff' ? `TU Tingkat ${member.assignedGrade || ''}` :
                           member.role === 'class_treasurer' ? `Bendahara Kelas ${member.className || ''}` : 'Siswa'}
                        </span>
                      </div>
                    </td>
                    {(isAdmin || profile?.role === 'treasurer') && (
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            disabled={updatingId === member.id}
                            onClick={() => { setEditingMember(member); setEditingRole(member.role || 'member'); setIsEditModalOpen(true); }}
                            className="rounded-xl bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 h-10 px-4"
                          >
                            Edit Data & Jabatan
                          </Button>
                          {isAdmin && member.uid !== profile.uid && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={updatingId === member.id}
                              onClick={() => removeMember(member)}
                              className="rounded-xl bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 w-10 h-10 p-0"
                            >
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Layout (Cards) */}
          <div className="md:hidden grid grid-cols-1 divide-y divide-slate-100">
             {loading ? (
               [...Array(3)].map((_, i) => (
                 <div key={i} className="p-6 animate-pulse space-y-4">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
                      <div className="space-y-2">
                        <div className="h-3 w-40 bg-slate-100 rounded" />
                        <div className="h-2 w-24 bg-slate-50 rounded" />
                      </div>
                   </div>
                 </div>
               ))
             ) : filteredMembers.map((member) => (
               <div key={member.id} className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img 
                        src={member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}`} 
                        alt="" 
                        className="w-12 h-12 rounded-2xl border border-slate-200 shadow-sm" 
                      />
                      <div>
                        <p className="text-sm font-black text-slate-900">{member.displayName}</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{member.role}</p>
                      </div>
                    </div>
                    {member.uid === profile?.uid && (
                      <span className="text-[8px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">You</span>
                    )}
                  </div>
                  
                  {isAdmin && member.uid !== profile?.uid && (
                    <div className="flex gap-2 pt-2">
                      <select 
                        disabled={updatingId === member.id}
                        value={member.role}
                        onChange={(e) => updateUserRole(member, e.target.value)}
                        className="flex-1 text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-xl px-4 py-3 outline-none shadow-sm"
                      >
                        <option value="member">Member</option>
                        <option value="treasurer">Treasurer</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        disabled={updatingId === member.id}
                        onClick={() => removeMember(member)}
                        className="rounded-xl bg-orange-50 text-orange-600 border border-orange-100 px-4"
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
               </div>
             ))}
          </div>
        </Card>
      </div>

      {/* Role Guide Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Glosarium Peran" className="lg:col-span-2 shadow-sm border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-200">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Admin Utama</h5>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Kontrol penuh akses user, pengelolaan organisasi, dan otorisasi finansial absolut.</p>
                </div>
              </div>
              <div className="flex gap-4 pt-2">
                <div className="w-12 h-12 rounded-[1.25rem] bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-100">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight">Bendahara</h5>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">Fokus pada arus kas, tabungan, dan integritas data transaksi harian.</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 relative overflow-hidden group">
               <div className="relative z-10">
                 <AlertCircle className="w-6 h-6 text-slate-400 mb-3" />
                 <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Peringatan Keamanan</h6>
                 <p className="text-xs text-slate-600 mt-2 leading-relaxed">Setiap perubahan peran direkam secara permanen dalam audit log untuk mencegah penyalahgunaan sistem.</p>
               </div>
               <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/50 rounded-full blur-2xl transition-transform group-hover:scale-150" />
            </div>
          </div>
        </Card>

        <Card title="Aturan Sistem" variant="dark">
           <div className="space-y-4 mt-2">
             <div className="flex items-start gap-3">
               <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-400 shrink-0" />
               <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest leading-loose">Admin tidak bisa mengubah profil sendiri</p>
             </div>
             <div className="flex items-start gap-3">
               <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-400 shrink-0" />
               <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest leading-loose">Hanya Admin yang punya akses menu ini</p>
             </div>
             <div className="flex items-start gap-3">
               <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-400 shrink-0" />
               <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest leading-loose">Audit Log tidak bisa dihapus user</p>
             </div>
             <div className="flex items-start gap-3">
               <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-400 shrink-0" />
               <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest leading-loose">Remove member bersifat permanen</p>
             </div>
           </div>
        </Card>
      </div>

      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsEditModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="z-[110] bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative border border-slate-200">
              <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tighter">
                {editingMember ? 'Edit Profil Anggota' : 'Daftarkan Akun Baru'}
              </h2>
              <form onSubmit={handleSaveMember} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block tracking-widest">Nama Lengkap</label>
                  <input name="displayName" defaultValue={editingMember?.displayName} required className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block tracking-widest">Email (Login UID)</label>
                  <input name="email" type="email" defaultValue={editingMember?.email} required className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block tracking-widest">Kelas</label>
                    <input name="className" defaultValue={editingMember?.className} placeholder="Contoh: 7A" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-center" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block tracking-widest">NISN</label>
                    <input name="nisn" defaultValue={editingMember?.nisn} placeholder="10 Digit" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold text-center" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block tracking-widest">Jabatan Sistem</label>
                    <select 
                      name="role" 
                      defaultValue={editingMember?.role} 
                      onChange={(e) => setEditingRole(e.target.value)}
                      className="w-full px-5 py-3 bg-slate-100 border border-slate-200 rounded-2xl outline-none font-bold text-xs"
                    >
                      <option value="member">Siswa</option>
                      <option value="class_treasurer">Bendahara Kelas</option>
                      <option value="staff">Tata Usaha (TU)</option>
                      <option value="treasurer">Bendahara Sekolah</option>
                      <option value="admin">Kepala Sekolah (Admin)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block tracking-widest">Tugas Khusus</label>
                    {editingRole === 'staff' ? (
                      <select name="assignedGrade" defaultValue={editingMember?.assignedGrade} className="w-full px-5 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl outline-none font-bold text-xs text-indigo-600">
                        <option value="">Status TU</option>
                        <option value="7">Tingkat 7</option>
                        <option value="8">Tingkat 8</option>
                        <option value="9">Tingkat 9</option>
                      </select>
                    ) : (
                      <div className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-400 flex items-center justify-center">
                        None
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block tracking-widest">WA Siswa</label>
                    <input name="phone" defaultValue={editingMember?.phone} placeholder="628..." className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block tracking-widest">WA Orang Tua</label>
                    <input name="parentPhone" defaultValue={editingMember?.parentPhone} placeholder="628..." className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-600 outline-none font-bold" />
                  </div>
                </div>
                
                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="ghost" className="flex-1" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
                  <Button type="submit" variant="brand" className="flex-1" isLoading={!!updatingId}>
                    {editingMember ? 'Simpan Perubahan' : 'Daftarkan Sekarang'}
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
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
      />
    </div>
  );
}
