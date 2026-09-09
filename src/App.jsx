import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";

const BIN_ID = "6a4c695cf5f4af5e296a28a4";
const MASTER_KEY = "$2a$10$O2F0Os04xfXpTPk7jCdHpeDQGKXiJdwlSlpnuFrlEPSmsZ/SdAMgO";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS = { "X-Master-Key": MASTER_KEY, "Content-Type": "application/json" };

// ---------- config ----------
const CYCLE_START_DAY = 25;   // budget month runs 25th -> 24th
const ROUND_TO = 100;         // round daily allowance down to nearest 100 won
const PAGE_SIZE = 10;

const TOOLS = [
  { key: "DB", label: "Dumbbell" },
  { key: "KB", label: "Kettlebell" },
  { key: "BB", label: "Barbell" },
  { key: "BW", label: "Bodyweight" },
  { key: "ERG", label: "Erg" },
];

const CATEGORIES = ["Food", "Grocery", "Entertainment", "Clothes", "Acc"];
const CAT_COLORS = {
  Food: "#5B7F62",
  Grocery: "#7C5A96",
  Entertainment: "#C1543C",
  Clothes: "#4A5FA0",
  Acc: "#C79A3C",
};

// ---------- date helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toDateStr = (isoTimestamp) => {
  const d = new Date(isoTimestamp);
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
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
};
const formatShortDate = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const won = (n) => `₩${Math.round(n).toLocaleString()}`;

// budget cycle that contains a given date
const cycleFor = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  let sy = y, sm = m;
  if (d < CYCLE_START_DAY) {
    sm = m - 1;
    if (sm === 0) { sm = 12; sy = y - 1; }
  }
  const start = `${sy}-${pad(sm)}-${pad(CYCLE_START_DAY)}`;
  let ey = sy, em = sm + 1;
  if (em === 13) { em = 1; ey = sy + 1; }
  return { start, end: `${ey}-${pad(em)}-${pad(CYCLE_START_DAY - 1)}` };
};

// ---------- streak helpers ----------
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

function calcReadingStreak(dates) {
  const set = new Set(dates);
  const today = todayStr();
  let cursor = set.has(today) ? today : addDaysStr(today, -1);
  if (!set.has(cursor)) return 0;
  let count = 0;
  while (set.has(cursor)) { count++; cursor = addDaysStr(cursor, -1); }
  return count;
}

const F_DISPLAY = "'Fraunces', serif";
const F_MONO = "'JetBrains Mono', monospace";

// ---------- ui icons ----------
const svg = (props) => ({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", ...props });
const SunIcon = (p) => (<svg {...svg(p)}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" /></svg>);
const MoonIcon = (p) => (<svg {...svg(p)}><path d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.5 6.5 0 0 0 10.2 10.2Z" /></svg>);
const ChevronIcon = (p) => (<svg {...svg(p)}><path d="M6 9l6 6 6-6" /></svg>);
const TrashIcon = (p) => (<svg {...svg(p)}><path d="M4 7h16M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7M18 7l-.7 12.4a1.6 1.6 0 0 1-1.6 1.6H8.3a1.6 1.6 0 0 1-1.6-1.6L6 7" /></svg>);
const XIcon = (p) => (<svg {...svg(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
const PlusIcon = (p) => (<svg {...svg(p)}><path d="M12 5v14M5 12h14" /></svg>);
const ArrowIcon = (p) => (<svg {...svg(p)}><path d="M15 6l-6 6 6 6" /></svg>);

// ---------- workout tool icons ----------
const DumbbellIcon = (p) => (<svg {...svg(p)}><path d="M4 9v6M7 7v10M10 11h4M17 7v10M20 9v6" /></svg>);
const KettlebellIcon = (p) => (<svg {...svg(p)}><path d="M9 7a3 3 0 0 1 6 0" /><path d="M9.2 7.4C7 8.6 5.5 11 5.5 13.6c0 2.3 1 4 2.2 5.4h8.6c1.2-1.4 2.2-3.1 2.2-5.4 0-2.6-1.5-5-3.7-6.2" /></svg>);
const BarbellIcon = (p) => (<svg {...svg(p)}><path d="M3 10v4M6 7.5v9M8.5 12h7M18 7.5v9M21 10v4" /></svg>);
const BodyweightIcon = (p) => (<svg {...svg(p)}><circle cx="12" cy="5" r="2" /><path d="M12 7.5v6M12 13.5l-3 6M12 13.5l3 6M7 10h10" /></svg>);
const ErgIcon = (p) => (<svg {...svg(p)}><circle cx="8" cy="8" r="2" /><path d="M10 10.5l3 2 3-1M13 12.5l1 4M14 16.5l-4 2.5M3 14h18M6 14l-2 5M18 14l2 5" /></svg>);

const TOOL_ICONS = { DB: DumbbellIcon, KB: KettlebellIcon, BB: BarbellIcon, BW: BodyweightIcon, ERG: ErgIcon };

// ---------- donut chart ----------
function Donut({ data, total, size = 168, thickness = 22, trackColor, centerLabel, centerValue, ink }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={thickness} />
        {total > 0 && data.map((d) => {
          const len = (d.value / total) * c;
          const dash = <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return dash;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span style={{ fontFamily: F_DISPLAY, color: ink }} className="text-xl font-semibold tabular-nums">{centerValue}</span>
        <span className="text-[11px] opacity-60">{centerLabel}</span>
      </div>
    </div>
  );
}

// ---------- pagination ----------
function Pager({ page, pages, onChange, subtle }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className={`p-1.5 rounded-lg ${page === 1 ? "opacity-30" : "hover:opacity-70"}`} aria-label="Previous page">
        <ArrowIcon className="w-4 h-4" />
      </button>
      <span style={{ fontFamily: F_MONO, color: subtle }} className="text-xs">{page} / {pages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === pages} className={`p-1.5 rounded-lg rotate-180 ${page === pages ? "opacity-30" : "hover:opacity-70"}`} aria-label="Next page">
        <ArrowIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [streakLastReset, setStreakLastReset] = useState(todayStr());
  const [streakResets, setStreakResets] = useState([]);
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
  const [txType, setTxType] = useState("expense");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [spendPeriod, setSpendPeriod] = useState("cycle"); // cycle | last | all
  const [txPage, setTxPage] = useState(1);
  const [wkPage, setWkPage] = useState(1);

  // ---- load ----
  useEffect(() => {
    axios.get(BIN_URL, { headers: HEADERS })
      .then(res => {
        const data = res.data.record;
        setDarkMode(data.darkMode ?? false);
        setTransactions(data.transactions ?? []);
        setStreakLastReset(data.streakLastReset ?? todayStr());
        setStreakResets(data.streakResets ?? (data.streakLastReset ? [data.streakLastReset] : []));
        setReadingDates(data.readingDates ?? []);
        setWorkoutPlan(data.workoutPlan ?? []);
        lastSavedRef.current = JSON.stringify(data);
        setSynced(true);
      })
      .catch(() => { setStreakLastReset(todayStr()); setSynced(true); })
      .finally(() => setLoading(false));
  }, []);

  // ---- save ----
  const saveToCloud = useCallback(() => {
    if (!synced || isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (typingRef.current) return;
    const data = { darkMode, transactions, streakLastReset, streakResets, readingDates, workoutPlan };
    const newData = JSON.stringify(data);
    if (newData === lastSavedRef.current) return;
    lastSavedRef.current = newData;
    axios.put(BIN_URL, data, { headers: HEADERS }).catch(() => {});
  }, [darkMode, transactions, streakLastReset, streakResets, readingDates, workoutPlan, synced]);

  useEffect(() => {
    const t = setTimeout(saveToCloud, 1000);
    return () => clearTimeout(t);
  }, [saveToCloud]);

  // ---- poll ----
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
          setStreakResets(data.streakResets ?? (data.streakLastReset ? [data.streakLastReset] : []));
          setReadingDates(data.readingDates ?? []);
          setWorkoutPlan(data.workoutPlan ?? []);
          setTimeout(() => { remoteUpdateRef.current = false; }, 1000);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const today = todayStr();
  const cycle = useMemo(() => cycleFor(today), [today]);

  // normalise once: every transaction gets a plain YYYY-MM-DD day
  const txs = useMemo(
    () => transactions.map(t => ({ ...t, day: toDateStr(t.date), amt: Number(t.amount) || 0 })),
    [transactions]
  );

  // ---- budget cycle ----
  const budget = useMemo(() => {
    const inCycle = txs.filter(t => t.day >= cycle.start && t.day <= cycle.end);
    const income = inCycle.filter(t => t.type === "income").reduce((s, t) => s + t.amt, 0);
    const spent = inCycle.filter(t => t.type === "expense").reduce((s, t) => s + t.amt, 0);
    const spentToday = inCycle.filter(t => t.type === "expense" && t.day === today).reduce((s, t) => s + t.amt, 0);

    const remaining = income - spent;
    const daysLeft = Math.max(diffDays(today, cycle.end) + 1, 1);
    const beforeToday = remaining + spentToday;
    const raw = beforeToday / daysLeft;
    const allowance = raw > 0 ? Math.floor(raw / ROUND_TO) * ROUND_TO : 0;
    const leftToday = allowance - spentToday;

    return { income, spent, remaining, spentToday, daysLeft, allowance, leftToday, inCycle };
  }, [txs, cycle, today]);

  const allTime = useMemo(
    () => txs.reduce((s, t) => s + (t.type === "income" ? t.amt : -t.amt), 0),
    [txs]
  );

  // ---- streaks ----
  const streakDays = streakLastReset ? Math.max(diffDays(streakLastReset, today), 0) : 0;
  const streakResetDisabled = streakLastReset === today;
  const streakLongest = useMemo(() => {
    const list = [...new Set([...streakResets, streakLastReset])].filter(Boolean).sort();
    let best = streakDays;
    for (let i = 1; i < list.length; i++) best = Math.max(best, diffDays(list[i - 1], list[i]));
    return best;
  }, [streakResets, streakLastReset, streakDays]);

  const readingStreak = useMemo(() => calcReadingStreak(readingDates), [readingDates]);
  const readingLongest = useMemo(() => Math.max(longestRun(readingDates), readingStreak), [readingDates, readingStreak]);
  const readingDoneToday = readingDates.includes(today);

  // ---- spending breakdown ----
  const periodTx = useMemo(() => {
    if (spendPeriod === "all") return txs;
    const c = spendPeriod === "cycle" ? cycle : cycleFor(addDaysStr(cycle.start, -1));
    return txs.filter(t => t.day >= c.start && t.day <= c.end);
  }, [txs, spendPeriod, cycle]);

  const spendData = useMemo(() => {
    const totals = {};
    CATEGORIES.forEach(c => { totals[c] = 0; });
    periodTx.filter(t => t.type === "expense").forEach(t => {
      if (totals[t.category] !== undefined) totals[t.category] += t.amt;
      else totals[t.category] = (totals[t.category] || 0) + t.amt;
    });
    return Object.entries(totals)
      .map(([label, value]) => ({ label, value, color: CAT_COLORS[label] || "#8A8A8A" }))
      .sort((a, b) => b.value - a.value);
  }, [periodTx]);

  const spendTotal = spendData.reduce((s, d) => s + d.value, 0);

  // daily spend bars across the current cycle
  const dailyBars = useMemo(() => {
    const days = diffDays(cycle.start, cycle.end) + 1;
    const map = {};
    budget.inCycle.filter(t => t.type === "expense").forEach(t => { map[t.day] = (map[t.day] || 0) + t.amt; });
    return Array.from({ length: days }, (_, i) => {
      const day = addDaysStr(cycle.start, i);
      return { day, value: map[day] || 0, isToday: day === today, future: day > today };
    });
  }, [budget.inCycle, cycle, today]);

  const maxBar = Math.max(...dailyBars.map(b => b.value), budget.allowance, 1);

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

  // ---- paged lists ----
  const sortedTx = useMemo(() => [...txs].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)), [txs]);
  const txPages = Math.max(Math.ceil(sortedTx.length / PAGE_SIZE), 1);
  const txSlice = sortedTx.slice((Math.min(txPage, txPages) - 1) * PAGE_SIZE, Math.min(txPage, txPages) * PAGE_SIZE);

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
  const wkPages = Math.max(Math.ceil(sortedWorkouts.length / PAGE_SIZE), 1);
  const wkSlice = sortedWorkouts.slice((Math.min(wkPage, wkPages) - 1) * PAGE_SIZE, Math.min(wkPage, wkPages) * PAGE_SIZE);

  useEffect(() => { setWkPage(1); }, [filter]);

  // ---- theme ----
  const bg = darkMode ? "#17181B" : "#FAF6EE";
  const ink = darkMode ? "#F0EBE1" : "#2B2A28";
  const cardBg = darkMode ? "#211F1C" : "#FFFFFF";
  const borderCol = darkMode ? "rgba(255,255,255,0.08)" : "rgba(43,42,40,0.08)";
  const subtle = darkMode ? "rgba(240,235,225,0.55)" : "rgba(43,42,40,0.55)";
  const inputBg = darkMode ? "#17181B" : "#FAF6EE";
  const track = darkMode ? "rgba(255,255,255,0.08)" : "rgba(43,42,40,0.07)";
  const green = "#5B7F62";
  const red = "#C1543C";

  const pill = (active) => ({
    background: active ? "#7C5A96" : inputBg,
    color: active ? "#fff" : ink,
    border: `1px solid ${borderCol}`,
  });
  const inputStyle = { background: inputBg, border: `1px solid ${borderCol}`, color: ink };

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
        {/* header - visual pass later */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 style={{ fontFamily: F_DISPLAY }} className="text-2xl sm:text-3xl font-semibold tracking-tight">Merdy Dashboard</h1>
            <p style={{ fontFamily: F_MONO, color: subtle }} className="text-xs mt-1 tracking-wide">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <button onClick={() => setDarkMode(d => !d)} style={{ background: cardBg, border: `1px solid ${borderCol}`, color: ink }} className="rounded-full p-2.5 shadow-sm hover:opacity-80 transition-opacity shrink-0" aria-label="Toggle dark mode">
            {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
        </div>

        {/* budget hero */}
        <section style={{ background: darkMode ? "#3F5A45" : green }} className="rounded-2xl p-5 sm:p-6 shadow-sm text-white mb-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs opacity-75">Left this cycle</p>
              <p style={{ fontFamily: F_DISPLAY }} className="text-4xl sm:text-5xl font-semibold tabular-nums mt-1">{won(budget.remaining)}</p>
              <p className="text-xs opacity-75 mt-2">
                {formatShortDate(cycle.start)} – {formatShortDate(cycle.end)} · {budget.daysLeft} {budget.daysLeft === 1 ? "day" : "days"} left
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75">You can spend today</p>
              <p style={{ fontFamily: F_DISPLAY }} className="text-3xl sm:text-4xl font-semibold tabular-nums mt-1">{won(budget.allowance)}</p>
              <p className="text-xs opacity-75 mt-2">
                spent {won(budget.spentToday)} · {budget.leftToday >= 0 ? `${won(budget.leftToday)} left` : `${won(-budget.leftToday)} over`}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="h-2 rounded-full overflow-hidden bg-white/20">
              <div className="h-full bg-white/85 rounded-full transition-all" style={{ width: `${budget.income > 0 ? Math.min((budget.spent / budget.income) * 100, 100) : 0}%` }} />
            </div>
            <div className="flex justify-between text-xs opacity-75 mt-2">
              <span>Spent {won(budget.spent)}</span>
              <span>Budget {won(budget.income)}</span>
            </div>
          </div>
        </section>

        {/* streaks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div style={{ background: cardBg, border: `1px solid ${borderCol}` }} className="rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span style={{ fontFamily: F_DISPLAY, color: darkMode ? "#A1B5D8" : "#4A5FA0" }} className="text-3xl sm:text-4xl font-semibold tabular-nums">{streakDays}</span>
                <span className="text-sm opacity-80">{streakDays === 1 ? "day" : "days"}</span>
              </div>
              <p className="text-xs opacity-80">Streak</p>
              <p style={{ color: subtle }} className="text-xs mt-1">Longest {streakLongest} {streakLongest === 1 ? "day" : "days"}</p>
            </div>
            <button onClick={resetStreak} disabled={streakResetDisabled} className={`px-4 py-2 rounded-full text-sm font-medium text-white shrink-0 transition-opacity ${streakResetDisabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-90"}`} style={{ background: red }}>Reset</button>
          </div>

          <div style={{ background: cardBg, border: `1px solid ${borderCol}` }} className="rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span style={{ fontFamily: F_DISPLAY, color: darkMode ? "#C5B4D6" : "#7C5A96" }} className="text-3xl sm:text-4xl font-semibold tabular-nums">{readingStreak}</span>
                <span className="text-sm opacity-80">{readingStreak === 1 ? "day" : "days"}</span>
              </div>
              <p className="text-xs opacity-80">Reading streak</p>
              <p style={{ color: subtle }} className="text-xs mt-1">Longest {readingLongest} {readingLongest === 1 ? "day" : "days"}</p>
            </div>
            <button onClick={markReadToday} disabled={readingDoneToday} className={`px-4 py-2 rounded-full text-sm font-medium shrink-0 transition-opacity ${readingDoneToday ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`} style={{ background: readingDoneToday ? (darkMode ? "#2E4A32" : "#DCE7DD") : green, color: readingDoneToday ? green : "#fff" }}>
              {readingDoneToday ? "Read today" : "Read now"}
            </button>
          </div>
        </div>

        {/* money tracker */}
        <section style={{ background: cardBg, border: `1px solid ${borderCol}` }} className="rounded-2xl shadow-sm p-5 sm:p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 style={{ fontFamily: F_DISPLAY }} className="text-lg font-semibold">Money tracker</h2>
            <span style={{ fontFamily: F_MONO, color: subtle }} className="text-xs">All time {won(allTime)}</span>
          </div>

          <form onSubmit={addTransaction} className="flex flex-wrap gap-3 mb-6">
            <input type="number" step="1" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} className="rounded-xl px-3 py-2 text-sm w-28 outline-none focus:ring-2 focus:ring-[#5B7F62]" required />
            <select value={txType} onChange={(e) => setTxType(e.target.value)} style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5B7F62]">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#5B7F62]">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="text" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} className="rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px] outline-none focus:ring-2 focus:ring-[#5B7F62]" />
            <button type="submit" className="rounded-xl px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity flex items-center gap-1" style={{ background: green }}><PlusIcon className="w-4 h-4" /> Add</button>
          </form>

          {/* breakdown */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h3 className="text-sm font-semibold">Spending breakdown</h3>
              <div className="flex gap-2">
                <button onClick={() => setSpendPeriod("cycle")} style={pill(spendPeriod === "cycle")} className="rounded-full px-3 py-1 text-xs font-medium">This cycle</button>
                <button onClick={() => setSpendPeriod("last")} style={pill(spendPeriod === "last")} className="rounded-full px-3 py-1 text-xs font-medium">Last cycle</button>
                <button onClick={() => setSpendPeriod("all")} style={pill(spendPeriod === "all")} className="rounded-full px-3 py-1 text-xs font-medium">All time</button>
              </div>
            </div>

            {spendTotal === 0 ? (
              <p style={{ color: subtle }} className="text-sm py-6 text-center">No expenses yet in this period. Add one above.</p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Donut data={spendData} total={spendTotal} trackColor={track} ink={ink} centerValue={won(spendTotal)} centerLabel="spent" />
                <div className="flex-1 w-full space-y-2.5">
                  {spendData.filter(d => d.value > 0).map(d => (
                    <div key={d.label} className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-sm flex-1 truncate">{d.label}</span>
                      <span style={{ color: subtle }} className="text-xs w-10 text-right">{Math.round((d.value / spendTotal) * 100)}%</span>
                      <span style={{ fontFamily: F_MONO }} className="text-sm w-24 text-right tabular-nums">{won(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* daily spend vs allowance */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Daily spend this cycle</h3>
              <span style={{ color: subtle }} className="text-xs">dashed line = today's allowance</span>
            </div>
            <div className="relative h-24 flex items-end gap-[3px]">
              <div className="absolute left-0 right-0 border-t border-dashed pointer-events-none" style={{ bottom: `${(budget.allowance / maxBar) * 100}%`, borderColor: subtle }} />
              {dailyBars.map(b => (
                <div key={b.day} className="flex-1 rounded-t-sm transition-all" title={`${formatShortDate(b.day)} · ${won(b.value)}`}
                  style={{
                    height: `${Math.max((b.value / maxBar) * 100, b.value > 0 ? 3 : 1)}%`,
                    background: b.isToday ? "#7C5A96" : b.future ? track : b.value > budget.allowance ? red : green,
                    opacity: b.future ? 0.6 : 1,
                  }} />
              ))}
            </div>
            <div className="flex justify-between text-xs mt-2" style={{ color: subtle, fontFamily: F_MONO }}>
              <span>{formatShortDate(cycle.start)}</span>
              <span>{formatShortDate(cycle.end)}</span>
            </div>
          </div>

          {/* history */}
          <div>
            <button onClick={() => setHistoryOpen(o => !o)} className="flex items-center gap-2 text-sm font-medium mb-3 hover:opacity-80">
              <ChevronIcon className={`w-4 h-4 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              Transaction history ({transactions.length})
            </button>
            {historyOpen && (
              transactions.length === 0 ? (
                <p style={{ color: subtle }} className="text-sm text-center py-6">Nothing recorded yet.</p>
              ) : (
                <div>
                  <ul className="divide-y" style={{ borderColor: borderCol }}>
                    {txSlice.map(t => (
                      <li key={t.id} className="flex items-center justify-between py-2.5 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span style={{ fontFamily: F_MONO, color: subtle }} className="text-xs w-14 shrink-0">{formatShortDate(t.day)}</span>
                          <div className="flex items-center gap-2 min-w-0">
                            {t.category && (
                              <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: `${CAT_COLORS[t.category] || "#8A8A8A"}22`, color: CAT_COLORS[t.category] || ink }}>{t.category}</span>
                            )}
                            <span className="text-sm truncate">{t.note || (t.type === "income" ? "Income" : "Expense")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span style={{ fontFamily: F_MONO, color: t.type === "income" ? green : red }} className="text-sm font-medium tabular-nums">{t.type === "income" ? "+" : "-"}{won(t.amt)}</span>
                          <button onClick={() => deleteTransaction(t.id)} style={{ color: subtle }} className="hover:text-red-500 transition-colors" aria-label="Delete"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pager page={Math.min(txPage, txPages)} pages={txPages} onChange={setTxPage} subtle={subtle} />
                </div>
              )
            )}
          </div>
        </section>

        {/* workout */}
        <section style={{ background: cardBg, border: `1px solid ${borderCol}` }} className="rounded-2xl shadow-sm overflow-hidden">
          <button onClick={() => setWorkoutOpen(o => !o)} className="w-full flex items-center justify-between px-5 sm:px-6 py-4 text-left">
            <h2 style={{ fontFamily: F_DISPLAY }} className="text-lg font-semibold flex items-center gap-2">
              <BarbellIcon className="w-5 h-5" /> Workout record
            </h2>
            <ChevronIcon className={`w-5 h-5 transition-transform duration-200 ${workoutOpen ? "rotate-180" : ""}`} />
          </button>

          {workoutOpen && (
            <div className="px-5 sm:px-6 pb-6">
              <div className="flex flex-wrap gap-2 mb-4">
                <button onClick={() => setFilter("ALL")} style={pill(filter === "ALL")} className="rounded-full px-3 py-1.5 text-xs font-medium">All</button>
                {TOOLS.map(t => {
                  const Icon = TOOL_ICONS[t.key];
                  return (
                    <button key={t.key} onClick={() => setFilter(t.key)} style={pill(filter === t.key)} className="rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5" title={t.label}>
                      <Icon className="w-4 h-4" /> {t.key}
                    </button>
                  );
                })}
              </div>

              {sortedWorkouts.length === 0 ? (
                <p style={{ color: subtle }} className="text-sm py-2 mb-3">No exercises here yet.</p>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <div className="min-w-[340px]">
                    <div style={{ color: subtle }} className="grid grid-cols-[56px_1fr_56px_56px_32px] sm:grid-cols-[72px_1fr_72px_72px_32px] gap-2 text-xs px-1 mb-2">
                      <span>Tool</span>
                      <button onClick={() => toggleSort("name")} className="text-left flex items-center gap-1">Name{sortKey === "name" && (sortDir === "asc" ? " ▲" : " ▼")}</button>
                      <button onClick={() => toggleSort("weight")} className="text-left flex items-center gap-1">Wt{sortKey === "weight" && (sortDir === "asc" ? " ▲" : " ▼")}</button>
                      <button onClick={() => toggleSort("reps")} className="text-left flex items-center gap-1">Reps{sortKey === "reps" && (sortDir === "asc" ? " ▲" : " ▼")}</button>
                      <span />
                    </div>
                    <div className="space-y-2">
                      {wkSlice.map(ex => {
                        const Icon = TOOL_ICONS[ex.tool] || DumbbellIcon;
                        return (
                          <div key={ex.id} className="grid grid-cols-[56px_1fr_56px_56px_32px] sm:grid-cols-[72px_1fr_72px_72px_32px] gap-2 items-center">
                            <div className="relative flex items-center">
                              <Icon className="w-4 h-4 absolute left-1.5 pointer-events-none" style={{ color: subtle }} />
                              <select value={ex.tool || "DB"} onChange={(e) => updateExercise(ex.id, "tool", e.target.value)} style={inputStyle} className="w-full rounded-lg pl-7 pr-1 py-1.5 text-xs appearance-none outline-none focus:ring-2 focus:ring-[#7C5A96]">
                                {TOOLS.map(t => <option key={t.key} value={t.key}>{t.key}</option>)}
                              </select>
                            </div>
                            <input type="text" placeholder="Exercise name" value={ex.name || ""} onChange={(e) => updateExercise(ex.id, "name", e.target.value)} style={inputStyle} className="rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7C5A96]" />
                            <input type="number" min="0" placeholder="kg" value={ex.weight || ""} onChange={(e) => updateExercise(ex.id, "weight", e.target.value)} style={inputStyle} className="rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7C5A96]" />
                            <input type="number" min="0" value={ex.reps || ""} onChange={(e) => updateExercise(ex.id, "reps", e.target.value)} style={inputStyle} className="rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#7C5A96]" />
                            <button onClick={() => deleteExercise(ex.id)} style={{ color: subtle }} className="hover:text-red-500 transition-colors flex justify-center" aria-label="Remove"><XIcon className="w-4 h-4" /></button>
                          </div>
                        );
                      })}
                    </div>
                    <Pager page={Math.min(wkPage, wkPages)} pages={wkPages} onChange={setWkPage} subtle={subtle} />
                  </div>
                </div>
              )}

              <button onClick={addExercise} style={{ border: `1px solid ${borderCol}`, color: ink }} className="rounded-xl px-4 py-2 text-sm font-medium hover:opacity-70 transition-opacity flex items-center gap-1 mt-3"><PlusIcon className="w-4 h-4" /> Add exercise</button>
            </div>
          )}
        </section>

        <p style={{ color: subtle }} className="text-center text-xs mt-8">Synced by MERDY</p>
      </div>
    </div>
  );
}