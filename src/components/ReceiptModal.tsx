import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer,
  Edit3,
  Lock,
  Trash2,
  Check,
  X,
  Wifi,
  Plus,
  Minus,
  AlertTriangle,
  Receipt,
} from 'lucide-react';
import {
  Transaction,
  StoreSettings,
  UserAccount,
  PaymentMethod,
  OrderType,
  CartItem,
} from '../types';
import { formatRupiah, formatDateTime } from '../data/initialData';
import {
  springSnappy,
  tapScale,
  backdropVariants,
  modalPanelVariants,
} from '../lib/motion';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  settings: StoreSettings;
  currentUser: UserAccount;
  onUpdateTransaction: (updated: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  transaction,
  onClose,
  settings,
  currentUser,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [isEditing, setIsEditing] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('Dine-In');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (transaction) {
      setCustomerName(transaction.customerName);
      setTableNumber(transaction.tableNumber);
      setOrderType(transaction.orderType);
      setPaymentMethod(transaction.paymentMethod);
      setDiscountAmount(transaction.discountAmount);
      setAmountPaid(transaction.amountPaid);
      setNotes(transaction.notes);
      setItems(transaction.items.map((i) => ({ ...i })));
      setIsEditing(false);
    }
  }, [transaction]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((afterDiscount * settings.taxPercent) / 100);
  const serviceAmount = Math.round((afterDiscount * settings.servicePercent) / 100);
  const totalAmount = afterDiscount + taxAmount + serviceAmount;
  const effectivePaid = paymentMethod === 'Tunai' ? Math.max(amountPaid, totalAmount) : totalAmount;
  const changeAmount = Math.max(0, effectivePaid - totalAmount);

  const handleQtyChange = (cartItemId: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((it) =>
          it.cartItemId === cartItemId
            ? { ...it, quantity: Math.max(0, it.quantity + delta) }
            : it
        )
        .filter((it) => it.quantity > 0)
    );
  };

  const handleSaveEdit = () => {
    if (!isAdmin || items.length === 0 || !transaction) return;
    const updated: Transaction = {
      ...transaction,
      customerName: customerName.trim() || 'Pelanggan Umum',
      tableNumber: orderType === 'Dine-In' ? tableNumber || 'Meja 01' : '-',
      orderType,
      paymentMethod,
      items,
      subtotal,
      discountAmount,
      taxAmount,
      serviceAmount,
      totalAmount,
      amountPaid: effectivePaid,
      changeAmount,
      notes,
      status: 'Edited',
      lastEditedBy: currentUser.name,
      lastEditedAt: new Date().toISOString(),
    };
    onUpdateTransaction(updated);
    setIsEditing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {transaction && (
      <motion.div
        key={transaction.id}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto"
      >
        <motion.div
          variants={modalPanelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 max-h-[92vh]"
        >
          {/* Left: Thermal Receipt Paper Preview */}
          <div className="md:col-span-6 bg-slate-950/70 p-6 flex flex-col items-center justify-start overflow-y-auto border-b md:border-b-0 md:border-r border-slate-800">
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
              <Receipt className="h-4 w-4 text-amber-400" />
              <span>Pratinjau Kertas Struk Thermal ({settings.paperWidth})</span>
            </div>

            {/* Thermal Paper Card */}
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={springSnappy}
              id="printable-receipt"
              className="w-full max-w-[330px] rounded-xl bg-white text-slate-900 p-5 shadow-xl font-mono text-xs leading-relaxed"
            >
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="text-base font-extrabold tracking-tight uppercase">
                  {settings.storeName}
                </div>
                <div className="text-[11px] text-slate-600 font-sans mt-0.5">
                  {settings.tagline}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{settings.address}</div>
                <div className="text-[11px] text-slate-500">
                  Telp: {settings.phone} • {settings.instagram}
                </div>
                {settings.receiptHeaderNote && (
                  <div className="mt-1.5 text-[11px] font-semibold text-slate-700">
                    "{settings.receiptHeaderNote}"
                  </div>
                )}
              </div>

              {/* Meta Info */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>No. Struk:</span>
                  <span className="font-bold">{transaction.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Waktu:</span>
                  <span>{formatDateTime(transaction.createdAt)}</span>
                </div>
                {settings.showCashierOnReceipt && (
                  <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span>{transaction.cashierName.split(' (')[0]}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span className="font-semibold">
                    {isEditing ? customerName : transaction.customerName}
                  </span>
                </div>
                {settings.showTableOnReceipt && (
                  <div className="flex justify-between">
                    <span>Tipe / Meja:</span>
                    <span className="font-bold">
                      {isEditing ? orderType : transaction.orderType}{' '}
                      {(isEditing ? orderType : transaction.orderType) === 'Dine-In'
                        ? `(${isEditing ? tableNumber : transaction.tableNumber})`
                        : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-2">
                {(isEditing ? items : transaction.items).map((item) => (
                  <div key={item.cartItemId}>
                    <div className="font-bold text-slate-900">{item.name}</div>
                    {item.variant && (
                      <div className="text-[10px] text-slate-500">• {item.variant}</div>
                    )}
                    {item.note && (
                      <div className="text-[10px] italic text-slate-500">Cat: {item.note}</div>
                    )}
                    <div className="flex justify-between text-[11px] mt-0.5">
                      <span>
                        {item.quantity} x {formatRupiah(item.price)}
                      </span>
                      <span className="font-semibold">
                        {formatRupiah(item.quantity * item.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>
                    {formatRupiah(isEditing ? subtotal : transaction.subtotal)}
                  </span>
                </div>
                {(isEditing ? discountAmount : transaction.discountAmount) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Diskon / Promo</span>
                    <span>
                      -{formatRupiah(isEditing ? discountAmount : transaction.discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>PB1 ({settings.taxPercent}%)</span>
                  <span>
                    {formatRupiah(isEditing ? taxAmount : transaction.taxAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Service ({settings.servicePercent}%)</span>
                  <span>
                    {formatRupiah(isEditing ? serviceAmount : transaction.serviceAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-extrabold pt-1 border-t border-slate-200">
                  <span>TOTAL</span>
                  <span>
                    {formatRupiah(isEditing ? totalAmount : transaction.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Metode ({isEditing ? paymentMethod : transaction.paymentMethod})</span>
                  <span>
                    {formatRupiah(isEditing ? effectivePaid : transaction.amountPaid)}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kembalian</span>
                  <span>
                    {formatRupiah(isEditing ? changeAmount : transaction.changeAmount)}
                  </span>
                </div>
              </div>

              {/* WiFi & Footer */}
              <div className="pt-3 text-center space-y-1.5 text-[11px]">
                {settings.showWifiOnReceipt && settings.wifiName && (
                  <div className="rounded-lg bg-slate-100 py-1.5 px-2 text-slate-700 font-sans text-[11px]">
                    <div className="font-bold flex items-center justify-center gap-1">
                      <Wifi className="h-3 w-3" /> Free Wi-Fi: {settings.wifiName}
                    </div>
                    <div>Password: {settings.wifiPassword}</div>
                  </div>
                )}
                <p className="text-[10px] text-slate-500 font-sans leading-snug">
                  {settings.receiptFooterNote}
                </p>
                {transaction.status === 'Edited' && (
                  <p className="text-[9px] text-slate-400 italic">
                    *Struk dikoreksi oleh {transaction.lastEditedBy}
                  </p>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right: Actions & Admin Editor */}
          <div className="md:col-span-6 p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Detail & Cetak Struk</h3>
                  <p className="text-xs text-slate-400">{transaction.receiptNumber}</p>
                </div>
                <button
                  onClick={onClose}
                  className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Role Access Notice */}
              {!isAdmin ? (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                  <Lock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200 leading-relaxed">
                    <span className="font-bold block text-amber-300 mb-0.5">
                      Mode Karyawan / Kasir (Edit Struk Dikunci)
                    </span>
                    Anda hanya dapat melihat dan mencetak ulang struk ini. Untuk mengedit item, nominal diskon, atau menghapus struk, silakan gunakan akun <strong>Admin</strong>.
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                  <div className="text-xs text-emerald-200">
                    <span className="font-bold text-emerald-300 block">Akses Admin Aktif</span>
                    Anda dapat mengedit isi struk atau membatalkan transaksi ini.
                  </div>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition ${
                      isEditing
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>{isEditing ? 'Batal Edit' : 'Edit Struk'}</span>
                  </button>
                </div>
              )}

              {/* Edit Form (Admin Only) */}
              {isAdmin && isEditing ? (
                <div className="mt-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Nama Pelanggan</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Tipe Pesanan</label>
                      <select
                        value={orderType}
                        onChange={(e) => setOrderType(e.target.value as OrderType)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="Dine-In">Dine-In</option>
                        <option value="Takeaway">Takeaway</option>
                        <option value="Delivery">Delivery</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Nomor Meja</label>
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        disabled={orderType !== 'Dine-In'}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white disabled:opacity-40 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Metode Bayar</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="Tunai">Tunai</option>
                        <option value="QRIS">QRIS</option>
                        <option value="Debit/Kartu">Debit/Kartu</option>
                        <option value="Transfer">Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Diskon (Rp)</label>
                      <input
                        type="number"
                        min={0}
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Koreksi Jumlah Item</label>
                    <div className="max-h-44 overflow-y-auto space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
                      {items.map((it) => (
                        <div
                          key={it.cartItemId}
                          className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2"
                        >
                          <div>
                            <div className="font-semibold text-white">{it.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {formatRupiah(it.price)} / item
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQtyChange(it.cartItemId, -1)}
                              className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 flex items-center justify-center text-slate-300"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center font-bold text-white">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQtyChange(it.cartItemId, 1)}
                              className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center justify-center text-slate-300"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Catatan Struk</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Catatan tambahan..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2.5 font-bold text-slate-950 flex items-center justify-center gap-1.5 transition"
                    >
                      <Check className="h-4 w-4" />
                      <span>Simpan Perubahan Struk</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Hapus struk transaksi ini secara permanen?')) {
                          onDeleteTransaction(transaction.id);
                          onClose();
                        }
                      }}
                      className="rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 px-3.5 py-2.5 font-bold text-rose-300 flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-3 text-xs text-slate-300">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status Struk</span>
                      <span className="font-bold text-emerald-400">{transaction.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Kasir Bertugas</span>
                      <span className="font-medium text-white">{transaction.cashierName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Metode Pembayaran</span>
                      <span className="font-semibold text-amber-400">
                        {transaction.paymentMethod}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Tagihan</span>
                      <span className="text-sm font-bold text-white">
                        {formatRupiah(transaction.totalAmount)}
                      </span>
                    </div>
                    {transaction.notes && (
                      <div className="pt-2 border-t border-slate-800 text-slate-400">
                        Catatan: <span className="text-slate-200">{transaction.notes}</span>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/30 p-3.5 text-[11px] text-slate-400 flex items-center gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>
                        Ingin mengubah nama toko, logo, pajak PB1, info Wi-Fi, atau pesan kaki struk? Buka tab <strong>Riwayat & Pengaturan Struk</strong>.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Print & Close Buttons */}
            <div className="mt-6 flex gap-3 pt-4 border-t border-slate-800">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={tapScale}
                type="button"
                onClick={handlePrint}
                className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 py-3.5 font-bold text-slate-950 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition"
              >
                <Printer className="h-5 w-5" />
                <span>Cetak Struk Thermal</span>
              </motion.button>
              <motion.button
                whileTap={tapScale}
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-6 py-3.5 font-bold text-slate-200 transition"
              >
                Tutup
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};
