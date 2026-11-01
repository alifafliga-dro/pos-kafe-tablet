import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Send,
  X,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Settings2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  Zap,
  Lock,
} from 'lucide-react';
import {
  MenuItem,
  Transaction,
  CashflowRecord,
  UserAccount,
  StoreSettings,
} from '../types';
import { formatRupiah } from '../data/initialData';

interface AiAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  transactions: Transaction[];
  cashflow: CashflowRecord[];
  currentUser: UserAccount;
  settings: StoreSettings;
  onRequestAdminLogin?: () => void;
}

export type GeminiModelId =
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash'
  | 'gemini-2.0-flash-lite'
  | 'gemini-flash-latest';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: string;
}

const GEMINI_KEY_STORAGE = 'kopinusa_gemini_api_key_v1';
const GEMINI_MODEL_STORAGE = 'kopinusa_gemini_model_v1';

export const AiAgentDrawer: React.FC<AiAgentDrawerProps> = ({
  isOpen,
  onClose,
  menuItems,
  transactions,
  cashflow,
  currentUser,
  settings,
  onRequestAdminLogin,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(GEMINI_KEY_STORAGE) || ''
  );
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(
    () =>
      (localStorage.getItem(GEMINI_MODEL_STORAGE) as GeminiModelId) ||
      'gemini-2.5-flash'
  );
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [tempKey, setTempKey] = useState<string>(apiKey);
  const [keySavedToast, setKeySavedToast] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ type: 'idle', message: '' });

  const sanitizeKey = (raw: string) =>
    raw
      .trim()
      .replace(/^Bearer\s+/i, '')
      .replace(/["'\s]/g, '');

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `Halo **${currentUser.name.split(' (')[0]}**! 👋 Saya **KopiNusa AI Agent (Google Gemini Flash Cloud)**.\n\nKalau sedang bingung cara pakai kasir, mau cek stok barang yang menipis, cari rekomendasi menu, atau analisis omset hari ini, langsung tanyakan saja di sini!`,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      source: 'Gemini Flash Cloud Ready',
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastPendingPrompt, setLastPendingPrompt] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCancelAndFallback = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    if (lastPendingPrompt) {
      const fallback = generateSmartLocalFallback(lastPendingPrompt);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: fallback,
          timestamp: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          source: 'Smart POS Engine (Jawab Instan)',
        },
      ]);
      setLastPendingPrompt('');
    }
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const cleaned = sanitizeKey(tempKey);
    setTempKey(cleaned);
    setApiKey(cleaned);
    localStorage.setItem(GEMINI_KEY_STORAGE, cleaned);
    localStorage.setItem(GEMINI_MODEL_STORAGE, selectedModel);
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 2500);
    setShowKeyConfig(false);
  };

  // Call Gemini REST API safely with strict user/model turn alternation & multi-model fallback
  const callGeminiCloud = async (
    keyToUse: string,
    promptText: string,
    systemInstruction: string,
    priorMessages: ChatMessage[]
  ): Promise<{ replyText: string; usedModel: string }> => {
    const cleanKey = sanitizeKey(keyToUse);

    // Filter out welcome message & fallback warnings, and enforce strict user -> model alternation
    const filtered = priorMessages.filter(
      (m) => m.id !== 'welcome-1' && !m.content.startsWith('⚠️')
    );
    const alternatingHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    for (const msg of filtered.slice(-6)) {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      if (alternatingHistory.length === 0 && role === 'model') {
        // Gemini requires the first turn in contents to be 'user'
        continue;
      }
      const prev = alternatingHistory[alternatingHistory.length - 1];
      if (prev && prev.role === role) {
        prev.parts[0].text += `\n${msg.content}`;
      } else {
        alternatingHistory.push({
          role,
          parts: [{ text: msg.content }],
        });
      }
    }
    // Ensure the last history item before appending current user message is 'model'
    if (
      alternatingHistory.length > 0 &&
      alternatingHistory[alternatingHistory.length - 1].role === 'user'
    ) {
      alternatingHistory.pop();
    }

    const candidateModels: GeminiModelId[] = Array.from(
      new Set<GeminiModelId>([
        selectedModel,
        'gemini-2.0-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
      ])
    ).slice(0, 2);

    let firstError = '';
    const mainAbort = new AbortController();
    abortControllerRef.current = mainAbort;

    const payloadBody = JSON.stringify({
      contents: [
        ...alternatingHistory.slice(-4),
        {
          role: 'user',
          parts: [
            {
              text: `[KONTEKS KASIR REAL-TIME]\n${systemInstruction}\n\n[PERTANYAAN PENGGUNA]\n${promptText}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
      },
    });

    for (const modelId of candidateModels) {
      if (mainAbort.signal.aborted) {
        throw new Error('Permintaan dibatalkan oleh pengguna.');
      }

      const proxyUrl = `/api/gemini/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(
        cleanKey
      )}`;
      const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(
        cleanKey
      )}`;

      const timeoutCtrl = new AbortController();
      const onMainAbort = () => timeoutCtrl.abort();
      mainAbort.signal.addEventListener('abort', onMainAbort);
      const timer = setTimeout(() => timeoutCtrl.abort(), 8000);

      try {
        let response: Response;
        try {
          // 1. Call local IPv4-forced Vite proxy first (~130ms, bypasses broken ISP IPv6)
          response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadBody,
            signal: timeoutCtrl.signal,
          });
          const contentType = response.headers.get('content-type') || '';
          if (response.status === 404 && !contentType.includes('application/json')) {
            throw new Error('Static host without proxy');
          }
        } catch {
          // 2. Fallback to direct URL with a fresh controller
          const fallbackCtrl = new AbortController();
          const fallbackTimer = setTimeout(() => fallbackCtrl.abort(), 6000);
          try {
            response = await fetch(directUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: payloadBody,
              signal: fallbackCtrl.signal,
            });
          } finally {
            clearTimeout(fallbackTimer);
          }
        }

        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const text =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            'Maaf, tidak ada respons teks dari Gemini Cloud.';
          if (modelId !== selectedModel) {
            setSelectedModel(modelId);
            localStorage.setItem(GEMINI_MODEL_STORAGE, modelId);
          }
          return { replyText: text, usedModel: modelId };
        } else {
          const errMsg = data?.error?.message || `Error HTTP ${response.status}`;
          if (!firstError) firstError = errMsg;
          if (
            response.status === 400 &&
            (errMsg.toLowerCase().includes('api key') ||
              errMsg.toLowerCase().includes('api_key_invalid'))
          ) {
            throw new Error('API Key Google Gemini tidak valid. Periksa kembali API Key Anda.');
          }
        }
      } catch (fetchErr: any) {
        if (mainAbort.signal.aborted) {
          throw new Error('Dihentikan');
        }
        if (fetchErr?.name === 'AbortError') {
          if (!firstError) {
            firstError = `Batas waktu koneksi habis (6 detik) pada ${modelId}`;
          }
        } else if (!firstError) {
          firstError = fetchErr?.message || 'Gagal terhubung ke Google Cloud';
        }
        if (fetchErr?.message?.includes('API Key Google Gemini tidak valid')) {
          throw fetchErr;
        }
      } finally {
        clearTimeout(timer);
        mainAbort.signal.removeEventListener('abort', onMainAbort);
      }
    }

    throw new Error(firstError || 'Gagal menghubungi server Google Gemini Cloud.');
  };

  const handleTestConnection = async () => {
    if (!isAdmin) return;
    const cleaned = sanitizeKey(tempKey);
    if (!cleaned) {
      setTestStatus({
        type: 'error',
        message: 'Masukkan API Key Google AI Studio terlebih dahulu (AIzaSy...).',
      });
      return;
    }
    setTestStatus({
      type: 'loading',
      message: `Menguji koneksi ke ${selectedModel}...`,
    });
    try {
      const res = await callGeminiCloud(
        cleaned,
        'Jawab singkat: Koneksi KopiNusa POS berhasil!',
        'Anda adalah asisten KopiNusa POS.',
        []
      );
      setApiKey(cleaned);
      setTempKey(cleaned);
      localStorage.setItem(GEMINI_KEY_STORAGE, cleaned);
      localStorage.setItem(GEMINI_MODEL_STORAGE, selectedModel);
      setTestStatus({
        type: 'success',
        message: `✓ Terhubung ke ${res.usedModel}! API Key otomatis disimpan.`,
      });
    } catch (err: any) {
      setTestStatus({
        type: 'error',
        message: `Gagal: ${err.message}`,
      });
    }
  };

  // Build real-time POS context string for Gemini
  const buildPosContext = () => {
    const availableItems = menuItems.filter((m) => m.isAvailable && m.stock > 0);
    const lowStockItems = menuItems.filter(
      (m) => m.isAvailable && m.stock > 0 && m.stock <= m.minStock
    );
    const outItems = menuItems.filter((m) => !m.isAvailable || m.stock <= 0);

    const validTrx = transactions.filter((t) => t.status !== 'Void');
    const omset = validTrx.reduce((s, t) => s + t.totalAmount, 0);
    const hpp = validTrx.reduce(
      (s, t) =>
        s + t.items.reduce((is, i) => is + i.costPrice * i.quantity, 0),
      0
    );
    const extraIncome = cashflow
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + c.amount, 0);
    const expenses = cashflow
      .filter((c) => c.type === 'expense')
      .reduce((s, c) => s + c.amount, 0);
    const netProfit = omset + extraIncome - expenses - hpp;

    const menuSummary = menuItems
      .map(
        (m) =>
          `- ${m.name} (${m.category}): Harga ${formatRupiah(m.price)}${
            isAdmin ? `, HPP ${formatRupiah(m.costPrice)}` : ''
          }, Stok: ${m.stock} ${m.unit} (${
            !m.isAvailable || m.stock <= 0
              ? 'HABIS'
              : m.stock <= m.minStock
              ? 'MENIPIS'
              : 'TERSEDIA'
          })`
      )
      .join('\n');

    return `
Anda adalah "KopiNusa AI Agent", asisten pintar pada aplikasi kasir tablet "${settings.storeName}".
Jawablah selalu dalam Bahasa Indonesia yang singkat, padat, ramah, dan terstruktur dengan bullet points agar mudah dibaca di layar tablet.

PENGGUNA AKTIF SAAT INI:
- Nama: ${currentUser.name}
- Peran (Role): ${isAdmin ? 'ADMIN / OWNER (Akses Edit Penuh)' : 'KASIR / KARYAWAN (Mode Terbatas, Tidak Bisa Edit Barang/Struk/Keuangan)'}

ATURAN HAK AKSES PENTING:
- Akun KASIR (Mode Client): Hanya bisa membuat pesanan di tab "Kasir & Order", melihat stok di tab "Stok & Barang", melihat kas di tab "Omset & Kas", dan mencetak struk. Kasir TIDAK BISA mengedit harga/stok barang, TIDAK BISA mengedit/menghapus struk yang sudah selesai, dan TIDAK BISA mengubah pengaturan toko.
- Akun ADMIN (Mode Server): Memiliki akses penuh untuk tambah/edit barang, restock (+1/-1/+10), koreksi/edit struk transaksi, catat/edit pemasukan & pengeluaran, kustomisasi template struk, serta mengubah PIN keamanan. JANGAN PERNAH menyebutkan atau membocorkan angka PIN Admin maupun Kasir di dalam chat!

DATA REAL-TIME KAFE SAAT INI:
- Total Menu: ${menuItems.length} (${availableItems.length} tersedia, ${lowStockItems.length} stok menipis, ${outItems.length} habis)
- Menu Stok Habis: ${outItems.map((m) => m.name).join(', ') || 'Tidak ada'}
- Menu Stok Menipis: ${lowStockItems.map((m) => `${m.name} (sisa ${m.stock})`).join(', ') || 'Tidak ada'}
- Jumlah Transaksi Selesai: ${validTrx.length} struk
- Total Omset Penjualan POS: ${formatRupiah(omset)}
- Pemasukan Lain: ${formatRupiah(extraIncome)}
- Total Pengeluaran Operasional: ${formatRupiah(expenses)}
${isAdmin ? `- Total HPP Bahan Terjual: ${formatRupiah(hpp)}\n- Estimasi Laba Bersih: ${formatRupiah(netProfit)}` : ''}
- Pajak PB1: ${settings.taxPercent}%, Service Charge: ${settings.servicePercent}%

DAFTAR MENU & STOK:
${menuSummary}
`.trim();
  };

  // Comprehensive Automatic POS AI Engine (works 100% offline/instant & as seamless fallback)
  const generateSmartLocalFallback = (question: string): string => {
    const q = question.toLowerCase().trim();
    const availItems = menuItems.filter((m) => m.isAvailable && m.stock > 0);
    const lowStock = menuItems.filter(
      (m) => m.isAvailable && m.stock > 0 && m.stock <= m.minStock
    );
    const outStock = menuItems.filter((m) => !m.isAvailable || m.stock <= 0);
    const validTrx = transactions.filter((t) => t.status !== 'Void');
    const omset = validTrx.reduce((s, t) => s + t.totalAmount, 0);
    const extraIncome = cashflow
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + c.amount, 0);
    const expenses = cashflow
      .filter((c) => c.type === 'expense')
      .reduce((s, c) => s + c.amount, 0);
    const hpp = validTrx.reduce(
      (s, t) =>
        s + t.items.reduce((is, i) => is + i.costPrice * i.quantity, 0),
      0
    );
    const netProfit = omset + extraIncome - expenses - hpp;

    // Calculate best-selling items from transactions
    const salesCountMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    validTrx.forEach((t) => {
      t.items.forEach((it) => {
        if (!salesCountMap[it.name]) {
          salesCountMap[it.name] = { name: it.name, qty: 0, revenue: 0 };
        }
        salesCountMap[it.name].qty += it.quantity;
        salesCountMap[it.name].revenue += it.price * it.quantity;
      });
    });
    const topSellers = Object.values(salesCountMap).sort((a, b) => b.qty - a.qty);

    // 1. Check if user is asking about a specific menu item by name
    const matchedMenus = menuItems.filter((m) => {
      const words = m.name.toLowerCase().split(/\s+/);
      return (
        q.includes(m.name.toLowerCase()) ||
        q.includes(m.sku.toLowerCase()) ||
        words.some((w) => w.length >= 4 && q.includes(w))
      );
    });

    if (matchedMenus.length > 0 && !q.includes('cara edit')) {
      const list = matchedMenus
        .slice(0, 5)
        .map(
          (m) =>
            `• ${m.emoji} **${m.name}** (${m.category})\n  Harga: **${formatRupiah(
              m.price
            )}**${
              isAdmin
                ? ` | HPP: ${formatRupiah(m.costPrice)} (Margin ${formatRupiah(
                    m.price - m.costPrice
                  )})`
                : ''
            } | Stok: **${m.stock} ${m.unit}** (${
              !m.isAvailable || m.stock <= 0
                ? '❌ HABIS'
                : m.stock <= m.minStock
                ? '⚠️ MENIPIS'
                : '✅ TERSEDIA'
            })`
        )
        .join('\n');
      return `🔎 **Info Menu yang Anda Cari:**\n\n${list}\n\n💡 *Sentuh kartu menu di tab **Kasir & Order** untuk langsung memasukkan ke keranjang pesanan.*`;
    }

    // 2. Stock / Inventory queries
    if (
      q.includes('stok') ||
      q.includes('habis') ||
      q.includes('tipis') ||
      q.includes('barang') ||
      q.includes('restock') ||
      q.includes('gudang')
    ) {
      return `📦 **Laporan Stok & Barang Real-Time (${menuItems.length} Menu):**\n\n• **Stok Aman (${availItems.length - lowStock.length} menu)**: Siap dijual\n• **Menu Habis (${outStock.length})**: ${
        outStock.map((m) => `${m.emoji} ${m.name}`).join(', ') || 'Tidak ada (Semua tersedia!)'
      }\n• **Stok Menipis (${lowStock.length})**: ${
        lowStock.map((m) => `${m.emoji} ${m.name} (sisa ${m.stock} ${m.unit})`).join(', ') || 'Aman semua'
      }\n\n💡 **Cara Kelola Stok**: Buka menu **Stok & Barang** di kiri. ${
        isAdmin
          ? 'Anda sedang di **Mode Server (Admin)**, silakan klik tombol **+1 / +10** untuk tambah stok cepat atau **+ Tambah Barang Baru**.'
          : 'Saat ini Anda di **Mode Client (Kasir)** (hanya lihat). Untuk mengubah stok/harga, silakan masuk ke **Mode Server (Admin)** dengan PIN rahasia Admin.'
      }`;
    }

    // 3. Finance / Omset / Laba / Payment methods / Best sellers
    if (
      q.includes('omset') ||
      q.includes('laba') ||
      q.includes('untung') ||
      q.includes('keuangan') ||
      q.includes('pengeluaran') ||
      q.includes('pemasukan') ||
      q.includes('kas') ||
      q.includes('laku') ||
      q.includes('terlaris') ||
      q.includes('qris') ||
      q.includes('tunai')
    ) {
      const byMethod = validTrx.reduce((acc, t) => {
        acc[t.paymentMethod] = (acc[t.paymentMethod] || 0) + t.totalAmount;
        return acc;
      }, {} as Record<string, number>);
      const methodSummary =
        Object.entries(byMethod)
          .map(([k, v]) => `${k}: **${formatRupiah(v)}**`)
          .join(' • ') || 'Belum ada';

      const topText =
        topSellers
          .slice(0, 3)
          .map((t, idx) => `${idx + 1}. **${t.name}** (${t.qty} terjual)`)
          .join(', ') || 'Belum ada penjualan';

      return `💰 **Analisis Omset & Arus Kas Real-Time:**\n\n• **Omset Penjualan POS**: **${formatRupiah(
        omset
      )}** (${validTrx.length} struk selesai)\n• **Rincian Metode Bayar**: ${methodSummary}\n• **Pemasukan Kas Lain**: **${formatRupiah(
        extraIncome
      )}**\n• **Total Pengeluaran Kas**: **${formatRupiah(expenses)}**${
        isAdmin
          ? `\n• **Total HPP Bahan**: **${formatRupiah(hpp)}**\n• **Estimasi Laba Bersih**: **${formatRupiah(
              netProfit
            )}**`
          : '\n• 🔒 *Info HPP & Laba Bersih hanya ditampilkan pada Mode Admin.*'
      }\n\n🏆 **Menu Paling Laris**: ${topText}`;
    }

    // 4. Receipts / Struk / Printer / Tax / Wi-Fi
    if (
      q.includes('struk') ||
      q.includes('nota') ||
      q.includes('cetak') ||
      q.includes('print') ||
      q.includes('koreksi') ||
      q.includes('edit') ||
      q.includes('pajak') ||
      q.includes('wifi')
    ) {
      return `🧾 **Panduan Struk, Pajak & Kustomisasi Nota:**\n\n• **Cetak Ulang Struk**: Buka tab **Struk & Akun** → klik baris transaksi → klik **Cetak Struk Thermal**.\n• **Edit / Koreksi Struk**: Hanya bisa dilakukan di **Mode Server (Admin)**. Buka struk lalu klik tombol **Edit Struk** untuk ubah item, qty, metode bayar, atau diskon.\n• **Info Pajak & Wi-Fi Aktif**: PB1 **${settings.taxPercent}%**, Service **${settings.servicePercent}%**, Wi-Fi: **${settings.wifiName}** (Pass: \`${settings.wifiPassword}\`).`;
    }

    // 5. Menu Recommendations / Price list / Murah / Mahal
    if (
      q.includes('rekomendasi') ||
      q.includes('paket') ||
      q.includes('menu') ||
      q.includes('daftar harga') ||
      q.includes('murah') ||
      q.includes('mahal') ||
      q.includes('kopi') ||
      q.includes('makanan') ||
      q.includes('snack')
    ) {
      const sortedByPrice = [...availItems].sort((a, b) => a.price - b.price);
      const cheapest = sortedByPrice.slice(0, 3);
      const availDrinks = availItems.filter(
        (m) => m.category === 'Kopi & Espresso' || m.category === 'Non-Kopi & Teh'
      );
      const availFood = availItems.filter(
        (m) => m.category === 'Makanan Berat' || m.category === 'Snack & Pastry'
      );
      return `☕ **Rekomendasi & Daftar Menu Siap Jual (${availItems.length} Tersedia):**\n\n• **Minuman Andalan**: ${availDrinks
        .slice(0, 3)
        .map((d) => `${d.emoji} **${d.name}** (${formatRupiah(d.price)})`)
        .join(', ')}\n• **Makanan & Pastry**: ${availFood
        .slice(0, 3)
        .map((s) => `${s.emoji} **${s.name}** (${formatRupiah(s.price)})`)
        .join(', ')}\n• **Paling Hemat**: ${cheapest
        .map((c) => `${c.name} (${formatRupiah(c.price)})`)
        .join(', ')}\n• **Paket Bundling**: 🎁 **Paket Hemat Ngopi & Croissant** (**Rp 44.000**).`;
    }

    // 6. Account / PIN / Admin vs Cashier role questions
    if (
      q.includes('admin') ||
      q.includes('kasir') ||
      q.includes('pin') ||
      q.includes('login') ||
      q.includes('akun') ||
      q.includes('shift') ||
      q.includes('kunci') ||
      q.includes('apikey') ||
      q.includes('api key')
    ) {
      return `🔐 **Panduan Hak Akses Mode Server (Admin) vs Mode Client (Kasir):**\n\n• **Sesi Anda Saat Ini**: **${currentUser.name}** (${
        isAdmin ? '✅ MODE SERVER ADMIN - Akses Penuh' : '👤 MODE CLIENT KASIR - Terbatas'
      })\n• **Mode Server (Admin)**: Memiliki akses penuh untuk mengubah PIN keamanan, edit barang/stok, koreksi struk, edit arus kas, dan atur API Key AI.\n• **Mode Client (Kasir / Karyawan)**: Hanya dapat menginput pesanan kasir & cetak struk tanpa akses edit data server.\n• **Cara Ganti Sesi / Ubah PIN**: Klik tombol **PIN / Akun** di kanan atas layar.`;
    }

    // 7. Default conversational assistant for "bingung", "cara pakai", greetings, etc.
    return `👋 **Halo ${currentUser.name.split(' (')[0]}! Berikut Panduan Cepat & Status Kasir Saat Ini:**\n\n• **Cara Input Order Kasir**: Di tab **Kasir & Order**, pilih *Dine-In / Takeaway*, ketuk menu untuk masuk keranjang, pilih metode bayar (*Tunai / QRIS / Debit*), lalu klik **Selesaikan & Cetak Struk**.\n• **Atur Gula / Es / Catatan**: Klik ikon *slider* kecil di pojok kanan kartu menu.\n• **Ringkasan Kafe Saat Ini**: Omset **${formatRupiah(
      omset
    )}** (${validTrx.length} transaksi) • Stok menipis: **${lowStock.length} barang** • Stok habis: **${outStock.length} barang**.\n\n💬 *Silakan ketik pertanyaan spesifik seperti: **"Cek stok yang habis"**, **"Berapa omset & laba hari ini?"**, **"Harga Kopi Susu Aren"**, atau **"Cara edit struk"**!*`;
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? input).trim();
    if (!textToSend) return;

    // If a previous request was still running, abort it so it never blocks new messages
    if (isLoading) {
      abortControllerRef.current?.abort();
    }

    // Auto-save tempKey if Admin typed an API key and immediately sent a chat message
    let activeKey = sanitizeKey(apiKey);
    if (isAdmin && sanitizeKey(tempKey) && sanitizeKey(tempKey) !== activeKey) {
      activeKey = sanitizeKey(tempKey);
      setApiKey(activeKey);
      localStorage.setItem(GEMINI_KEY_STORAGE, activeKey);
      localStorage.setItem(GEMINI_MODEL_STORAGE, selectedModel);
    }

    const priorMessages = [...messages];
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setLastPendingPrompt(textToSend);
    setIsLoading(true);

    // If a valid Google API Key (AIza...) is configured, try Google Gemini Cloud API first;
    // otherwise or on any cloud error, seamlessly answer using the Automatic Smart POS Engine
    if (activeKey && activeKey.startsWith('AIza') && activeKey.length >= 30) {
      try {
        const systemInstruction = buildPosContext();
        const { replyText, usedModel } = await callGeminiCloud(
          activeKey,
          textToSend,
          systemInstruction,
          priorMessages
        );

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: replyText,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            source: `Google Cloud: ${usedModel}`,
          },
        ]);
      } catch (err: any) {
        if (err?.message === 'Dihentikan') {
          return;
        }
        const fallback = generateSmartLocalFallback(textToSend);
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: fallback,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            source: 'AI Kasir Otomatis (Real-Time)',
          },
        ]);
      } finally {
        setIsLoading(false);
        setLastPendingPrompt('');
      }
    } else {
      // Instant automatic chat response (~200ms)
      setTimeout(() => {
        const reply = generateSmartLocalFallback(textToSend);
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: reply,
            timestamp: new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            source: 'AI Kasir Otomatis (Real-Time)',
          },
        ]);
        setIsLoading(false);
        setLastPendingPrompt('');
      }, 220);
    }
  };

  const quickPrompts = [
    'Barang apa yang stoknya tipis atau habis?',
    'Ringkasan omset & laba bersih hari ini',
    'Rekomendasi paket menu kopi & snack',
    'Bagaimana cara edit struk atau stok barang?',
  ];

  // Simple markdown-like formatter for bold & bullet lines
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <div key={i} className={line.trim() === '' ? 'h-2' : 'leading-relaxed'}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={j} className="font-extrabold text-amber-300">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={j}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Slide-over Tablet AI Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md border-l border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-indigo-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
                  <Bot className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-white text-sm">
                      Tanya AI Agent POS
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      <Zap className="h-2.5 w-2.5" /> {selectedModel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {apiKey
                      ? '✓ Terhubung ke Google Gemini Flash Cloud'
                      : isAdmin
                      ? 'Klik ⚙️ untuk isi API Key Gemini Cloud (Mode Admin)'
                      : 'Asisten Siap • API Key Cloud diatur oleh Admin'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTempKey(apiKey);
                    setShowKeyConfig(!showKeyConfig);
                  }}
                  className={`relative rounded-xl p-2 transition flex items-center gap-1 text-xs font-bold ${
                    showKeyConfig || (!apiKey && isAdmin)
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                  title={
                    isAdmin
                      ? 'Pengaturan API Key & Model Gemini Flash (Mode Admin)'
                      : 'Pengaturan API Key Dikunci (Hanya Mode Admin)'
                  }
                >
                  <Settings2 className="h-4 w-4" />
                  {!isAdmin && (
                    <Lock className="h-3 w-3 text-amber-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {keySavedToast && (
              <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-2 text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>API Key & Model Gemini Flash berhasil disimpan oleh Admin!</span>
              </div>
            )}

            {/* Collapsible Gemini Cloud API Key & Model Selector (Admin Only) */}
            <AnimatePresence>
              {showKeyConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-slate-800 bg-slate-950/95"
                >
                  {!isAdmin ? (
                    <div className="p-4 space-y-3 text-xs">
                      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                        <div className="h-9 w-9 shrink-0 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                          <Lock className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="font-extrabold text-amber-300">
                            API Key Hanya Bisa Diubah di Mode Admin
                          </div>
                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            Anda sedang berada di <strong>Mode Client Kasir ({currentUser.name.split(' (')[0]})</strong>. Demi keamanan kuota cloud, hanya <strong>Server Admin</strong> yang dapat melihat atau mengubah API Key Google Gemini Flash.
                          </p>
                          <div className="pt-1 text-[11px] text-slate-400">
                            Status Cloud saat ini:{' '}
                            {apiKey ? (
                              <span className="text-emerald-400 font-bold">
                                ✓ Aktif ({selectedModel})
                              </span>
                            ) : (
                              <span className="text-amber-300 font-bold">
                                Belum diisi Admin (Mode Lokal Pintar Aktif)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowKeyConfig(false)}
                          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-300 font-semibold"
                        >
                          Tutup
                        </button>
                        {onRequestAdminLogin && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowKeyConfig(false);
                              onRequestAdminLogin();
                            }}
                            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 font-extrabold text-slate-950 flex items-center gap-1.5"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            <span>Masuk Mode Admin (PIN)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveApiKey} className="p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          <span>Konfigurasi Admin: Google Gemini Flash Cloud</span>
                        </span>
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                        >
                          <span>Ambil API Key Gratis</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">
                          Pilih Model Google Flash (Limit Longgar & Respons Cepat)
                        </label>
                        <select
                          value={selectedModel}
                          onChange={(e) =>
                            setSelectedModel(e.target.value as GeminiModelId)
                          }
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white font-semibold"
                        >
                          <option value="gemini-2.5-flash">
                            gemini-2.5-flash (Recommended • Cepat, Cerdas & Kuota Longgar)
                          </option>
                          <option value="gemini-2.5-flash-lite">
                            gemini-2.5-flash-lite (Limit Paling Longgar • 1.000+ req/hari)
                          </option>
                          <option value="gemini-2.0-flash">
                            gemini-2.0-flash (Stabil & Respons Instan)
                          </option>
                          <option value="gemini-2.0-flash-lite">
                            gemini-2.0-flash-lite (Ringan & Cadangan Kuota Longgar)
                          </option>
                          <option value="gemini-flash-latest">
                            gemini-flash-latest (Auto-Alias Flash Terbaru)
                          </option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                          *Otomatis fallback antar seri Gemini Flash jika salah satu model sedang penuh.
                        </p>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">
                          Google AI Studio API Key (Khusus Admin)
                        </label>
                        <input
                          type="password"
                          value={tempKey}
                          onChange={(e) => {
                            setTempKey(e.target.value);
                            setTestStatus({ type: 'idle', message: '' });
                          }}
                          placeholder="AIzaSy..."
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white font-mono"
                        />
                      </div>

                      {testStatus.type !== 'idle' && (
                        <div
                          className={`rounded-xl px-3 py-2 text-[11px] font-semibold border ${
                            testStatus.type === 'success'
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                              : testStatus.type === 'error'
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                              : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
                          }`}
                        >
                          {testStatus.message}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        {apiKey ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTempKey('');
                              setApiKey('');
                              localStorage.removeItem(GEMINI_KEY_STORAGE);
                              setTestStatus({ type: 'idle', message: '' });
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Hapus Key</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            Tersimpan di kasir ini
                          </span>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={testStatus.type === 'loading'}
                            className="rounded-xl border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 px-3 py-1.5 text-sky-300 font-bold"
                          >
                            {testStatus.type === 'loading' ? 'Menguji...' : 'Tes Koneksi'}
                          </button>
                          <button
                            type="submit"
                            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 font-extrabold text-slate-950 flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Simpan</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-semibold rounded-br-sm'
                        : 'border border-slate-800 bg-slate-950/90 text-slate-200 rounded-bl-sm'
                    }`}
                  >
                    {msg.role === 'assistant'
                      ? renderFormattedText(msg.content)
                      : msg.content}
                  </div>
                  <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-slate-500">
                    <span>{msg.timestamp}</span>
                    {msg.source && <span>• {msg.source}</span>}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-amber-300 w-full">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 animate-spin shrink-0" />
                    <span>Menghubungi Gemini Flash...</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelAndFallback}
                    className="shrink-0 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition"
                  >
                    Jawab Instan ⚡
                  </button>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/50">
              <div className="text-[10px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                <HelpCircle className="h-3 w-3 text-amber-400" />
                <span>Pertanyaan Cepat (Sentuh untuk Tanya):</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    onClick={() => handleSendMessage(qp)}
                    className="shrink-0 rounded-xl border border-slate-800 bg-slate-900 hover:border-amber-500/50 hover:text-amber-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition active:scale-95"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Box */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t border-slate-800 bg-slate-900 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanya AI seputar stok, omset, atau cara pakai kasir..."
                className="flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 transition active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
