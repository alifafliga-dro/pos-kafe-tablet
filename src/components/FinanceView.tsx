import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  Plus,
  Edit3,
  Trash2,
  Lock,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Bot,
  Sparkles,
} from 'lucide-react';
import {
  Transaction,
  CashflowRecord,
  CashflowType,
  PaymentMethod,
  UserAccount,
  StoreSettings,
} from '../types';
import { formatRupiah, formatDateTime } from '../data/initialData';
import {
  springSnappy,
  springSoft,
  tapScale,
  hoverLift,
  staggerContainer,
  fadeUpItem,
  backdropVariants,
  modalPanelVariants,
  useAnimatedNumber,
} from '../lib/motion';

interface FinanceViewProps {
  transactions: Transaction[];
  cashflow: CashflowRecord[];
  currentUser: UserAccount;
  settings: StoreSettings;
  onSaveCashflow: (record: CashflowRecord) => void;
  onDeleteCashflow: (id: string) => void;
  onSelectTransaction: (trx: Transaction) => void;
  onAskAi?: (prompt?: string) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  transactions,
  cashflow,
  currentUser,
  settings,
  onSaveCashflow,
  onDeleteCashflow,
  onSelectTransaction,
  onAskAi,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const canAddCashflow = isAdmin || settings.allowCashierAddExpense;

  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [editingRecord, setEditingRecord] = useState<CashflowRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Compute financial metrics
  const metrics = useMemo(() => {
    const validTrx = transactions.filter((t) => t.status !== 'Void');
    const omsetPenjualan = validTrx.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalHpp = validTrx.reduce(
      (sum, t) =>
        sum +
        t.items.reduce((isum, item) => isum + item.costPrice * item.quantity, 0),
      0
    );
    const pemasukanLain = cashflow
      .filter((c) => c.type === 'income')
      .reduce((sum, c) => sum + c.amount, 0);
    const totalPengeluaran = cashflow
      .filter((c) => c.type === 'expense')
      .reduce((sum, c) => sum + c.amount, 0);

    const totalPemasukan = omsetPenjualan + pemasukanLain;
    const labaKotor = omsetPenjualan - totalHpp;
    const labaBersih = totalPemasukan - totalPengeluaran - totalHpp;

    // Breakdown by payment method
    const byPayment: Record<PaymentMethod, number> = {
      QRIS: 0,
      Tunai: 0,
      'Debit/Kartu': 0,
      Transfer: 0,
    };
    validTrx.forEach((t) => {
      byPayment[t.paymentMethod] = (byPayment[t.paymentMethod] || 0) + t.totalAmount;
    });

    return {
      omsetPenjualan,
      totalHpp,
      pemasukanLain,
      totalPemasukan,
      totalPengeluaran,
      labaKotor,
      labaBersih,
      trxCount: validTrx.length,
      byPayment,
    };
  }, [transactions, cashflow]);

  // Combined ledger (sales + cashflow records)
  const combinedLedger = useMemo(() => {
    const trxEntries: CashflowRecord[] = transactions
      .filter((t) => t.status !== 'Void')
      .map((t) => ({
        id: `trx-cf-${t.id}`,
        date: t.createdAt,
        type: 'income' as CashflowType,
        category: `Penjualan POS (${t.orderType})`,
        title: `${t.receiptNumber} — ${t.customerName} (${t.items.reduce(
          (s, i) => s + i.quantity,
          0
        )} item)`,
        amount: t.totalAmount,
        paymentMethod: t.paymentMethod,
        createdBy: t.cashierName,
        notes: t.notes,
        isFromTransaction: true,
        transactionId: t.id,
      }));

    const all = [...trxEntries, ...cashflow].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (typeFilter === 'all') return all;
    return all.filter((item) => item.type === typeFilter);
  }, [transactions, cashflow, typeFilter]);

  const openAddModal = (defaultType: CashflowType) => {
    if (!canAddCashflow) return;
    setEditingRecord({
      id: `cf-${Date.now()}`,
      date: new Date().toISOString(),
      type: isAdmin ? defaultType : 'expense',
      category:
        defaultType === 'income' ? 'Pemasukan Lainnya' : 'Operasional Harian',
      title: '',
      amount: 50000,
      paymentMethod: 'Tunai',
      createdBy: currentUser.name,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (rec: CashflowRecord) => {
    if (!isAdmin || rec.isFromTransaction) return;
    setEditingRecord({ ...rec });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editingRecord.title.trim()) return;
    onSaveCashflow(editingRecord);
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  const handleExportCsv = () => {
    const headers = [
      'Tanggal',
      'Tipe',
      'Kategori',
      'Keterangan',
      'Nominal (Rp)',
      'Metode',
      'Oleh',
    ];
    const rows = combinedLedger.map((r) => [
      formatDateTime(r.date),
      r.type === 'income' ? 'PEMASUKAN' : 'PENGELUARAN',
      `"${r.category}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      r.amount,
      r.paymentMethod,
      `"${r.createdBy}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Laporan_Keuangan_KopiNusa_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const animOmset = useAnimatedNumber(metrics.omsetPenjualan, 0.45);
  const animPemasukan = useAnimatedNumber(metrics.totalPemasukan, 0.45);
  const animPengeluaran = useAnimatedNumber(metrics.totalPengeluaran, 0.45);
  const animLabaBersih = useAnimatedNumber(metrics.labaBersih, 0.5);

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto pr-1">
      {/* Top KPI Cards */}
      <motion.div
        variants={staggerContainer(0.05, 0.02)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <motion.div
          variants={fadeUpItem}
          whileHover={hoverLift}
          className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-slate-900 p-4"
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
            <span>Total Omset Penjualan</span>
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white mt-1.5 tabular-nums">
            {formatRupiah(animOmset)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Dari {metrics.trxCount} struk transaksi selesai
          </div>
        </motion.div>

        <motion.div
          variants={fadeUpItem}
          whileHover={hoverLift}
          className="rounded-3xl border border-sky-500/30 bg-gradient-to-br from-sky-500/15 to-slate-900 p-4"
        >
          <div className="flex items-center justify-between text-xs font-bold text-sky-300">
            <span>Total Kas Masuk (Omset + Lain)</span>
            <ArrowUpRight className="h-4 w-4" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white mt-1.5 tabular-nums">
            {formatRupiah(animPemasukan)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Pemasukan non-kasir: {formatRupiah(metrics.pemasukanLain)}
          </div>
        </motion.div>

        <motion.div
          variants={fadeUpItem}
          whileHover={hoverLift}
          className="rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-500/15 to-slate-900 p-4"
        >
          <div className="flex items-center justify-between text-xs font-bold text-rose-300">
            <span>Total Pengeluaran Kas</span>
            <TrendingDown className="h-4 w-4" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-white mt-1.5 tabular-nums">
            {formatRupiah(animPengeluaran)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            HPP Bahan Terjual: {formatRupiah(metrics.totalHpp)}
          </div>
        </motion.div>

        <motion.div
          variants={fadeUpItem}
          whileHover={hoverLift}
          className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-slate-900 p-4"
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-300">
            <span>Estimasi Laba Bersih</span>
            <Wallet className="h-4 w-4" />
          </div>
          <div
            className={`text-xl sm:text-2xl font-extrabold mt-1.5 tabular-nums ${
              metrics.labaBersih >= 0 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {formatRupiah(animLabaBersih)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Laba Kotor Menu: {formatRupiah(metrics.labaKotor)}
          </div>
        </motion.div>
      </motion.div>

      {/* Payment Method Breakdown & Action Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-xs font-bold text-slate-300">
              Rincian Omset Berdasarkan Metode Pembayaran
            </div>
            {onAskAi && (
              <motion.button
                whileHover={hoverLift}
                whileTap={tapScale}
                type="button"
                onClick={() => onAskAi('Ringkasan omset & laba bersih hari ini')}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 text-[11px] font-extrabold text-amber-300 flex items-center gap-1 transition"
              >
                <Bot className="h-3.5 w-3.5 text-amber-400" />
                <span>Tanya AI Keuangan</span>
                <Sparkles className="h-3 w-3 text-amber-400" />
              </motion.button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(['QRIS', 'Tunai', 'Debit/Kartu', 'Transfer'] as PaymentMethod[]).map(
              (method) => (
                <motion.div
                  whileHover={hoverLift}
                  key={method}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3"
                >
                  <div className="text-[11px] text-slate-400">{method}</div>
                  <div className="text-sm font-extrabold text-white mt-0.5 tabular-nums">
                    {formatRupiah(metrics.byPayment[method] || 0)}
                  </div>
                </motion.div>
              )
            )}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Kelola Arus Kas</h3>
              <p className="text-[11px] text-slate-400">
                {isAdmin
                  ? 'Mode Admin: Bebas tambah, edit & hapus catatan keuangan.'
                  : 'Mode Kasir: Catatan keuangan dikunci agar tidak bisa diubah karyawan.'}
              </p>
            </div>
            {!isAdmin && <Lock className="h-5 w-5 text-amber-400 shrink-0" />}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {isAdmin ? (
              <>
                <motion.button
                  whileTap={tapScale}
                  type="button"
                  onClick={() => openAddModal('income')}
                  className="flex-1 rounded-2xl bg-emerald-500 hover:bg-emerald-400 py-2.5 px-3 text-xs font-extrabold text-slate-950 flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Catat Pemasukan</span>
                </motion.button>
                <motion.button
                  whileTap={tapScale}
                  type="button"
                  onClick={() => openAddModal('expense')}
                  className="flex-1 rounded-2xl bg-rose-500 hover:bg-rose-400 py-2.5 px-3 text-xs font-extrabold text-white flex items-center justify-center gap-1.5 transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Catat Pengeluaran</span>
                </motion.button>
              </>
            ) : canAddCashflow ? (
              <motion.button
                whileTap={tapScale}
                type="button"
                onClick={() => openAddModal('expense')}
                className="flex-1 rounded-2xl bg-amber-500 hover:bg-amber-400 py-2.5 px-3 text-xs font-extrabold text-slate-950 flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Input Kas Keluar Harian (Tanpa Akses Edit)</span>
              </motion.button>
            ) : (
              <div className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-[11px] text-slate-400">
                Hanya <strong>Admin</strong> yang dapat menambah atau mengedit catatan pemasukan & pengeluaran.
              </div>
            )}

            <motion.button
              whileTap={tapScale}
              type="button"
              onClick={handleExportCsv}
              className="rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition"
            >
              <Download className="h-4 w-4" />
              <span>CSV</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="flex-1 flex flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-4 min-h-[280px]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-extrabold text-white">
            Buku Kas: Riwayat Omset, Pemasukan & Pengeluaran
          </h3>
          <div className="flex items-center gap-1.5 text-xs">
            {(
              [
                { id: 'all', label: 'Semua Mutasi' },
                { id: 'income', label: 'Pemasukan & Omset' },
                { id: 'expense', label: 'Pengeluaran' },
              ] as const
            ).map((tab) => {
              const active = typeFilter === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  whileTap={tapScale}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`relative rounded-xl px-3 py-1.5 font-bold transition ${
                    active
                      ? 'text-slate-950'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="financeFilterPill"
                      transition={springSnappy}
                      className="absolute inset-0 rounded-xl bg-amber-500 shadow"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900/95 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-3">Tipe</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Rincian Transaksi / Catatan</th>
                <th className="py-3 px-3">Metode</th>
                <th className="py-3 px-3 text-right">Nominal</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <AnimatePresence initial={false}>
                {combinedLedger.map((row) => (
                  <motion.tr
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={springSoft}
                    key={row.id}
                    className="hover:bg-slate-900/50 transition"
                  >
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {formatDateTime(row.date)}
                    </td>
                    <td className="py-3 px-3">
                      {row.type === 'income' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          <ArrowUpRight className="h-3 w-3" /> MASUK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                          <ArrowDownRight className="h-3 w-3" /> KELUAR
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-medium">
                      {row.category}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{row.title}</div>
                      <div className="text-[11px] text-slate-500">
                        Oleh: {row.createdBy} {row.notes ? `• ${row.notes}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded-lg bg-slate-900 border border-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                        {row.paymentMethod}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-extrabold text-sm whitespace-nowrap tabular-nums ${
                        row.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {row.type === 'income' ? '+' : '-'}
                      {formatRupiah(row.amount)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {row.isFromTransaction ? (
                        <motion.button
                          whileTap={tapScale}
                          type="button"
                          onClick={() => {
                            const found = transactions.find(
                              (t) => t.id === row.transactionId
                            );
                            if (found) onSelectTransaction(found);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition"
                        >
                          <Receipt className="h-3 w-3" />
                          <span> {isAdmin ? 'Lihat / Edit Struk' : 'Lihat Struk'}</span>
                        </motion.button>
                      ) : isAdmin ? (
                        <div className="inline-flex items-center gap-1.5">
                          <motion.button
                            whileTap={tapScale}
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 p-1.5 text-slate-300 transition"
                            title="Edit Catatan Kas"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </motion.button>
                          <motion.button
                            whileTap={tapScale}
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Hapus catatan "${row.title}"?`)) {
                                onDeleteCashflow(row.id);
                              }
                            }}
                            className="rounded-lg bg-rose-500/15 hover:bg-rose-500/30 p-1.5 text-rose-300 transition"
                            title="Hapus Catatan Kas"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </motion.button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Lock className="h-3 w-3" /> Terkunci
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Cashflow Modal */}
      <AnimatePresence>
        {isModalOpen && editingRecord && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
          >
            <motion.form
              variants={modalPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onSubmit={handleSave}
              className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">
                  {editingRecord.type === 'income'
                    ? 'Catat Pemasukan Kas'
                    : 'Catat Pengeluaran Operasional'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isAdmin && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingRecord({ ...editingRecord, type: 'income' })
                    }
                    className={`rounded-xl py-2.5 font-bold border transition ${
                      editingRecord.type === 'income'
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    Pemasukan (+)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingRecord({ ...editingRecord, type: 'expense' })
                    }
                    className={`rounded-xl py-2.5 font-bold border transition ${
                      editingRecord.type === 'expense'
                        ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    Pengeluaran (-)
                  </button>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Kategori Kas</label>
                <input
                  type="text"
                  required
                  value={editingRecord.category}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, category: e.target.value })
                  }
                  placeholder="Contoh: Bahan Baku / Operasional / Sewa / Event"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Judul / Keperluan</label>
                <input
                  type="text"
                  required
                  value={editingRecord.title}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, title: e.target.value })
                  }
                  placeholder="Contoh: Beli Susu Fresh Milk 12 Karton"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Nominal (Rp)</label>
                  <input
                    type="number"
                    required
                    min={100}
                    value={editingRecord.amount}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        amount: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Metode Dana</label>
                  <select
                    value={editingRecord.paymentMethod}
                    onChange={(e) =>
                      setEditingRecord({
                        ...editingRecord,
                        paymentMethod: e.target.value as PaymentMethod,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  >
                    <option value="Tunai">Tunai</option>
                    <option value="Transfer">Transfer</option>
                    <option value="QRIS">QRIS</option>
                    <option value="Debit/Kartu">Debit/Kartu</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  value={editingRecord.notes}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, notes: e.target.value })
                  }
                  placeholder="Nomor nota / supplier..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 font-bold text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 font-extrabold text-slate-950"
                >
                  Simpan Catatan Kas
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
