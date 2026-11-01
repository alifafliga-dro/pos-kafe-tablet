export type UserRole = 'admin' | 'cashier';

export interface UserAccount {
  id: string;
  name: string;
  username: string;
  pin: string;
  role: UserRole;
  shift: string;
  avatarColor: string;
  active: boolean;
}

export type MenuCategory =
  | 'Kopi & Espresso'
  | 'Non-Kopi & Teh'
  | 'Makanan Berat'
  | 'Snack & Pastry'
  | 'Dessert & Paket';

export interface MenuItem {
  id: string;
  sku: string;
  name: string;
  category: MenuCategory;
  price: number;
  costPrice: number; // HPP (Harga Pokok Penjualan)
  stock: number;
  minStock: number;
  unit: string;
  emoji: string;
  description: string;
  isAvailable: boolean;
}

export type OrderType = 'Dine-In' | 'Takeaway' | 'Delivery';
export type PaymentMethod = 'Tunai' | 'QRIS' | 'Debit/Kartu' | 'Transfer';

export interface CartItem {
  cartItemId: string;
  menuItemId: string;
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  quantity: number;
  variant: string; // e.g., "Normal Sugar • Normal Ice"
  note: string;
  emoji: string;
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  createdAt: string; // ISO string
  cashierId: string;
  cashierName: string;
  customerName: string;
  orderType: OrderType;
  tableNumber: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  changeAmount: number;
  notes: string;
  status: 'Completed' | 'Edited' | 'Void';
  lastEditedBy?: string;
  lastEditedAt?: string;
}

export type CashflowType = 'income' | 'expense';

export interface CashflowRecord {
  id: string;
  date: string; // ISO string
  type: CashflowType;
  category: string;
  title: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdBy: string;
  notes: string;
  isFromTransaction?: boolean;
  transactionId?: string;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  instagram: string;
  wifiName: string;
  wifiPassword: string;
  taxPercent: number;
  servicePercent: number;
  receiptHeaderNote: string;
  receiptFooterNote: string;
  showWifiOnReceipt: boolean;
  showCashierOnReceipt: boolean;
  showTableOnReceipt: boolean;
  allowCashierAddExpense: boolean;
  paperWidth: '58mm' | '80mm';
}
