import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";

const BIN_ID = "6a4c695cf5f4af5e296a28a4";
const MASTER_KEY = "$2a$10$O2F0Os04xfXpTPk7jCdHpeDQGKXiJdwlSlpnuFrlEPSmsZ/SdAMgO";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS = { "X-Master-Key": MASTER_KEY, "Content-Type": "application/json" };

// ============================================================
// DESIGN TOKENS
// ============================================================
const SP = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
const R = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

const TY = {
  largeTitle: { fontSize: 34, lineHeight: "41px", fontWeight: 600, letterSpacing: "-0.4px" },
  title1:     { fontSize: 28, lineHeight: "34px", fontWeight: 600, letterSpacing: "-0.36px" },
  title2:     { fontSize: 22, lineHeight: "28px", fontWeight: 600, letterSpacing: "-0.26px" },
  title3:     { fontSize: 20, lineHeight: "25px", fontWeight: 600, letterSpacing: "-0.2px" },
  headline:   { fontSize: 17, lineHeight: "22px", fontWeight: 600, letterSpacing: "-0.24px" },
  body:       { fontSize: 17, lineHeight: "22px", fontWeight: 400, letterSpacing: "-0.24px" },
  callout:    { fontSize: 16, lineHeight: "21px", fontWeight: 400, letterSpacing: "-0.2px" },
  subhead:    { fontSize: 15, lineHeight: "20px", fontWeight: 500, letterSpacing: "-0.16px" },
  footnote:   { fontSize: 13, lineHeight: "18px", fontWeight: 400, letterSpacing: "-0.08px" },
  caption1:   { fontSize: 12, lineHeight: "16px", fontWeight: 400, letterSpacing: "0px" },
  caption2:   { fontSize: 11, lineHeight: "16px", fontWeight: 400, letterSpacing: "0.06px" },
};
const num = (style) => ({ ...style, fontVariantNumeric: "tabular-nums" });

const BRAND = "#2F5BEA";
const BRAND_2 = "#1A73E8";
const BRAND_TINT = "#6F9BFF";
const TEAL = "#12B3A8";
const GREEN = "#1AA971";
const AMBER = "#F5A623";
const VIOLET = "#7C6BF0";
const RED_DARK = "#FF6961";
const RED_LIGHT = "#D22B20";

const HIT = 44;

// ---------- config ----------
const CYCLE_START_DAY = 25;
const ROUND_TO = 100;
const TX_PAGE_SIZE = 5;
const WK_PAGE_SIZE = 5;
const HIGHLIGHT_MAX = 200;
const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

const TOOLS = [
  { key: "BB", label: "Barbell" },
  { key: "DB", label: "Dumbbell" },
  { key: "KB", label: "Kettlebell" },
  { key: "BW", label: "Bodyweight" },
  { key: "ERG", label: "Erg" },
];

const CATEGORIES = ["Food", "Grocery", "Entertainment", "Clothes", "Acc"];
const CAT_LABELS = { Food: "Food", Grocery: "Grocery", Entertainment: "Entertainment", Clothes: "Clothes", Acc: "Accessories" };
const CAT_COLORS = { Food: BRAND, Grocery: TEAL, Entertainment: VIOLET, Clothes: GREEN, Acc: AMBER };

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
const ChevronIcon = (p) => (<svg {...s(p)}><path d="M15 6l-6 6 6 6" /></svg>);
const FlameIcon = (p) => (<svg {...s(p)}><path d="M12 3c.6 3.2 3 4.2 3.9 6.4a5.9 5.9 0 1 1-9.6 1.7C7.6 8.4 10.4 8 12 3Z" /></svg>);
const BookIcon = (p) => (<svg {...s(p)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" /></svg>);
const PenIcon = (p) => (<svg {...s(p)}><path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17v3Z" /></svg>);
const CheckIcon = (p) => (<svg {...s(p)}><path d="M5 12.5 10 17l9-10" /></svg>);
const CalendarIcon = (p) => (<svg {...s(p)}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" /></svg>);

const FoodIcon = (p) => (<svg {...s(p)}><path d="M4.5 3v6a2.8 2.8 0 0 0 5.6 0V3M7.3 11.5V21" /><path d="M17.5 3c-1.4 2-2 4.2-2 6.3 0 1.5.9 2.4 2 2.4s2-.9 2-2.4c0-2.1-.6-4.3-2-6.3ZM17.5 11.7V21" /></svg>);
const GroceryIcon = (p) => (<svg {...s(p)}><path d="M4.5 8h15l-1.4 10.4a2 2 0 0 1-2 1.7H7.9a2 2 0 0 1-2-1.7L4.5 8Z" /><path d="m8.5 8 3.5-5 3.5 5M10 12v4M14 12v4" /></svg>);
const EntertainmentIcon = (p) => (<svg {...s(p)}><circle cx="12" cy="12" r="8.5" /><path d="M10.3 9.2 15 12l-4.7 2.8V9.2Z" /></svg>);
const ClothesIcon = (p) => (<svg {...s(p)}><path d="M8.5 3.5 5 5.5 3 9l3.2 1.7V20.5h11.6V10.7L21 9l-2-3.5-3.5-2" /><path d="M8.5 3.5c0 1.9 1.6 3 3.5 3s3.5-1.1 3.5-3" /></svg>);
const AccessoriesIcon = (p) => (<svg {...s(p)}><circle cx="12" cy="12" r="4.6" /><path d="M9 7.6 9.6 3h4.8l.6 4.6M9 16.4 9.6 21h4.8l.6-4.6" /></svg>);
const DotIcon = (p) => (<svg {...s(p)}><circle cx="12" cy="12" r="4" /></svg>);
const CAT_ICONS = { Food: FoodIcon, Grocery: GroceryIcon, Entertainment: EntertainmentIcon, Clothes: ClothesIcon, Acc: AccessoriesIcon };

const DumbbellIcon = (p) => (<svg {...s(p)}><path d="M4 9v6M7 7v10M10 11h4M17 7v10M20 9v6" /></svg>);
const KettlebellIcon = (p) => (<svg {...s(p)}><path d="M9 7a3 3 0 0 1 6 0" /><path d="M9.2 7.4C7 8.6 5.5 11 5.5 13.6c0 2.3 1 4 2.2 5.4h8.6c1.2-1.4 2.2-3.1 2.2-5.4 0-2.6-1.5-5-3.7-6.2" /></svg>);
const BarbellIcon = (p) => (<svg {...s(p)}><path d="M3 10v4M6 7.5v9M8.5 12h7M18 7.5v9M21 10v4" /></svg>);
const BodyweightIcon = (p) => (<svg {...s(p)}><circle cx="12" cy="5" r="2" /><path d="M12 7.5v6M12 13.5l-3 6M12 13.5l3 6M7 10h10" /></svg>);
const ErgIcon = (p) => (<svg {...s(p)}><circle cx="8" cy="8" r="2" /><path d="M10 10.5l3 2 3-1M13 12.5l1 4M14 16.5l-4 2.5M3 14h18M6 14l-2 5M18 14l2 5" /></svg>);
const TOOL_ICONS = { DB: DumbbellIcon, KB: KettlebellIcon, BB: BarbellIcon, BW: BodyweightIcon, ERG: ErgIcon };

// ---------- primitives ----------
function Donut({ data, total, size = 152, thickness = 20, track, ink, centerValue, centerLabel }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        {total > 0 && data.map((d) => {
          const len = (d.value / total) * c;
          const arc = (
            <circle key={d.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color}
              strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt"
              style={{ transition: "stroke-dasharray .5s var(--ease), stroke-dashoffset .5s var(--ease)" }} />
          );
          offset += len;
          return arc;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ gap: SP.xs }}>
        <span style={{ ...num(TY.title3), color: ink }}>{centerValue}</span>
        <span style={{ ...TY.caption2, opacity: 0.6 }}>{centerLabel}</span>
      </div>
    </div>
  );
}

// weight over sessions
function ProgressChart({ points, color, grid, label2 }) {
  const W = 640, H = 180, padY = 24;
  if (points.length === 0) return null;

  const values = points.map(p => p.value);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min = Math.max(0, min - 5); max = max + 5; }
  const span = max - min;

  const x = (i) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * (W - 16) + 8);
  const y = (v) => H - padY - ((v - min) / span) * (H - padY * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const gid = "pg-fill";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 180, display: "block" }} role="img" aria-label="Weight progress">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map(f => (
        <line key={f} x1="0" x2={W} y1={padY + f * (H - padY * 2)} y2={padY + f * (H - padY * 2)}
          stroke={grid} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      {points.length > 1 && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={p.day} cx={x(i)} cy={y(p.value)} r="3.5" fill={color} vectorEffect="non-scaling-stroke">
          <title>{`${shortDate(p.day)} · ${p.value}kg × ${p.reps}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Pager({ page, pages, onChange, label2 }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-center" style={{ gap: SP.sm, paddingTop: SP.md }} aria-label="Pagination">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="press flex items-center justify-center rounded-full"
        style={{ width: HIT, height: HIT, opacity: page === 1 ? 0.3 : 1 }} aria-label="Previous page">
        <ChevronIcon className="w-5 h-5" />
      </button>
      <span style={{ ...num(TY.footnote), color: label2, minWidth: 48, textAlign: "center" }}>{page} / {pages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === pages} className="press flex items-center justify-center rounded-full rotate-180"
        style={{ width: HIT, height: HIT, opacity: page === pages ? 0.3 : 1 }} aria-label="Next page">
        <ChevronIcon className="w-5 h-5" />
      </button>
    </nav>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [streakLastReset, setStreakLastReset] = useState(todayStr());
  const [streakResets, setStreakResets] = useState([]);
  const [readingDates, setReadingDates] = useState([]);
  const [workoutPlan, setWorkoutPlan] = useState([]);
  const [workoutLog, setWorkoutLog] = useState([]);
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
  const [chartLift, setChartLift] = useState(null);

  useEffect(() => {
    if (!document.getElementById("poppins-font")) {
      const link = document.createElement("link");
      link.id = "poppins-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap";
      document.head.appendChild(link);
    }
    if (!document.getElementById("hig-base")) {
      const st = document.createElement("style");
      st.id = "hig-base";
      st.textContent = `
        :root { --ease: cubic-bezier(.32,.72,0,1); }
        * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        .press { transition: transform .2s var(--ease), opacity .2s var(--ease), background-color .2s var(--ease); touch-action: manipulation; }
        .press:active:not(:disabled) { transform: scale(.96); }
        .lift { transition: transform .28s var(--ease), background-color .28s var(--ease); }
        :focus { outline: none; }
        :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 6px; }
        input::placeholder, textarea::placeholder { color: var(--label3); }
        @media (prefers-reduced-motion: reduce) {
          .press, .lift, .bar { transition: none !important; }
          .press:active { transform: none; }
        }
      `;
      document.head.appendChild(st);
    }
  }, []);

  useEffect(() => {
    const i = setInterval(() => {
      const d = todayStr();
      setToday((prev) => (prev === d ? prev : d));
    }, 30000);
    return () => clearInterval(i);
  }, []);

  const applyRecord = useCallback((data) => {
    setDarkMode(data.darkMode ?? true);
    setTransactions(data.transactions ?? []);
    setStreakLastReset(data.streakLastReset ?? todayStr());
    setStreakResets(data.streakResets ?? (data.streakLastReset ? [data.streakLastReset] : []));
    setReadingDates(data.readingDates ?? []);
    setWorkoutPlan(data.workoutPlan ?? []);
    setWorkoutLog(data.workoutLog ?? []);
    setWeekHighlight(data.weekHighlight ?? "");
  }, []);

  useEffect(() => {
    axios.get(BIN_URL, { headers: HEADERS })
      .then(res => {
        applyRecord(res.data.record);
        lastSavedRef.current = JSON.stringify(res.data.record);
        setSynced(true);
      })
      .catch(() => { setStreakLastReset(todayStr()); setSynced(true); })
      .finally(() => setLoading(false));
  }, [applyRecord]);

  const saveToCloud = useCallback(() => {
    if (!synced || isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (typingRef.current) return;
    const data = { darkMode, transactions, streakLastReset, streakResets, readingDates, workoutPlan, workoutLog, weekHighlight };
    const newData = JSON.stringify(data);
    if (newData === lastSavedRef.current) return;
    lastSavedRef.current = newData;
    axios.put(BIN_URL, data, { headers: HEADERS }).catch(() => {});
  }, [darkMode, transactions, streakLastReset, streakResets, readingDates, workoutPlan, workoutLog, weekHighlight, synced]);

  useEffect(() => {
    const t = setTimeout(saveToCloud, 1000);
    return () => clearTimeout(t);
  }, [saveToCloud]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typingRef.current || remoteUpdateRef.current) return;
      axios.get(BIN_URL, { headers: HEADERS })
        .then(res => {
          const newData = JSON.stringify(res.data.record);
          if (newData === lastSavedRef.current) return;
          remoteUpdateRef.current = true;
          lastSavedRef.current = newData;
          applyRecord(res.data.record);
          setTimeout(() => { remoteUpdateRef.current = false; }, 1000);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [applyRecord]);

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
    const daysLeft = Math.max(diffDays(today, cycle.end) + 1, 1);
    const allowance = savings > 0 ? Math.floor(savings / daysLeft / ROUND_TO) * ROUND_TO : 0;
    return { spentCycle, daysLeft, allowance, inCycle };
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

  // ---- workout history ----
  const loggedLifts = useMemo(() => {
    const seen = new Map();
    [...workoutLog].sort((a, b) => (a.date < b.date ? 1 : -1)).forEach(e => {
      if (e.name && !seen.has(e.name)) seen.set(e.name, e.tool);
    });
    return [...seen.entries()].map(([name, tool]) => ({ name, tool }));
  }, [workoutLog]);

  const activeLift = chartLift && loggedLifts.some(l => l.name === chartLift) ? chartLift : loggedLifts[0]?.name || null;

  const chartPoints = useMemo(() => {
    if (!activeLift) return [];
    const byDay = {};
    workoutLog.filter(e => e.name === activeLift).forEach(e => {
      const w = Number(e.weight) || 0;
      if (!byDay[e.date] || w > byDay[e.date].value) byDay[e.date] = { day: e.date, value: w, reps: Number(e.reps) || 0 };
    });
    return Object.values(byDay).sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-20);
  }, [workoutLog, activeLift]);

  const chartDelta = chartPoints.length > 1 ? chartPoints[chartPoints.length - 1].value - chartPoints[0].value : 0;

  // ---- handlers ----
  const addTransaction = (e) => {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setTransactions(prev => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount: n, type: txType, category, note: note.trim(),
      date: new Date(`${today}T12:00:00`).toISOString(),
    }, ...prev]);
    setAmount(""); setNote(""); setTxPage(1);
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

  const logExercise = (ex) => {
    const name = (ex.name || "").trim();
    if (!name) return;
    setWorkoutLog(prev => [
      ...prev.filter(e => !(e.date === today && e.name === name)),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, date: today, name, tool: ex.tool || "BB", weight: Number(ex.weight) || 0, reps: Number(ex.reps) || 0 },
    ]);
    setChartLift(name);
  };
  const loggedToday = (ex) => workoutLog.some(e => e.date === today && e.name === (ex.name || "").trim());

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

  // ---------- semantic colors ----------
  const c = darkMode
    ? {
        bg: "#000000", surface: "rgba(28,28,30,0.72)", surfaceSolid: "#1C1C1E",
        fill: "rgba(120,120,128,0.24)", fillQuiet: "rgba(120,120,128,0.16)",
        separator: "rgba(84,84,88,0.60)",
        label: "#FFFFFF", label2: "rgba(235,235,245,0.62)", label3: "rgba(235,235,245,0.32)",
        accent: BRAND_TINT, danger: RED_DARK, positive: "#30D158",
      }
    : {
        bg: "#F2F2F7", surface: "rgba(255,255,255,0.80)", surfaceSolid: "#FFFFFF",
        fill: "rgba(120,120,128,0.14)", fillQuiet: "rgba(120,120,128,0.08)",
        separator: "rgba(60,60,67,0.24)",
        label: "#1C1C1E", label2: "rgba(60,60,67,0.62)", label3: "rgba(60,60,67,0.34)",
        accent: BRAND, danger: RED_LIGHT, positive: GREEN,
      };

  const glass = {
    background: c.surface, border: `0.5px solid ${c.separator}`,
    backdropFilter: "saturate(180%) blur(24px)", WebkitBackdropFilter: "saturate(180%) blur(24px)",
    borderRadius: R.xl,
  };
  const inset = { background: c.fillQuiet, borderRadius: R.lg };
  const field = {
    background: c.fill, border: `0.5px solid ${c.separator}`, color: c.label,
    borderRadius: R.md, padding: `${SP.sm + 2}px ${SP.md - 4}px`, minHeight: HIT, width: "100%",
    ...TY.callout,
  };
  const brandFill = { backgroundImage: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_2} 100%)`, color: "#FFFFFF" };
  const chip = (on) => ({
    ...(on ? brandFill : { background: c.fill, color: c.label2 }),
    borderRadius: R.pill, minHeight: 32, padding: `0 ${SP.md - 4}px`,
    ...TY.footnote, fontWeight: 500,
  });
  const cssVars = { "--focus": c.accent, "--label3": c.label3 };

  if (loading) {
    return (
      <div style={{ background: c.bg, color: c.label2, fontFamily: FONT, minHeight: "100vh", ...TY.subhead }} className="flex items-center justify-center">
        Loading
      </div>
    );
  }

  const StreakRow = ({ Icon, tint, days, action, longest }) => (
    <div className="flex items-center" style={{ minHeight: HIT + SP.sm }}>
      <div className="flex justify-center" style={{ width: "30%", color: tint }} aria-hidden="true">
        <Icon style={{ width: 36, height: 36 }} />
      </div>
      <div className="text-center" style={{ width: "30%" }}>
        <span style={num(TY.title2)}>{days}</span>
        <span style={{ ...TY.caption2, color: c.label2, display: "block", marginTop: 2 }}>days</span>
      </div>
      <div className="flex justify-center" style={{ width: "30%" }}>{action}</div>
      <div className="text-right" style={{ width: "10%" }}>
        <span style={{ ...num(TY.subhead), color: c.label2 }} title="Longest streak">{longest}</span>
      </div>
    </div>
  );

  return (
    <div style={{ background: c.bg, color: c.label, fontFamily: FONT, minHeight: "100vh", ...cssVars }}>
      <div className="mx-auto" style={{ maxWidth: 1360, padding: `${SP.xl}px ${SP.lg}px` }}>

        <header className="flex items-center justify-between" style={{ marginBottom: SP.lg }}>
          <div>
            <h1 style={TY.title1}>Hello, Merdy</h1>
            <p style={{ ...TY.footnote, color: c.label2, marginTop: SP.xs }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <button onClick={() => setDarkMode(d => !d)} className="press flex items-center justify-center"
            style={{ ...glass, borderRadius: R.pill, width: HIT, height: HIT, color: c.label }}
            aria-label={darkMode ? "Switch to light appearance" : "Switch to dark appearance"}>
            {darkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4" style={{ gap: SP.md }}>

          {/* ---------------- left ---------------- */}
          <div className="lg:col-span-3 flex flex-col" style={{ gap: SP.md }}>

            <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: SP.md }}>
              <section className="sm:col-span-2" style={{ ...glass, padding: SP.lg, backgroundImage: `radial-gradient(120% 120% at 100% 0%, ${BRAND}1A 0%, transparent 58%)` }}>
                <h2 style={{ ...TY.footnote, color: c.label2 }}>Total savings</h2>
                <p style={{ ...num(TY.largeTitle), fontSize: 44, lineHeight: "52px", letterSpacing: "-1px", marginTop: SP.sm }}>{won(savings)}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: SP.sm, marginTop: SP.lg }}>
                  <div style={{ ...brandFill, borderRadius: R.lg, padding: SP.md }}>
                    <p style={{ ...TY.caption1, opacity: 0.85 }}>You can spend today</p>
                    <p style={{ ...num(TY.title2), marginTop: SP.xs }}>{won(budget.allowance)}</p>
                  </div>
                  <div className="flex items-center" style={{ ...inset, padding: SP.md, gap: SP.md }}>
                    <span className="flex items-center justify-center shrink-0"
                      style={{ width: 40, height: 40, borderRadius: R.pill, background: `${BRAND}24`, color: c.accent }} aria-hidden="true">
                      <CalendarIcon className="w-5 h-5" />
                    </span>
                    <div>
                      <p style={num(TY.title3)}>{budget.daysLeft}<span style={{ ...TY.footnote, color: c.label2, marginLeft: SP.xs }}>days</span></p>
                      <p style={{ ...TY.caption1, color: c.label2, marginTop: 2 }}>until reset</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="flex flex-col justify-center" style={{ ...glass, padding: SP.md, gap: SP.md }}>
                <StreakRow Icon={FlameIcon} tint={c.accent} days={streakDays} longest={streakLongest}
                  action={
                    <button onClick={resetStreak} disabled={streakResetDisabled} className="press"
                      style={{ ...chip(false), color: streakResetDisabled ? c.label3 : c.danger, minHeight: 36 }}>Reset</button>
                  } />
                <div style={{ borderTop: `0.5px solid ${c.separator}` }} />
                <StreakRow Icon={BookIcon} tint={TEAL} days={readingStreak} longest={readingLongest}
                  action={
                    <button onClick={markReadToday} disabled={readingDoneToday} className="press"
                      style={readingDoneToday ? { ...chip(false), color: c.label3, minHeight: 36 } : { ...chip(true), minHeight: 36 }}>
                      {readingDoneToday ? "Done" : "Read"}
                    </button>
                  } />
              </section>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: SP.md }}>
              <section style={{ ...glass, padding: SP.lg }}>
                <h2 style={TY.subhead}>Breakdown</h2>
                {spendTotal === 0 ? (
                  <p style={{ ...TY.footnote, color: c.label2, textAlign: "center", padding: `${SP.xl}px 0` }}>Nothing yet</p>
                ) : (
                  <>
                    <div style={{ marginTop: SP.md }}>
                      <Donut data={spendData} total={spendTotal} track={c.fillQuiet} ink={c.label} centerValue={wonShort(spendTotal)} centerLabel="spent" />
                    </div>
                    <ul className="flex flex-col" style={{ gap: SP.sm, marginTop: SP.lg }}>
                      {spendData.map(d => (
                        <li key={d.key} className="flex items-center" style={{ gap: SP.sm }}>
                          <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: R.pill, background: d.color }} />
                          <span className="flex-1 truncate" style={TY.footnote}>{d.label}</span>
                          <span style={{ ...num(TY.caption1), color: c.label2 }}>{Math.round((d.value / spendTotal) * 100)}%</span>
                          <span style={{ ...num(TY.footnote), width: 88, textAlign: "right" }}>{won(d.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <section className="sm:col-span-2 flex flex-col" style={{ ...glass, padding: SP.lg }}>
                <div className="flex items-start justify-between flex-wrap" style={{ gap: SP.md }}>
                  <div>
                    <h2 style={TY.subhead}>Daily spend</h2>
                    <p style={{ ...num(TY.title2), marginTop: SP.xs }}>{won(budget.spentCycle)}</p>
                  </div>
                  <div className="flex" style={{ gap: SP.sm }}>
                    {[["cycle", "Cycle"], ["last", "Last"], ["all", "All"]].map(([k, label]) => (
                      <button key={k} onClick={() => setSpendPeriod(k)} className="press" style={chip(spendPeriod === k)} aria-pressed={spendPeriod === k}>{label}</button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex items-end" style={{ gap: SP.xs, height: 176, marginTop: SP.xl }}>
                  {dailyBars.map(b => (
                    <div key={b.day} className="flex-1 h-full flex flex-col justify-end items-center relative">
                      {b.isToday && b.value > 0 && (
                        <span style={{ ...brandFill, ...num(TY.caption2), fontWeight: 600, padding: `2px ${SP.sm - 2}px`, borderRadius: R.sm, position: "absolute", bottom: "100%", marginBottom: SP.sm, whiteSpace: "nowrap", zIndex: 10 }}>
                          {wonShort(b.value)}
                        </span>
                      )}
                      <div className="bar w-full" title={`${shortDate(b.day)} ${won(b.value)}`}
                        style={{
                          height: `${Math.max((b.value / maxBar) * 100, b.value > 0 ? 4 : 2)}%`,
                          borderRadius: 6,
                          ...(b.isToday ? brandFill : { background: b.future ? c.fillQuiet : c.fill }),
                          transition: "height .5s var(--ease)",
                        }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between" style={{ ...TY.caption1, color: c.label2, marginTop: SP.md }}>
                  <span>{shortDate(cycle.start)}</span>
                  <span>{shortDate(cycle.end)}</span>
                </div>
              </section>
            </div>

            {/* ---------- workout ---------- */}
            <section style={{ ...glass, padding: SP.lg }}>
              <div className="flex items-start justify-between flex-wrap" style={{ gap: SP.md, marginBottom: SP.md }}>
                <div>
                  <h2 className="flex items-center" style={{ ...TY.subhead, gap: SP.sm }}><BarbellIcon className="w-5 h-5" /> Workout</h2>
                  {activeLift && chartPoints.length > 0 && (
                    <p style={{ ...num(TY.title2), marginTop: SP.xs }}>
                      {chartPoints[chartPoints.length - 1].value}<span style={{ ...TY.footnote, color: c.label2, marginLeft: SP.xs }}>kg</span>
                      {chartDelta !== 0 && (
                        <span style={{ ...num(TY.footnote), color: chartDelta > 0 ? c.positive : c.label2, marginLeft: SP.sm }}>
                          {chartDelta > 0 ? "+" : ""}{chartDelta} kg
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center" style={{ gap: SP.sm }}>
                  <button onClick={() => setFilter("ALL")} className="press" style={chip(filter === "ALL")} aria-pressed={filter === "ALL"}>All</button>
                  {TOOLS.map(tool => {
                    const Icon = TOOL_ICONS[tool.key];
                    return (
                      <button key={tool.key} onClick={() => setFilter(tool.key)} className="press flex items-center justify-center"
                        style={{ ...chip(filter === tool.key), width: 36, height: 36, padding: 0 }}
                        aria-pressed={filter === tool.key} aria-label={tool.label} title={tool.label}>
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                  <button onClick={addExercise} className="press flex items-center justify-center"
                    style={{ ...brandFill, borderRadius: R.pill, width: 36, height: 36 }} aria-label="Add exercise">
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* progress chart */}
              {loggedLifts.length === 0 ? (
                <div style={{ ...inset, padding: SP.lg, textAlign: "center" }}>
                  <p style={{ ...TY.footnote, color: c.label2 }}>No history yet. Hit Log on a lift to start the chart.</p>
                </div>
              ) : (
                <div style={{ ...inset, padding: SP.md }}>
                  <div className="flex flex-wrap" style={{ gap: SP.sm, marginBottom: SP.sm }}>
                    {loggedLifts.slice(0, 6).map(l => (
                      <button key={l.name} onClick={() => setChartLift(l.name)} className="press"
                        style={chip(l.name === activeLift)} aria-pressed={l.name === activeLift}>{l.name}</button>
                    ))}
                  </div>
                  <ProgressChart points={chartPoints} color={BRAND_TINT} grid={c.separator} label2={c.label2} />
                  <div className="flex justify-between" style={{ ...TY.caption1, color: c.label2, marginTop: SP.sm }}>
                    <span>{chartPoints.length ? shortDate(chartPoints[0].day) : ""}</span>
                    <span>{chartPoints.length ? shortDate(chartPoints[chartPoints.length - 1].day) : ""}</span>
                  </div>
                </div>
              )}

              {/* exercise list */}
              <div className="flex" style={{ gap: SP.md, margin: `${SP.md}px 0 ${SP.sm}px` }}>
                {[["name", "Name"], ["weight", "Weight"], ["reps", "Reps"]].map(([k, label]) => (
                  <button key={k} onClick={() => toggleSort(k)} className="press"
                    style={{ ...TY.caption1, color: sortKey === k ? c.label : c.label2, minHeight: 32 }}>
                    {label}{sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                ))}
              </div>

              {sortedWorkouts.length === 0 ? (
                <p style={{ ...TY.footnote, color: c.label2, textAlign: "center", padding: `${SP.lg}px 0` }}>No lifts here yet</p>
              ) : (
                <>
                  <ul className="flex flex-col" style={{ gap: SP.sm }}>
                    {wkSlice.map(ex => {
                      const Icon = TOOL_ICONS[ex.tool] || DumbbellIcon;
                      const done = loggedToday(ex);
                      return (
                        <li key={ex.id} className="lift flex items-center flex-wrap" style={{ ...inset, padding: SP.sm + 2, gap: SP.sm }}>
                          <button
                            onClick={() => {
                              const i = TOOLS.findIndex(x => x.key === (ex.tool || "BB"));
                              updateExercise(ex.id, "tool", TOOLS[(i + 1) % TOOLS.length].key);
                            }}
                            className="press flex items-center justify-center shrink-0"
                            style={{ width: 36, height: 36, borderRadius: R.pill, background: `${BRAND}24`, color: c.accent }}
                            aria-label={`Tool: ${ex.tool || "BB"}. Tap to change`}>
                            <Icon className="w-[18px] h-[18px]" />
                          </button>
                          <input type="text" placeholder="Exercise name" value={ex.name || ""} onChange={(e) => updateExercise(ex.id, "name", e.target.value)}
                            style={{ ...TY.callout, color: c.label, background: "transparent", border: "none", flex: "1 1 140px", minWidth: 0, minHeight: 36 }}
                            aria-label="Exercise name" />
                          <div className="flex items-center" style={{ gap: SP.sm }}>
                            <input type="number" inputMode="numeric" min="0" placeholder="0" value={ex.weight || ""} onChange={(e) => updateExercise(ex.id, "weight", e.target.value)}
                              style={{ ...field, ...num(TY.footnote), width: 68, minHeight: 36, padding: `${SP.xs}px ${SP.sm}px`, borderRadius: R.sm, background: c.surfaceSolid }}
                              aria-label="Weight in kilograms" />
                            <span style={{ ...TY.caption1, color: c.label2 }}>kg</span>
                            <input type="number" inputMode="numeric" min="0" value={ex.reps || ""} onChange={(e) => updateExercise(ex.id, "reps", e.target.value)}
                              style={{ ...field, ...num(TY.footnote), width: 60, minHeight: 36, padding: `${SP.xs}px ${SP.sm}px`, borderRadius: R.sm, background: c.surfaceSolid }}
                              aria-label="Repetitions" />
                            <span style={{ ...TY.caption1, color: c.label2 }}>reps</span>
                          </div>
                          <button onClick={() => logExercise(ex)} disabled={!ex.name} className="press"
                            style={done ? { ...chip(false), color: c.positive, minHeight: 36 } : { ...chip(true), minHeight: 36, opacity: ex.name ? 1 : 0.4 }}
                            aria-label={`Log ${ex.name || "exercise"} for today`}>
                            {done ? "Logged" : "Log"}
                          </button>
                          <button onClick={() => deleteExercise(ex.id)} className="press flex items-center justify-center shrink-0"
                            style={{ width: 36, height: 36, borderRadius: R.pill, color: c.label3 }} aria-label="Remove exercise">
                            <XIcon className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <Pager page={wkCur} pages={wkPages} onChange={setWkPage} label2={c.label2} />
                </>
              )}
            </section>
          </div>

          {/* ---------------- right ---------------- */}
          <div className="lg:col-span-1 flex flex-col" style={{ gap: SP.md }}>

            <section style={{ ...glass, padding: SP.lg, backgroundImage: `radial-gradient(120% 120% at 0% 0%, ${BRAND}14 0%, transparent 60%)` }}>
              <div className="flex items-center justify-between" style={{ marginBottom: SP.md, gap: SP.sm }}>
                <h2 style={TY.subhead}>Week Highlight</h2>
                {editingHighlight ? (
                  <button onClick={saveHighlight} className="press flex items-center" style={{ ...chip(true), gap: SP.xs }}>
                    <CheckIcon className="w-4 h-4" /> Save
                  </button>
                ) : (
                  <button onClick={startEditHighlight} className="press flex items-center" style={{ ...chip(false), gap: SP.xs }}>
                    <PenIcon className="w-4 h-4" /> Edit
                  </button>
                )}
              </div>

              {editingHighlight ? (
                <>
                  <textarea value={highlightDraft} maxLength={HIGHLIGHT_MAX}
                    onChange={(e) => setHighlightDraft(e.target.value)}
                    onFocus={() => { typingRef.current = true; }} onBlur={() => { typingRef.current = false; }}
                    rows={5} placeholder="What matters this week"
                    style={{ ...field, ...TY.caption2, lineHeight: "18px", resize: "none", padding: SP.md }} />
                  <div className="flex items-center justify-between" style={{ marginTop: SP.sm }}>
                    <button onClick={clearHighlight} className="press" style={{ ...TY.footnote, color: c.danger, minHeight: 32 }}>Delete</button>
                    <span style={{ ...num(TY.caption2), color: c.label3 }}>{highlightDraft.length}/{HIGHLIGHT_MAX}</span>
                  </div>
                </>
              ) : weekHighlight ? (
                <p style={{ ...TY.caption2, lineHeight: "18px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{weekHighlight}</p>
              ) : (
                <p style={{ ...TY.caption2, lineHeight: "18px", color: c.label3 }}>Nothing pinned. Tap edit to write one.</p>
              )}
            </section>

            <section style={{ ...glass, padding: SP.lg }}>
              <h2 style={{ ...TY.subhead, marginBottom: SP.md }}>Add entry</h2>
              <form onSubmit={addTransaction} className="flex flex-col" style={{ gap: SP.sm }}>
                <input type="number" inputMode="numeric" step="1" min="0" placeholder="Amount" value={amount}
                  onChange={(e) => setAmount(e.target.value)} style={field} aria-label="Amount" required />
                <div className="grid grid-cols-2" style={{ gap: SP.sm }}>
                  <select value={txType} onChange={(e) => setTxType(e.target.value)} style={field} aria-label="Type">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} style={field} aria-label="Category">
                    {CATEGORIES.map(k => <option key={k} value={k}>{CAT_LABELS[k]}</option>)}
                  </select>
                </div>
                <input type="text" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} style={field} aria-label="Note" />
                <button type="submit" className="press flex items-center justify-center"
                  style={{ ...brandFill, ...TY.headline, borderRadius: R.md, minHeight: HIT, gap: SP.sm, marginTop: SP.xs }}>
                  <PlusIcon className="w-5 h-5" /> Add
                </button>
              </form>
            </section>

            {/* money tracker */}
            <section style={{ ...glass, padding: SP.lg }}>
              <div className="flex items-center justify-between" style={{ marginBottom: SP.sm }}>
                <h2 style={TY.subhead}>Money tracker</h2>
                <span style={{ ...num(TY.footnote), color: c.label2 }}>{transactions.length}</span>
              </div>
              {transactions.length === 0 ? (
                <p style={{ ...TY.footnote, color: c.label2, textAlign: "center", padding: `${SP.lg}px 0` }}>Add your first entry above</p>
              ) : (
                <>
                  <ul>
                    {txSlice.map((tx, i) => {
                      const color = CAT_COLORS[tx.category] || c.label2;
                      const Icon = CAT_ICONS[tx.category] || DotIcon;
                      return (
                        <li key={tx.id} className="flex items-center" style={{
                          gap: SP.sm, minHeight: 56,
                          borderTop: i === 0 ? "none" : `0.5px solid ${c.separator}`,
                        }}>
                          <span className="flex items-center justify-center shrink-0"
                            style={{ width: 36, height: 36, borderRadius: R.pill, background: `${color}24`, color }} aria-hidden="true">
                            <Icon className="w-[18px] h-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate" style={TY.footnote}>{tx.note || CAT_LABELS[tx.category] || (tx.type === "income" ? "Income" : "Expense")}</p>
                            <p style={{ ...TY.caption2, color: c.label2 }}>{shortDate(tx.day)}</p>
                          </div>
                          <span className="shrink-0" style={{ ...num(TY.footnote), fontWeight: 500, textAlign: "right", color: tx.type === "income" ? c.positive : c.label }}>
                            {tx.type === "income" ? "+" : "-"}{won(tx.amt)}
                          </span>
                          <button onClick={() => deleteTransaction(tx.id)} className="press flex items-center justify-center shrink-0"
                            style={{ width: 36, height: 36, borderRadius: R.pill, color: c.label3 }}
                            aria-label={`Delete ${tx.note || "entry"}`}>
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <Pager page={txCur} pages={txPages} onChange={setTxPage} label2={c.label2} />
                </>
              )}
            </section>
          </div>
        </div>

        <p style={{ ...TY.caption1, color: c.label3, textAlign: "center", marginTop: SP.xl }}>Synced by MERDY</p>
      </div>
    </div>
  );
}