import React, { useState } from 'react';
import {
  Receipt,
  Settings,
  Users,
  Search,
  Printer,
  Edit3,
  Lock,
  Plus,
  Trash2,
  ShieldCheck,
  UserCheck,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  Transaction,
  StoreSettings,
  UserAccount,
  UserRole,
} from '../types';
import { formatRupiah, formatDateTime } from '../data/initialData';

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('receipts')}
            className={`rounded-2xl px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 transition ${
              subTab === 'receipts'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="h-4 w-4" />
            <span>Daftar Struk Transaksi ({transactions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('template')}
            className={`rounded-2xl px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 transition ${
              subTab === 'template'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Desain & Pengaturan Struk</span>
            {!isAdmin && <Lock className="h-3.5 w-3.5 text-amber-400" />}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('accounts')}
            className={`rounded-2xl px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 transition ${
              subTab === 'accounts'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Akun Admin & Kasir (Client)</span>
            {!isAdmin && <Lock className="h-3.5 w-3.5 text-amber-400" />}
          </button>
        </div>

        {isAdmin && (
          <button
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
          </button>
        )}
      </div>

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
              <thead className="sticky top-0 bg-slate-900/95 text-slate-400 border-b border-slate-800">
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
                {filteredTrx.map((trx) => (
                  <tr
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
                    <td className="py-3.5 px-3 text-right font-extrabold text-sm text-emerald-400">
                      {formatRupiah(trx.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
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
                      </button>
                    </td>
                  </tr>
                ))}
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
                Pengaturan Struk Dikunci untuk Akun Kasir
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed">
                Karyawan / Kasir tidak diizinkan mengubah nama kafe, persentase pajak PB1, maupun format cetakan struk. Silakan klik tombol <strong>Ganti Shift / Akun</strong> di pojok kiri bawah dan masuk sebagai <strong>Admin (PIN: 1234)</strong>.
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

      {/* Sub-Tab 3: User Accounts Management */}
      {subTab === 'accounts' && (
        <div className="flex-1 overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          {!isAdmin ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="h-16 w-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <Lock className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-extrabold text-white">
                Manajemen Akun Hanya untuk Admin
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-2">
                Akun Kasir / Karyawan tidak dapat melihat PIN akun lain atau mengubah hak akses.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              <div className="lg:col-span-7 space-y-3">
                <h3 className="text-sm font-extrabold text-white mb-2">
                  Daftar Akun Terdaftar
                </h3>
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${u.avatarColor} flex items-center justify-center text-white font-bold text-base`}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{u.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              <ShieldCheck className="h-3 w-3" /> ADMIN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                              <UserCheck className="h-3 w-3" /> KASIR / CLIENT
                            </span>
                          )}
                          <span className="text-slate-400">PIN: {u.pin}</span>
                          <span className="text-slate-500">• {u.shift}</span>
                        </div>
                      </div>
                    </div>

                    {users.length > 1 && u.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() => onDeleteUser(u.id)}
                        className="rounded-xl bg-rose-500/15 hover:bg-rose-500/30 p-2 text-rose-300 transition"
                        title="Hapus Akun"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleAddUser}
                className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 space-y-3 h-fit"
              >
                <h3 className="text-sm font-extrabold text-white">
                  Tambah Akun Kasir / Admin Baru
                </h3>
                <div>
                  <label className="block text-slate-400 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Rina (Kasir Siang)"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Peran Akses</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    >
                      <option value="cashier">Kasir / Client (Terbatas)</option>
                      <option value="admin">Admin (Full Edit)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">PIN Login (4 Digit)</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Contoh: 2222"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-amber-400 font-mono font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Jadwal Shift</label>
                  <input
                    type="text"
                    value={newShift}
                    onChange={(e) => setNewShift(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-amber-500 hover:bg-amber-400 py-3 font-extrabold text-slate-950 flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Simpan Akun Baru</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
