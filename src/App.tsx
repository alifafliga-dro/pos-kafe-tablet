import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coffee,
  LayoutGrid,
  PackageSearch,
  Wallet,
  Receipt,
  ShieldCheck,
  UserCheck,
  KeyRound,
  Bell,
  Sparkles,
} from 'lucide-react';
import {
  UserAccount,
  MenuItem,
  Transaction,
  CashflowRecord,
  StoreSettings,
} from './types';
import {
  INITIAL_USERS,
  INITIAL_MENU_ITEMS,
  INITIAL_TRANSACTIONS,
  INITIAL_CASHFLOW,
  INITIAL_STORE_SETTINGS,
  formatRupiah,
} from './data/initialData';
import { PosView } from './components/PosView';
import { InventoryView } from './components/InventoryView';
import { FinanceView } from './components/FinanceView';
import { ReceiptsSettingsView } from './components/ReceiptsSettingsView';
import { LoginModal } from './components/LoginModal';
import { ReceiptModal } from './components/ReceiptModal';

type ActiveTab = 'pos' | 'inventory' | 'finance' | 'receipts';

const STORAGE_KEYS = {
  users: 'kopinusa_users_v1',
  menu: 'kopinusa_menu_v1',
  transactions: 'kopinusa_trx_v1',
  cashflow: 'kopinusa_cashflow_v1',
  settings: 'kopinusa_settings_v1',
  currentUser: 'kopinusa_current_user_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function App() {
  const [users, setUsers] = useState<UserAccount[]>(() =>
    loadFromStorage(STORAGE_KEYS.users, INITIAL_USERS)
  );
  const [currentUser, setCurrentUser] = useState<UserAccount>(() =>
    loadFromStorage(STORAGE_KEYS.currentUser, INITIAL_USERS[0])
  );
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.menu, INITIAL_MENU_ITEMS)
  );
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    loadFromStorage(STORAGE_KEYS.transactions, INITIAL_TRANSACTIONS)
  );
  const [cashflow, setCashflow] = useState<CashflowRecord[]>(() =>
    loadFromStorage(STORAGE_KEYS.cashflow, INITIAL_CASHFLOW)
  );
  const [settings, setSettings] = useState<StoreSettings[]>(() => [
    loadFromStorage(STORAGE_KEYS.settings, INITIAL_STORE_SETTINGS),
  ]);
  const storeSettings = settings[0];

  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Transaction | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [clock, setClock] = useState<string>('');

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.menu, JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cashflow, JSON.stringify(cashflow));
  }, [cashflow]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(storeSettings));
  }, [storeSettings]);

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock(
        new Intl.DateTimeFormat('id-ID', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }).format(now)
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Handlers
  const handleCompleteOrder = (trx: Transaction) => {
    // Deduct stock automatically
    setMenuItems((prev) =>
      prev.map((item) => {
        const orderedQty = trx.items
          .filter((ci) => ci.menuItemId === item.id)
          .reduce((sum, ci) => sum + ci.quantity, 0);
        if (orderedQty === 0) return item;
        const nextStock = Math.max(0, item.stock - orderedQty);
        return {
          ...item,
          stock: nextStock,
          isAvailable: nextStock > 0 ? item.isAvailable : false,
        };
      })
    );

    setTransactions((prev) => [trx, ...prev]);
    setSelectedReceipt(trx);
    showToast(
      `Transaksi ${trx.receiptNumber} (${formatRupiah(trx.totalAmount)}) berhasil disimpan!`
    );
  };

  const handleUpdateTransaction = (updated: Transaction) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    setSelectedReceipt(updated);
    showToast(`Struk ${updated.receiptNumber} berhasil diperbarui oleh Admin.`);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    showToast('Struk transaksi telah dihapus oleh Admin.');
  };

  const handleSaveMenuItem = (item: MenuItem) => {
    setMenuItems((prev) => {
      const exists = prev.some((m) => m.id === item.id);
      if (exists) {
        return prev.map((m) => (m.id === item.id ? item : m));
      }
      return [item, ...prev];
    });
    showToast(`Data barang "${item.name}" berhasil disimpan.`);
  };

  const handleDeleteMenuItem = (id: string) => {
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
    showToast('Menu berhasil dihapus dari daftar.');
  };

  const handleQuickStockChange = (id: string, delta: number) => {
    setMenuItems((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const nextStock = Math.max(0, m.stock + delta);
        return {
          ...m,
          stock: nextStock,
          isAvailable: nextStock > 0 ? true : false,
        };
      })
    );
  };

  const handleToggleAvailability = (id: string) => {
    setMenuItems((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, isAvailable: !m.isAvailable } : m
      )
    );
  };

  const handleSaveCashflow = (record: CashflowRecord) => {
    setCashflow((prev) => {
      const exists = prev.some((c) => c.id === record.id);
      if (exists) {
        return prev.map((c) => (c.id === record.id ? record : c));
      }
      return [record, ...prev];
    });
    showToast(`Catatan arus kas "${record.title}" berhasil disimpan.`);
  };

  const handleDeleteCashflow = (id: string) => {
    setCashflow((prev) => prev.filter((c) => c.id !== id));
    showToast('Catatan arus kas dihapus.');
  };

  const handleUpdateSettings = (newSettings: StoreSettings) => {
    setSettings([newSettings]);
  };

  const handleSaveUser = (user: UserAccount) => {
    setUsers((prev) => [...prev, user]);
    showToast(`Akun "${user.name}" berhasil ditambahkan.`);
  };

  const handleDeleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    showToast('Akun pengguna berhasil dihapus.');
  };

  const handleResetDemoData = () => {
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setMenuItems(INITIAL_MENU_ITEMS);
    setTransactions(INITIAL_TRANSACTIONS);
    setCashflow(INITIAL_CASHFLOW);
    setSettings([INITIAL_STORE_SETTINGS]);
    showToast('Seluruh data berhasil dikembalikan ke data awal demo.');
  };

  const lowOrOutCount = menuItems.filter(
    (m) => !m.isAvailable || m.stock <= m.minStock
  ).length;

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col md:flex-row select-none">
      {/* Left Tablet Dock Navigation */}
      <aside className="w-full md:w-24 lg:w-64 shrink-0 border-b md:border-b-0 md:border-r border-slate-800/90 bg-slate-900/90 backdrop-blur-xl p-3 flex md:flex-col justify-between z-20">
        {/* Brand Logo */}
        <div>
          <div className="flex items-center justify-between md:justify-start gap-3 px-2 py-1.5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20">
                <Coffee className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div className="hidden lg:block">
                <h1 className="font-extrabold text-sm tracking-tight text-white leading-none">
                  KopiNusa <span className="text-amber-400">POS</span>
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tablet Smart Cashier
                </p>
              </div>
            </div>

            {/* Mobile/Compact Role Switch Button */}
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="md:hidden rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-amber-300 flex items-center gap-1.5"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>{isAdmin ? 'Admin' : 'Kasir'}</span>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="mt-2 md:mt-6 flex md:flex-col gap-1.5 overflow-x-auto">
            {(
              [
                {
                  id: 'pos',
                  label: 'Kasir & Order',
                  sub: 'Input Pesanan Meja',
                  icon: LayoutGrid,
                },
                {
                  id: 'inventory',
                  label: 'Stok & Barang',
                  sub: 'Cek Ketersediaan',
                  icon: PackageSearch,
                  badge: lowOrOutCount > 0 ? lowOrOutCount : undefined,
                },
                {
                  id: 'finance',
                  label: 'Omset & Kas',
                  sub: 'Pemasukan/Pengeluaran',
                  icon: Wallet,
                },
                {
                  id: 'receipts',
                  label: 'Struk & Akun',
                  sub: 'Edit Struk & Pengaturan',
                  icon: Receipt,
                },
              ] as const
            ).map((nav) => {
              const Icon = nav.icon;
              const active = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => setActiveTab(nav.id)}
                  className={`relative group flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition-all active:scale-95 ${
                    active
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-white font-semibold'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <div className="hidden lg:block min-w-0">
                    <div className="text-xs leading-tight truncate">
                      {nav.label}
                    </div>
                    <div
                      className={`text-[10px] truncate ${
                        active ? 'text-slate-900/80 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {nav.sub}
                    </div>
                  </div>
                  {'badge' in nav && nav.badge && (
                    <span
                      className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        active
                          ? 'bg-slate-950 text-amber-400'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {nav.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Active User & Quick Role Switcher */}
        <div className="hidden md:flex flex-col gap-2 pt-3 border-t border-slate-800">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-2.5">
            <div className="flex items-center gap-2.5">
              <div
                className={`h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br ${currentUser.avatarColor} flex items-center justify-center font-bold text-white text-sm`}
              >
                {currentUser.name.charAt(0)}
              </div>
              <div className="hidden lg:block min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {currentUser.name}
                </div>
                <div className="mt-0.5">
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                      <ShieldCheck className="h-3 w-3" /> ADMIN (Full Edit)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/30">
                      <UserCheck className="h-3 w-3" /> KASIR (No Edit)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="mt-2.5 w-full rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 py-2 px-2.5 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition"
            >
              <KeyRound className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden lg:inline">Ganti Akun / Shift</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Top Status Header */}
        <header className="shrink-0 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-white">
              {storeSettings.storeName}
            </span>
            <span className="hidden sm:inline-block text-xs text-slate-500">•</span>
            <span className="hidden sm:inline-block text-xs text-slate-400">
              {clock}
            </span>
          </div>

          {/* Instant Role Indicator & Quick Toggle Pill for Easy Testing */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950/90 p-1 text-xs">
              {users.slice(0, 2).map((u) => {
                const active = currentUser.id === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      if (currentUser.id !== u.id) {
                        setIsLoginModalOpen(true);
                      }
                    }}
                    className={`rounded-xl px-2.5 py-1 font-bold flex items-center gap-1 transition ${
                      active
                        ? u.role === 'admin'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-sky-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {u.role === 'admin' ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <UserCheck className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {u.role === 'admin' ? 'Mode Admin' : 'Mode Kasir (Client)'}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 flex items-center gap-1.5 transition"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>PIN / Akun</span>
            </button>
          </div>
        </header>

        {/* Active Workspace View */}
        <div className="flex-1 p-4 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              {activeTab === 'pos' && (
                <PosView
                  menuItems={menuItems}
                  settings={storeSettings}
                  currentUser={currentUser}
                  onCompleteOrder={handleCompleteOrder}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryView
                  menuItems={menuItems}
                  currentUser={currentUser}
                  onSaveItem={handleSaveMenuItem}
                  onDeleteItem={handleDeleteMenuItem}
                  onQuickStockChange={handleQuickStockChange}
                  onToggleAvailability={handleToggleAvailability}
                />
              )}

              {activeTab === 'finance' && (
                <FinanceView
                  transactions={transactions}
                  cashflow={cashflow}
                  currentUser={currentUser}
                  settings={storeSettings}
                  onSaveCashflow={handleSaveCashflow}
                  onDeleteCashflow={handleDeleteCashflow}
                  onSelectTransaction={(trx) => setSelectedReceipt(trx)}
                />
              )}

              {activeTab === 'receipts' && (
                <ReceiptsSettingsView
                  transactions={transactions}
                  settings={storeSettings}
                  users={users}
                  currentUser={currentUser}
                  onSelectTransaction={(trx) => setSelectedReceipt(trx)}
                  onUpdateSettings={handleUpdateSettings}
                  onSaveUser={handleSaveUser}
                  onDeleteUser={handleDeleteUser}
                  onResetDemoData={handleResetDemoData}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Login / Switch Account Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        currentUser={currentUser}
        onSelectUser={(user) => {
          setCurrentUser(user);
          showToast(
            `Berhasil beralih ke akun: ${user.name} (${
              user.role === 'admin' ? 'Akses Edit Penuh' : 'Mode Terbatas Kasir'
            })`
          );
        }}
      />

      {/* Receipt Preview & Editor Modal */}
      <ReceiptModal
        transaction={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        settings={storeSettings}
        currentUser={currentUser}
        onUpdateTransaction={handleUpdateTransaction}
        onDeleteTransaction={handleDeleteTransaction}
      />

      {/* Animated Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-5 right-5 z-50 rounded-2xl border border-amber-500/40 bg-slate-900/95 backdrop-blur-md px-4 py-3 text-xs font-bold text-white shadow-2xl flex items-center gap-2.5"
          >
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default App;
