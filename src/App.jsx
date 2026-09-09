import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";

const BIN_ID = "6a4c695cf5f4af5e296a28a4";
const MASTER_KEY = "$2a$10$O2F0Os04xfXpTPk7jCdHpeDQGKXiJdwlSlpnuFrlEPSmsZ/SdAMgO";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS = { "X-Master-Key": MASTER_KEY, "Content-Type": "application/json" };

// ---------- config ----------
const CYCLE_START_DAY = 25;
const ROUND_TO = 100;
const PAGE_SIZE = 10;
const FONT = "'Poppins', system-ui, sans-serif";

const TOOLS = [
  { key: "BB", label: "Barbell" },
  { key: "DB", label: "Dumbbell" },
  { key: "KB", label: "Kettlebell" },
  { key: "BW", label: "Bodyweight" },
  { key: "ERG", label: "Erg" },
];

const CATEGORIES = ["Food", "Grocery", "Entertainment", "Clothes", "Acc"];
const CAT_COLORS = {
  Food: "#C9F24D",
  Grocery: "#4FD1A5",
  Entertainment: "#A78BFA",
  Clothes: "#60A5FA",
  Acc: "#F5B841",
};
const OTHER = "Other";

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

  // Poppins
  useEffect(() => {
    const id = "poppins-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // date rolls over on its own
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
        lastSavedRef.current = JSON.stringify(data);
        setSynced(true);
      })
      .catch(() => { setStreakLastReset(todayStr()); setSynced(true); })
      .finally(() => setLoading(false));
  }, []);

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
    return { spentCycle, spentToday, daysLeft, allowance, leftToday: allowance - spentToday, inCycle };
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

  // uncategorised entries stay out of the chart
  const spendData = useMemo(() => {
    const totals = {};
    periodTx.filter(t => t.type === "expense").forEach(t => {
      if (t.category && CATEGORIES.includes(t.category)) totals[t.category] = (totals[t.category] || 0) + t.amt;
    });
    return Object.entries(totals)
      .map(([label, value]) => ({ label, value, color: CAT_COLORS[label] }))
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
  const txPages = Math.max(Math.ceil(sortedTx.length / PAGE_SIZE), 1);
  const txCur = Math.min(txPage, txPages);
  const txSlice = sortedTx.slice((txCur - 1) * PAGE_SIZE, txCur * PAGE_SIZE);

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
  const wkCur = Math.min(wkPage, wkPages);
  const wkSlice = sortedWorkouts.slice((wkCur - 1) * PAGE_SIZE, wkCur * PAGE_SIZE);
  useEffect(() => { setWkPage(1); }, [filter]);

  // ---- theme ----
  const t = darkMode
    ? { bg: "#0B0C0A", card: "#16181A", soft: "#1E2124", border: "rgba(255,255,255,0.07)", ink: "#F2F4F0", subtle: "rgba(242,244,240,0.5)", track: "rgba(255,255,255,0.07)" }
    : { bg: "#F2F3EF", card: "#FFFFFF", soft: "#F5F6F2", border: "rgba(20,23,15,0.08)", ink: "#14170F", subtle: "rgba(20,23,15,0.5)", track: "rgba(20,23,15,0.07)" };
  const lime = "#C9F24D";
  const limeInk = "#14170F";
  const red = "#F0705E";

  const card = { background: t.card, border: `1px solid ${t.border}` };
  const input = { background: t.soft, border: `1px solid ${t.border}`, color: t.ink };
  const chip = (on) => ({ background: on ? lime : t.soft, color: on ? limeInk : t.subtle, border: `1px solid ${on ? lime : t.border}` });

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

          {/* ---------------- left: visualization ---------------- */}
          <div className="lg:col-span-3 space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* balance */}
              <div style={card} className="sm:col-span-2 rounded-3xl p-6">
                <p style={{ color: t.subtle }} className="text-xs">Total savings</p>
                <p className="text-4xl sm:text-5xl font-semibold tabular-nums mt-2 tracking-tight">{won(savings)}</p>

                <div className="grid grid-cols-3 gap-2 mt-6">
                  <div style={{ background: lime, color: limeInk }} className="rounded-2xl px-3 py-3">
                    <p className="text-[11px] opacity-70">Today</p>
                    <p className="text-base font-semibold tabular-nums mt-0.5">{won(budget.allowance)}</p>
                  </div>
                  <div style={{ background: t.soft }} className="rounded-2xl px-3 py-3">
                    <p style={{ color: t.subtle }} className="text-[11px]">Spent</p>
                    <p className="text-base font-semibold tabular-nums mt-0.5">{won(budget.spentToday)}</p>
                  </div>
                  <div style={{ background: t.soft }} className="rounded-2xl px-3 py-3">
                    <p style={{ color: t.subtle }} className="text-[11px]">Left</p>
                    <p className="text-base font-semibold tabular-nums mt-0.5" style={{ color: budget.leftToday < 0 ? red : t.ink }}>{won(budget.leftToday)}</p>
                  </div>
                </div>
              </div>

              {/* streaks */}
              <div style={card} className="rounded-3xl p-5 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span style={{ background: t.soft }} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"><FlameIcon className="w-4 h-4" /></span>
                    <div className="min-w-0">
                      <p className="text-lg font-semibold tabular-nums leading-none">{streakDays}<span style={{ color: t.subtle }} className="text-xs font-normal ml-1">d</span></p>
                      <p style={{ color: t.subtle }} className="text-[11px] mt-1 truncate">Streak · best {streakLongest}</p>
                    </div>
                  </div>
                  <button onClick={resetStreak} disabled={streakResetDisabled} style={{ background: t.soft, color: streakResetDisabled ? t.subtle : red }} className={`rounded-full px-3 py-1.5 text-xs font-medium shrink-0 ${streakResetDisabled ? "opacity-50" : "hover:opacity-80"}`}>Reset</button>
                </div>

                <div style={{ borderTop: `1px solid ${t.border}` }} />

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span style={{ background: t.soft }} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"><BookIcon className="w-4 h-4" /></span>
                    <div className="min-w-0">
                      <p className="text-lg font-semibold tabular-nums leading-none">{readingStreak}<span style={{ color: t.subtle }} className="text-xs font-normal ml-1">d</span></p>
                      <p style={{ color: t.subtle }} className="text-[11px] mt-1 truncate">Reading · best {readingLongest}</p>
                    </div>
                  </div>
                  <button onClick={markReadToday} disabled={readingDoneToday} style={readingDoneToday ? { background: t.soft, color: t.subtle } : { background: lime, color: limeInk }} className={`rounded-full px-3 py-1.5 text-xs font-medium shrink-0 ${readingDoneToday ? "opacity-60" : "hover:opacity-90"}`}>
                    {readingDoneToday ? "Done" : "Read"}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* donut */}
              <div style={card} className="rounded-3xl p-5">
                <h2 className="text-sm font-medium mb-4">Breakdown</h2>
                {spendTotal === 0 ? (
                  <p style={{ color: t.subtle }} className="text-sm py-12 text-center">Nothing yet</p>
                ) : (
                  <>
                    <Donut data={spendData} total={spendTotal} track={t.track} ink={t.ink} centerValue={wonShort(spendTotal)} centerLabel="spent" />
                    <div className="space-y-2 mt-5">
                      {spendData.map(d => (
                        <div key={d.label} className="flex items-center gap-2">
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

              {/* daily chart */}
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
                        <span style={{ background: lime, color: limeInk }} className="absolute bottom-full mb-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap z-10">{wonShort(b.value)}</span>
                      )}
                      <div
                        className="w-full rounded-md transition-all"
                        title={`${shortDate(b.day)} ${won(b.value)}`}
                        style={{
                          height: `${Math.max((b.value / maxBar) * 100, b.value > 0 ? 4 : 2)}%`,
                          background: b.isToday ? lime : b.future ? t.track : t.subtle,
                          opacity: b.future ? 0.35 : b.isToday ? 1 : 0.55,
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

            {/* transactions */}
            <div style={card} className="rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
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
                      return (
                        <div key={tx.id} className="flex items-center gap-3 py-2.5 group">
                          <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: `${color}22`, color }}>
                            {(tx.category || OTHER).slice(0, 1)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{tx.note || tx.category || (tx.type === "income" ? "Income" : "Expense")}</p>
                            <p style={{ color: t.subtle }} className="text-[11px]">{tx.category || OTHER}</p>
                          </div>
                          <span style={{ color: t.subtle }} className="text-xs tabular-nums shrink-0 hidden sm:block">{shortDate(tx.day)}</span>
                          <span className="text-sm font-medium tabular-nums shrink-0 w-24 text-right" style={{ color: tx.type === "income" ? lime : red }}>
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

          {/* ---------------- right: input ---------------- */}
          <div className="lg:col-span-1 space-y-4">

            <div style={card} className="rounded-3xl p-5">
              <h2 className="text-sm font-medium mb-4">Add entry</h2>
              <form onSubmit={addTransaction} className="space-y-2.5">
                <input type="number" step="1" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={input} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#C9F24D]" required />
                <div className="grid grid-cols-2 gap-2.5">
                  <select value={txType} onChange={(e) => setTxType(e.target.value)} style={input} className="rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#C9F24D]">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={input} className="rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#C9F24D]">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <input type="text" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} style={input} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#C9F24D]" />
                <button type="submit" style={{ background: lime, color: limeInk }} className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                  <PlusIcon className="w-4 h-4" /> Add
                </button>
              </form>
            </div>

            {/* workout */}
            <div style={card} className="rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium flex items-center gap-2"><BarbellIcon className="w-4 h-4" /> Workout</h2>
                <button onClick={addExercise} style={{ background: lime, color: limeInk }} className="rounded-full p-1.5 hover:opacity-90" aria-label="Add exercise"><PlusIcon className="w-3.5 h-3.5" /></button>
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
                              style={{ background: `${lime}1F`, color: lime }}
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 hover:opacity-80"
                              title="Change tool"
                            >
                              <Icon className="w-4 h-4" />
                            </button>
                            <input type="text" placeholder="Exercise" value={ex.name || ""} onChange={(e) => updateExercise(ex.id, "name", e.target.value)} style={{ color: t.ink }} className="flex-1 min-w-0 bg-transparent text-sm outline-none" />
                            <button onClick={() => deleteExercise(ex.id)} style={{ color: t.subtle }} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0" aria-label="Remove"><XIcon className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className="flex items-center gap-2 mt-2 pl-10">
                            <input type="number" min="0" placeholder="0" value={ex.weight || ""} onChange={(e) => updateExercise(ex.id, "weight", e.target.value)} style={{ background: t.card, border: `1px solid ${t.border}`, color: t.ink }} className="w-16 rounded-lg px-2 py-1 text-xs tabular-nums outline-none focus:ring-1 focus:ring-[#C9F24D]" />
                            <span style={{ color: t.subtle }} className="text-[11px]">kg</span>
                            <input type="number" min="0" value={ex.reps || ""} onChange={(e) => updateExercise(ex.id, "reps", e.target.value)} style={{ background: t.card, border: `1px solid ${t.border}`, color: t.ink }} className="w-14 rounded-lg px-2 py-1 text-xs tabular-nums outline-none focus:ring-1 focus:ring-[#C9F24D]" />
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