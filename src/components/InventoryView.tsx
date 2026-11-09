import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PackageCheck,
  X,
  Bot,
  Sparkles,
} from 'lucide-react';
import { MenuItem, MenuCategory, UserAccount } from '../types';
import { MENU_CATEGORIES, formatRupiah } from '../data/initialData';
import {
  springSnappy,
  springSoft,
  tapScale,
  hoverLift,
  backdropVariants,
  modalPanelVariants,
  useAnimatedNumber,
} from '../lib/motion';

interface InventoryViewProps {
  menuItems: MenuItem[];
  currentUser: UserAccount;
  onSaveItem: (item: MenuItem) => void;
  onDeleteItem: (id: string) => void;
  onQuickStockChange: (id: string, delta: number) => void;
  onToggleAvailability: (id: string) => void;
  onAskAi?: (prompt?: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  menuItems,
  currentUser,
  onSaveItem,
  onDeleteItem,
  onQuickStockChange,
  onToggleAvailability,
  onAskAi,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = menuItems.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'Semua' || item.category === categoryFilter;
    const isOut = !item.isAvailable || item.stock <= 0;
    const isLow = !isOut && item.stock <= item.minStock;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'available' && !isOut) ||
      (statusFilter === 'low' && isLow) ||
      (statusFilter === 'out' && isOut);
    return matchSearch && matchCat && matchStatus;
  });

  const totalAvailable = menuItems.filter((m) => m.isAvailable && m.stock > 0).length;
  const totalLow = menuItems.filter(
    (m) => m.isAvailable && m.stock > 0 && m.stock <= m.minStock
  ).length;
  const totalOut = menuItems.filter((m) => !m.isAvailable || m.stock <= 0).length;

  const animAvailable = useAnimatedNumber(totalAvailable, 0.35);
  const animLow = useAnimatedNumber(totalLow, 0.35);
  const animOut = useAnimatedNumber(totalOut, 0.35);

  const openAddModal = () => {
    if (!isAdmin) return;
    setEditingItem({
      id: `mn-${Date.now()}`,
      sku: `MNU-0${menuItems.length + 1}`,
      name: '',
      category: 'Kopi & Espresso',
      price: 25000,
      costPrice: 10000,
      stock: 20,
      minStock: 5,
      unit: 'Cup',
      emoji: '☕',
      description: '',
      isAvailable: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    if (!isAdmin) return;
    setEditingItem({ ...item });
    setIsModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingItem || !editingItem.name.trim()) return;
    onSaveItem(editingItem);
    setIsModalOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Top Role Banner & Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                isAdmin
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
              }`}
            >
              {isAdmin ? <PackageCheck className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                Cek Ketersediaan Barang & Stok Menu
              </h2>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? 'Mode Admin: Anda dapat menambah menu, mengedit harga, dan menyesuaikan stok.'
                  : 'Mode Kasir (Read-Only): Hanya cek ketersediaan barang. Edit stok & harga dikunci.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onAskAi && (
              <motion.button
                whileHover={hoverLift}
                whileTap={tapScale}
                type="button"
                onClick={() => onAskAi('Barang apa yang stoknya tipis atau habis?')}
                className="rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2.5 text-xs font-extrabold text-amber-300 flex items-center gap-1.5 transition"
                title="Tanya AI Analisis Stok & Prioritas Restock"
              >
                <Bot className="h-4 w-4 text-amber-400" />
                <span className="hidden sm:inline">Tanya AI Stok</span>
                <Sparkles className="h-3 w-3 text-amber-400" />
              </motion.button>
            )}
            {isAdmin && (
              <motion.button
                whileHover={hoverLift}
                whileTap={tapScale}
                type="button"
                onClick={openAddModal}
                className="rounded-2xl bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Barang</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* KPI Pills */}
        <div className="lg:col-span-7 grid grid-cols-3 gap-3">
          <motion.button
            whileHover={hoverLift}
            whileTap={tapScale}
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'available' ? 'all' : 'available')}
            className={`rounded-3xl border p-4 text-left transition ${
              statusFilter === 'available'
                ? 'border-emerald-500 bg-emerald-500/15'
                : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-400 text-xs font-bold">
              <span>Tersedia Siap Jual</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1 tabular-nums">
              {animAvailable} <span className="text-xs font-normal text-slate-400">Menu</span>
            </div>
          </motion.button>

          <motion.button
            whileHover={hoverLift}
            whileTap={tapScale}
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'low' ? 'all' : 'low')}
            className={`rounded-3xl border p-4 text-left transition ${
              statusFilter === 'low'
                ? 'border-amber-500 bg-amber-500/15'
                : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-amber-400 text-xs font-bold">
              <span>Stok Menipis</span>
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1 tabular-nums">
              {animLow} <span className="text-xs font-normal text-slate-400">Menu</span>
            </div>
          </motion.button>

          <motion.button
            whileHover={hoverLift}
            whileTap={tapScale}
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'out' ? 'all' : 'out')}
            className={`rounded-3xl border p-4 text-left transition ${
              statusFilter === 'out'
                ? 'border-rose-500 bg-rose-500/15'
                : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-rose-400 text-xs font-bold">
              <span>Stok Habis / Nonaktif</span>
              <XCircle className="h-4 w-4" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1 tabular-nums">
              {animOut} <span className="text-xs font-normal text-slate-400">Menu</span>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Filter & Table Container */}
      <div className="flex-1 flex flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama barang / menu atau SKU..."
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['Semua', ...MENU_CATEGORIES].map((cat) => {
              const active = categoryFilter === cat;
              return (
                <motion.button
                  key={cat}
                  whileTap={tapScale}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`relative rounded-xl px-3 py-2 text-xs font-bold transition ${
                    active
                      ? 'text-slate-950'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="invCategoryPill"
                      transition={springSnappy}
                      className="absolute inset-0 rounded-xl bg-amber-500 shadow"
                    />
                  )}
                  <span className="relative z-10">{cat}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Inventory Table */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950/60">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Barang / Menu</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Harga Jual</th>
                {isAdmin && <th className="py-3 px-3">HPP (Modal)</th>}
                <th className="py-3 px-3">Sisa Stok</th>
                <th className="py-3 px-3">Status Ketersediaan</th>
                <th className="py-3 px-4 text-right">
                  {isAdmin ? 'Kontrol Stok & Edit (Admin)' : 'Akses Karyawan'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <AnimatePresence initial={false}>
                {filtered.map((item) => {
                  const isOut = !item.isAvailable || item.stock <= 0;
                  const isLow = !isOut && item.stock <= item.minStock;
                  return (
                    <motion.tr
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={springSoft}
                      key={item.id}
                      className="hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.emoji}</span>
                          <div>
                            <div className="font-bold text-white text-sm">{item.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.sku} • Min. Stok: {item.minStock} {item.unit}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{item.category}</td>
                      <td className="py-3 px-3 font-bold text-amber-400">
                        {formatRupiah(item.price)}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-slate-400">
                          {formatRupiah(item.costPrice)}
                        </td>
                      )}
                      <td className="py-3 px-3">
                        <motion.span
                          key={item.stock}
                          initial={{ scale: 0.85 }}
                          animate={{ scale: 1 }}
                          transition={springSnappy}
                          className={`inline-block font-extrabold text-sm tabular-nums ${
                            isOut
                              ? 'text-rose-400'
                              : isLow
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {item.stock} {item.unit}
                        </motion.span>
                      </td>
                      <td className="py-3 px-3">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-[11px] font-bold text-rose-300">
                            <XCircle className="h-3.5 w-3.5" /> Habis / Nonaktif
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5" /> Stok Menipis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Tersedia
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isAdmin ? (
                          <div className="inline-flex items-center gap-1.5">
                            <motion.button
                              whileTap={tapScale}
                              type="button"
                              onClick={() => onQuickStockChange(item.id, -1)}
                              className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2 py-1 text-slate-300 font-bold"
                              title="Kurangi 1"
                            >
                              -1
                            </motion.button>
                            <motion.button
                              whileTap={tapScale}
                              type="button"
                              onClick={() => onQuickStockChange(item.id, 1)}
                              className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2 py-1 text-emerald-300 font-bold"
                              title="Tambah 1"
                            >
                              +1
                            </motion.button>
                            <motion.button
                              whileTap={tapScale}
                              type="button"
                              onClick={() => onQuickStockChange(item.id, 10)}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 text-emerald-300 font-bold"
                              title="Restock +10"
                            >
                              +10
                            </motion.button>
                            <motion.button
                              whileTap={tapScale}
                              type="button"
                              onClick={() => onToggleAvailability(item.id)}
                              className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300"
                            >
                              {item.isAvailable ? 'Set Habis' : 'Aktifkan'}
                            </motion.button>
                            <motion.button
                              whileTap={tapScale}
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 p-1.5 text-amber-300 transition"
                              title="Edit Detail Barang"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </motion.button>
                            <motion.button
                              whileTap={tapScale}
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Hapus ${item.name} dari daftar menu?`)) {
                                  onDeleteItem(item.id);
                                }
                              }}
                              className="rounded-lg bg-rose-500/15 hover:bg-rose-500/30 p-1.5 text-rose-300 transition"
                              title="Hapus Barang"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </motion.button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-[11px] text-slate-500">
                            <Lock className="h-3 w-3 text-slate-500" /> Terkunci (Khusus Admin)
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit Item (Admin Only) */}
      <AnimatePresence>
        {isAdmin && isModalOpen && editingItem && (
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
              onSubmit={handleFormSubmit}
              className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">
                  Edit / Tambah Menu & Ketersediaan Barang
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3">
                  <label className="block text-slate-400 mb-1">Ikon Emoji</label>
                  <input
                    type="text"
                    value={editingItem.emoji}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, emoji: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-center text-lg"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-slate-400 mb-1">Kode SKU</label>
                  <input
                    type="text"
                    required
                    value={editingItem.sku}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, sku: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div className="col-span-5">
                  <label className="block text-slate-400 mb-1">Kategori</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        category: e.target.value as MenuCategory,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  >
                    {MENU_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Menu / Barang</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, name: e.target.value })
                  }
                  placeholder="Contoh: Es Kopi Susu Gula Aren"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Harga Jual Kasir (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingItem.price}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        price: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Harga Modal / HPP (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingItem.costPrice}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        costPrice: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Jumlah Stok</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingItem.stock}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        stock: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Batas Stok Tipis</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingItem.minStock}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        minStock: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={editingItem.unit}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, unit: e.target.value })
                    }
                    placeholder="Cup / Porsi"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  />
                </div>
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
                  Simpan Barang
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
