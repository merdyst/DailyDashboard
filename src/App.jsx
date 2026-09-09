import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";

const BIN_ID = "6a4c695cf5f4af5e296a28a4";
const MASTER_KEY = "$2a$10$O2F0Os04xfXpTPk7jCdHpeDQGKXiJdwlSlpnuFrlEPSmsZ/SdAMgO";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS = { "X-Master-Key": MASTER_KEY, "Content-Type": "application/json" };

// ---------- config ----------
const CYCLE_START_DAY = 25;
const ROUND_TO = 100;
const TX_PAGE_SIZE = 5;
const WK_PAGE_SIZE = 10;
const HIGHLIGHT_MAX = 200;
const FONT = "'Poppins', system-ui, sans-serif";

// brand (from Past Works guide)
const BLUE = "#2F5BEA";
const BLUE_2 = "#1A73E8";
const TEAL = "#12B3A8";
const GREEN = "#1AA971";
const AMBER = "#F5A623";
const VIOLET = "#7C6BF0";
const RED = "#E5544B";

const TOOLS = [
  { key: "BB", label: "Barbell" },
  { key: "DB", label: "Dumbbell" },
  { key: "KB", label: "Kettlebell" },
  { key: "BW", label: "Bodyweight" },
  { key: "ERG", label: "Erg" },
];

const CATEGORIES = ["Food", "Grocery", "Entertainment", "Clothes", "Acc"];
const CAT_LABELS = { Food: "Food", Grocery: "Grocery", Entertainment: "Entertainment", Clothes: "Clothes", Acc: "Accessories" };
const CAT_COLORS = { Food: BLUE, Grocery: TEAL, Entertainment: VIOLET, Clothes: GREEN, Acc: AMBER };

// ---------- date helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toDateStr = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const addDaysStr = (dateStr, delta) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
const diffDays = (a, b) => {
  const [fy, fm, fd] = a.split("-").map(Number);
  const [ty, tm, td] = b.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
};
const shortDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const won = (n) => `₩${Math.round(n).toLocaleString()}`;
const wonShort = (n) => (Math.abs(n) >= 10000 ? `₩${Math.round(n / 1000)}k` : `₩${Math.round(n).toLocaleString()}`);

const cycleFor = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  let sy = y, sm = m;
  if (d < CYCLE_START_DAY) { sm = m - 1; if (sm === 0) { sm = 12; sy = y - 1; } }
  const start = `${sy}-${pad(sm)}-${pad(CYCLE_START_DAY)}`;
  let ey = sy, em = sm + 1;
  if (em === 13) { em = 1; ey = sy + 1; }
  return { start, end: `${ey}-${pad(em)}-${pad(CYCLE_START_DAY - 1)}` };
};

function longestRun(dates) {
  const sorted = [...new Set(dates)].sort();
  let best = 0, run = 0, prev = null;
  for (const d of sorted) {
    run = prev && diffDays(prev, d) === 1 ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
  }
  return best;
}
function calcReadingStreak(dates, today) {
  const set = new Set(dates);
  let cursor = set.has(today) ? today : addDaysStr(today, -1);
  if (!set.has(cursor)) return 0;
  let count = 0;
  while (set.has(cursor)) { count++; cursor = addDaysStr(cursor, -1); }
  return count;
}

// ---------- icons ----------
const s = (p) => ({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", ...p });
const SunIcon = (p) => (<svg {...s(p)}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" /></svg>);
const MoonIcon = (p) => (<svg {...s(p)}><path d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.5 6.5 0 0 0 10.2 10.2Z" /></svg>);
const TrashIcon = (p) => (<svg {...s(p)}><path d="M4 7h16M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7M18 7l-.7 12.4a1.6 1.6 0 0 1-1.6 1.6H8.3a1.6 1.6 0 0 1-1.6-1.6L6 7" /></svg>);
const XIcon = (p) => (<svg {...s(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
const PlusIcon = (p) => (<svg {...s(p)}><path d="M12 5v14M5 12h14" /></svg>);
const ArrowIcon = (p) => (<svg {...s(p)}><path d="M15 6l-6 6 6 6" /></svg>);
const FlameIcon = (p) => (<svg {...s(p)}><path d="M12 3c.6 3.2 3 4.2 3.9 6.4a5.9 5.9 0 1 1-9.6 1.7C7.6 8.4 10.4 8 12 3Z" /></svg>);
const BookIcon = (p) => (<svg {...s(p)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" /></svg>);
const PenIcon = (p) => (<svg {...s(p)}><path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17v3Z" /></svg>);
const CheckIcon = (p) => (<svg {...s(p)}><path d="M5 12.5 10 17l9-10" /></svg>);
const CalendarIcon = (p) => (<svg {...s(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" /></svg>);

// category icons
const FoodIcon = (p) => (<svg {...s(p)}><path d="M4.5 3v6a2.8 2.8 0 0 0 5.6 0V3M7.3 11.5V21" /><path d="M17.5 3c-1.4 2-2 4.2-2 6.3 0 1.5.9 2.4 2 2.4s2-.9 2-2.4c0-2.1-.6-4.3-2-6.3ZM17.5 11.7V21" /></svg>);
const GroceryIcon = (p) => (<svg {...s(p)}><path d="M4.5 8h15l-1.4 10.4a2 2 0 0 1-2 1.7H7.9a2 2 0 0 1-2-1.7L4.5 8Z" /><path d="m8.5 8 3.5-5 3.5 5M10 12v4M14 12v4" /></svg>);
const EntertainmentIcon = (p) => (<svg {...s(p)}><circle cx="12" cy="12" r="8.5" /><path d="M10.3 9.2 15 12l-4.7 2.8V9.2Z" /></svg>);
const ClothesIcon = (p) => (<svg {...s(p)}><path d="M8.5 3.5 5 5.5 3 9l3.2 1.7V20.5h11.6V10.7L21 9l-2-3.5-3.5-2" /><path d="M8.5 3.5c0 1.9 1.6 3 3.5 3s3.5-1.1 3.5-3" /></svg>);
const AccessoriesIcon = (p) => (<svg {...s(p)}><circle cx="12" cy="12" r="4.6" /><path d="M9 7.6 9.6 3h4.8l.6 4.6M9 16.4 9.6 21h4.8l.6-4.6" /></svg>);
const CAT_ICONS = { Food: FoodIcon, Grocery: GroceryIcon, Entertainment: EntertainmentIcon, Clothes: ClothesIcon, Acc: AccessoriesIcon };

// workout icons
const DumbbellIcon = (p) => (<svg {...s(p)}><path d="M4 9v6M7 7v10M10 11h4M17 7v10M20 9v6" /></svg>);
const KettlebellIcon = (p) => (<svg {...s(p)}><path d="M9 7a3 3 0 0 1 6 0" /><path d="M9.2 7.4C7 8.6 5.5 11 5.5 13.6c0 2.3 1 4 2.2 5.4h8.6c1.2-1.4 2.2-3.1 2.2-5.4 0-2.6-1.5-5-3.7-6.2" /></svg>);
const BarbellIcon = (p) => (<svg {...s(p)}><path d="M3 10v4M6 7.5v9M8.5 12h7M18 7.5v9M21 10v4" /></svg>);
const BodyweightIcon = (p) => (<svg {...s(p)}><circle cx="12" cy="5" r="2" /><path d="M12 7.5v6M12 13.5l-3 6M12 13.5l3 6M7 10h10" /></svg>);
const ErgIcon = (p) => (<svg {...s(p)}><circle cx="8" cy="8" r="2" /><path d="M10 10.5l3 2 3-1M13 12.5l1 4M14 16.5l-4 2.5M3 14h18M6 14l-2 5M18 14l2 5" /></svg>);
const TOOL_ICONS = { DB: DumbbellIcon, KB: KettlebellIcon, BB: BarbellIcon, BW: BodyweightIcon, ERG: ErgIcon };

// ---------- donut ----------
function Donut({ data, total, size = 150, thickness = 20, track, ink, centerValue, centerLabel }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        {total > 0 && data.map((d) => {
          const len = (d.value / total) * c;
          const arc = <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />;
          offset += len;
          return arc;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span style={{ color: ink }} className="text-lg font-semibold tabular-nums">{centerValue}</span>
        <span className="text-[11px] opacity-50">{centerLabel}</span>
      </div>
    </div>
  );
}

function Pager({ page, pages, onChange, subtle }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className={`p-1.5 rounded-lg ${page === 1 ? "opacity-25" : "hover:opacity-70"}`} aria-label="Previous">
        <ArrowIcon className="w-4 h-4" />
      </button>
      <span style={{ color: subtle }} className="text-xs tabular-nums">{page} / {pages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === pages} className={`p-1.5 rounded-lg rotate-180 ${page === pages ? "opacity-25" : "hover:opacity-70"}`} aria-label="Next">
        <ArrowIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [streakLastReset, setStreakLastReset] = useState(todayStr());
  const [streakResets, setStreakResets] = useState([]);
  const [readingDates, setReadingDates] = useState([]);
  const [workoutPlan, setWorkoutPlan] = useState([]);
  const [weekHighlight, setWeekHighlight] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const isFirstLoad = useRef(true);
  const lastSavedRef = useRef("");
  const typingRef = useRef(false);
  const typeTimerRef = useRef(null);
  const remoteUpdateRef = useRef(false);

  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState("expense");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [spendPeriod, setSpendPeriod] = useState("cycle");
  const [txPage, setTxPage] = useState(1);
  const [wkPage, setWkPage] = useState(1);
  const [today, setToday] = useState(todayStr());
  const [editingHighlight, setEditingHighlight] = useState(false);
  const [highlightDraft, setHighlightDraft] = useState("");

  useEffect(() => {
    const id = "poppins-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    const i = setInterval(() => {
      const d = todayStr();
      setToday((prev) => (prev === d ? prev : d));
    }, 30000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    axios.get(BIN_URL, { headers: HEADERS })
      .then(res => {
        const data = res.data.record;
        setDarkMode(data.darkMode ?? true);
        setTransactions(data.transactions ?? []);
        setStreakLastReset(data.streakLastReset ?? todayStr());
        setStreakResets(data.streakResets ?? (data.streakLastReset ? [data.streakLastReset] : []));
        setReadingDates(data.readingDates ?? []);
        setWorkoutPlan(data.workoutPlan ?? []);
        setWeekHighlight(data.weekHighlight ?? "");
        lastSavedRef.current = JSON.stringify(data);
        setSynced(true);
      })
      .catch(() => { setStreakLastReset(todayStr()); setSynced(true); })
      .finally(() => setLoading(false));
  }, []);

  const saveToCloud = useCallback(() => {
    if (!synced || isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (typingRef.current) return;
    const data = { darkMode, transactions, streakLastReset, streakResets, readingDates, workoutPlan, weekHighlight };
    const newData = JSON.stringify(data);
    if (newData === lastSavedRef.current) return;
    lastSavedRef.current = newData;
    axios.put(BIN_URL, data, { headers: HEADERS }).catch(() => {});
  }, [darkMode, transactions, streakLastReset, streakResets, readingDates, workoutPlan, weekHighlight, synced]);

  useEffect(() => {
    const t = setTimeout(saveToCloud, 1000);
    return () => clearTimeout(t);
  }, [saveToCloud]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typingRef.current || remoteUpdateRef.current) return;
      axios.get(BIN_URL, { headers: HEADERS })
        .then(res => {
          const data = res.data.record;
          const newData = JSON.stringify(data);
          if (newData === lastSavedRef.current) return;
          remoteUpdateRef.current = true;
          lastSavedRef.current = newData;
          setDarkMode(data.darkMode ?? true);
          setTransactions(data.transactions ?? []);
          setStreakLastReset(data.streakLastReset ?? todayStr());
          setStreakResets(data.streakResets ?? (data.streakLastReset ? [data.streakLastReset] : []));
          setReadingDates(data.readingDates ?? []);
          setWorkoutPlan(data.workoutPlan ?? []);
          setWeekHighlight(data.weekHighlight ?? "");
          setTimeout(() => { remoteUpdateRef.current = false; }, 1000);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const cycle = useMemo(() => cycleFor(today), [today]);
  const txs = useMemo(
    () => transactions.map(t => ({ ...t, day: toDateStr(t.date), amt: Number(t.amount) || 0 })),
    [transactions]
  );

  const savings = useMemo(
    () => txs.reduce((sum, t) => sum + (t.type === "income" ? t.amt : -t.amt), 0),
    [txs]
  );

  const budget = useMemo(() => {
    const inCycle = txs.filter(t => t.day >= cycle.start && t.day <= cycle.end);
    const spentCycle = inCycle.filter(t => t.type === "expense").reduce((a, t) => a + t.amt, 0);
    const spentToday = inCycle.filter(t => t.type === "expense" && t.day === today).reduce((a, t) => a + t.amt, 0);
    const daysLeft = Math.max(diffDays(today, cycle.end) + 1, 1);
    const raw = (savings + spentToday) / daysLeft;
    const allowance = raw > 0 ? Math.floor(raw / ROUND_TO) * ROUND_TO : 0;
    return { spentCycle, spentToday, daysLeft, allowance, inCycle };
  }, [txs, cycle, today, savings]);

  const streakDays = streakLastReset ? Math.max(diffDays(streakLastReset, today), 0) : 0;
  const streakResetDisabled = streakLastReset === today;
  const streakLongest = useMemo(() => {
    const list = [...new Set([...streakResets, streakLastReset])].filter(Boolean).sort();
    let best = streakDays;
    for (let i = 1; i < list.length; i++) best = Math.max(best, diffDays(list[i - 1], list[i]));
    return best;
  }, [streakResets, streakLastReset, streakDays]);

  const readingStreak = useMemo(() => calcReadingStreak(readingDates, today), [readingDates, today]);
  const readingLongest = useMemo(() => Math.max(longestRun(readingDates), readingStreak), [readingDates, readingStreak]);
  const readingDoneToday = readingDates.includes(today);

  const periodTx = useMemo(() => {
    if (spendPeriod === "all") return txs;
    const c = spendPeriod === "cycle" ? cycle : cycleFor(addDaysStr(cycle.start, -1));
    return txs.filter(t => t.day >= c.start && t.day <= c.end);
  }, [txs, spendPeriod, cycle]);

  const spendData = useMemo(() => {
    const totals = {};
    periodTx.filter(t => t.type === "expense").forEach(t => {
      if (t.category && CATEGORIES.includes(t.category)) totals[t.category] = (totals[t.category] || 0) + t.amt;
    });
    return Object.entries(totals)
      .map(([key, value]) => ({ key, label: CAT_LABELS[key], value, color: CAT_COLORS[key] }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [periodTx]);
  const spendTotal = spendData.reduce((a, d) => a + d.value, 0);

  const dailyBars = useMemo(() => {
    const days = diffDays(cycle.start, cycle.end) + 1;
    const map = {};
    budget.inCycle.filter(t => t.type === "expense").forEach(t => { map[t.day] = (map[t.day] || 0) + t.amt; });
    return Array.from({ length: days }, (_, i) => {
      const day = addDaysStr(cycle.start, i);
      return { day, value: map[day] || 0, isToday: day === today, future: day > today };
    });
  }, [budget.inCycle, cycle, today]);
  const maxBar = Math.max(...dailyBars.map(b => b.value), 1);

  // ---- handlers ----
  const addTransaction = (e) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    setTransactions(prev => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount: num,
      type: txType,
      category,
      note: note.trim(),
      date: new Date(`${today}T12:00:00`).toISOString(),
    }, ...prev]);
    setAmount("");
    setNote("");
    setTxPage(1);
  };
  const deleteTransaction = (id) => setTransactions(prev => prev.filter(t => t.id !== id));

  const resetStreak = () => {
    if (streakResetDisabled) return;
    setStreakResets(prev => [...new Set([...prev, streakLastReset, today])].filter(Boolean).sort());
    setStreakLastReset(today);
  };
  const markReadToday = () => {
    if (readingDoneToday) return;
    setReadingDates(prev => [...prev, today]);
  };

  const startEditHighlight = () => { setHighlightDraft(weekHighlight); setEditingHighlight(true); };
  const saveHighlight = () => { setWeekHighlight(highlightDraft.trim()); setEditingHighlight(false); };
  const clearHighlight = () => { setWeekHighlight(""); setHighlightDraft(""); setEditingHighlight(false); };

  const addExercise = () => {
    setWorkoutPlan(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: "", tool: filter !== "ALL" ? filter : "BB", weight: "", reps: 10,
    }]);
  };
  const updateExercise = (id, field, value) => {
    typingRef.current = true;
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
    typeTimerRef.current = setTimeout(() => { typingRef.current = false; }, 2000);
    setWorkoutPlan(prev => prev.map(ex => (ex.id === id ? { ...ex, [field]: value } : ex)));
  };
  const deleteExercise = (id) => setWorkoutPlan(prev => prev.filter(ex => ex.id !== id));
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortedTx = useMemo(() => [...txs].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)), [txs]);
  const txPages = Math.max(Math.ceil(sortedTx.length / TX_PAGE_SIZE), 1);
  const txCur = Math.min(txPage, txPages);
  const txSlice = sortedTx.slice((txCur - 1) * TX_PAGE_SIZE, txCur * TX_PAGE_SIZE);

  const sortedWorkouts = useMemo(() => {
    const list = workoutPlan.filter(ex => filter === "ALL" || ex.tool === filter);
    return [...list].sort((a, b) => {
      let va = a[sortKey] || "", vb = b[sortKey] || "";
      if (sortKey === "weight" || sortKey === "reps") { va = Number(va) || 0; vb = Number(vb) || 0; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [workoutPlan, filter, sortKey, sortDir]);
  const wkPages = Math.max(Math.ceil(sortedWorkouts.length / WK_PAGE_SIZE), 1);
  const wkCur = Math.min(wkPage, wkPages);
  const wkSlice = sortedWorkouts.slice((wkCur - 1) * WK_PAGE_SIZE, wkCur * WK_PAGE_SIZE);
  useEffect(() => { setWkPage(1); }, [filter]);

  // ---- theme ----
  const t = darkMode
    ? { bg: "#0A0C10", card: "#141821", soft: "#1C2130", border: "rgba(255,255,255,0.07)", ink: "#EEF1F7", subtle: "rgba(238,241,247,0.5)", track: "rgba(255,255,255,0.07)" }
    : { bg: "#F6F7FB", card: "#FFFFFF", soft: "#F1F4FA", border: "rgba(18,23,43,0.08)", ink: "#12172B", subtle: "rgba(18,23,43,0.5)", track: "rgba(18,23,43,0.07)" };

  const card = { background: t.card, border: `1px solid ${t.border}` };
  const input = { background: t.soft, border: `1px solid ${t.border}`, color: t.ink };
  const chip = (on) => ({ background: on ? BLUE : t.soft, color: on ? "#fff" : t.subtle, border: `1px solid ${on ? BLUE : t.border}` });
  const brandGrad = `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_2} 100%)`;

  if (loading) {
    return (
      <div style={{ background: t.bg, color: t.ink, fontFamily: FONT, minHeight: "100vh" }} className="flex items-center justify-center">
        <p className="text-sm opacity-60">Loading</p>
      </div>
    );
  }

  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: FONT, minHeight: "100vh" }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">

        <header className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Hello, Merdy</h1>
            <p style={{ color: t.subtle }} className="text-xs mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <button onClick={() => setDarkMode(d => !d)} style={card} className="rounded-full p-2.5 hover:opacity-80 transition-opacity" aria-label="Toggle theme">
            {darkMode ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* ---------------- left ---------------- */}
          <div className="lg:col-span-3 space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* savings */}
              <div style={{ ...card, backgroundImage: `radial-gradient(120% 120% at 100% 0%, ${BLUE}1F 0%, transparent 55%)` }} className="sm:col-span-2 rounded-3xl p-6">
                <p style={{ color: t.subtle }} className="text-xs">Total savings</p>
                <p className="text-4xl sm:text-5xl font-semibold tabular-nums mt-2 tracking-tight">{won(savings)}</p>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div style={{ backgroundImage: brandGrad, color: "#fff" }} className="rounded-2xl px-4 py-3.5">
                    <p className="text-[11px] opacity-80">You can spend today</p>
                    <p className="text-xl font-semibold tabular-nums mt-1">{won(budget.allowance)}</p>
                  </div>
                  <div style={{ background: t.soft }} className="rounded-2xl px-4 py-3.5 flex items-center gap-3">
                    <span style={{ background: `${BLUE}1F`, color: BLUE }} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0">
                      <CalendarIcon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xl font-semibold tabular-nums leading-none">{budget.daysLeft}<span style={{ color: t.subtle }} className="text-xs font-normal ml-1">days</span></p>
                      <p style={{ color: t.subtle }} className="text-[11px] mt-1 truncate">until reset</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* streaks */}
              <div style={card} className="rounded-3xl px-4 py-5 flex flex-col justify-center gap-4">
                <div className="flex items-center">
                  <div className="w-[30%] flex justify-center" style={{ color: BLUE }}><FlameIcon className="w-10 h-10" /></div>
                  <div className="w-[30%] text-center">
                    <p className="text-2xl font-semibold tabular-nums leading-none">{streakDays}</p>
                    <p style={{ color: t.subtle }} className="text-[10px] mt-1">days</p>
                  </div>
                  <div className="w-[30%] flex justify-center">
                    <button onClick={resetStreak} disabled={streakResetDisabled} style={{ background: t.soft, color: streakResetDisabled ? t.subtle : RED }} className={`rounded-full px-3 py-1.5 text-xs font-medium ${streakResetDisabled ? "opacity-50" : "hover:opacity-80"}`}>Reset</button>
                  </div>
                  <div className="w-[10%] text-right">
                    <p style={{ color: t.subtle }} className="text-sm font-medium tabular-nums" title="Longest streak">{streakLongest}</p>
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${t.border}` }} />

                <div className="flex items-center">
                  <div className="w-[30%] flex justify-center" style={{ color: TEAL }}><BookIcon className="w-10 h-10" /></div>
                  <div className="w-[30%] text-center">
                    <p className="text-2xl font-semibold tabular-nums leading-none">{readingStreak}</p>
                    <p style={{ color: t.subtle }} className="text-[10px] mt-1">days</p>
                  </div>
                  <div className="w-[30%] flex justify-center">
                    <button onClick={markReadToday} disabled={readingDoneToday} style={readingDoneToday ? { background: t.soft, color: t.subtle } : { backgroundImage: brandGrad, color: "#fff" }} className={`rounded-full px-3 py-1.5 text-xs font-medium ${readingDoneToday ? "opacity-60" : "hover:opacity-90"}`}>
                      {readingDoneToday ? "Done" : "Read"}
                    </button>
                  </div>
                  <div className="w-[10%] text-right">
                    <p style={{ color: t.subtle }} className="text-sm font-medium tabular-nums" title="Longest streak">{readingLongest}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* breakdown */}
              <div style={card} className="rounded-3xl p-5">
                <h2 className="text-sm font-medium mb-4">Breakdown</h2>
                {spendTotal === 0 ? (
                  <p style={{ color: t.subtle }} className="text-sm py-12 text-center">Nothing yet</p>
                ) : (
                  <>
                    <Donut data={spendData} total={spendTotal} track={t.track} ink={t.ink} centerValue={wonShort(spendTotal)} centerLabel="spent" />
                    <div className="space-y-2 mt-5">
                      {spendData.map(d => (
                        <div key={d.key} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="text-xs flex-1 truncate">{d.label}</span>
                          <span style={{ color: t.subtle }} className="text-[11px] tabular-nums">{Math.round((d.value / spendTotal) * 100)}%</span>
                          <span className="text-xs tabular-nums w-20 text-right">{won(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* daily spend */}
              <div style={card} className="sm:col-span-2 rounded-3xl p-5 flex flex-col">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-sm font-medium">Daily spend</h2>
                    <p className="text-2xl font-semibold tabular-nums mt-1">{won(budget.spentCycle)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {[["cycle", "Cycle"], ["last", "Last"], ["all", "All"]].map(([k, label]) => (
                      <button key={k} onClick={() => setSpendPeriod(k)} style={chip(spendPeriod === k)} className="rounded-full px-3 py-1 text-[11px] font-medium">{label}</button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex items-end gap-[3px] h-44 mt-8">
                  {dailyBars.map(b => (
                    <div key={b.day} className="flex-1 h-full flex flex-col justify-end items-center relative">
                      {b.isToday && b.value > 0 && (
                        <span style={{ backgroundImage: brandGrad, color: "#fff" }} className="absolute bottom-full mb-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap z-10">{wonShort(b.value)}</span>
                      )}
                      <div
                        className="w-full rounded-md transition-all"
                        title={`${shortDate(b.day)} ${won(b.value)}`}
                        style={{
                          height: `${Math.max((b.value / maxBar) * 100, b.value > 0 ? 4 : 2)}%`,
                          backgroundImage: b.isToday ? brandGrad : "none",
                          background: b.isToday ? undefined : b.future ? t.track : t.subtle,
                          opacity: b.future ? 0.35 : b.isToday ? 1 : 0.5,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[11px] mt-3" style={{ color: t.subtle }}>
                  <span>{shortDate(cycle.start)}</span>
                  <span>{shortDate(cycle.end)}</span>
                </div>
              </div>
            </div>

            {/* money tracker */}
            <div style={card} className="rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium">Money tracker</h2>
                <span style={{ color: t.subtle }} className="text-xs tabular-nums">{transactions.length}</span>
              </div>
              {transactions.length === 0 ? (
                <p style={{ color: t.subtle }} className="text-sm py-8 text-center">Add your first entry on the right</p>
              ) : (
                <>
                  <div className="space-y-1">
                    {txSlice.map(tx => {
                      const color = CAT_COLORS[tx.category] || t.subtle;
                      const Icon = CAT_ICONS[tx.category];
                      return (
                        <div key={tx.id} className="flex items-center gap-3 py-2.5 group">
                          <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}1F`, color }}>
                            {Icon ? <Icon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4 rotate-45" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{tx.note || CAT_LABELS[tx.category] || (tx.type === "income" ? "Income" : "Expense")}</p>
                            <p style={{ color: t.subtle }} className="text-[11px]">{CAT_LABELS[tx.category] || "Other"}</p>
                          </div>
                          <span style={{ color: t.subtle }} className="text-xs tabular-nums shrink-0 hidden sm:block">{shortDate(tx.day)}</span>
                          <span className="text-sm font-medium tabular-nums shrink-0 w-24 text-right" style={{ color: tx.type === "income" ? GREEN : RED }}>
                            {tx.type === "income" ? "+" : "-"}{won(tx.amt)}
                          </span>
                          <button onClick={() => deleteTransaction(tx.id)} style={{ color: t.subtle }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0" aria-label="Delete">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <Pager page={txCur} pages={txPages} onChange={setTxPage} subtle={t.subtle} />
                </>
              )}
            </div>
          </div>

          {/* ---------------- right ---------------- */}
          <div className="lg:col-span-1 space-y-4">

            {/* week highlight */}
            <div style={{ ...card, backgroundImage: `radial-gradient(120% 120% at 0% 0%, ${BLUE}14 0%, transparent 60%)` }} className="rounded-3xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium">Week Highlight</h2>
                {editingHighlight ? (
                  <button onClick={saveHighlight} style={{ backgroundImage: brandGrad, color: "#fff" }} className="rounded-full px-3 py-1 text-[11px] font-medium flex items-center gap-1 hover:opacity-90">
                    <CheckIcon className="w-3.5 h-3.5" /> Save
                  </button>
                ) : (
                  <button onClick={startEditHighlight} style={{ background: t.soft, color: t.subtle }} className="rounded-full px-3 py-1 text-[11px] font-medium flex items-center gap-1 hover:opacity-80">
                    <PenIcon className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>

              {editingHighlight ? (
                <>
                  <textarea
                    value={highlightDraft}
                    maxLength={HIGHLIGHT_MAX}
                    onChange={(e) => setHighlightDraft(e.target.value)}
                    onFocus={() => { typingRef.current = true; }}
                    onBlur={() => { typingRef.current = false; }}
                    rows={5}
                    placeholder="What matters this week"
                    style={{ ...input, fontSize: "11px", lineHeight: "17px" }}
                    className="w-full rounded-xl px-3 py-2.5 outline-none resize-none focus:ring-2"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <button onClick={clearHighlight} style={{ color: t.subtle }} className="text-[11px] hover:opacity-70">Delete</button>
                    <span style={{ color: t.subtle }} className="text-[10px] tabular-nums">{highlightDraft.length}/{HIGHLIGHT_MAX}</span>
                  </div>
                </>
              ) : weekHighlight ? (
                <p style={{ fontSize: "11px", lineHeight: "17px" }} className="whitespace-pre-wrap break-words">{weekHighlight}</p>
              ) : (
                <p style={{ color: t.subtle, fontSize: "11px", lineHeight: "17px" }}>Nothing pinned. Tap edit to write one.</p>
              )}
            </div>

            {/* add entry */}
            <div style={card} className="rounded-3xl p-5">
              <h2 className="text-sm font-medium mb-4">Add entry</h2>
              <form onSubmit={addTransaction} className="space-y-2.5">
                <input type="number" step="1" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={input} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2" required />
                <div className="grid grid-cols-2 gap-2.5">
                  <select value={txType} onChange={(e) => setTxType(e.target.value)} style={input} className="rounded-xl px-3 py-2.5 text-sm outline-none">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={input} className="rounded-xl px-3 py-2.5 text-sm outline-none">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>
                <input type="text" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} style={input} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
                <button type="submit" style={{ backgroundImage: brandGrad, color: "#fff" }} className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                  <PlusIcon className="w-4 h-4" /> Add
                </button>
              </form>
            </div>

            {/* workout */}
            <div style={card} className="rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium flex items-center gap-2"><BarbellIcon className="w-4 h-4" /> Workout</h2>
                <button onClick={addExercise} style={{ backgroundImage: brandGrad, color: "#fff" }} className="rounded-full p-1.5 hover:opacity-90" aria-label="Add exercise"><PlusIcon className="w-3.5 h-3.5" /></button>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                <button onClick={() => setFilter("ALL")} style={chip(filter === "ALL")} className="rounded-full px-2.5 py-1 text-[11px] font-medium">All</button>
                {TOOLS.map(tool => {
                  const Icon = TOOL_ICONS[tool.key];
                  return (
                    <button key={tool.key} onClick={() => setFilter(tool.key)} style={chip(filter === tool.key)} className="rounded-full p-1.5" title={tool.label}>
                      <Icon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 text-[11px] mb-2" style={{ color: t.subtle }}>
                <button onClick={() => toggleSort("name")} className="hover:opacity-70">Name{sortKey === "name" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</button>
                <button onClick={() => toggleSort("weight")} className="hover:opacity-70">Weight{sortKey === "weight" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</button>
                <button onClick={() => toggleSort("reps")} className="hover:opacity-70">Reps{sortKey === "reps" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</button>
              </div>

              {sortedWorkouts.length === 0 ? (
                <p style={{ color: t.subtle }} className="text-sm py-6 text-center">No lifts here</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {wkSlice.map(ex => {
                      const Icon = TOOL_ICONS[ex.tool] || DumbbellIcon;
                      return (
                        <div key={ex.id} style={{ background: t.soft }} className="rounded-2xl p-2.5 group">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const i = TOOLS.findIndex(x => x.key === (ex.tool || "BB"));
                                updateExercise(ex.id, "tool", TOOLS[(i + 1) % TOOLS.length].key);
                              }}
                              style={{ background: `${BLUE}1F`, color: BLUE }}
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 hover:opacity-80"
                              title="Change tool"
                            >
                              <Icon className="w-4 h-4" />
                            </button>
                            <input type="text" placeholder="Exercise" value={ex.name || ""} onChange={(e) => updateExercise(ex.id, "name", e.target.value)} style={{ color: t.ink }} className="flex-1 min-w-0 bg-transparent text-sm outline-none" />
                            <button onClick={() => deleteExercise(ex.id)} style={{ color: t.subtle }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0" aria-label="Remove"><XIcon className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className="flex items-center gap-2 mt-2 pl-10">
                            <input type="number" min="0" placeholder="0" value={ex.weight || ""} onChange={(e) => updateExercise(ex.id, "weight", e.target.value)} style={{ background: t.card, border: `1px solid ${t.border}`, color: t.ink }} className="w-16 rounded-lg px-2 py-1 text-xs tabular-nums outline-none" />
                            <span style={{ color: t.subtle }} className="text-[11px]">kg</span>
                            <input type="number" min="0" value={ex.reps || ""} onChange={(e) => updateExercise(ex.id, "reps", e.target.value)} style={{ background: t.card, border: `1px solid ${t.border}`, color: t.ink }} className="w-14 rounded-lg px-2 py-1 text-xs tabular-nums outline-none" />
                            <span style={{ color: t.subtle }} className="text-[11px]">reps</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Pager page={wkCur} pages={wkPages} onChange={setWkPage} subtle={t.subtle} />
                </>
              )}
            </div>
          </div>
        </div>

        <p style={{ color: t.subtle }} className="text-center text-[11px] mt-8">Synced by MERDY</p>
      </div>
    </div>
  );
}