import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  Settings,
  Users,
  Search,
  Printer,
  Edit3,
  Lock,
  ShieldCheck,
  UserCheck,
  RotateCcw,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Save,
  Bot,
  Sparkles,
} from 'lucide-react';
import {
  Transaction,
  StoreSettings,
  UserAccount,
  UserRole,
} from '../types';
import { formatRupiah, formatDateTime } from '../data/initialData';
import {
  springSnappy,
  springSoft,
  tapScale,
  hoverLift,
  pageVariants,
} from '../lib/motion';

interface ReceiptsSettingsViewProps {
  transactions: Transaction[];
  settings: StoreSettings;
  users: UserAccount[];
  currentUser: UserAccount;
  onSelectTransaction: (trx: Transaction) => void;
  onUpdateSettings: (newSettings: StoreSettings) => void;
  onSaveUser: (user: UserAccount) => void;
  onDeleteUser: (id: string) => void;
  onResetDemoData: () => void;
  onAskAi?: (prompt?: string) => void;
}

export const ReceiptsSettingsView: React.FC<ReceiptsSettingsViewProps> = ({
  transactions,
  settings,
  users,
  currentUser,
  onSelectTransaction,
  onUpdateSettings,
  onSaveUser,
  onDeleteUser,
  onResetDemoData,
  onAskAi,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [subTab, setSubTab] = useState<'receipts' | 'template' | 'accounts'>(
    'receipts'
  );
  const [searchTrx, setSearchTrx] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);

  // User form state for Admin
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('cashier');
  const [newShift, setNewShift] = useState('Shift Reguler');

  // Edit existing user PIN/profile state for Admin
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPin, setEditUserPin] = useState('');
  const [editUserShift, setEditUserShift] = useState('');
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  const toggleRevealPin = (userId: string) => {
    setRevealedPins((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const startEditUser = (u: UserAccount) => {
    setEditingUserId(u.id);
    setEditUserName(u.name);
    setEditUserPin(u.pin);
    setEditUserShift(u.shift);
  };

  const handleSaveEditUser = (u: UserAccount) => {
    const cleanPin = editUserPin.replace(/\D/g, '');
    if (!editUserName.trim() || cleanPin.length < 4) return;
    onSaveUser({
      ...u,
      name: editUserName.trim(),
      pin: cleanPin,
      shift: editUserShift.trim() || u.shift,
    });
    setEditingUserId(null);
  };

  const filteredTrx = transactions.filter(
    (t) =>
      t.receiptNumber.toLowerCase().includes(searchTrx.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchTrx.toLowerCase()) ||
      t.cashierName.toLowerCase().includes(searchTrx.toLowerCase())
  );

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newName.trim() || !newPin.trim()) return;
    onSaveUser({
      id: `usr-${Date.now()}`,
      name: newName.trim(),
      username: newUsername.trim() || newName.toLowerCase().replace(/\s+/g, ''),
      pin: newPin.trim(),
      role: newRole,
      shift: newShift,
      avatarColor:
        newRole === 'admin'
          ? 'from-amber-500 to-orange-600'
          : 'from-emerald-500 to-teal-600',
      active: true,
    });
    setNewName('');
    setNewUsername('');
    setNewPin('');
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/80 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              {
                id: 'receipts' as const,
                label: `Daftar Struk Transaksi (${transactions.length})`,
                icon: Receipt,
                locked: false,
              },
              {
                id: 'template' as const,
                label: 'Desain & Pengaturan Struk',
                icon: Settings,
                locked: !isAdmin,
              },
              {
                id: 'accounts' as const,
                label: 'Akun Admin & Kasir (Client)',
                icon: Users,
                locked: !isAdmin,
              },
            ]
          ).map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileTap={tapScale}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`relative rounded-2xl px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 transition ${
                  active
                    ? 'text-slate-950'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="receiptsSubTabPill"
                    transition={springSnappy}
                    className="absolute inset-0 rounded-2xl bg-amber-500 shadow"
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{tab.label}</span>
                {tab.locked && (
                  <Lock
                    className={`relative z-10 h-3.5 w-3.5 ${
                      active ? 'text-slate-950' : 'text-amber-400'
                    }`}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {onAskAi && (
            <motion.button
              whileHover={hoverLift}
              whileTap={tapScale}
              type="button"
              onClick={() =>
                onAskAi('Bagaimana cara koreksi struk dan ubah pajak PB1 / Wi-Fi?')
              }
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 text-xs font-extrabold text-amber-300 flex items-center gap-1.5 transition"
            >
              <Bot className="h-4 w-4 text-amber-400" />
              <span>Tanya AI Struk</span>
              <Sparkles className="h-3 w-3 text-amber-400" />
            </motion.button>
          )}

          {isAdmin && (
            <motion.button
              whileTap={tapScale}
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Reset seluruh data ke data awal demo KopiNusa POS?'
                  )
                ) {
                  onResetDemoData();
                }
              }}
              className="rounded-2xl border border-slate-700 bg-slate-800 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300 px-3.5 py-2 text-xs font-bold text-slate-300 flex items-center gap-1.5 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Data Demo</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Animated Sub-Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={subTab}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex-1 flex flex-col overflow-hidden"
        >
          {/* Sub-Tab 1: Receipt List */}
          {subTab === 'receipts' && (
            <div className="flex-1 flex flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTrx}
                    onChange={(e) => setSearchTrx(e.target.value)}
                    placeholder="Cari nomor struk (INV-...), nama pelanggan, atau kasir..."
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="text-xs text-slate-400">
                  {isAdmin ? (
                    <span className="text-emerald-400 font-semibold">
                      ✓ Mode Admin: Klik struk untuk mencetak atau mengedit isi struk
                    </span>
                  ) : (
                    <span className="text-amber-300 font-semibold">
                      🔒 Mode Kasir: Hanya bisa lihat & cetak ulang struk (Edit dikunci)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-900/95 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">No. Struk</th>
                      <th className="py-3 px-3">Waktu</th>
                      <th className="py-3 px-3">Pelanggan & Meja</th>
                      <th className="py-3 px-3">Kasir</th>
                      <th className="py-3 px-3">Metode</th>
                      <th className="py-3 px-3 text-right">Total Struk</th>
                      <th className="py-3 px-4 text-right">Aksi Struk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    <AnimatePresence initial={false}>
                      {filteredTrx.map((trx) => (
                        <motion.tr
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={springSoft}
                          key={trx.id}
                          className="hover:bg-slate-900/60 transition cursor-pointer"
                          onClick={() => onSelectTransaction(trx)}
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                            {trx.receiptNumber}
                            {trx.status === 'Edited' && (
                              <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-sans text-amber-300">
                                Dikoreksi
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-400">
                            {formatDateTime(trx.createdAt)}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-white">{trx.customerName}</div>
                            <div className="text-[11px] text-slate-400">
                              {trx.orderType}{' '}
                              {trx.orderType === 'Dine-In' ? `• ${trx.tableNumber}` : ''}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-slate-300">
                            {trx.cashierName.split(' (')[0]}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                              {trx.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-sm text-emerald-400 tabular-nums">
                            {formatRupiah(trx.totalAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <motion.button
                              whileTap={tapScale}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTransaction(trx);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 transition"
                            >
                              {isAdmin ? (
                                <>
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>Cetak / Edit</span>
                                </>
                              ) : (
                                <>
                                  <Printer className="h-3.5 w-3.5" />
                                  <span>Cetak Struk</span>
                                </>
                              )}
                            </motion.button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          )}

      {/* Sub-Tab 2: Receipt Template & Store Settings */}
      {subTab === 'template' && (
        <div className="flex-1 overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          {!isAdmin ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="h-16 w-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <Lock className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-extrabold text-white">
                Pengaturan Struk Dikunci untuk Mode Client (Kasir)
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed">
                Karyawan pada Mode Client tidak diizinkan mengubah nama kafe, persentase pajak PB1, maupun format cetakan struk. Silakan masuk ke <strong>Sesi Server (Admin)</strong> menggunakan PIN rahasia Admin untuk membuka pengaturan ini.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Kustomisasi Format & Informasi Struk Kasir
                  </h3>
                  <p className="text-slate-400">
                    Semua perubahan otomatis diterapkan pada struk transaksi berikutnya maupun saat cetak ulang.
                  </p>
                </div>
                {savedBanner && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-emerald-300 font-bold">
                    <CheckCircle2 className="h-4 w-4" /> Tersimpan Otomatis
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Nama Kafe / Toko di Kepala Struk
                  </label>
                  <input
                    type="text"
                    value={settings.storeName}
                    onChange={(e) => {
                      onUpdateSettings({ ...settings, storeName: e.target.value });
                      setSavedBanner(true);
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Slogan / Subjudul Struk
                  </label>
                  <input
                    type="text"
                    value={settings.tagline}
                    onChange={(e) => {
                      onUpdateSettings({ ...settings, tagline: e.target.value });
                      setSavedBanner(true);
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">
                    Alamat Lengkap Kafe
                  </label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, address: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, phone: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Pajak Resto / PB1 (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={settings.taxPercent}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        taxPercent: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Service Charge (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={settings.servicePercent}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        servicePercent: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Nama Wi-Fi di Struk
                  </label>
                  <input
                    type="text"
                    value={settings.wifiName}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, wifiName: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Password Wi-Fi di Struk
                  </label>
                  <input
                    type="text"
                    value={settings.wifiPassword}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        wifiPassword: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Pesan Sambutan Atas Struk
                  </label>
                  <input
                    type="text"
                    value={settings.receiptHeaderNote}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        receiptHeaderNote: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Catatan Kaki (Footer) Struk
                  </label>
                  <input
                    type="text"
                    value={settings.receiptFooterNote}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        receiptFooterNote: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="font-bold text-white">
                  Opsi Tampilan Struk & Izin Karyawan
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showWifiOnReceipt}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        showWifiOnReceipt: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span className="text-slate-300">
                    Tampilkan Kotak Info Wi-Fi Gratis pada Struk Pelanggan
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowCashierAddExpense}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        allowCashierAddExpense: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span className="text-slate-300">
                    Izinkan Kasir Menginput Catatan Kas Keluar Baru (Tetap Tidak Bisa Edit/Hapus Catatan yang Sudah Ada)
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: Server Admin PIN & Client Mode Management */}
      {subTab === 'accounts' && (
        <div className="flex-1 overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          {!isAdmin ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="h-16 w-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <Lock className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-extrabold text-white">
                Pengaturan PIN Server Hanya untuk Admin
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-2">
                Sesi Client (Karyawan) berjalan tanpa PIN dan tidak dapat mengubah PIN Server Admin.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-4 text-xs">
              <div className="mb-2">
                <h3 className="text-sm font-extrabold text-white">
                  Pengaturan Sesi: Server (Admin) & Client (Karyawan)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Hanya ada 2 mode sesi: <strong>Client (Karyawan)</strong> masuk langsung tanpa PIN, sedangkan <strong>Server (Admin)</strong> wajib menggunakan PIN rahasia yang bisa Anda ubah di bawah ini.
                </p>
              </div>

              {users.map((u) => {
                const isEditingThis = editingUserId === u.id;
                const isRevealed = !!revealedPins[u.id];
                const isUserAdmin = u.role === 'admin';
                return (
                  <div
                    key={u.id}
                    className={`rounded-2xl border p-4 transition ${
                      isEditingThis
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-800 bg-slate-950/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${u.avatarColor} flex items-center justify-center text-white font-bold text-base shrink-0`}
                        >
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <span>{u.name}</span>
                            {u.id === currentUser.id && (
                              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                Sesi Aktif
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {isUserAdmin ? (
                              <>
                                <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                  <ShieldCheck className="h-3 w-3" /> SERVER ADMIN (WAJIB PIN)
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-300 font-mono">
                                  <span>
                                    PIN: {isRevealed ? u.pin : '•'.repeat(u.pin.length || 4)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealPin(u.id)}
                                    className="text-slate-400 hover:text-amber-300"
                                    title={isRevealed ? 'Sembunyikan PIN' : 'Lihat PIN'}
                                  >
                                    {isRevealed ? (
                                      <EyeOff className="h-3.5 w-3.5" />
                                    ) : (
                                      <Eye className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </span>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                                <UserCheck className="h-3 w-3" /> CLIENT KARYAWAN (TANPA PIN • LANGSUNG MASUK)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isUserAdmin && (
                        <button
                          type="button"
                          onClick={() =>
                            isEditingThis ? setEditingUserId(null) : startEditUser(u)
                          }
                          className="rounded-xl bg-amber-500/15 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/30 px-3.5 py-2 text-xs font-extrabold text-amber-300 flex items-center gap-1.5 transition"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span>{isEditingThis ? 'Batal' : 'Ubah PIN Admin'}</span>
                        </button>
                      )}
                    </div>

                    {isEditingThis && isUserAdmin && (
                      <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Nama Sesi Admin
                          </label>
                          <input
                            type="text"
                            value={editUserName}
                            onChange={(e) => setEditUserName(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] text-amber-300 font-bold mb-1">
                            PIN Admin Baru (4-6 Angka)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={editUserPin}
                            onChange={(e) =>
                              setEditUserPin(e.target.value.replace(/\D/g, ''))
                            }
                            className="w-full rounded-xl border border-amber-500/50 bg-slate-900 px-3 py-2 text-amber-400 font-mono font-bold tracking-widest"
                          />
                        </div>
                        <div className="sm:col-span-3 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEditUser(u)}
                            className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2 px-3 font-extrabold text-slate-950 flex items-center justify-center gap-1 transition"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span>Simpan PIN</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
