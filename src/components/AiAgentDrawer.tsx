import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Send,
  X,
  KeyRound,
  ShieldCheck,
  Settings2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  HelpCircle,
  Zap,
  Lock,
  TrendingUp,
  PackageSearch,
  Coffee,
  Copy,
  Check,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import {
  MenuItem,
  Transaction,
  CashflowRecord,
  UserAccount,
  StoreSettings,
} from '../types';
import { formatRupiah } from '../data/initialData';
import {
  springSnappy,
  springSoft,
  tapScale,
  hoverLift,
  staggerContainer,
  fadeUpItem,
} from '../lib/motion';

interface AiAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  transactions: Transaction[];
  cashflow: CashflowRecord[];
  currentUser: UserAccount;
  settings: StoreSettings;
  onRequestAdminLogin?: () => void;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}

// Model ID is a free string so newly discovered Gemini models (via ListModels) can be used too.
export type GeminiModelId = string;

// Aliases "-latest" always point to Google's newest Flash models, so they don't break
// when older versions (e.g. gemini-2.0-flash, shut down June 2026) are retired.
const DEFAULT_GEMINI_MODEL: GeminiModelId = 'gemini-flash-latest';
const FALLBACK_GEMINI_MODELS: GeminiModelId[] = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];
// Retired models: saved selections of these are migrated automatically to the default.
const RETIRED_GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-pro',
];
const GEMINI_DIRECT_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_PROXY_BASE = '/api/gemini';
const GEMINI_TIMEOUT_MS = 25000;

const loadSavedModel = (): GeminiModelId => {
  const saved = localStorage.getItem('kopinusa_gemini_model_v1');
  if (!saved || RETIRED_GEMINI_MODELS.includes(saved)) return DEFAULT_GEMINI_MODEL;
  return saved;
};

interface GeminiError extends Error {
  status?: number;
  fatal?: boolean;
}

const makeGeminiError = (message: string, status?: number, fatal = false): GeminiError => {
  const err = new Error(message) as GeminiError;
  err.status = status;
  err.fatal = fatal;
  return err;
};

// Translate raw Gemini API errors into a clear Indonesian explanation.
const explainGeminiError = (status: number, rawMessage: string): GeminiError => {
  const msg = rawMessage.toLowerCase();
  if (msg.includes('api key not valid') || msg.includes('api_key_invalid') || msg.includes('api key expired')) {
    return makeGeminiError('API Key Google Gemini tidak valid / kedaluwarsa. Buat ulang di aistudio.google.com.', status, true);
  }
  if (status === 403) {
    if (msg.includes('referer') || msg.includes('referrer')) {
      return makeGeminiError(`API Key dibatasi HTTP referrer — tambahkan domain ini (${window.location.origin}) di Google Cloud Console.`, status, true);
    }
    return makeGeminiError(`Akses ditolak (403): ${rawMessage}. Pastikan "Generative Language API" aktif untuk key ini.`, status, true);
  }
  if (status === 429) {
    return makeGeminiError('Kuota / rate limit Gemini habis (429). Tunggu sebentar atau ganti ke model "lite".', status);
  }
  if (status === 404) {
    return makeGeminiError(`Model tidak ditemukan / sudah dihentikan: ${rawMessage}`, status);
  }
  if (status === 400 && msg.includes('location')) {
    return makeGeminiError('Gemini API tidak tersedia di lokasi/jaringan ini (400 location not supported).', status, true);
  }
  return makeGeminiError(rawMessage || `Error HTTP ${status}`, status);
};

// Fetch via local IPv4 Vite proxy first; if no proxy exists (static hosting), call Google directly.
const geminiFetch = async (
  pathWithQuery: string,
  init: RequestInit,
  signal: AbortSignal
): Promise<Response> => {
  try {
    const res = await fetch(`${GEMINI_PROXY_BASE}${pathWithQuery}`, { ...init, signal });
    const contentType = res.headers.get('content-type') || '';
    // Static hosts (GitHub Pages, Netlify, etc.) answer with HTML 404/405 — not our proxy.
    if (!contentType.includes('application/json')) {
      throw new Error('Proxy tidak tersedia');
    }
    return res;
  } catch (err: any) {
    if (signal.aborted) throw err;
    return fetch(`${GEMINI_DIRECT_BASE}${pathWithQuery}`, { ...init, signal });
  }
};

// Ask Google which Flash models are actually available for this API key.
const discoverFlashModels = async (key: string, signal: AbortSignal): Promise<GeminiModelId[]> => {
  try {
    const res = await geminiFetch(
      `/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`,
      { method: 'GET' },
      signal
    );
    if (!res.ok) return [];
    const data = await res.json();
    const names: string[] = (data?.models || [])
      .filter(
        (m: any) =>
          Array.isArray(m?.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
      )
      .map((m: any) => String(m.name || '').replace(/^models\//, ''))
      .filter(
        (n: string) =>
          n.includes('flash') && !/(image|tts|audio|live|embedding|thinking-exp)/.test(n)
      );
    const score = (n: string) =>
      (n.endsWith('-latest') ? 1000 : 0) +
      (n.includes('preview') || n.includes('exp') ? -500 : 0) +
      (n.includes('lite') ? -1 : 0) +
      (parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || '0') * 10);
    return names.sort((a, b) => score(b) - score(a));
  } catch {
    return [];
  }
};

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
  initialPrompt,
  onClearInitialPrompt,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(GEMINI_KEY_STORAGE) || ''
  );
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(loadSavedModel);
  const [discoveredModels, setDiscoveredModels] = useState<GeminiModelId[]>([]);
  const [activeTopic, setActiveTopic] = useState<
    'quick' | 'finance' | 'stock' | 'menu' | 'guide'
  >('quick');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const modelOptions = Array.from(
    new Set<GeminiModelId>([
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      ...discoveredModels,
      ...FALLBACK_GEMINI_MODELS,
      selectedModel,
    ])
  ).map((id) => ({
    id,
    label:
      id === 'gemini-flash-latest'
        ? 'gemini-flash-latest (Recommended • Flash terbaru otomatis)'
        : id === 'gemini-flash-lite-latest'
        ? 'gemini-flash-lite-latest (Kuota paling longgar)'
        : id,
  }));
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

  // Automatically discover available Flash models when API key is configured
  useEffect(() => {
    const clean = sanitizeKey(apiKey);
    if (!clean || !clean.startsWith('AIza') || clean.length < 30) return;
    const ctrl = new AbortController();
    discoverFlashModels(clean, ctrl.signal).then((models) => {
      if (models.length > 0) {
        setDiscoveredModels(models);
      }
    });
    return () => ctrl.abort();
  }, [apiKey]);

  const buildWelcomeMessage = (): ChatMessage => ({
    id: 'welcome-1',
    role: 'assistant',
    content: `Halo **${currentUser.name.split(' (')[0]}**! 👋 Saya **KopiNusa AI Agent (Google Gemini Flash Cloud)**.\n\nPilih **Opsi Tanya AI** di bawah atau ketik langsung pertanyaan seputar stok barang, analisis omset & laba, rekomendasi paket menu, maupun panduan kasir!`,
    timestamp: new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    source: 'Gemini Flash Cloud Ready',
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildWelcomeMessage()]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastPendingPrompt, setLastPendingPrompt] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleCopyMessage = (msg: ChatMessage) => {
    const plain = msg.content.replace(/\*\*/g, '');
    navigator.clipboard?.writeText(plain).catch(() => {});
    setCopiedId(msg.id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === msg.id ? null : prev));
    }, 1800);
  };

  const handleResetChat = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setLastPendingPrompt('');
    setMessages([buildWelcomeMessage()]);
  };

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
    if (
      alternatingHistory.length > 0 &&
      alternatingHistory[alternatingHistory.length - 1].role === 'user'
    ) {
      alternatingHistory.pop();
    }

    const candidateModels: GeminiModelId[] = Array.from(
      new Set<GeminiModelId>([
        selectedModel,
        ...discoveredModels,
        ...FALLBACK_GEMINI_MODELS,
      ])
    ).slice(0, 3);

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
        maxOutputTokens: 550,
      },
    });

    for (const modelId of candidateModels) {
      if (mainAbort.signal.aborted) {
        throw new Error('Permintaan dibatalkan oleh pengguna.');
      }

      const timeoutCtrl = new AbortController();
      const onMainAbort = () => timeoutCtrl.abort();
      mainAbort.signal.addEventListener('abort', onMainAbort);
      const timer = setTimeout(() => timeoutCtrl.abort(), GEMINI_TIMEOUT_MS);

      try {
        const response = await geminiFetch(
          `/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(cleanKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payloadBody,
          },
          timeoutCtrl.signal
        );

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
          const rawMsg = data?.error?.message || `Error HTTP ${response.status}`;
          const explained = explainGeminiError(response.status, rawMsg);
          if (!firstError) firstError = explained.message;
          if (explained.fatal) {
            throw explained;
          }
        }
      } catch (fetchErr: any) {
        if (mainAbort.signal.aborted) {
          throw new Error('Dihentikan');
        }
        if (fetchErr?.fatal) {
          throw fetchErr;
        }
        if (fetchErr?.name === 'AbortError') {
          if (!firstError) {
            firstError = `Batas waktu koneksi habis pada ${modelId}`;
          }
        } else if (!firstError) {
          firstError = fetchErr?.message || 'Gagal terhubung ke Google Cloud';
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

  // Automatically trigger contextual prompt when opened from "Tanya AI" buttons across views
  useEffect(() => {
    if (isOpen && initialPrompt && initialPrompt.trim()) {
      const promptToRun = initialPrompt.trim();
      onClearInitialPrompt?.();
      handleSendMessage(promptToRun);
    }
  }, [isOpen, initialPrompt]);

  const topicCategories = [
    {
      id: 'quick' as const,
      label: '⚡ Populer',
      icon: Sparkles,
      prompts: [
        'Barang apa yang stoknya tipis atau habis?',
        'Ringkasan omset & laba bersih hari ini',
        'Rekomendasi paket menu kopi & snack',
        'Bagaimana cara edit struk atau stok barang?',
      ],
    },
    {
      id: 'finance' as const,
      label: '💰 Omset & Kas',
      icon: TrendingUp,
      prompts: [
        'Berapa omset, pengeluaran, dan laba bersih hari ini?',
        'Menu apa yang paling laris terjual hari ini?',
        'Rincian omset berdasarkan metode pembayaran (QRIS vs Tunai)',
        'Bagaimana cara catat pengeluaran kas operasional?',
      ],
    },
    {
      id: 'stock' as const,
      label: '📦 Stok & Gudang',
      icon: PackageSearch,
      prompts: [
        'Daftar lengkap barang yang stoknya menipis dan habis',
        'Berapa sisa stok Es Kopi Susu Gula Aren?',
        'Prioritas barang apa yang harus segera di-restock?',
        'Bagaimana cara tambah barang baru atau restock +10?',
      ],
    },
    {
      id: 'menu' as const,
      label: '☕ Menu & Promo',
      icon: Coffee,
      prompts: [
        'Rekomendasi menu kopi andalan & makanan berat',
        'Apa saja menu paling hemat di bawah Rp 25.000?',
        'Info harga dan stok Paket Hemat Ngopi & Croissant',
        'Bagaimana cara atur Less Sugar / Less Ice pada pesanan?',
      ],
    },
    {
      id: 'guide' as const,
      label: '🛠️ Panduan POS',
      icon: HelpCircle,
      prompts: [
        'Panduan cara input order kasir sampai cetak struk',
        'Apa perbedaan Mode Client (Kasir) dan Server (Admin)?',
        'Bagaimana cara koreksi struk dan ubah pajak PB1 / Wi-Fi?',
        'Bagaimana cara mengganti PIN keamanan Server Admin?',
      ],
    },
  ];

  const activeTopicObj =
    topicCategories.find((t) => t.id === activeTopic) || topicCategories[0];

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
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-950/65 backdrop-blur-sm"
          />

          {/* Slide-over Tablet AI Drawer */}
          <motion.aside
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={springSnappy}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md border-l border-slate-800 bg-slate-900 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ rotate: -10, scale: 0.9 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={springSnappy}
                  className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-indigo-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20"
                >
                  <Bot className="h-6 w-6 stroke-[2.2]" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                </motion.div>
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
                      ? 'Mode Pintar Aktif • Klik ⚙️ untuk API Key Cloud'
                      : 'Asisten Siap Membantu • Real-Time Data Kasir'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {messages.length > 1 && (
                  <motion.button
                    whileTap={tapScale}
                    type="button"
                    onClick={handleResetChat}
                    className="rounded-xl bg-slate-800/90 hover:bg-slate-700 p-2 text-slate-400 hover:text-white transition"
                    title="Bersihkan Riwayat Percakapan"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </motion.button>
                )}
                <motion.button
                  whileTap={tapScale}
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
                </motion.button>
                <motion.button
                  whileTap={tapScale}
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white transition"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>
            </div>

            <AnimatePresence>
              {keySavedToast && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-2 text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 overflow-hidden"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>API Key & Model Gemini Flash berhasil disimpan oleh Admin!</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Collapsible Gemini Cloud API Key & Model Selector (Admin Only) */}
            <AnimatePresence>
              {showKeyConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={springSoft}
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
                          {modelOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                          *Alias "-latest" selalu menunjuk ke model Flash terbaru Google. Jika model
                          tidak tersedia, aplikasi otomatis mencari model Flash aktif di akun Anda.
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
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={springSoft}
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`group relative max-w-[90%] rounded-2xl px-4 py-3 text-xs shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-semibold rounded-br-sm shadow-amber-500/10'
                          : 'border border-slate-800 bg-slate-950/95 text-slate-200 rounded-bl-sm'
                      }`}
                    >
                      {msg.role === 'assistant'
                        ? renderFormattedText(msg.content)
                        : msg.content}

                      {msg.role === 'assistant' && msg.id !== 'welcome-1' && (
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg)}
                          className="mt-2 pt-1.5 border-t border-slate-800/80 w-full flex items-center justify-end gap-1 text-[10px] font-semibold text-slate-400 hover:text-amber-300 transition"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400">Disalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Salin Jawaban</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-slate-500">
                      <span>{msg.timestamp}</span>
                      {msg.source && <span>• {msg.source}</span>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-slate-950/90 px-4 py-3 text-xs text-amber-300 w-full"
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-4 w-4 animate-spin shrink-0 text-amber-400" />
                    <span>Menganalisis data kasir...</span>
                    <span className="inline-flex items-center gap-1 ml-0.5">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{
                            duration: 0.7,
                            repeat: Infinity,
                            delay: dot * 0.15,
                          }}
                          className="h-1.5 w-1.5 rounded-full bg-amber-400"
                        />
                      ))}
                    </span>
                  </div>
                  <motion.button
                    whileTap={tapScale}
                    type="button"
                    onClick={handleCancelAndFallback}
                    className="shrink-0 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition"
                  >
                    Jawab Instan ⚡
                  </motion.button>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Interactive Categorized "Opsi Tanya AI" Selector */}
            <div className="px-3.5 py-2.5 border-t border-slate-800/90 bg-slate-950/85 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <span>Opsi Tanya AI (Pilih Topik & Pertanyaan Cepat):</span>
                </div>
              </div>

              {/* Topic Filter Tabs with Framer Motion Sliding Pill */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                {topicCategories.map((topic) => {
                  const active = activeTopic === topic.id;
                  return (
                    <motion.button
                      key={topic.id}
                      whileTap={tapScale}
                      type="button"
                      onClick={() => setActiveTopic(topic.id)}
                      className={`relative shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-extrabold transition ${
                        active
                          ? 'text-slate-950'
                          : 'text-slate-400 hover:text-white bg-slate-900/90 border border-slate-800/80'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="aiTopicTab"
                          transition={springSnappy}
                          className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 shadow-sm"
                        />
                      )}
                      <span className="relative z-10">{topic.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Staggered Quick Prompts for Active Topic */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTopic}
                  variants={staggerContainer(0.03, 0.01)}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto pr-0.5 no-scrollbar"
                >
                  {activeTopicObj.prompts.map((qp) => (
                    <motion.button
                      key={qp}
                      variants={fadeUpItem}
                      whileHover={hoverLift}
                      whileTap={tapScale}
                      type="button"
                      onClick={() => handleSendMessage(qp)}
                      className="w-full text-left rounded-xl border border-slate-800/90 bg-slate-900/95 hover:border-amber-500/50 hover:bg-slate-800/90 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:text-amber-300 flex items-center justify-between gap-2 transition"
                    >
                      <span className="truncate">{qp}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-amber-400/80" />
                    </motion.button>
                  ))}
                </motion.div>
              </AnimatePresence>
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
                placeholder="Ketik pertanyaan bebas untuk AI Kasir..."
                className="flex-1 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={tapScale}
                type="submit"
                disabled={!input.trim() || isLoading}
                className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 transition"
              >
                <Send className="h-4 w-4" />
              </motion.button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
