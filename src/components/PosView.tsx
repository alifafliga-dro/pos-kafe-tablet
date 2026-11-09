import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Utensils,
  Package,
  Truck,
  CreditCard,
  QrCode,
  Banknote,
  Building2,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  X,
  Bot,
} from 'lucide-react';
import {
  MenuItem,
  CartItem,
  OrderType,
  PaymentMethod,
  StoreSettings,
  UserAccount,
  Transaction,
} from '../types';
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

interface PosViewProps {
  menuItems: MenuItem[];
  settings: StoreSettings;
  currentUser: UserAccount;
  onCompleteOrder: (transaction: Transaction) => void;
  onAskAi?: (prompt?: string) => void;
}

const TABLE_OPTIONS = [
  'Meja 01',
  'Meja 02',
  'Meja 03',
  'Meja 04',
  'Meja 05',
  'Meja 06',
  'Meja Outdoor 01',
  'Meja Outdoor 02',
  'Meja VIP 01',
];

export const PosView: React.FC<PosViewProps> = ({
  menuItems,
  settings,
  currentUser,
  onCompleteOrder,
  onAskAi,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'available'>('all');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [orderType, setOrderType] = useState<OrderType>('Dine-In');
  const [tableNumber, setTableNumber] = useState<string>('Meja 01');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Item customization modal
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [sugarLevel, setSugarLevel] = useState<string>('Normal Sugar');
  const [iceLevel, setIceLevel] = useState<string>('Normal Ice');
  const [itemNote, setItemNote] = useState<string>('');

  // Payment checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('QRIS');
  const [cashReceived, setCashReceived] = useState<number>(0);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat =
        selectedCategory === 'Semua' || item.category === selectedCategory;
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStock =
        stockFilter === 'all' || (item.isAvailable && item.stock > 0);
      return matchCat && matchSearch && matchStock;
    });
  }, [menuItems, selectedCategory, searchQuery, stockFilter]);

  // Calculate current cart quantity for a menuItem
  const getQtyInCart = (menuItemId: string) =>
    cart
      .filter((c) => c.menuItemId === menuItemId)
      .reduce((sum, c) => sum + c.quantity, 0);

  const handleQuickAdd = (item: MenuItem) => {
    const inCart = getQtyInCart(item.id);
    if (!item.isAvailable || item.stock <= inCart) return;

    const defaultVariant =
      item.category === 'Kopi & Espresso' || item.category === 'Non-Kopi & Teh'
        ? 'Normal Sugar • Normal Ice'
        : 'Standar';

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (c) =>
          c.menuItemId === item.id &&
          c.variant === defaultVariant &&
          c.note === ''
      );
      if (existingIdx > -1) {
        const clone = [...prev];
        clone[existingIdx] = {
          ...clone[existingIdx],
          quantity: clone[existingIdx].quantity + 1,
        };
        return clone;
      }
      return [
        ...prev,
        {
          cartItemId: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          menuItemId: item.id,
          sku: item.sku,
          name: item.name,
          price: item.price,
          costPrice: item.costPrice,
          quantity: 1,
          variant: defaultVariant,
          note: '',
          emoji: item.emoji,
        },
      ];
    });
  };

  const openCustomizeModal = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const inCart = getQtyInCart(item.id);
    if (!item.isAvailable || item.stock <= inCart) return;
    setCustomizingItem(item);
    setSugarLevel('Normal Sugar');
    setIceLevel('Normal Ice');
    setItemNote('');
  };

  const confirmCustomizedAdd = () => {
    if (!customizingItem) return;
    const isDrink =
      customizingItem.category === 'Kopi & Espresso' ||
      customizingItem.category === 'Non-Kopi & Teh';
    const variantStr = isDrink ? `${sugarLevel} • ${iceLevel}` : sugarLevel;

    setCart((prev) => [
      ...prev,
      {
        cartItemId: `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: customizingItem.id,
        sku: customizingItem.sku,
        name: customizingItem.name,
        price: customizingItem.price,
        costPrice: customizingItem.costPrice,
        quantity: 1,
        variant: variantStr,
        note: itemNote.trim(),
        emoji: customizingItem.emoji,
      },
    ]);
    setCustomizingItem(null);
  };

  const updateCartItemQty = (cartItem: CartItem, delta: number) => {
    const menuObj = menuItems.find((m) => m.id === cartItem.menuItemId);
    if (delta > 0 && menuObj) {
      const currentTotalForMenu = getQtyInCart(menuObj.id);
      if (currentTotalForMenu >= menuObj.stock) return;
    }

    setCart((prev) =>
      prev
        .map((c) =>
          c.cartItemId === cartItem.cartItemId
            ? { ...c, quantity: c.quantity + delta }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  // Totals calculation
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const validDiscount = Math.min(discountAmount, subtotal);
  const afterDiscount = Math.max(0, subtotal - validDiscount);
  const taxAmount = Math.round((afterDiscount * settings.taxPercent) / 100);
  const serviceAmount = Math.round((afterDiscount * settings.servicePercent) / 100);
  const totalAmount = afterDiscount + taxAmount + serviceAmount;

  const animatedSubtotal = useAnimatedNumber(subtotal, 0.35);
  const animatedTaxAndService = useAnimatedNumber(taxAmount + serviceAmount, 0.35);
  const animatedTotal = useAnimatedNumber(totalAmount, 0.4);
  const animatedChange = useAnimatedNumber(Math.max(0, cashReceived - totalAmount), 0.35);

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setCashReceived(totalAmount);
    setIsCheckoutOpen(true);
  };

  const handleFinalizeOrder = () => {
    if (cart.length === 0) return;
    const paid =
      paymentMethod === 'Tunai' ? Math.max(cashReceived, totalAmount) : totalAmount;
    const change = Math.max(0, paid - totalAmount);
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = String(Math.floor(100 + Math.random() * 900));

    const newTrx: Transaction = {
      id: `trx-${Date.now()}`,
      receiptNumber: `INV-${datePart}-${randPart}`,
      createdAt: now.toISOString(),
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      customerName: customerName.trim() || 'Pelanggan Walk-In',
      orderType,
      tableNumber: orderType === 'Dine-In' ? tableNumber : '-',
      items: cart,
      subtotal,
      discountAmount: validDiscount,
      taxAmount,
      serviceAmount,
      totalAmount,
      paymentMethod,
      amountPaid: paid,
      changeAmount: change,
      notes: orderNotes.trim(),
      status: 'Completed',
    };

    onCompleteOrder(newTrx);

    // Reset cart
    setCart([]);
    setCustomerName('');
    setDiscountAmount(0);
    setOrderNotes('');
    setIsCheckoutOpen(false);
  };

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
      {/* Left Area: Catalog & Stock Availability (7 or 8 cols on tablet landscape) */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/60 p-4">
        {/* Search & Stock Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari menu kafe, minuman, makanan, atau kode SKU..."
              className="w-full rounded-2xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center rounded-2xl border border-slate-800 bg-slate-950/80 p-1 text-xs">
            <motion.button
              whileTap={tapScale}
              type="button"
              onClick={() => setStockFilter('all')}
              className={`relative rounded-xl px-3 py-1.5 font-semibold transition ${
                stockFilter === 'all'
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {stockFilter === 'all' && (
                <motion.span
                  layoutId="posStockFilterPill"
                  transition={springSnappy}
                  className="absolute inset-0 rounded-xl bg-slate-800"
                />
              )}
              <span className="relative z-10">Semua Menu ({menuItems.length})</span>
            </motion.button>
            <motion.button
              whileTap={tapScale}
              type="button"
              onClick={() => setStockFilter('available')}
              className={`relative rounded-xl px-3 py-1.5 font-semibold transition ${
                stockFilter === 'available'
                  ? 'text-emerald-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {stockFilter === 'available' && (
                <motion.span
                  layoutId="posStockFilterPill"
                  transition={springSnappy}
                  className="absolute inset-0 rounded-xl bg-emerald-500/20 border border-emerald-500/30"
                />
              )}
              <span className="relative z-10">
                Tersedia ({menuItems.filter((m) => m.isAvailable && m.stock > 0).length})
              </span>
            </motion.button>
          </div>

          {onAskAi && (
            <motion.button
              whileHover={hoverLift}
              whileTap={tapScale}
              type="button"
              onClick={() => onAskAi('Rekomendasi paket menu kopi & snack')}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 text-xs font-extrabold text-amber-300 flex items-center gap-1.5 transition"
              title="Tanya AI rekomendasi menu dan paket bundling"
            >
              <Bot className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Tanya AI Menu</span>
              <Sparkles className="h-3 w-3 text-amber-400" />
            </motion.button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2.5 mb-2 no-scrollbar">
          {['Semua', ...MENU_CATEGORIES].map((cat) => {
            const active = selectedCategory === cat;
            return (
              <motion.button
                key={cat}
                whileTap={tapScale}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`relative shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition-colors ${
                  active
                    ? 'text-slate-950'
                    : 'border border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="posCategoryPill"
                    transition={springSnappy}
                    className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20"
                  />
                )}
                <span className="relative z-10">{cat}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => {
              const qtyInCart = getQtyInCart(item.id);
              const remainingStock = Math.max(0, item.stock - qtyInCart);
              const isOut = !item.isAvailable || remainingStock === 0;
              const isLow = !isOut && remainingStock <= item.minStock;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.94, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  whileHover={!isOut ? hoverLift : undefined}
                  whileTap={!isOut ? tapScale : undefined}
                  transition={springSoft}
                  key={item.id}
                  onClick={() => handleQuickAdd(item)}
                  className={`group relative rounded-2xl border p-3.5 flex flex-col justify-between transition-colors ${
                    isOut
                      ? 'border-slate-800/60 bg-slate-950/40 opacity-55 cursor-not-allowed'
                      : qtyInCart > 0
                      ? 'border-amber-500/70 bg-amber-500/10 cursor-pointer shadow-lg shadow-amber-500/5'
                      : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer'
                  }`}
                >
                  {/* Top Row: Emoji & Stock Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <motion.div
                        animate={{ scale: qtyInCart > 0 ? 1.06 : 1 }}
                        transition={springSnappy}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-2xl shadow-inner"
                      >
                        {item.emoji}
                      </motion.div>
                      <div className="flex flex-col items-end gap-1">
                        {isOut ? (
                          <span className="rounded-lg bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            HABIS
                          </span>
                        ) : isLow ? (
                          <span className="rounded-lg bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            Sisa {remainingStock} {item.unit}
                          </span>
                        ) : (
                          <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                            Stok: {remainingStock}
                          </span>
                        )}

                        <AnimatePresence>
                          {qtyInCart > 0 && (
                            <motion.span
                              key={qtyInCart}
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.5, opacity: 0 }}
                              transition={springSnappy}
                              className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-slate-950 shadow-sm"
                            >
                              +{qtyInCart} di Bill
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <div className="text-[10px] font-mono text-slate-500">{item.sku}</div>
                      <h4 className="font-bold text-white text-xs sm:text-sm leading-snug line-clamp-2 mt-0.5">
                        {item.name}
                      </h4>
                    </div>
                  </div>

                  {/* Bottom Price & Variant Button */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="font-extrabold text-amber-400 text-xs sm:text-sm">
                      {formatRupiah(item.price)}
                    </span>
                    {!isOut && (
                      <motion.button
                        whileTap={tapScale}
                        type="button"
                        onClick={(e) => openCustomizeModal(item, e)}
                        className="rounded-xl bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 p-1.5 text-slate-300 transition"
                        title="Atur Gula / Es / Catatan Pesanan"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Right Area: Active Order Bill & Checkout (5 or 4 cols) */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/80 p-4">
        {/* Order Type Tabs */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-950 p-1 border border-slate-800 mb-3">
          {(
            [
              { type: 'Dine-In', icon: Utensils, label: 'Dine-In' },
              { type: 'Takeaway', icon: Package, label: 'Takeaway' },
              { type: 'Delivery', icon: Truck, label: 'Delivery' },
            ] as const
          ).map(({ type, icon: Icon, label }) => {
            const active = orderType === type;
            return (
              <motion.button
                key={type}
                whileTap={tapScale}
                type="button"
                onClick={() => setOrderType(type)}
                className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                  active
                    ? 'text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="posOrderTypePill"
                    transition={springSnappy}
                    className="absolute inset-0 rounded-xl bg-amber-500 shadow"
                  />
                )}
                <Icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Customer & Table Row */}
        <div className="grid grid-cols-12 gap-2 mb-3">
          <div className={orderType === 'Dine-In' ? 'col-span-7' : 'col-span-12'}>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama Pelanggan (Opsional)..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          {orderType === 'Dine-In' && (
            <div className="col-span-5">
              <select
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/90 px-2.5 py-2 text-xs font-semibold text-amber-300 focus:border-amber-500 focus:outline-none"
              >
                {TABLE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {cart.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springSoft}
              className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500"
            >
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                className="h-14 w-14 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-3 text-slate-600"
              >
                <ShoppingBag className="h-7 w-7" />
              </motion.div>
              <p className="text-sm font-semibold text-slate-400">Belum Ada Pesanan</p>
              <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                Sentuh kartu menu di sebelah kiri untuk menambahkan pesanan ke struk.
              </p>
              {onAskAi && (
                <motion.button
                  whileHover={hoverLift}
                  whileTap={tapScale}
                  type="button"
                  onClick={() => onAskAi('Panduan cara input order kasir sampai cetak struk')}
                  className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-[11px] font-bold text-amber-300 flex items-center gap-1.5 transition"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>Bingung cara order? Tanya AI</span>
                </motion.button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {cart.map((item) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, x: 16, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -16, scale: 0.95 }}
                  transition={springSnappy}
                  key={item.cartItemId}
                  className="rounded-2xl border border-slate-800/90 bg-slate-950/80 p-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-xl mt-0.5">{item.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs truncate">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {item.variant}
                        {item.note ? ` • "${item.note}"` : ''}
                      </div>
                      <div className="text-xs font-bold text-amber-400 mt-0.5">
                        {formatRupiah(item.price * item.quantity)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <motion.button
                      whileTap={tapScale}
                      type="button"
                      onClick={() => updateCartItemQty(item, -1)}
                      className="h-8 w-8 rounded-xl border border-slate-800 bg-slate-900 hover:bg-rose-500/20 hover:text-rose-300 flex items-center justify-center text-slate-300 transition"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </motion.button>
                    <motion.span
                      key={item.quantity}
                      initial={{ scale: 0.7 }}
                      animate={{ scale: 1 }}
                      transition={springSnappy}
                      className="w-6 text-center text-xs font-extrabold text-white"
                    >
                      {item.quantity}
                    </motion.span>
                    <motion.button
                      whileTap={tapScale}
                      type="button"
                      onClick={() => updateCartItemQty(item, 1)}
                      className="h-8 w-8 rounded-xl border border-slate-800 bg-slate-900 hover:bg-emerald-500/20 hover:text-emerald-300 flex items-center justify-center text-slate-300 transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Summary & Checkout Footer */}
        <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
          {/* Quick Promo Discount Pills */}
          {cart.length > 0 && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">Potongan Promo:</span>
              <div className="flex items-center gap-1">
                {[0, 5000, 10000, 20000].map((disc) => (
                  <motion.button
                    key={disc}
                    whileTap={tapScale}
                    type="button"
                    onClick={() => setDiscountAmount(disc)}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                      discountAmount === disc
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {disc === 0 ? 'Tanpa' : `-${disc / 1000}rb`}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-slate-950/90 border border-slate-800/80 p-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} item)</span>
              <span className="text-slate-200 font-medium tabular-nums">
                {formatRupiah(animatedSubtotal)}
              </span>
            </div>
            {validDiscount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Diskon Promo</span>
                <span className="tabular-nums">-{formatRupiah(validDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>
                Pajak PB1 ({settings.taxPercent}%) & Service ({settings.servicePercent}%)
              </span>
              <span className="text-slate-200 tabular-nums">
                {formatRupiah(animatedTaxAndService)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-800 text-sm font-extrabold">
              <span className="text-white">TOTAL TAGIHAN</span>
              <span className="text-lg text-amber-400 tabular-nums">
                {formatRupiah(animatedTotal)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {cart.length > 0 && (
              <motion.button
                whileTap={tapScale}
                type="button"
                onClick={() => setCart([])}
                className="rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-3.5 py-3.5 text-rose-300 transition"
                title="Kosongkan Keranjang"
              >
                <Trash2 className="h-5 w-5" />
              </motion.button>
            )}
            <motion.button
              whileHover={cart.length > 0 ? { scale: 1.01 } : undefined}
              whileTap={cart.length > 0 ? tapScale : undefined}
              type="button"
              disabled={cart.length === 0}
              onClick={handleOpenCheckout}
              className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed py-3.5 px-4 font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 flex items-center justify-between transition"
            >
              <span>Proses Bayar & Struk</span>
              <span className="font-mono text-sm bg-slate-950/20 px-2.5 py-1 rounded-xl tabular-nums">
                {formatRupiah(animatedTotal)}
              </span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Modal 1: Item Variant & Note Customizer */}
      <AnimatePresence>
        {customizingItem && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          >
            <motion.div
              variants={modalPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{customizingItem.emoji}</span>
                  <div>
                    <h3 className="font-bold text-white">{customizingItem.name}</h3>
                    <p className="text-xs font-bold text-amber-400">
                      {formatRupiah(customizingItem.price)}
                    </p>
                  </div>
                </div>
                <motion.button
                  whileTap={tapScale}
                  onClick={() => setCustomizingItem(null)}
                  className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              <div className="my-4 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-2">
                    Pilihan Gula / Varian Rasa
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Normal Sugar', 'Less Sugar', 'No Sugar'].map((opt) => (
                      <motion.button
                        whileTap={tapScale}
                        key={opt}
                        type="button"
                        onClick={() => setSugarLevel(opt)}
                        className={`rounded-xl py-2.5 font-bold border transition ${
                          sugarLevel === opt
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        {opt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-2">
                    Pilihan Es / Penyajian
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Normal Ice', 'Less Ice', 'Hot / Panas'].map((opt) => (
                      <motion.button
                        whileTap={tapScale}
                        key={opt}
                        type="button"
                        onClick={() => setIceLevel(opt)}
                        className={`rounded-xl py-2.5 font-bold border transition ${
                          iceLevel === opt
                            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400'
                        }`}
                      >
                        {opt}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1.5">
                    Catatan Khusus Dapur / Barista
                  </label>
                  <input
                    type="text"
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                    placeholder="Contoh: Ekstra saus, pisah es, tanpa bawang..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <motion.button
                whileTap={tapScale}
                type="button"
                onClick={confirmCustomizedAdd}
                className="w-full rounded-2xl bg-amber-500 hover:bg-amber-400 py-3 font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition"
              >
                Tambahkan ke Pesanan
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal 2: Checkout & Payment */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
          >
            <motion.div
              variants={modalPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">Pembayaran Kasir</h3>
                  <p className="text-xs text-slate-400">
                    {orderType} {orderType === 'Dine-In' ? `• ${tableNumber}` : ''} •{' '}
                    {customerName || 'Pelanggan Walk-In'}
                  </p>
                </div>
                <motion.button
                  whileTap={tapScale}
                  onClick={() => setIsCheckoutOpen(false)}
                  className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              <div className="my-5">
                <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 flex items-center justify-between mb-4">
                  <div>
                    <span className="text-xs text-slate-400 block">Total Harus Dibayar</span>
                    <span className="text-2xl font-extrabold text-amber-400 tabular-nums">
                      {formatRupiah(animatedTotal)}
                    </span>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>{cart.reduce((s, i) => s + i.quantity, 0)} Item Pesanan</div>
                    <div>Termasuk PB1 & Service</div>
                  </div>
                </div>

                {/* Payment Method Grid */}
                <label className="block text-xs font-semibold text-slate-400 mb-2">
                  Pilih Metode Pembayaran
                </label>
                <div className="grid grid-cols-4 gap-2.5 mb-4">
                  {(
                    [
                      { method: 'QRIS', icon: QrCode },
                      { method: 'Tunai', icon: Banknote },
                      { method: 'Debit/Kartu', icon: CreditCard },
                      { method: 'Transfer', icon: Building2 },
                    ] as const
                  ).map(({ method, icon: Icon }) => (
                    <motion.button
                      whileTap={tapScale}
                      key={method}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(method);
                        if (method !== 'Tunai') setCashReceived(totalAmount);
                      }}
                      className={`rounded-2xl border p-3 flex flex-col items-center gap-1.5 text-xs font-bold transition ${
                        paymentMethod === method
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300 shadow-md'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{method}</span>
                    </motion.button>
                  ))}
                </div>

                {paymentMethod === 'Tunai' ? (
                  <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Uang Tunai Diterima (Rp)</span>
                      <input
                        type="number"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(Number(e.target.value) || 0)}
                        className="w-40 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-right font-mono text-sm font-bold text-white focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Uang Pas', val: totalAmount },
                        { label: 'Rp 50.000', val: 50000 },
                        { label: 'Rp 100.000', val: 100000 },
                        { label: 'Rp 150.000', val: 150000 },
                        { label: 'Rp 200.000', val: 200000 },
                      ].map((btn) => (
                        <motion.button
                          whileTap={tapScale}
                          key={btn.label}
                          type="button"
                          onClick={() => setCashReceived(btn.val)}
                          className="rounded-xl border border-slate-800 bg-slate-900 hover:border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-slate-300 transition"
                        >
                          {btn.label}
                        </motion.button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-sm">
                      <span className="text-slate-400">Uang Kembalian:</span>
                      <span className="font-extrabold text-emerald-400 tabular-nums">
                        {formatRupiah(animatedChange)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3 text-xs text-emerald-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      Pembayaran non-tunai melalui <strong>{paymentMethod}</strong> senilai{' '}
                      <strong>{formatRupiah(totalAmount)}</strong> siap diverifikasi dan dicetak ke struk.
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Catatan Struk / Nomor Referensi Pembayaran (Opsional)..."
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileTap={tapScale}
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-5 py-3.5 text-xs font-bold text-slate-300"
                >
                  Kembali
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={tapScale}
                  type="button"
                  onClick={handleFinalizeOrder}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 py-3.5 font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Selesaikan & Tampilkan Struk</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
