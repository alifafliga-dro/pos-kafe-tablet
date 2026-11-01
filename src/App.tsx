import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Bot,
  Server,
  MonitorSmartphone,
  Lock,
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
import { AiAgentDrawer } from './components/AiAgentDrawer';

type ActiveTab = 'pos' | 'inventory' | 'finance' | 'receipts';

const STORAGE_KEYS = {
  users: 'kopinusa_users_v1',
  menu: 'kopinusa_menu_v1',
  transactions: 'kopinusa_trx_v1',
  cashflow: 'kopinusa_cashflow_v1',
  settings: 'kopinusa_settings_v1',
  currentUserSession: 'kopinusa_session_user_v2',
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

function normalizeTwoRoleUsers(list: UserAccount[]): UserAccount[] {
  const existingAdmin = list.find((u) => u.role === 'admin');
  return [
    {
      ...INITIAL_USERS[0],
      pin: existingAdmin?.pin && existingAdmin.pin.length >= 4 ? existingAdmin.pin : INITIAL_USERS[0].pin,
    },
    {
      ...INITIAL_USERS[1],
      pin: '',
    },
  ];
}

function loadSessionUser(usersList: UserAccount[]): UserAccount {
  const normalized = normalizeTwoRoleUsers(usersList);
  const defaultCashier = normalized[1];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.currentUserSession);
    if (!raw) return defaultCashier;
    const parsed = JSON.parse(raw) as UserAccount;
    const matched = normalized.find((u) => u.role === parsed.role);
    return matched || defaultCashier;
  } catch {
    return defaultCashier;
  }
}

export function App() {
  const [users, setUsers] = useState<UserAccount[]>(() =>
    normalizeTwoRoleUsers(loadFromStorage(STORAGE_KEYS.users, INITIAL_USERS))
  );
  // Default session is always Client (Karyawan/Kasir) per tab/device until Admin logs in with secret PIN
  const [currentUser, setCurrentUser] = useState<UserAccount>(() =>
    loadSessionUser(loadFromStorage(STORAGE_KEYS.users, INITIAL_USERS))
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
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Transaction | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [clock, setClock] = useState<string>('');
  const [serverConnected, setServerConnected] = useState<boolean>(true);
  const isHydratedFromServer = useRef<boolean>(false);
  const lastSyncedStamp = useRef<string>('');

  // Sync from central Vite POS Server on mount & poll for multi-client real-time updates
  useEffect(() => {
    let active = true;

    const pullServerState = async (isInitial = false) => {
      try {
        const res = await fetch('/api/pos/state');
        if (
          !res.ok ||
          !(res.headers.get('content-type') || '').includes('application/json')
        ) {
          setServerConnected(true);
          return;
        }
        const json = await res.json();
        if (!active) return;
        setServerConnected(true);

        if (json?.ok && json?.data) {
          const srv = json.data;
          if (srv.updatedAt && srv.updatedAt === lastSyncedStamp.current) {
            return;
          }
          if (srv.updatedAt) {
            lastSyncedStamp.current = srv.updatedAt;
          }
          if (Array.isArray(srv.users) && srv.users.length > 0) {
            const norm = normalizeTwoRoleUsers(srv.users);
            setUsers(norm);
            setCurrentUser((prev) => {
              const updatedSelf = norm.find((u: UserAccount) => u.role === prev.role);
              return updatedSelf || prev;
            });
          }
          if (Array.isArray(srv.menuItems)) setMenuItems(srv.menuItems);
          if (Array.isArray(srv.transactions)) setTransactions(srv.transactions);
          if (Array.isArray(srv.cashflow)) setCashflow(srv.cashflow);
          if (srv.storeSettings) setSettings([srv.storeSettings]);
          isHydratedFromServer.current = true;
        } else if (isInitial) {
          // Initialize server DB with current state
          isHydratedFromServer.current = true;
          pushServerState({
            users,
            menuItems,
            transactions,
            cashflow,
            storeSettings,
          });
        }
      } catch {
        if (active) setServerConnected(false);
      }
    };

    pullServerState(true);
    const pollTimer = setInterval(() => pullServerState(false), 4000);
    return () => {
      active = false;
      clearInterval(pollTimer);
    };
  }, []);

  const pushServerState = async (payload: {
    users?: UserAccount[];
    menuItems?: MenuItem[];
    transactions?: Transaction[];
    cashflow?: CashflowRecord[];
    storeSettings?: StoreSettings;
  }) => {
    try {
      const res = await fetch('/api/pos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.updatedAt) {
          lastSyncedStamp.current = data.updatedAt;
        }
        setServerConnected(true);
      }
    } catch {
      setServerConnected(false);
    }
  };

  // Save to localStorage & push to Server
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
    if (isHydratedFromServer.current) {
      pushServerState({ users });
    }
  }, [users]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.currentUserSession, JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.menu, JSON.stringify(menuItems));
    if (isHydratedFromServer.current) {
      pushServerState({ menuItems });
    }
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
    if (isHydratedFromServer.current) {
      pushServerState({ transactions });
    }
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cashflow, JSON.stringify(cashflow));
    if (isHydratedFromServer.current) {
      pushServerState({ cashflow });
    }
  }, [cashflow]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(storeSettings));
    if (isHydratedFromServer.current) {
      pushServerState({ storeSettings });
    }
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
      `Transaksi ${trx.receiptNumber} (${formatRupiah(trx.totalAmount)}) tersimpan ke Server!`
    );
  };

  const handleUpdateTransaction = (updated: Transaction) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    setSelectedReceipt(updated);
    showToast(`Struk ${updated.receiptNumber} berhasil diperbarui di Server oleh Admin.`);
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
    showToast(`Data barang "${item.name}" berhasil disimpan di Server.`);
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
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      if (exists) {
        return prev.map((u) => (u.id === user.id ? user : u));
      }
      return [...prev, user];
    });
    if (currentUser.id === user.id) {
      setCurrentUser(user);
    }
    showToast(`Data & PIN akun "${user.name}" berhasil disimpan di Server.`);
  };

  const handleUpdateUserPin = (userId: string, newPin: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, pin: newPin } : u))
    );
    if (currentUser.id === userId) {
      setCurrentUser((prev) => ({ ...prev, pin: newPin }));
    }
    const target = users.find((u) => u.id === userId);
    showToast(`PIN keamanan untuk "${target?.name || 'Akun'}" berhasil diubah!`);
  };

  const handleDeleteUser = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    showToast('Akun pengguna berhasil dihapus.');
  };

  const handleSwitchToClientMode = () => {
    const defaultClient =
      users.find((u) => u.role === 'cashier' && u.active) || INITIAL_USERS[1];
    setCurrentUser(defaultClient);
    showToast(
      `Sesi Server Admin dikunci. Beralih ke Mode Client Karyawan (${defaultClient.name}).`
    );
  };

  const handleResetDemoData = () => {
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[1]);
    setMenuItems(INITIAL_MENU_ITEMS);
    setTransactions(INITIAL_TRANSACTIONS);
    setCashflow(INITIAL_CASHFLOW);
    setSettings([INITIAL_STORE_SETTINGS]);
    pushServerState({
      users: INITIAL_USERS,
      menuItems: INITIAL_MENU_ITEMS,
      transactions: INITIAL_TRANSACTIONS,
      cashflow: INITIAL_CASHFLOW,
      storeSettings: INITIAL_STORE_SETTINGS,
    });
    showToast('Seluruh data Server berhasil dikembalikan ke data awal demo.');
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
                  {isAdmin ? 'Server Host (Admin)' : 'Client Terminal (Kasir)'}
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
              <span>{isAdmin ? 'Server Admin' : 'Client Kasir'}</span>
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
                  sub: isAdmin ? 'Kelola Stok Server' : 'Cek Ketersediaan',
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
                  sub: isAdmin ? 'Edit Struk & Ubah PIN' : 'Cetak Ulang Struk',
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
          {/* Quick AI Assistant Button in Sidebar */}
          <button
            type="button"
            onClick={() => setIsAiDrawerOpen(true)}
            className="w-full rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-orange-500/25 p-2.5 text-left transition flex items-center gap-2.5 group"
          >
            <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Bot className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="text-xs font-extrabold text-amber-300 truncate flex items-center gap-1">
                <span>Tanya AI Flash</span>
                <Sparkles className="h-3 w-3 shrink-0" />
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                Bingung? Tanya Cloud AI
              </div>
            </div>
          </button>

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
                      <Server className="h-3 w-3" /> SERVER (Admin)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/30">
                      <MonitorSmartphone className="h-3 w-3" /> CLIENT (Karyawan)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="w-full rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 py-2 px-2.5 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition"
              >
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden lg:inline">
                  {isAdmin ? 'Ubah PIN / Ganti Sesi' : 'Ganti Shift / Login Admin'}
                </span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleSwitchToClientMode}
                  className="w-full rounded-xl border border-sky-500/30 bg-sky-500/15 hover:bg-sky-500 hover:text-slate-950 py-1.5 px-2.5 text-[11px] font-extrabold text-sky-300 flex items-center justify-center gap-1.5 transition"
                  title="Kunci sesi Admin dan kembali ke mode Client untuk karyawan"
                >
                  <Lock className="h-3 w-3 shrink-0" />
                  <span className="hidden lg:inline">Kunci ke Mode Client</span>
                </button>
              )}
            </div>
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
            <span
              className={`hidden md:inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                isAdmin
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  serverConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {isAdmin
                ? 'SERVER HOST (SESI ADMIN)'
                : 'CLIENT TERMINAL (VERSI KARYAWAN)'}
            </span>
          </div>

          {/* Instant Role Indicator & Mode Switcher */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(true)}
              className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition active:scale-95"
            >
              <Bot className="h-4 w-4 stroke-[2.3]" />
              <span>Bingung? Tanya AI Flash</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-950/90 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (isAdmin) {
                    handleSwitchToClientMode();
                  }
                }}
                className={`rounded-xl px-2.5 py-1 font-bold flex items-center gap-1.5 transition ${
                  !isAdmin
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mode Client untuk Karyawan / Kasir"
              >
                <MonitorSmartphone className="h-3.5 w-3.5" />
                <span>Client (Karyawan)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!isAdmin) {
                    setIsLoginModalOpen(true);
                  }
                }}
                className={`rounded-xl px-2.5 py-1 font-bold flex items-center gap-1.5 transition ${
                  isAdmin
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Mode Server untuk Owner / Admin (Wajib PIN)"
              >
                <Server className="h-3.5 w-3.5" />
                <span>Server (Admin)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 flex items-center gap-1.5 transition"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>{isAdmin ? 'Ubah PIN / Akun' : 'PIN / Akun'}</span>
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

      {/* Login / Switch Account / Change Admin PIN Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={users}
        currentUser={currentUser}
        onUpdateUserPin={handleUpdateUserPin}
        onSelectUser={(user) => {
          setCurrentUser(user);
          showToast(
            `Berhasil beralih ke: ${user.name} (${
              user.role === 'admin'
                ? 'Mode Server Admin - Akses Penuh'
                : 'Mode Client Karyawan - Kasir'
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

      {/* Google Gemini Flash Cloud AI Agent Drawer */}
      <AiAgentDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        menuItems={menuItems}
        transactions={transactions}
        cashflow={cashflow}
        currentUser={currentUser}
        settings={storeSettings}
        onRequestAdminLogin={() => setIsLoginModalOpen(true)}
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
