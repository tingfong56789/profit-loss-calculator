import { useState, useEffect } from "react";

function fmt(n) {
  if (Math.abs(n) >= 100000000) return "NT$" + (n / 100000000).toFixed(2) + "億";
  if (Math.abs(n) >= 10000) return "NT$" + (n / 10000).toFixed(1) + "萬";
  return "NT$" + Math.round(n).toLocaleString("en-US");
}
function fmtFull(n) { return "NT$" + Math.round(n).toLocaleString("en-US"); }

function Dot({ on, onClick }) {
  if (onClick === undefined) return null;
  return (
    <span onClick={onClick} title={on ? "點擊停用（計算時以中性值代入）" : "點擊啟用"}
      style={{ cursor: "pointer", color: on ? "#34d399" : "#94a3b8", fontSize: 11, userSelect: "none" }}>
      {on ? "●" : "○"}
    </span>
  );
}

function NumInput({ label, value, onChange, prefix, suffix, width = 100, small, tip, on, onToggle }) {
  const off = on === false;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, opacity: off ? 0.45 : 1 }}>
      <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 5 }}>
        <Dot on={!off} onClick={onToggle} />
        <span onClick={onToggle}
          style={{ textDecoration: off ? "line-through" : "none", cursor: onToggle ? "pointer" : "default" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {prefix && <span style={{ fontSize: 12, color: "#64748b" }}>{prefix}</span>}
        <input type="text" value={value} onChange={e => onChange(e.target.value)} disabled={off}
          style={{
            background: "#f1f5f9", border: "1px solid #cbd5e1",
            borderRadius: 8, padding: small ? "6px 8px" : "8px 10px",
            fontSize: small ? 16 : 20, fontWeight: 700, color: "#1a202c",
            width, outline: "none", transition: "border-color 0.2s",
          }}
          onFocus={e => e.target.style.borderColor = "#f59e0b"}
          onBlur={e => e.target.style.borderColor = "#cbd5e1"} />
        {suffix && <span style={{ fontSize: 12, color: "#64748b" }}>{suffix}</span>}
      </div>
      {tip && <div style={{ fontSize: 10, color: "#94a3b8" }}>{tip}</div>}
    </div>
  );
}

function Chip({ label, active, onClick, color = "#f59e0b" }) {
  return (
    <button onClick={onClick} style={{
      background: active ? color : "#f1f5f9",
      color: active ? "#1a202c" : "#64748b",
      border: "none", borderRadius: 8, padding: "5px 11px",
      fontSize: 11, cursor: "pointer", transition: "all 0.2s", fontWeight: 600,
    }}>{label}</button>
  );
}

const card = {
  background: "#ffffff", border: "1px solid #e2e8f0",
  borderRadius: 14, padding: "18px 18px 14px",
  boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
};

export default function AIPricingCalc() {
  // API costs
  const [costWhisper, setCostWhisper] = useState("0.3");
  const [costLLM, setCostLLM] = useState("1.5");
  const [costTTS, setCostTTS] = useState("0.4");
  const [costDenoise, setCostDenoise] = useState("0.1");

  // Packs
  const [packs, setPacks] = useState([
    { name: "輕量包", turns: 200, price: 199 },
    { name: "標準包", turns: 600, price: 499 },
    { name: "專業包", turns: 1500, price: 999 },
  ]);
  const [packMix, setPackMix] = useState([30, 50, 20]);
  const [avgTurnsUsed, setAvgTurnsUsed] = useState("70");

  // Business
  const [baseCost, setBaseCost] = useState("400000");
  const [initUsers, setInitUsers] = useState("50");
  const [qGrowth, setQGrowth] = useState([85, 40, 20, 10]);

  // NEW: Churn
  const [churnRate, setChurnRate] = useState(8);

  // NEW: Server scaling
  const [usersPerServer, setUsersPerServer] = useState("100");
  const [serverCost, setServerCost] = useState("50000");

  // NEW: Repurchase
  const [repurchaseRate, setRepurchaseRate] = useState(60);
  const [repurchaseCycle, setRepurchaseCycle] = useState("1.5"); // months between purchases

  // NEW: single monthly growth rate (overrides quarterly when enabled)
  const [monthlyGrowth, setMonthlyGrowth] = useState(15);

  // NEW: pricing model tab
  const [activeTab, setActiveTab] = useState("pack");

  // Credit-mode state
  const [creditPacks, setCreditPacks] = useState([
    { name: "入門包", credits: 1000, price: 499 },
    { name: "標準包", credits: 3000, price: 1299 },
    { name: "專業包", credits: 7000, price: 2799 },
  ]);
  const [creditPackMix, setCreditPackMix] = useState([30, 50, 20]);
  const [creditsPerTurn, setCreditsPerTurn] = useState("10");
  const [creditsPerMonthPerUser, setCreditsPerMonthPerUser] = useState("500");
  const [consumptionRate, setConsumptionRate] = useState("100");

  // Per-variable enable/disable (disabled → neutral value substituted in calc)
  const [enabled, setEnabled] = useState({
    costDenoise: true, costWhisper: true, costLLM: true, costTTS: true,
    avgTurnsUsed: true, baseCost: true, initUsers: true,
    churnRate: true, gpu: true, repurchase: true,
    monthlyGrowth: false,
    q0: true, q1: true, q2: true, q3: true,
    pack0: true, pack1: true, pack2: true,
    creditPack0: true, creditPack1: true, creditPack2: true,
    creditsPerTurn: true, creditsPerMonthPerUser: true, consumptionRate: true,
  });

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggle = (key) => setEnabled(s => ({ ...s, [key]: !s[key] }));

  const apiCostPerTurn =
    (enabled.costWhisper ? (parseFloat(costWhisper) || 0) : 0) +
    (enabled.costLLM ? (parseFloat(costLLM) || 0) : 0) +
    (enabled.costTTS ? (parseFloat(costTTS) || 0) : 0) +
    (enabled.costDenoise ? (parseFloat(costDenoise) || 0) : 0);

  const fixedBase = enabled.baseCost ? (parseInt(String(baseCost).replace(/,/g, ""), 10) || 0) : 0;
  const startUsers = enabled.initUsers ? (parseInt(initUsers, 10) || 0) : 0;
  const turnsUsedPct = enabled.avgTurnsUsed ? ((parseFloat(avgTurnsUsed) || 70) / 100) : 1;
  const uPerServer = parseInt(usersPerServer, 10) || 100;
  const sCost = enabled.gpu ? (parseInt(String(serverCost).replace(/,/g, ""), 10) || 0) : 0;
  const rCycle = parseFloat(repurchaseCycle) || 1;

  const data = (() => {
    const qRates = enabled.monthlyGrowth
      ? [0, 1, 2, 3].map(() => monthlyGrowth / 100)
      : qGrowth.map((g, i) => enabled[`q${i}`] ? g / 100 : 0);
    const churn = enabled.churnRate ? churnRate / 100 : 0;
    const repRate = enabled.repurchase ? repurchaseRate / 100 : 0;

    const effMix = packMix.map((m, i) => enabled[`pack${i}`] ? (m || 0) : 0);
    const totalMixPct = effMix.reduce((a, b) => a + b, 0) || 100;
    let avgRevenuePerPurchase = 0;
    let avgApiCostPerPurchase = 0;
    packs.forEach((pack, i) => {
      const pct = effMix[i] / totalMixPct;
      avgRevenuePerPurchase += pack.price * pct;
      avgApiCostPerPurchase += pack.turns * turnsUsedPct * apiCostPerTurn * pct;
    });

    // Credit-mode pricing
    const cpt = enabled.creditsPerTurn ? (parseFloat(creditsPerTurn) || 1) : 1;
    const cpu = enabled.creditsPerMonthPerUser ? (parseFloat(creditsPerMonthPerUser) || 0) : 0;
    const consRate = enabled.consumptionRate ? ((parseFloat(consumptionRate) || 100) / 100) : 1;
    const effCreditMix = creditPackMix.map((m, i) => enabled[`creditPack${i}`] ? (m || 0) : 0);
    const totalCreditMixPct = effCreditMix.reduce((a, b) => a + b, 0) || 100;
    let weightedCredits = 0, weightedPrice = 0;
    creditPacks.forEach((p, i) => {
      const pct = effCreditMix[i] / totalCreditMixPct;
      weightedCredits += p.credits * pct;
      weightedPrice += p.price * pct;
    });
    const avgPricePerCredit = weightedCredits > 0 ? weightedPrice / weightedCredits : 0;
    const apiCostPerCredit = cpt > 0 ? apiCostPerTurn / cpt : 0;
    const avgCreditsPerPack = weightedCredits;
    const monthRevenuePerUser = cpu * avgPricePerCredit;
    const monthApiCostPerUser = cpu * consRate * apiCostPerCredit;
    const creditMarginPerUser = monthRevenuePerUser - monthApiCostPerUser;

    let cumRevenue = 0;
    let cumCost = 0;
    let breakEvenMonth = null;
    let activeUsers = startUsers;

    // Store monthly new user counts for repurchase calculation
    const newUsersByMonth = [];

    const monthsData = [];

    for (let i = 0; i < 12; i++) {
      const qi = Math.floor(i / 3);
      const rate = qRates[qi] || 0;

      let newUsersThisMonth;
      if (i === 0) {
        newUsersThisMonth = startUsers;
      } else {
        const retained = Math.round(activeUsers * (1 - churn));
        const grown = Math.max(0, Math.round(retained * rate));
        activeUsers = retained + grown;
        newUsersThisMonth = grown;
      }

      newUsersByMonth.push(newUsersThisMonth);

      let purchasesThisMonth;
      let monthRevenue;
      let monthApiCost;

      if (activeTab === "credit") {
        monthRevenue = activeUsers * monthRevenuePerUser;
        monthApiCost = activeUsers * monthApiCostPerUser;
        purchasesThisMonth = avgCreditsPerPack > 0
          ? Math.round(activeUsers * cpu / avgCreditsPerPack)
          : 0;
      } else {
        purchasesThisMonth = newUsersThisMonth;
        // Cohort j's k-th repurchase at time j + k*rCycle lands in month i when
        // i <= j + k*rCycle < i+1. Counting events spreads them evenly and
        // correctly handles rCycle<1 (multiple repurchases per month per cohort).
        if (rCycle > 0) {
          for (let j = 0; j < i; j++) {
            const lower = (i - j) / rCycle;
            const upper = (i - j + 1) / rCycle;
            const kMin = Math.max(1, Math.ceil(lower));
            const kMax = Math.ceil(upper) - 1;
            const events = Math.max(0, kMax - kMin + 1);
            if (events > 0) {
              const surviving = Math.round(newUsersByMonth[j] * Math.pow(1 - churn, i - j));
              purchasesThisMonth += Math.round(surviving * repRate) * events;
            }
          }
        }
        monthRevenue = avgRevenuePerPurchase * purchasesThisMonth;
        monthApiCost = avgApiCostPerPurchase * purchasesThisMonth;
      }

      const serversNeeded = Math.max(1, Math.ceil(activeUsers / uPerServer));
      const serverTotalCost = serversNeeded * sCost;
      const monthFixedCost = fixedBase + serverTotalCost;

      const monthTotalCost = monthFixedCost + monthApiCost;
      const monthProfit = monthRevenue - monthTotalCost;

      cumRevenue += monthRevenue;
      cumCost += monthTotalCost;
      const cumProfit = cumRevenue - cumCost;

      if (breakEvenMonth === null && cumProfit >= 0) breakEvenMonth = i + 1;

      monthsData.push({
        month: i + 1, quarter: qi + 1, growthRate: rate * 100,
        activeUsers, newUsers: newUsersThisMonth, purchases: purchasesThisMonth,
        serversNeeded, serverTotalCost,
        monthRevenue, monthApiCost, monthFixedCost, monthTotalCost, monthProfit,
        cumRevenue, cumCost, cumProfit,
      });
    }

    const grossMarginPerPurchase = avgRevenuePerPurchase - avgApiCostPerPurchase;
    const grossMarginPct = avgRevenuePerPurchase > 0 ? (grossMarginPerPurchase / avgRevenuePerPurchase * 100) : 0;

    const creditMarginPct = monthRevenuePerUser > 0
      ? (creditMarginPerUser / monthRevenuePerUser * 100) : 0;

    // Lower-bound break-even: base cost + one GPU server (variable scaling not modeled).
    const breakEvenUsers = activeTab === "credit"
      ? (creditMarginPerUser > 0 ? Math.ceil((fixedBase + sCost) / creditMarginPerUser) : Infinity)
      : (grossMarginPerPurchase > 0 ? Math.ceil((fixedBase + sCost) / grossMarginPerPurchase) : Infinity);

    return {
      avgRevenuePerPurchase, avgApiCostPerPurchase, grossMarginPerPurchase,
      grossMarginPct, breakEvenUsers, breakEvenMonth, months: monthsData,
      avgPricePerCredit, apiCostPerCredit, creditMarginPerUser, creditMarginPct,
      monthRevenuePerUser, monthApiCostPerUser,
    };
  })();

  const updatePack = (idx, field, val) => {
    const next = [...packs];
    next[idx] = { ...next[idx], [field]: field === "name" ? val : (parseInt(val, 10) || 0) };
    setPacks(next);
  };
  const updateMix = (idx, val) => {
    const next = [...packMix]; next[idx] = parseInt(val, 10) || 0; setPackMix(next);
  };
  const updateCreditPack = (idx, field, val) => {
    const next = [...creditPacks];
    next[idx] = { ...next[idx], [field]: field === "name" ? val : (parseInt(val, 10) || 0) };
    setCreditPacks(next);
  };
  const updateCreditMix = (idx, val) => {
    const next = [...creditPackMix]; next[idx] = parseInt(val, 10) || 0; setCreditPackMix(next);
  };

  const maxChart = Math.max(...data.months.map(m => Math.max(m.cumRevenue, m.cumCost)), 1);

  return (
    <div style={{
      fontFamily: "'Noto Sans TC', 'SF Pro Display', -apple-system, sans-serif",
      background: "linear-gradient(160deg, #f8fafc 0%, #eef2f7 40%, #f8fafc 100%)",
      color: "#1a202c", minHeight: "100vh", padding: isMobile ? "16px 10px" : "28px 16px",
    }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: "inline-block", fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase",
            color: "#f59e0b", background: "rgba(245,158,11,0.1)",
            padding: "4px 12px", borderRadius: 6, marginBottom: 10,
          }}>AI 軍師 · 對話包定價模擬器 v2</div>
          <h1 style={{ fontSize: isMobile ? 19 : 24, fontWeight: 700, margin: "8px 0 0", color: "#1a202c", lineHeight: 1.3 }}>
            完整損益模擬（含流失 · 擴容 · 續購）
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 12, margin: "6px 0 0" }}>
            6 大維度：API成本 → 對話包設計 → 營運成本 → 用戶流失 → 伺服器擴容 → 續購行為
          </p>
        </div>

        {/* ===== Tab Switcher ===== */}
        <div style={{
          display: "flex", gap: 6, marginBottom: 12, padding: 4,
          background: "#ffffff", borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}>
          {[
            { k: "pack", label: "📦 方案計價", color: "#f59e0b" },
            { k: "credit", label: "⭐ 點數計價", color: "#34d399" },
          ].map(t => {
            const on = activeTab === t.k;
            return (
              <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
                flex: 1, padding: "12px 16px", borderRadius: 10, border: "none",
                background: on ? `${t.color}22` : "transparent",
                color: on ? t.color : "#64748b",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: on ? `inset 0 0 0 1px ${t.color}55` : "none",
              }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ===== 1. API Cost ===== */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>⚡</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>① 每輪對話 API 成本</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
            <NumInput label="AI 降噪" value={costDenoise} onChange={setCostDenoise} prefix="NT$" suffix="/輪" width={55} small on={enabled.costDenoise} onToggle={() => toggle("costDenoise")} />
            <NumInput label="Whisper STT" value={costWhisper} onChange={setCostWhisper} prefix="NT$" suffix="/輪" width={55} small on={enabled.costWhisper} onToggle={() => toggle("costWhisper")} />
            <NumInput label="LLM 推理" value={costLLM} onChange={setCostLLM} prefix="NT$" suffix="/輪" width={55} small on={enabled.costLLM} onToggle={() => toggle("costLLM")} />
            <NumInput label="TTS 語音合成" value={costTTS} onChange={setCostTTS} prefix="NT$" suffix="/輪" width={55} small on={enabled.costTTS} onToggle={() => toggle("costTTS")} />
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(245,158,11,0.06)", borderRadius: 10, padding: "8px 14px",
          }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>單輪總成本</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>NT${apiCostPerTurn.toFixed(1)}</span>
          </div>
        </div>

        {/* ===== 2. Pack Design ===== */}
        {activeTab === "pack" && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>📦</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>② 對話包方案設計</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
            {packs.map((pack, i) => {
              const packOn = enabled[`pack${i}`];
              const apiCost = pack.turns * turnsUsedPct * apiCostPerTurn;
              const margin = pack.price - apiCost;
              const marginPct = pack.price > 0 ? (margin / pack.price * 100) : 0;
              return (
                <div key={i} style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #e2e8f0", opacity: packOn ? 1 : 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Dot on={packOn} onClick={() => toggle(`pack${i}`)} />
                    <input value={pack.name} onChange={e => updatePack(i, "name", e.target.value)} disabled={!packOn}
                      style={{ background: "transparent", border: "none", borderBottom: "1px solid #cbd5e1", color: "#1a202c", fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, padding: "2px 0 4px", outline: "none", textDecoration: packOn ? "none" : "line-through" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { l: "對話輪數", f: "turns", v: pack.turns },
                      { l: "售價", f: "price", v: pack.price, pre: "NT$" },
                    ].map(r => (
                      <div key={r.f} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{r.l}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                          {r.pre && <span style={{ fontSize: 10, color: "#64748b" }}>{r.pre}</span>}
                          <input value={r.v} onChange={e => updatePack(i, r.f, e.target.value)}
                            style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "3px 6px", fontSize: 13, fontWeight: 600, color: "#1a202c", width: 65, textAlign: "right", outline: "none" }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>用戶佔比</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <input value={packMix[i]} onChange={e => updateMix(i, e.target.value)}
                          style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "3px 6px", fontSize: 13, fontWeight: 600, color: "#1a202c", width: 35, textAlign: "right", outline: "none" }} />
                        <span style={{ fontSize: 10, color: "#64748b" }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, padding: "6px 0 0", borderTop: "1px solid #e2e8f0", fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: "#64748b" }}>API 成本</span><span style={{ color: "#ef4444" }}>{fmt(apiCost)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>毛利</span>
                      <span style={{ color: margin >= 0 ? "#34d399" : "#ef4444", fontWeight: 600 }}>{fmt(margin)} ({marginPct.toFixed(0)}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <NumInput label="用戶平均使用率（未用完的輪數 = 額外利潤）" value={avgTurnsUsed} onChange={setAvgTurnsUsed} suffix="%" width={50} small on={enabled.avgTurnsUsed} onToggle={() => toggle("avgTurnsUsed")} />
        </div>
        )}

        {/* ===== 2. Credit Pack Design ===== */}
        {activeTab === "credit" && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>⭐</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>② 點數包方案設計</span>
            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
              單點 API 成本 NT${data.apiCostPerCredit.toFixed(3)} · 加權單點售價 NT${data.avgPricePerCredit.toFixed(3)}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
            {creditPacks.map((pack, i) => {
              const packOn = enabled[`creditPack${i}`];
              const unitPrice = pack.credits > 0 ? pack.price / pack.credits : 0;
              const unitApiCost = data.apiCostPerCredit;
              const unitMargin = unitPrice - unitApiCost;
              const marginPct = unitPrice > 0 ? (unitMargin / unitPrice * 100) : 0;
              return (
                <div key={i} style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #e2e8f0", opacity: packOn ? 1 : 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Dot on={packOn} onClick={() => toggle(`creditPack${i}`)} />
                    <input value={pack.name} onChange={e => updateCreditPack(i, "name", e.target.value)} disabled={!packOn}
                      style={{ background: "transparent", border: "none", borderBottom: "1px solid #cbd5e1", color: "#1a202c", fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, padding: "2px 0 4px", outline: "none", textDecoration: packOn ? "none" : "line-through" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { l: "點數", f: "credits", v: pack.credits },
                      { l: "售價", f: "price", v: pack.price, pre: "NT$" },
                    ].map(r => (
                      <div key={r.f} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{r.l}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                          {r.pre && <span style={{ fontSize: 10, color: "#64748b" }}>{r.pre}</span>}
                          <input value={r.v} onChange={e => updateCreditPack(i, r.f, e.target.value)}
                            style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "3px 6px", fontSize: 13, fontWeight: 600, color: "#1a202c", width: 65, textAlign: "right", outline: "none" }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>用戶佔比</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <input value={creditPackMix[i]} onChange={e => updateCreditMix(i, e.target.value)}
                          style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "3px 6px", fontSize: 13, fontWeight: 600, color: "#1a202c", width: 35, textAlign: "right", outline: "none" }} />
                        <span style={{ fontSize: 10, color: "#64748b" }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, padding: "6px 0 0", borderTop: "1px solid #e2e8f0", fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: "#64748b" }}>單點售價</span><span style={{ color: "#1a202c" }}>NT${unitPrice.toFixed(3)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>單點毛利</span>
                      <span style={{ color: unitMargin >= 0 ? "#34d399" : "#ef4444", fontWeight: 600 }}>NT${unitMargin.toFixed(3)} ({marginPct.toFixed(0)}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            💡 點包越大單點越便宜（批量折扣），但因消耗量固定，單用戶月毛利仍取決於加權平均單點售價。
          </div>
        </div>
        )}

        {/* ===== 3. Business Params (cost + users) ===== */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>🎛️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>③ 營運基礎參數</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
            <div>
              <NumInput label="每月基礎固定成本（人事/辦公/雜支，不含 GPU）" value={baseCost} onChange={setBaseCost} prefix="NT$" width={130} small on={enabled.baseCost} onToggle={() => toggle("baseCost")} />
              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                {[{ l: "10萬", v: "100000" }, { l: "20萬", v: "200000" }, { l: "40萬", v: "400000" }].map(c => (
                  <Chip key={c.v} label={c.l} active={baseCost === c.v} onClick={() => setBaseCost(c.v)} />
                ))}
              </div>
            </div>
            <div>
              <NumInput label="初始付費用戶（上線第一個月）" value={initUsers} onChange={setInitUsers} suffix="人" width={80} small on={enabled.initUsers} onToggle={() => toggle("initUsers")} />
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                {[{ l: "17", v: "17" }, { l: "50", v: "50" }, { l: "100", v: "100" }, { l: "500", v: "500" }].map(c => (
                  <Chip key={c.v} label={c.l + "人"} active={initUsers === c.v} onClick={() => setInitUsers(c.v)} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== 4. Churn + Repurchase / Consumption ===== */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>🔄</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>
              ④ {activeTab === "credit" ? "用戶流失與點數消耗" : "用戶流失與續購行為"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
            <div style={{ opacity: enabled.churnRate ? 1 : 0.45 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <Dot on={enabled.churnRate} onClick={() => toggle("churnRate")} />
                <span onClick={() => toggle("churnRate")} style={{ textDecoration: enabled.churnRate ? "none" : "line-through", cursor: "pointer" }}>每月流失率（Churn）</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#ef4444" }}>{churnRate}%</div>
              <input type="range" min={0} max={40} step={1} value={churnRate} disabled={!enabled.churnRate}
                onChange={e => setChurnRate(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#ef4444", marginTop: 4 }} />
              <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                {[3, 5, 8, 12, 20].map(v => (
                  <Chip key={v} label={`${v}%`} active={churnRate === v} onClick={() => setChurnRate(v)} color="#ef4444" />
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
                SaaS 平均月流失 5-8%，對話包可能更高
              </div>
            </div>
            {activeTab === "pack" ? (
              <>
                <div style={{ opacity: enabled.repurchase ? 1 : 0.45 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <Dot on={enabled.repurchase} onClick={() => toggle("repurchase")} />
                    <span onClick={() => toggle("repurchase")} style={{ textDecoration: enabled.repurchase ? "none" : "line-through", cursor: "pointer" }}>對話包續購率</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#3b82f6" }}>{repurchaseRate}%</div>
                  <input type="range" min={0} max={100} step={1} value={repurchaseRate} disabled={!enabled.repurchase}
                    onChange={e => setRepurchaseRate(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#3b82f6", marginTop: 4 }} />
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {[30, 45, 60, 75, 90].map(v => (
                      <Chip key={v} label={`${v}%`} active={repurchaseRate === v} onClick={() => setRepurchaseRate(v)} color="#3b82f6" />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
                    用完對話包後有多少%用戶會再買
                  </div>
                </div>
                <div>
                  <NumInput label="平均續購週期" value={repurchaseCycle} onChange={setRepurchaseCycle} suffix="個月/次" width={50} small
                    tip="用戶多久買一次對話包" on={enabled.repurchase} onToggle={() => toggle("repurchase")} />
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {[{ l: "半月", v: "0.5" }, { l: "1月", v: "1" }, { l: "1.5月", v: "1.5" }, { l: "2月", v: "2" }, { l: "3月", v: "3" }].map(c => (
                      <Chip key={c.v} label={c.l} active={repurchaseCycle === c.v} onClick={() => setRepurchaseCycle(c.v)} color="#3b82f6" />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <NumInput label="每輪對話消耗點數" value={creditsPerTurn} onChange={setCreditsPerTurn} suffix="點/輪" width={50} small
                    tip="1 次對話扣幾點" on={enabled.creditsPerTurn} onToggle={() => toggle("creditsPerTurn")} />
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {[{ l: "5", v: "5" }, { l: "10", v: "10" }, { l: "15", v: "15" }, { l: "20", v: "20" }].map(c => (
                      <Chip key={c.v} label={c.l + "點"} active={creditsPerTurn === c.v} onClick={() => setCreditsPerTurn(c.v)} color="#34d399" />
                    ))}
                  </div>
                </div>
                <div>
                  <NumInput label="月均消耗點數（每位活躍用戶）" value={creditsPerMonthPerUser} onChange={setCreditsPerMonthPerUser} suffix="點/月" width={70} small
                    tip="每位活躍用戶每月平均用掉的點數" on={enabled.creditsPerMonthPerUser} onToggle={() => toggle("creditsPerMonthPerUser")} />
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {[{ l: "200", v: "200" }, { l: "500", v: "500" }, { l: "1000", v: "1000" }, { l: "2000", v: "2000" }].map(c => (
                      <Chip key={c.v} label={c.l} active={creditsPerMonthPerUser === c.v} onClick={() => setCreditsPerMonthPerUser(c.v)} color="#34d399" />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          {activeTab === "credit" && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 14, alignItems: "center" }}>
                <NumInput label="實際使用率（未用完的點數 = 額外利潤）" value={consumptionRate} onChange={setConsumptionRate} suffix="%" width={50} small
                  tip="100% = 買的點都用完；<100% 模擬點數浪費/過期" on={enabled.consumptionRate} onToggle={() => toggle("consumptionRate")} />
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  每用戶月營收 <span style={{ color: "#34d399", fontWeight: 700 }}>{fmtFull(Math.round(data.monthRevenuePerUser))}</span>
                  {" · "}月 API 成本 <span style={{ color: "#ef4444", fontWeight: 700 }}>{fmtFull(Math.round(data.monthApiCostPerUser))}</span>
                  {" · "}月毛利 <span style={{ color: data.creditMarginPerUser >= 0 ? "#34d399" : "#ef4444", fontWeight: 700 }}>{fmtFull(Math.round(data.creditMarginPerUser))} ({data.creditMarginPct.toFixed(0)}%)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== 5. Server Scaling ===== */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>🖥️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>⑤ GPU 伺服器階梯擴容</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
            <NumInput label="每台伺服器承載用戶數" value={usersPerServer} onChange={setUsersPerServer} suffix="人/台" width={70} small
              tip="AWS g6e.2xlarge 約 50-100 並發" on={enabled.gpu} onToggle={() => toggle("gpu")} />
            <NumInput label="每台伺服器月費" value={serverCost} onChange={setServerCost} prefix="NT$" suffix="/月" width={80} small
              tip="~$1,614 USD ≈ NT$50,000" on={enabled.gpu} onToggle={() => toggle("gpu")} />
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>目前模擬需要</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#a78bfa" }}>
                {data.months[11]?.serversNeeded || 1} 台
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>
                第 12 月 GPU 費用 {fmt(data.months[11]?.serverTotalCost || 0)}/月
              </div>
            </div>
          </div>
        </div>

        {/* ===== 6. Growth (monthly override + quarterly) ===== */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>📈</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>⑥ 用戶成長率</span>
            <span style={{ fontSize: 11, color: "#ef4444", marginLeft: "auto" }}>
              淨成長 = 成長率 - 流失率 ({enabled.churnRate ? churnRate : 0}%)
            </span>
          </div>

          {/* Monthly uniform growth (overrides quarterly when on) */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
            padding: "10px 14px", borderRadius: 10, flexWrap: "wrap",
            background: enabled.monthlyGrowth ? "rgba(52,211,153,0.06)" : "#ffffff",
            border: `1px solid ${enabled.monthlyGrowth ? "rgba(52,211,153,0.25)" : "#e2e8f0"}`,
          }}>
            <Dot on={enabled.monthlyGrowth} onClick={() => toggle("monthlyGrowth")} />
            <span onClick={() => toggle("monthlyGrowth")}
              style={{ fontSize: 12, color: "#64748b", cursor: "pointer", textDecoration: enabled.monthlyGrowth ? "none" : "line-through" }}>
              每月統一用戶成長率
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, color: enabled.monthlyGrowth ? "#34d399" : "#94a3b8", minWidth: 60 }}>
              {monthlyGrowth > 0 ? "+" : ""}{monthlyGrowth}%
            </span>
            <input type="range" min={-10} max={100} step={1} value={monthlyGrowth} disabled={!enabled.monthlyGrowth}
              onChange={e => setMonthlyGrowth(Number(e.target.value))}
              style={{ flex: 1, minWidth: 140, accentColor: "#34d399" }} />
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {[5, 10, 15, 25, 40].map(v => (
                <Chip key={v} label={`${v}%`} active={monthlyGrowth === v && enabled.monthlyGrowth}
                  onClick={() => { setMonthlyGrowth(v); if (!enabled.monthlyGrowth) toggle("monthlyGrowth"); }}
                  color="#34d399" />
              ))}
            </div>
            <span style={{ fontSize: 10, color: "#94a3b8", width: "100%" }}>
              {enabled.monthlyGrowth ? "✓ 已覆蓋下方分季設定，每月一律用此值" : "啟用後將覆蓋下方 Q1–Q4 設定"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, opacity: enabled.monthlyGrowth ? 0.4 : 1 }}>
            {["Q1（1-3月）", "Q2（4-6月）", "Q3（7-9月）", "Q4（10-12月）"].map((label, qi) => {
              const colors = ["#f59e0b", "#3b82f6", "#a78bfa", "#34d399"];
              const g = qGrowth[qi];
              const qOn = enabled[`q${qi}`];
              const effG = qOn ? g : 0;
              const effChurn = enabled.churnRate ? churnRate : 0;
              const net = effG - effChurn;
              return (
                <div key={qi} style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: `1px solid ${colors[qi]}22`, opacity: qOn ? 1 : 0.45 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2, display: "flex", alignItems: "center", gap: 5 }}>
                    <Dot on={qOn} onClick={() => toggle(`q${qi}`)} />
                    <span onClick={() => toggle(`q${qi}`)} style={{ textDecoration: qOn ? "none" : "line-through", cursor: "pointer" }}>{label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: colors[qi] }}>{effG > 0 ? "+" : ""}{effG}%</span>
                    <span style={{ fontSize: 11, color: net >= 0 ? "#34d399" : "#ef4444" }}>
                      淨{net >= 0 ? "+" : ""}{net}%
                    </span>
                  </div>
                  <input type="range" min={-10} max={100} step={1} value={g} disabled={!qOn}
                    onChange={e => { const n = [...qGrowth]; n[qi] = Number(e.target.value); setQGrowth(n); }}
                    style={{ width: "100%", accentColor: colors[qi] }} />
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {[0, 10, 30, 50, 85].map(v => (
                      <Chip key={v} label={`${v}%`} active={g === v}
                        onClick={() => { const n = [...qGrowth]; n[qi] = v; setQGrowth(n); }}
                        color={colors[qi]} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
                    {qi === 0 && "🚀 上線衝刺期"}{qi === 1 && "📣 口碑擴散期"}
                    {qi === 2 && "📊 穩定成長期"}{qi === 3 && "🏔️ 成熟運營期"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== KEY METRICS ===== */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
          {[
            activeTab === "credit"
              ? { label: "每用戶月毛利", value: `${fmtFull(Math.round(data.creditMarginPerUser))} (${data.creditMarginPct.toFixed(0)}%)`, color: data.creditMarginPerUser >= 0 ? "#34d399" : "#ef4444" }
              : { label: "每次購買毛利", value: `${fmtFull(Math.round(data.grossMarginPerPurchase))} (${data.grossMarginPct.toFixed(0)}%)`, color: data.grossMarginPerPurchase >= 0 ? "#34d399" : "#ef4444" },
            activeTab === "credit"
              ? { label: "靜態損平衡(含1GPU)", value: data.breakEvenUsers === Infinity ? "∞" : `${data.breakEvenUsers.toLocaleString()} 活躍用戶`, color: "#f59e0b" }
              : { label: "靜態損平衡(含1GPU)", value: data.breakEvenUsers === Infinity ? "∞" : `${data.breakEvenUsers.toLocaleString()} 次購買/月`, color: "#f59e0b" },
            { label: "第 12 月活躍用戶", value: `${(data.months[11]?.activeUsers || 0).toLocaleString()} 人`, color: "#3b82f6" },
            { label: "第 12 月 GPU 台數", value: `${data.months[11]?.serversNeeded || 1} 台`, color: "#a78bfa" },
            { label: "累計回本月份", value: data.breakEvenMonth ? `第 ${data.breakEvenMonth} 月` : "12月內無法", color: data.breakEvenMonth && data.breakEvenMonth <= 3 ? "#34d399" : "#ef4444" },
          ].map((m, i) => (
            <div key={i} style={{ ...card, textAlign: "center", padding: "12px 8px" }}>
              <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 5 }}>{m.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* 3-month badge */}
        {(() => {
          const m3 = data.months[2];
          const hit = m3 && m3.cumProfit >= 0;
          return (
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
              borderRadius: 12, marginBottom: 12, flexWrap: "wrap",
              background: hit ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${hit ? "rgba(52,211,153,0.2)" : "rgba(239,68,68,0.2)"}`,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: hit ? "#34d399" : "#ef4444", boxShadow: `0 0 10px ${hit ? "#34d39966" : "#ef444466"}` }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: hit ? "#34d399" : "#ef4444" }}>
                {hit ? "✓ 3 個月內達成盈利！" : "✗ 3 個月內尚無法回本"}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>前 3 月累計：{fmt(m3?.cumProfit || 0)}</span>
            </div>
          );
        })()}

        {/* Chart */}
        <div style={{ ...card, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: "#1a202c" }}>12 個月累計損益趨勢</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 12, fontSize: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ color: "#64748b" }}>營收（依季度著色）</span>
            {["Q1", "Q2", "Q3", "Q4"].map((q, i) => {
              const cs = ["#f59e0b", "#3b82f6", "#a78bfa", "#34d399"];
              return (<span key={q} style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 3, background: cs[i], borderRadius: 2 }} />{q}</span>);
            })}
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 3, background: "#ef4444", borderRadius: 2 }} />成本</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 170 }}>
            {data.months.map(m => {
              const rH = maxChart > 0 ? (m.cumRevenue / maxChart) * 155 : 0;
              const cH = maxChart > 0 ? (m.cumCost / maxChart) * 155 : 0;
              const qc = ["#f59e0b", "#3b82f6", "#a78bfa", "#34d399"][m.quarter - 1];
              return (
                <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 155 }}>
                    <div style={{ width: 10, height: rH, background: m.cumProfit >= 0 ? `linear-gradient(to top, ${qc}, ${qc}cc)` : `linear-gradient(to top, ${qc}55, ${qc}33)`, borderRadius: "3px 3px 0 0", transition: "height 0.3s" }} />
                    <div style={{ width: 10, height: cH, background: "linear-gradient(to top, #ef4444, #f87171)", borderRadius: "3px 3px 0 0", opacity: 0.4, transition: "height 0.3s" }} />
                  </div>
                  <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 3 }}>{m.month}月</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly table */}
        <div style={{ ...card, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#1a202c" }}>逐月明細</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 850 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
                  {["月份", "季/成長", "活躍用戶", "新增", activeTab === "credit" ? "等效點包數" : "購買次數", "GPU台數", "營收", "API成本", "固定+GPU", "月損益", "累計損益"].map(h => (
                    <th key={h} style={{ padding: "7px 5px", textAlign: "right", color: "#94a3b8", fontWeight: 500, fontSize: 9 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.months.map(m => {
                  const qc = ["#f59e0b", "#3b82f6", "#a78bfa", "#34d399"][m.quarter - 1];
                  return (
                    <tr key={m.month} style={{ borderBottom: "1px solid #f1f5f9", background: m.month <= 3 ? "rgba(245,158,11,0.03)" : "transparent" }}>
                      <td style={{ padding: "6px 5px", textAlign: "right", color: "#1a202c", fontWeight: m.month <= 3 ? 600 : 400, fontSize: 10 }}>
                        {m.month <= 3 ? `⚡${m.month}` : m.month}
                      </td>
                      <td style={{ padding: "6px 5px", textAlign: "right" }}>
                        <span style={{ fontSize: 9, color: qc, background: `${qc}15`, padding: "1px 5px", borderRadius: 3 }}>Q{m.quarter} +{m.growthRate}%</span>
                      </td>
                      <td style={{ padding: "6px 5px", textAlign: "right", color: "#3b82f6", fontWeight: 500 }}>{m.activeUsers.toLocaleString()}</td>
                      <td style={{ padding: "6px 5px", textAlign: "right", color: "#64748b" }}>+{m.newUsers.toLocaleString()}</td>
                      <td style={{ padding: "6px 5px", textAlign: "right", color: "#f59e0b" }}>{m.purchases.toLocaleString()}</td>
                      <td style={{ padding: "6px 5px", textAlign: "right", color: "#a78bfa" }}>{m.serversNeeded}</td>
                      <td style={{ padding: "6px 5px", textAlign: "right", color: "#1a202c" }}>{fmt(m.monthRevenue)}</td>
                      <td style={{ padding: "6px 5px", textAlign: "right", color: "#ef4444", opacity: 0.7 }}>{fmt(m.monthApiCost)}</td>
                      <td style={{ padding: "6px 5px", textAlign: "right", color: "#ef4444", opacity: 0.5 }}>{fmt(m.monthFixedCost)}</td>
                      <td style={{ padding: "6px 5px", textAlign: "right", color: m.monthProfit >= 0 ? "#34d399" : "#ef4444", fontWeight: 600 }}>{fmt(m.monthProfit)}</td>
                      <td style={{ padding: "6px 5px", textAlign: "right", fontWeight: 700, color: m.cumProfit >= 0 ? "#34d399" : "#ef4444" }}>{fmt(m.cumProfit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 6 }}>
            ⚡ = 目標回本期 ｜
            {activeTab === "credit"
              ? " 等效點包數 = 活躍用戶 × 月消耗點數 ÷ 加權平均點包點數"
              : " 購買次數 = 新用戶首購 + 舊用戶續購"}
            ｜ 固定+GPU = 基礎成本 + 伺服器擴容費
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.1)",
          fontSize: 11, color: "#64748b", lineHeight: 1.8,
        }}>
          💡 <strong style={{ color: "#f59e0b" }}>模型說明：</strong>
          活躍用戶 = 上月活躍 × (1 − 流失率) × (1 + 成長率)（先流失後成長，負成長率自動歸零）。
          {activeTab === "credit"
            ? " 月營收 = 活躍用戶 × 月消耗點數 × 加權平均單點售價；API 成本依實際使用率計算（未用完的點數直接變成毛利）。"
            : " 購買次數 = 當月新增首購 + 各 cohort 依續購週期均勻觸發的回購（套用續購率，支援週期 < 1 月）。"}
          GPU 成本隨用戶數階梯增長，每滿 {usersPerServer} 人加開一台 {fmt(sCost)}/月。
          靜態損益平衡含 1 台 GPU 為下限；實際規模大時需按階梯加計。
        </div>
      </div>
    </div>
  );
}
