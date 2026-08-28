import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";

const BIN_ID = "6a4c695cf5f4af5e296a28a4";
const MASTER_KEY = "$2a$10$O2F0Os04xfXpTPk7jCdHpeDQGKXiJdwlSlpnuFrlEPSmsZ/SdAMgO";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS = { "X-Master-Key": MASTER_KEY, "Content-Type": "application/json" };

// ---------- tool config (workout) ----------
const TOOLS = [
  { key: "DB", emoji: "🎤" },
  { key: "KB", emoji: "🥘" },
  { key: "BB", emoji: "🏋️‍♂️" },
  { key: "BW", emoji: "🤽‍♂️" },
  { key: "ERG", emoji: "🚣" },
];

// ---------- money categories ----------
const CATEGORIES = ["Food", "Grocery", "Entertainment", "Clothes", "Acc"];

// ---------- date helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const addDaysStr = (dateStr, delta) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};
const diffDays = (fromStr, toStr) => {
  const [fy, fm, fd] = fromStr.split("-").map(Number);
  const [ty, tm, td] = toStr.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86400000);
};
const formatShortDate = (isoTimestamp) => {
  const d = new Date(isoTimestamp);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ---------- reading streak calc ----------
function calcReadingStreak(dates) {
  const set = new Set(dates);
  const today = todayStr();
  if (set.has(today)) {
    let count = 0;
    let cursor = today;
    while (set.has(cursor)) {
      count++;
      cursor = addDaysStr(cursor, -1);
    }
    return count;
  }
  const yesterday = addDaysStr(today, -1);
  if (set.has(yesterday)) {
    let count = 0;
    let cursor = yesterday;
    while (set.has(cursor)) {
      count++;
      cursor = addDaysStr(cursor, -1);
    }
    return count;
  }
  return 0;
}

const F_DISPLAY = "'Fraunces', serif";
const F_MONO = "'JetBrains Mono', monospace";

// ---------- icons ----------
const SunIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
  </svg>
);
const MoonIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.5 6.5 0 0 0 10.2 10.2Z" />
  </svg>
);
const ChevronIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const TrashIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 7h16M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7M18 7l-.7 12.4a1.6 1.6 0 0 1-1.6 1.6H8.3a1.6 1.6 0 0 1-1.6-1.6L6 7" />
  </svg>
);
const XIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const PlusIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

function StatCard({ bg, value, label, suffix }) {
  return (
    <div style={{ background: bg }} className="rounded-2xl p-5 shadow-sm text-white">
      <div className="flex items-baseline gap-1.5">
        <span style={{ fontFamily: F_DISPLAY }} className="text-3xl sm:text-4xl font-semibold tabular-nums">
          {value}
        </span>
        {suffix && <span className="text-sm opacity-80">{suffix}</span>}
      </div>
      <p className="text-xs uppercase tracking-wide opacity-80 mt-1.5">{label}</p>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [streakLastReset, setStreakLastReset] = useState(todayStr());
  const [readingDates, setReadingDates] = useState([]);
  const [workoutPlan, setWorkoutPlan] = useState([]);
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const isFirstLoad = useRef(true);
  const lastSavedRef = useRef("");
  const typingRef = useRef(false);
  const typeTimerRef = useRef(null);
  const remoteUpdateRef = useRef(false);

  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState("income");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [spendPeriod, setSpendPeriod] = useState("monthly"); // new state for visualization

  // ---- Load from JSONbin ----
  useEffect(() => {
    axios.get(BIN_URL, { headers: HEADERS })
      .then(res => {
        const data = res.data.record;
        setDarkMode(data.darkMode ?? false);
        setTransactions(data.transactions ?? []);
        setStreakLastReset(data.streakLastReset ?? todayStr());
        setReadingDates(data.readingDates ?? []);
        setWorkoutPlan(data.workoutPlan ?? []);
        lastSavedRef.current = JSON.stringify(data);
        setSynced(true);
      })
      .catch(() => {
        setStreakLastReset(todayStr());
        setSynced(true);
      })
      .finally(() => setLoading(false));
  }, []);

  // ---- Save to JSONbin ----
  const saveToCloud = useCallback(() => {
    if (!synced || isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (typingRef.current) return;
    const data = { darkMode, transactions, streakLastReset, readingDates, workoutPlan };
    const newData = JSON.stringify(data);
    if (newData === lastSavedRef.current) return;
    lastSavedRef.current = newData;
    axios.put(BIN_URL, data, { headers: HEADERS }).catch(() => {});
  }, [darkMode, transactions, streakLastReset, readingDates, workoutPlan, synced]);

  useEffect(() => {
    const t = setTimeout(saveToCloud, 1000);
    return () => clearTimeout(t);
  }, [saveToCloud]);

  // ---- Poll for cross-device changes (skip while typing or just after local save) ----
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
          setDarkMode(data.darkMode ?? false);
          setTransactions(data.transactions ?? []);
          setStreakLastReset(data.streakLastReset ?? todayStr());
          setReadingDates(data.readingDates ?? []);
          setWorkoutPlan(data.workoutPlan ?? []);
          setTimeout(() => { remoteUpdateRef.current = false; }, 1000);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ---- derived values ----
  const balance = useMemo(
    () => transactions.reduce((sum, t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0),
    [transactions]
  );
  const balanceFormatted = useMemo(
    () => new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(balance),
    [balance]
  );

  const streakDays = useMemo(() => {
    if (!streakLastReset) return 0;
    const today = todayStr();
    if (streakLastReset === today) return 0;
    return diffDays(streakLastReset, today);
  }, [streakLastReset]);
  const streakResetDisabled = streakLastReset === todayStr();

  const readingStreak = useMemo(() => calcReadingStreak(readingDates), [readingDates]);
  const readingDoneToday = readingDates.includes(todayStr());

  // ---- Spending breakdown data ----
  const spendData = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    if (spendPeriod === "weekly") {
      cutoff.setDate(now.getDate() - 7);
    } else {
      cutoff.setDate(now.getDate() - 30);
    }
    const expenses = transactions.filter(t => t.type === "expense" && new Date(t.date) >= cutoff);
    const totals = {};
    CATEGORIES.forEach(cat => totals[cat] = 0);
    expenses.forEach(t => {
      if (t.category && totals[t.category] !== undefined) {
        totals[t.category] += Number(t.amount);
      }
    });
    return totals;
  }, [transactions, spendPeriod]);

  const maxSpend = Math.max(...Object.values(spendData), 0);

  // ---- handlers ----
  const addTransaction = (e) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    setTransactions((prev) => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount: num,
      type: txType,
      category: category,
      note: note.trim(),
      date: new Date().toISOString(),
    }, ...prev]);
    setAmount("");
    setNote("");
  };
  const deleteTransaction = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id));

  const resetStreak = () => { if (streakResetDisabled) return; setStreakLastReset(todayStr()); };
  const markReadToday = () => { if (readingDoneToday) return; setReadingDates((prev) => [...prev, todayStr()]); };

  // ---- addExercise uses current filter ----
  const addExercise = () => {
    const defaultTool = filter !== "ALL" ? filter : "DB";
    setWorkoutPlan((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "", tool: defaultTool, weight: "", reps: 10 }]);
  };

  const updateExercise = (id, field, value) => {
    typingRef.current = true;
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
    typeTimerRef.current = setTimeout(() => { typingRef.current = false; }, 2000);
    setWorkoutPlan((prev) => prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex)));
  };

  const deleteExercise = (id) => setWorkoutPlan((prev) => prev.filter((ex) => ex.id !== id));

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredWorkouts = workoutPlan.filter(ex => filter === "ALL" || ex.tool === filter);
  const sortedWorkouts = [...filteredWorkouts].sort((a, b) => {
    let valA = a[sortKey] || "";
    let valB = b[sortKey] || "";
    if (sortKey === "weight" || sortKey === "reps") {
      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
    }
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const bg = darkMode ? "#17181B" : "#FAF6EE";
  const ink = darkMode ? "#F0EBE1" : "#2B2A28";
  const cardBg = darkMode ? "#211F1C" : "#FFFFFF";
  const borderCol = darkMode ? "rgba(255,255,255,0.08)" : "rgba(43,42,40,0.08)";
  const subtle = darkMode ? "rgba(240,235,225,0.55)" : "rgba(43,42,40,0.55)";
  const inputBg = darkMode ? "#17181B" : "#FAF6EE";

  if (loading) {
    return (
      <div style={{ background: bg, color: ink, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: F_DISPLAY }} className="text-xl">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ background: bg, color: ink, minHeight: "100vh" }} className="transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 style={{ fontFamily: F_DISPLAY }} className="text-2xl sm:text-3xl font-semibold tracking-tight">Merdy Dashboard</h1>
            <p style={{ fontFamily: F_MONO, color: subtle }} className="text-xs mt-1 tracking-wide">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <button onClick={() => setDarkMode((d) => !d)} style={{ background: cardBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-full p-2.5 shadow-sm hover:opacity-80 transition-opacity shrink-0" aria-label="Toggle dark mode">
            {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
        </div>

        <div className="mb-6">
          <StatCard bg={darkMode ? "#3F5A45" : "#5B7F62"} value={balanceFormatted} label="Total Savings" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div style={{ background: cardBg, border: `1px solid ${borderCol}` }} className="rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span style={{ fontFamily: F_DISPLAY, color: darkMode ? "#A1B5D8" : "#4A5FA0" }} className="text-3xl sm:text-4xl font-semibold tabular-nums">{streakDays}</span>
                <span className="text-sm opacity-80">{streakDays === 1 ? "day" : "days"}</span>
              </div>
              <p className="text-xs uppercase tracking-wide opacity-80">Streak</p>
              <p style={{ color: subtle }} className="text-xs mt-1">{streakResetDisabled ? "Already reset today" : "Log a relapse / restart"}</p>
            </div>
            <button onClick={resetStreak} disabled={streakResetDisabled} className={`px-4 py-2 rounded-full text-sm font-medium text-white shrink-0 transition-opacity ${streakResetDisabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-90"}`} style={{ background: "#C1543C" }}>Reset</button>
          </div>

          <div style={{ background: cardBg, border: `1px solid ${borderCol}` }} className="rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span style={{ fontFamily: F_DISPLAY, color: darkMode ? "#C5B4D6" : "#7C5A96" }} className="text-3xl sm:text-4xl font-semibold tabular-nums">{readingStreak}</span>
                <span className="text-sm opacity-80">{readingStreak === 1 ? "day" : "days"}</span>
              </div>
              <p className="text-xs uppercase tracking-wide opacity-80">Reading Streak</p>
              <p style={{ color: subtle }} className="text-xs mt-1">{readingDoneToday ? "Nice work today" : "Read at least 1 chapter"}</p>
            </div>
            <button onClick={markReadToday} disabled={readingDoneToday} className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-opacity ${readingDoneToday ? "opacity-70 cursor-not-allowed" : "hover:opacity-90 text-white"}`} style={{ background: readingDoneToday ? (darkMode ? "#2E4A32" : "#DCE7DD") : "#5B7F62", color: readingDoneToday ? "#5B7F62" : "#fff" }}>{readingDoneToday ? "✅ Done" : "Mark Read"}</button>
          </div>
        </div>

        {/* Money Tracker with category and visualization */}
        <section style={{ background: cardBg, border: `1px solid ${borderCol}` }} className="rounded-2xl shadow-sm p-5 sm:p-6 mb-6">
          <h2 style={{ fontFamily: F_DISPLAY }} className="text-lg font-semibold mb-4">Money Tracker</h2>
          <form onSubmit={addTransaction} className="flex flex-wrap gap-3 mb-5">
            <input type="number" step="0.01" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ background: inputBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-xl px-3 py-2 text-sm w-28 outline-none focus:ring-2 focus:ring-[#5B7F62]" required />
            <select value={txType} onChange={(e) => setTxType(e.target.value)} style={{ background: inputBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5B7F62]">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ background: inputBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5B7F62]">
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <input type="text" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ background: inputBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px] outline-none focus:ring-2 focus:ring-[#5B7F62]" />
            <button type="submit" className="rounded-xl px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity flex items-center gap-1" style={{ background: "#5B7F62" }}><PlusIcon className="w-4 h-4" /> Add</button>
          </form>

          {/* Spending Visualization */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Spending Breakdown</h3>
              <div className="flex gap-2">
                <button onClick={() => setSpendPeriod("weekly")} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${spendPeriod === "weekly" ? "bg-[#7C5A96] text-white" : ""}`} style={{ background: spendPeriod === "weekly" ? "#7C5A96" : inputBg, color: spendPeriod === "weekly" ? "#fff" : ink, border: `1px solid ${borderCol}` }}>Weekly</button>
                <button onClick={() => setSpendPeriod("monthly")} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${spendPeriod === "monthly" ? "bg-[#7C5A96] text-white" : ""}`} style={{ background: spendPeriod === "monthly" ? "#7C5A96" : inputBg, color: spendPeriod === "monthly" ? "#fff" : ink, border: `1px solid ${borderCol}` }}>Monthly</button>
              </div>
            </div>
            {maxSpend === 0 ? (
              <p style={{ color: subtle }} className="text-sm text-center py-4">No expenses in this period.</p>
            ) : (
              <div className="space-y-2">
                {CATEGORIES.map(cat => {
                  const val = spendData[cat] || 0;
                  const pct = (val / maxSpend) * 100;
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-xs w-24 shrink-0">{cat}</span>
                      <div className="flex-1 h-5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#5B7F62" }}></div>
                      </div>
                      <span style={{ fontFamily: F_MONO }} className="text-xs w-16 text-right shrink-0">₩{val.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* History */}
          <div>
            <button onClick={() => setHistoryOpen(o => !o)} className="flex items-center gap-2 text-sm font-medium mb-3 hover:opacity-80">
              <ChevronIcon className={`w-4 h-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              Transaction History ({transactions.length})
            </button>
            {historyOpen && (
              <div>
                {transactions.length === 0 ? (
                  <p style={{ color: subtle }} className="text-sm text-center py-6">No transactions yet.</p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: borderCol }}>
                    {transactions.map((t) => (
                      <li key={t.id} className="flex items-center justify-between py-2.5 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span style={{ fontFamily: F_MONO, color: subtle }} className="text-xs w-14 shrink-0">{formatShortDate(t.date)}</span>
                          <div className="flex items-center gap-2 min-w-0">
                            {t.category && (
                              <span style={{ background: darkMode ? "#2A2A2A" : "#F0EFEA", color: ink }} className="text-xs px-2 py-0.5 rounded-full shrink-0">
                                {t.category}
                              </span>
                            )}
                            <span className="text-sm truncate">{t.note || (t.type === "income" ? "Income" : "Expense")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span style={{ fontFamily: F_MONO, color: t.type === "income" ? "#5B7F62" : "#C1543C" }} className="text-sm font-medium">{t.type === "income" ? "+" : "–"}₩{Number(t.amount).toLocaleString()}</span>
                          <button onClick={() => deleteTransaction(t.id)} style={{ color: subtle }} className="hover:text-red-500 transition-colors" aria-label="Delete"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Workout Record */}
        <section style={{ background: cardBg, border: `1px solid ${borderCol}` }} className="rounded-2xl shadow-sm overflow-hidden">
          <button onClick={() => setWorkoutOpen((o) => !o)} className="w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left">
            <h2 style={{ fontFamily: F_DISPLAY }} className="text-lg font-semibold">💪 Workout Record</h2>
            <ChevronIcon className={`w-5 h-5 transition-transform duration-200 ${workoutOpen ? "rotate-180" : ""}`} />
          </button>
          {workoutOpen && (
            <div className="px-5 sm:px-6 pb-6">
              <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setFilter("ALL")} style={{ background: filter === "ALL" ? "#7C5A96" : inputBg, color: filter === "ALL" ? "#fff" : ink, border: `1px solid ${borderCol}` }} className="rounded-full px-3 py-1 text-xs font-medium transition-colors">All</button>
                {TOOLS.map(t => (
                  <button key={t.key} onClick={() => setFilter(t.key)} style={{ background: filter === t.key ? "#7C5A96" : inputBg, color: filter === t.key ? "#fff" : ink, border: `1px solid ${borderCol}` }} className="rounded-full px-3 py-1 text-sm transition-colors">{t.emoji}</button>
                ))}
              </div>
              {workoutPlan.length === 0 ? (
                <p style={{ color: subtle }} className="text-sm py-2 mb-3">No exercises yet.</p>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <div className="min-w-[340px]">
                    <div style={{ color: subtle }} className="grid grid-cols-[56px_1fr_56px_56px_32px] sm:grid-cols-[72px_1fr_72px_72px_32px] gap-2 text-xs px-1 mb-2">
                      <span>Tool</span>
                      <button onClick={() => toggleSort("name")} className="text-left hover:text-inherit flex items-center gap-1">Name{sortKey === "name" && (sortDir === "asc" ? " ▲" : " ▼")}</button>
                      <button onClick={() => toggleSort("weight")} className="text-left hover:text-inherit flex items-center gap-1">Wt{sortKey === "weight" && (sortDir === "asc" ? " ▲" : " ▼")}</button>
                      <button onClick={() => toggleSort("reps")} className="text-left hover:text-inherit flex items-center gap-1">Reps{sortKey === "reps" && (sortDir === "asc" ? " ▲" : " ▼")}</button>
                      <span></span>
                    </div>
                    <div className="space-y-2">
                      {sortedWorkouts.map((ex) => (
                        <div key={ex.id} className="grid grid-cols-[56px_1fr_56px_56px_32px] sm:grid-cols-[72px_1fr_72px_72px_32px] gap-2 items-center">
                          <select value={ex.tool || "DB"} onChange={(e) => updateExercise(ex.id, "tool", e.target.value)} style={{ background: inputBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-lg px-1 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7C5A96]">
                            <option value="DB">DB</option>
                            <option value="KB">KB</option>
                            <option value="BB">BB</option>
                            <option value="BW">BW</option>
                            <option value="ERG">ERG</option>
                          </select>
                          <input type="text" placeholder="Exercise name" value={ex.name || ""} onChange={(e) => updateExercise(ex.id, "name", e.target.value)} style={{ background: inputBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7C5A96]" />
                          <input type="number" min="0" placeholder="kg" value={ex.weight || ""} onChange={(e) => updateExercise(ex.id, "weight", e.target.value)} style={{ background: inputBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7C5A96]" />
                          <input type="number" min="0" value={ex.reps || ""} onChange={(e) => updateExercise(ex.id, "reps", e.target.value)} style={{ background: inputBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7C5A96]" />
                          <button onClick={() => deleteExercise(ex.id)} style={{ color: subtle }} className="hover:text-red-500 transition-colors flex justify-center" aria-label="Remove"><XIcon className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <button onClick={addExercise} style={{ border: `1px solid ${borderCol}`, color: ink }} className="rounded-xl px-4 py-2 text-sm font-medium hover:opacity-70 transition-opacity flex items-center gap-1 mt-3"><PlusIcon className="w-4 h-4" /> Add Exercise</button>
            </div>
          )}
        </section>

        <p style={{ color: subtle }} className="text-center text-xs mt-8">☁️ Data synced by MERDY</p>
      </div>
    </div>
  );
}