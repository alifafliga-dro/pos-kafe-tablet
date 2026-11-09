import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Delete,
  KeyRound,
  CheckCircle2,
  X,
  Server,
  MonitorSmartphone,
  Eye,
  EyeOff,
  Save,
  ArrowRight,
} from 'lucide-react';
import { UserAccount } from '../types';
import {
  springSnappy,
  tapScale,
  backdropVariants,
  modalPanelVariants,
} from '../lib/motion';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  currentUser: UserAccount;
  onSelectUser: (user: UserAccount) => void;
  onUpdateUserPin?: (userId: string, newPin: string) => void;
  forceLock?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSelectUser,
  onUpdateUserPin,
  forceLock = false,
}) => {
  const adminAccount =
    users.find((u) => u.role === 'admin') || users[0];
  const clientAccount =
    users.find((u) => u.role === 'cashier') || users[1] || users[0];

  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Admin Change PIN mode (only accessible when currentUser is already Admin)
  const [isChangingPin, setIsChangingPin] = useState<boolean>(false);
  const [newPinValue, setNewPinValue] = useState<string>('');
  const [confirmPinValue, setConfirmPinValue] = useState<string>('');
  const [showNewPin, setShowNewPin] = useState<boolean>(false);
  const [pinSavedMsg, setPinSavedMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMsg('');
      setIsChangingPin(currentUser.role === 'admin');
      setPinSavedMsg('');
      setNewPinValue('');
      setConfirmPinValue('');
    }
  }, [isOpen, currentUser]);

  const isCurrentAdmin = currentUser.role === 'admin';
  const expectedPinLength = Math.max(4, adminAccount?.pin?.length || 4);

  // Client mode: NO PIN needed, enter immediately!
  const handleEnterClientDirectly = () => {
    onSelectUser(clientAccount);
    setPinInput('');
    setErrorMsg('');
    onClose();
  };

  const handleDigit = (digit: string) => {
    setErrorMsg('');
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      if (nextPin === adminAccount.pin) {
        setTimeout(() => {
          onSelectUser(adminAccount);
          setPinInput('');
          onClose();
        }, 140);
      } else if (
        nextPin.length >= expectedPinLength &&
        nextPin.length >= adminAccount.pin.length
      ) {
        setTimeout(() => {
          setErrorMsg('PIN Server Admin salah! Akses ditolak.');
          setPinInput('');
        }, 180);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMsg('');
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handleVerifyAdmin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput === adminAccount.pin) {
      onSelectUser(adminAccount);
      setPinInput('');
      onClose();
    } else {
      setErrorMsg('PIN Server Admin tidak sesuai!');
      setPinInput('');
    }
  };

  const handleSaveNewAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinSavedMsg('');
    setErrorMsg('');
    if (!isCurrentAdmin || !onUpdateUserPin) return;
    const cleanPin = newPinValue.replace(/\D/g, '');
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      setErrorMsg('PIN Admin baru harus terdiri dari 4 hingga 6 angka.');
      return;
    }
    if (cleanPin !== confirmPinValue.replace(/\D/g, '')) {
      setErrorMsg('Konfirmasi PIN baru tidak cocok!');
      return;
    }
    onUpdateUserPin(adminAccount.id, cleanPin);
    setNewPinValue('');
    setConfirmPinValue('');
    setPinSavedMsg('PIN Server Admin berhasil diperbarui!');
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
      >
        <motion.div
          variants={modalPanelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl grid grid-cols-1 md:grid-cols-12"
        >
          {!forceLock && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full bg-slate-800/80 p-2.5 text-slate-400 hover:bg-slate-700 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {/* Left Column: 2 Mode Options Only (Client Tanpa PIN vs Server Admin Pakai PIN) */}
          <div className="md:col-span-7 border-b md:border-b-0 md:border-r border-slate-800 p-6 md:p-8 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950">
            <div>
              <div className="flex items-center gap-3 mb-2 pr-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Pilih Mode Sesi: Client / Server Admin
                  </h2>
                  <p className="text-xs text-slate-400">
                    <span className="text-sky-400 font-semibold">Client (Karyawan)</span> masuk langsung tanpa PIN. <span className="text-amber-400 font-semibold">Server (Admin)</span> wajib menggunakan PIN.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3.5">
                {/* 1. CLIENT (KARYAWAN) - TANPA PIN LANGSUNG MASUK */}
                <div
                  onClick={handleEnterClientDirectly}
                  className={`group cursor-pointer rounded-2xl border p-4 transition-all flex items-center justify-between ${
                    !isCurrentAdmin
                      ? 'border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/5'
                      : 'border-slate-800 bg-slate-800/40 hover:border-sky-500/60 hover:bg-sky-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-600 text-white font-bold text-lg shadow-md">
                      <MonitorSmartphone className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm md:text-base">
                          Client Kasir (Sesi Karyawan)
                        </span>
                        {!isCurrentAdmin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" /> Sedang Aktif
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-300 border border-sky-500/30">
                          TANPA PIN • LANGSUNG MASUK
                        </span>
                        <span className="text-xs text-slate-400">
                          Input Pesanan & Cetak Struk
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnterClientDirectly();
                    }}
                    className="rounded-xl bg-sky-500 hover:bg-sky-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 flex items-center gap-1.5 transition shadow"
                  >
                    <span>Masuk Client</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 2. SERVER (ADMIN) - WAJIB PAKAI PIN */}
                <div
                  onClick={() => {
                    setErrorMsg('');
                    if (isCurrentAdmin) {
                      setIsChangingPin(true);
                    }
                  }}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all flex items-center justify-between ${
                    isCurrentAdmin
                      ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                      : 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 font-bold text-lg shadow-md">
                      <Server className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm md:text-base">
                          Server Admin (Owner)
                        </span>
                        {isCurrentAdmin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" /> Sedang Aktif
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-500/30">
                          <Lock className="h-3 w-3" /> WAJIB PIN ADMIN
                        </span>
                        <span className="text-xs text-slate-400">
                          Full Edit Stok, Struk, Kas & Ubah PIN
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <ShieldCheck className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {isCurrentAdmin ? 'Ubah PIN' : 'Masukkan PIN →'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>Aturan Sesi Client vs Server:</span>
              </div>
              <p>
                • <strong className="text-sky-300">Sesi Client (Karyawan)</strong>: Tanpa PIN, langsung masuk ke kasir. Hanya bisa input pesanan & cetak struk (semua menu edit dikunci).
              </p>
              <p>
                • <strong className="text-amber-300">Sesi Server (Admin)</strong>: Wajib memasukkan PIN rahasia Admin di sebelah kanan. Admin bebas mengubah PIN kapan saja.
              </p>
            </div>
          </div>

          {/* Right Column: Admin PIN Keypad OR Admin Change PIN Form */}
          <div className="md:col-span-5 p-6 md:p-8 flex flex-col justify-between bg-slate-950/60">
            {isCurrentAdmin && isChangingPin ? (
              <form
                onSubmit={handleSaveNewAdminPin}
                className="flex flex-col justify-between h-full space-y-4"
              >
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300 mb-2">
                    <Server className="h-3.5 w-3.5" />
                    <span>Keamanan Sesi Server Admin</span>
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    Ubah PIN Server Admin
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hanya Admin yang menggunakan PIN. Sesi Client (Karyawan) tidak menggunakan PIN.
                  </p>

                  <div className="mt-5 space-y-3.5 text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        PIN Admin Baru (4 - 6 Angka)
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={newPinValue}
                          onChange={(e) =>
                            setNewPinValue(e.target.value.replace(/\D/g, ''))
                          }
                          placeholder="Masukkan PIN Admin baru..."
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 pr-10 text-amber-400 font-mono font-bold tracking-widest focus:border-amber-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPin(!showNewPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showNewPin ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        Konfirmasi PIN Admin Baru
                      </label>
                      <input
                        type={showNewPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={confirmPinValue}
                        onChange={(e) =>
                          setConfirmPinValue(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="Ulangi PIN Admin baru..."
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-amber-400 font-mono font-bold tracking-widest focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    {errorMsg && (
                      <p className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl py-2 px-3">
                        {errorMsg}
                      </p>
                    )}

                    {pinSavedMsg && (
                      <p className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-xl py-2.5 px-3 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>{pinSavedMsg}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-800">
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 py-3 font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition"
                  >
                    <Save className="h-4 w-4" />
                    <span>Simpan PIN Admin Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleEnterClientDirectly}
                    className="w-full rounded-2xl border border-sky-500/30 bg-sky-500/15 hover:bg-sky-500 hover:text-slate-950 py-2.5 text-xs font-extrabold text-sky-300 transition"
                  >
                    Kunci Admin & Masuk ke Mode Client (Tanpa PIN)
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 px-3 py-1 text-xs font-bold mb-2">
                    <Server className="h-3.5 w-3.5" />
                    <span>Khusus Sesi Server (Admin)</span>
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    Masukkan PIN Admin
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Untuk Karyawan, klik <strong>Masuk Client</strong> di kiri (Tanpa PIN)
                  </p>

                  {/* PIN Dots (Hidden PIN - never exposed) */}
                  <motion.div
                    key={errorMsg ? 'error' : 'normal'}
                    animate={errorMsg ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                    transition={{ duration: 0.35 }}
                    className="my-5 flex justify-center gap-3"
                  >
                    {Array.from({ length: expectedPinLength }).map((_, idx) => {
                      const filled = pinInput.length > idx;
                      return (
                        <motion.div
                          key={idx}
                          animate={{ scale: filled ? 1.2 : 1 }}
                          transition={springSnappy}
                          className={`h-4 w-4 rounded-full border transition-colors ${
                            filled
                              ? 'bg-amber-400 border-amber-400 shadow-md shadow-amber-400/50'
                              : errorMsg
                              ? 'bg-rose-500/20 border-rose-500/50'
                              : 'bg-slate-900 border-slate-700'
                          }`}
                        />
                      );
                    })}
                  </motion.div>

                  {errorMsg && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl py-2 px-3 mb-3"
                    >
                      {errorMsg}
                    </motion.p>
                  )}
                </div>

                {/* Keypad Grid */}
                <div className="grid grid-cols-3 gap-3 my-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      key={digit}
                      type="button"
                      onClick={() => handleDigit(digit)}
                      className="h-14 rounded-2xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-xl font-bold text-white transition shadow-sm"
                    >
                      {digit}
                    </motion.button>
                  ))}
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={() => setPinInput('')}
                    className="h-14 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-rose-500/15 hover:text-rose-300 text-xs font-bold text-slate-400 transition"
                  >
                    CLEAR
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={() => handleDigit('0')}
                    className="h-14 rounded-2xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-xl font-bold text-white transition shadow-sm"
                  >
                    0
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={handleBackspace}
                    className="h-14 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 flex items-center justify-center text-slate-300 transition"
                  >
                    <Delete className="h-5 w-5" />
                  </motion.button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={tapScale}
                  type="button"
                  onClick={() => handleVerifyAdmin()}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 py-3.5 font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition"
                >
                  Buka Sesi Server (Admin)
                </motion.button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};
