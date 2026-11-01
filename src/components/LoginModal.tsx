import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  UserCheck,
  Lock,
  Delete,
  KeyRound,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';
import { UserAccount } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  currentUser: UserAccount;
  onSelectUser: (user: UserAccount) => void;
  forceLock?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSelectUser,
  forceLock = false,
}) => {
  const activeUsers = users.filter((u) => u.active);
  const [selectedAccount, setSelectedAccount] = useState<UserAccount>(currentUser);
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    setErrorMsg('');
    if (pinInput.length < 6) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      if (nextPin === selectedAccount.pin) {
        setTimeout(() => {
          onSelectUser(selectedAccount);
          setPinInput('');
          onClose();
        }, 160);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMsg('');
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput === selectedAccount.pin) {
      onSelectUser(selectedAccount);
      setPinInput('');
      onClose();
    } else {
      setErrorMsg('PIN tidak sesuai! Silakan periksa kembali PIN akun.');
      setPinInput('');
    }
  };

  const handleQuickDemoLogin = (account: UserAccount) => {
    setSelectedAccount(account);
    setPinInput(account.pin);
    setTimeout(() => {
      onSelectUser(account);
      setPinInput('');
      onClose();
    }, 180);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
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

          {/* Left Column: Account Selector */}
          <div className="md:col-span-7 border-b md:border-b-0 md:border-r border-slate-800 p-6 md:p-8 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Ganti Akun / Shift Kasir</h2>
                  <p className="text-xs text-slate-400">
                    Pilih akun <span className="text-amber-400 font-semibold">Admin</span> untuk akses edit penuh atau <span className="text-emerald-400 font-semibold">Kasir (Client)</span> untuk mode terbatas.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {activeUsers.map((acc) => {
                  const isSelected = selectedAccount.id === acc.id;
                  const isCurrent = currentUser.id === acc.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccount(acc);
                        setPinInput('');
                        setErrorMsg('');
                      }}
                      className={`group cursor-pointer rounded-2xl border p-4 transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5'
                          : 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${acc.avatarColor} text-white font-bold text-lg shadow-md`}
                        >
                          {acc.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm md:text-base">
                              {acc.name}
                            </span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3" /> Aktif
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {acc.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300 border border-amber-500/30">
                                <ShieldCheck className="h-3 w-3" /> ADMIN (Full Edit)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-300 border border-sky-500/30">
                                <UserCheck className="h-3 w-3" /> KASIR / CLIENT (Tanpa Akses Edit)
                              </span>
                            )}
                            <span className="text-xs text-slate-400">{acc.shift}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickDemoLogin(acc);
                        }}
                        className="rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition flex items-center gap-1.5"
                        title="Klik untuk masuk instan (PIN otomatis)"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Masuk Cepat (PIN: {acc.pin})</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Role difference info box */}
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400 space-y-1.5">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>Proteksi Hak Akses (RBAC):</span>
              </div>
              <p>
                • <strong className="text-amber-300">Akun Admin</strong>: Bisa mengedit stok & harga barang, mengedit/koreksi struk, menambah/mengedit omset & pengeluaran, serta mengatur template struk.
              </p>
              <p>
                • <strong className="text-sky-300">Akun Kasir / Karyawan</strong>: Hanya bisa menginput pesanan kasir, cek ketersediaan barang, dan cetak struk (fitur edit & hapus dikunci).
              </p>
            </div>
          </div>

          {/* Right Column: Touch PIN Pad */}
          <div className="md:col-span-5 p-6 md:p-8 flex flex-col justify-between bg-slate-950/60">
            <div className="text-center">
              <span className="inline-block rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 mb-2">
                Masukkan PIN Keamanan
              </span>
              <h3 className="text-lg font-bold text-white">{selectedAccount.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                PIN Default: <code className="text-amber-400 font-mono font-bold">{selectedAccount.pin}</code>
              </p>

              {/* PIN Dots */}
              <div className="my-5 flex justify-center gap-3">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pinInput.length > idx;
                  return (
                    <motion.div
                      key={idx}
                      animate={{ scale: filled ? 1.15 : 1 }}
                      className={`h-4 w-4 rounded-full border transition-all ${
                        filled
                          ? 'bg-amber-400 border-amber-400 shadow-md shadow-amber-400/50'
                          : 'bg-slate-900 border-slate-700'
                      }`}
                    />
                  );
                })}
              </div>

              {errorMsg && (
                <p className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl py-2 px-3 mb-3">
                  {errorMsg}
                </p>
              )}
            </div>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-3 my-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-14 rounded-2xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-xl font-bold text-white transition shadow-sm"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPinInput('')}
                className="h-14 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-rose-500/15 hover:text-rose-300 active:scale-95 text-xs font-bold text-slate-400 transition"
              >
                CLEAR
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-14 rounded-2xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-xl font-bold text-white transition shadow-sm"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="h-14 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 active:scale-95 flex items-center justify-center text-slate-300 transition"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleVerify()}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 py-3.5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 active:scale-98 transition"
            >
              Buka Sesi Kasir
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
