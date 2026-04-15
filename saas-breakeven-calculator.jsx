import { useState, useEffect } from "react";

function fmt(n) {
  if (Math.abs(n) >= 100000000) return "NT$" + (n / 100000000).toFixed(2) + "億";
  if (Math.abs(n) >= 10000) return "NT$" + (n / 10000).toFixed(1) + "萬";
  return "NT$" + Math.round(n).toLocaleString("en-US");
}
function fmtFull(n) { return "NT$" + Math.round(n).toLocaleString("en-US"); }

function parseIntSafe(val) {
  return parseInt(String(val ?? "").replace(/,/g, ""), 10);
}
function parseFloatSafe(val) {
  return parseFloat(String(val ?? "").replace(/,/g, ""));
}

const STORAGE_PREFIX = "saas-calc-v3:";

function usePersistentState(key, initial) {
  const fullKey = STORAGE_PREFIX + key;
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(fullKey);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {}
  }, [fullKey, value]);
  return [value, setValue];
}

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
  const [costWhisper, setCostWhisper] = usePersistentState("costWhisper", "0.3");
  const [costLLM, setCostLLM] = usePersistentState("costLLM", "1.5");
  const [costTTS, setCostTTS] = usePersistentState("costTTS", "0.4");
  const [costDenoise, setCostDenoise] = usePersistentState("costDenoise", "0.1");

  // Packs (v3 defaults — positive out-of-box margin)
  const [packs, setPacks] = usePersistentState("packs", [
    { name: "輕量包", turns: 30, price: 399 },
    { name: "標準包", turns: 80, price: 899 },
    { name: "專業包", turns: 200, price: 1899 },
  ]);
  const [packMix, setPackMix] = usePersistentState("packMix", [40, 40, 20]);
  const [avgTurnsUsed, setAvgTurnsUsed] = usePersistentState("avgTurnsUsed", "70");

  // Operating cost breakdown (v3 — replaces single baseCost)
  const [hrCost, setHrCost] = usePersistentState("hrCost", "60000");
  const [officeCost, setOfficeCost] = usePersistentState("officeCost", "35000");
  const [toolsCost, setToolsCost] = usePersistentState("toolsCost", "5000");
  const [paymentFeePct, setPaymentFeePct] = usePersistentState("paymentFeePct", "2.8");
  const [refundRate, setRefundRate] = usePersistentState("refundRate", 2);

  // Marketing funnel (v3 new)
  const [monthlyBudget, setMonthlyBudget] = usePersistentState("monthlyBudget", "50000");
  const [cpa, setCpa] = usePersistentState("cpa", "20");
  const [landingConversion, setLandingConversion] = usePersistentState("landingConversion", 5);

  // Initial & growth
  const [initUsers, setInitUsers] = usePersistentState("initUsers", "50");
  const [qGrowth, setQGrowth] = usePersistentState("qGrowth", [30, 20, 10, 10]);

  // Churn (simple)
  const [churnRate, setChurnRate] = usePersistentState("churnRate", 5);

  // Cohort churn (advanced)
  const [useCohortChurn, setUseCohortChurn] = usePersistentState("useCohortChurn", false);
  const [firstMonthChurn, setFirstMonthChurn] = usePersistentState("firstMonthChurn", 15);
  const [stableChurn, setStableChurn] = usePersistentState("stableChurn", 5);

  // Architecture (v3 new)
  const [architecture, setArchitecture] = usePersistentState("architecture", "api");

  // Server scaling (used only when architecture === "selfhost")
  const [usersPerServer, setUsersPerServer] = usePersistentState("usersPerServer", "100");
  const [serverCost, setServerCost] = usePersistentState("serverCost", "50000");

  // Repurchase (pack mode)
  const [repurchaseRate, setRepurchaseRate] = usePersistentState("repurchaseRate", 60);
  const [repurchaseCycle, setRepurchaseCycle] = usePersistentState("repurchaseCycle", "1.5");

  // Monthly growth override
  const [monthlyGrowth, setMonthlyGrowth] = usePersistentState("monthlyGrowth", 15);

  // Pricing model tab
  const [activeTab, setActiveTab] = usePersistentState("activeTab", "pack");

  // Credit-mode state (v3 defaults)
  const [creditPacks, setCreditPacks] = usePersistentState("creditPacks", [
    { name: "入門包", credits: 300, price: 599 },
    { name: "標準包", credits: 800, price: 1099 },
    { name: "專業包", credits: 2000, price: 2599 },
  ]);
  const [creditPackMix, setCreditPackMix] = usePersistentState("creditPackMix", [55, 30, 15]);
  const [creditsPerTurn, setCreditsPerTurn] = usePersistentState("creditsPerTurn", "10");
  const [creditsPerMonthPerUser, setCreditsPerMonthPerUser] = usePersistentState("creditsPerMonthPerUser", "500");
  const [consumptionRate, setConsumptionRate] = usePersistentState("consumptionRate", "80");

  // Subscription-mode state (v3 defaults)
  const [subPlans, setSubPlans] = usePersistentState("subPlans", [
    { name: "基礎版", monthlyPrice: 799, includedTurns: 30 },
    { name: "標準版", monthlyPrice: 1490, includedTurns: 70 },
    { name: "專業版", monthlyPrice: 2990, includedTurns: 180 },
  ]);
  const [subPlanMix, setSubPlanMix] = usePersistentState("subPlanMix", [60, 30, 10]);
  const [subUsageRate, setSubUsageRate] = usePersistentState("subUsageRate", "70");
  const [overageTurns, setOverageTurns] = usePersistentState("overageTurns", "20");
  const [overagePrice, setOveragePrice] = usePersistentState("overagePrice", "299");
  const [overageUserPct, setOverageUserPct] = usePersistentState("overageUserPct", "15");
  const [overagePacksPerUser, setOveragePacksPerUser] = usePersistentState("overagePacksPerUser", "1.2");
  const [annualAdoption, setAnnualAdoption] = usePersistentState("annualAdoption", 30);
  const [annualDiscount, setAnnualDiscount] = usePersistentState("annualDiscount", 20);
  const [annualChurn, setAnnualChurn] = usePersistentState("annualChurn", "2");
  const [trialTurns, setTrialTurns] = usePersistentState("trialTurns", "5");
  const [trialConversion, setTrialConversion] = usePersistentState("trialConversion", 10);

  // Trial conversion for pack and credit modes (v3 new)
  const [packTrialConv, setPackTrialConv] = usePersistentState("packTrialConv", 10);
  const [creditTrialConv, setCreditTrialConv] = usePersistentState("creditTrialConv", 10);

  // Sub-mode downgrade rate (v3 new)
  const [downgradeRate, setDowngradeRate] = usePersistentState("downgradeRate", 3);

  // Market ceiling (v3 new, opt-in)
  const [enableMarketCeiling, setEnableMarketCeiling] = usePersistentState("enableMarketCeiling", false);
  const [tam, setTam] = usePersistentState("tam", "50000");
  const [som, setSom] = usePersistentState("som", 3);

  // Per-variable enable/disable
  const ENABLED_DEFAULTS = {
    costDenoise: true, costWhisper: true, costLLM: true, costTTS: true,
    churnRate: true, gpu: true, repurchase: true,
    monthlyGrowth: false,
    q0: true, q1: true, q2: true, q3: true,
    pack0: true, pack1: true, pack2: true,
    creditPack0: true, creditPack1: true, creditPack2: true,
    creditsPerTurn: true, creditsPerMonthPerUser: true,
    sub0: true, sub1: true, sub2: true,
    overage: true, annual: true, trial: true,
    marketing: true, payment: true,
  };
  const [enabledRaw, setEnabled] = usePersistentState("enabled", ENABLED_DEFAULTS);
  const enabled = { ...ENABLED_DEFAULTS, ...enabledRaw };

  const handleReset = () => {
    if (typeof window === "undefined") return;
    if (!window.confirm("確定要把所有參數重設為預設值？此動作會清掉你目前儲存的所有設定。")) return;
    try {
      Object.keys(window.localStorage)
        .filter(k => k.startsWith(STORAGE_PREFIX))
        .forEach(k => window.localStorage.removeItem(k));
    } catch {}
    window.location.reload();
  };

  const handleCsvExport = () => {
    if (typeof window === "undefined") return;
    const headers = ["月份", "季度", "成長率(%)", "活躍用戶", "新增", "購買/試用", "GPU台數", "營收", "API成本", "固定成本", "行銷費", "手續+退款", "月損益", "累計營收", "累計成本", "累計損益"];
    const rows = data.months.map(m => {
      const pureFixed = m.monthFixedCost - m.marketingCost;
      return [
        m.month, m.quarter, m.growthRate.toFixed(1),
        m.activeUsers, m.newUsers, m.purchases, m.serversNeeded,
        Math.round(m.monthRevenue), Math.round(m.monthApiCost), Math.round(pureFixed),
        Math.round(m.marketingCost), Math.round(m.monthVariableCost),
        Math.round(m.monthProfit), Math.round(m.cumRevenue), Math.round(m.cumCost), Math.round(m.cumProfit)
      ].join(",");
    });
    const csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pl-simulation-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
    (enabled.costWhisper ? (parseFloatSafe(costWhisper) || 0) : 0) +
    (enabled.costLLM ? (parseFloatSafe(costLLM) || 0) : 0) +
    (enabled.costTTS ? (parseFloatSafe(costTTS) || 0) : 0) +
    (enabled.costDenoise ? (parseFloatSafe(costDenoise) || 0) : 0);

  const hrVal = parseIntSafe(hrCost) || 0;
  const officeVal = parseIntSafe(officeCost) || 0;
  const toolsVal = parseIntSafe(toolsCost) || 0;
  const budgetVal = enabled.marketing ? (parseIntSafe(monthlyBudget) || 0) : 0;
  const fixedBase = hrVal + officeVal + toolsVal + budgetVal;

  const feeRate = enabled.payment ? ((parseFloatSafe(paymentFeePct) || 0) / 100) : 0;
  const refundR = enabled.payment ? ((refundRate || 0) / 100) : 0;
  const variableRate = feeRate + refundR;

  const startUsers = parseIntSafe(initUsers) || 0;
  const turnsUsedPct = (parseFloatSafe(avgTurnsUsed) || 70) / 100;
  const uPerServer = parseIntSafe(usersPerServer) || 100;
  const sCost = (architecture === "selfhost" && enabled.gpu) ? (parseIntSafe(serverCost) || 0) : 0;
  const rCycle = parseFloatSafe(repurchaseCycle) || 1;

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
    const cpt = enabled.creditsPerTurn ? (parseFloatSafe(creditsPerTurn) || 1) : 1;
    const cpu = enabled.creditsPerMonthPerUser ? (parseFloatSafe(creditsPerMonthPerUser) || 0) : 0;
    const consRate = (parseFloatSafe(consumptionRate) || 70) / 100;
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

    // Sub-mode pricing
    const effSubMix = subPlanMix.map((m, i) => enabled[`sub${i}`] ? (m || 0) : 0);
    const totalSubMix = effSubMix.reduce((a, b) => a + b, 0) || 100;
    let wMonthlyPrice = 0;
    let wIncludedTurns = 0;
    subPlans.forEach((p, i) => {
      const pct = effSubMix[i] / totalSubMix;
      wMonthlyPrice += p.monthlyPrice * pct;
      wIncludedTurns += p.includedTurns * pct;
    });
    const subUse = (parseFloatSafe(subUsageRate) || 70) / 100;
    const turnsPerSubUser = wIncludedTurns * subUse;
    const apiCostPerSubUser = turnsPerSubUser * apiCostPerTurn;

    const annualPct = enabled.annual ? annualAdoption / 100 : 0;
    const annualDisc = enabled.annual ? annualDiscount / 100 : 0;
    const monthlyPct = 1 - annualPct;
    const recognizedArpu = wMonthlyPrice * (monthlyPct + (1 - annualDisc) * annualPct);

    const annualChurnNum = enabled.annual ? ((parseFloatSafe(annualChurn) || 0) / 100) : churn;
    const blendedChurn = churn * monthlyPct + annualChurnNum * annualPct;

    const overUsers = enabled.overage ? ((parseFloatSafe(overageUserPct) || 0) / 100) : 0;
    const overPacks = enabled.overage ? (parseFloatSafe(overagePacksPerUser) || 0) : 0;
    const overT = parseFloatSafe(overageTurns) || 0;
    const overP = parseFloatSafe(overagePrice) || 0;
    const overageRevPerUser = overUsers * overPacks * overP;
    const overageApiPerUser = overUsers * overPacks * overT * apiCostPerTurn;

    const trialT = enabled.trial ? (parseFloatSafe(trialTurns) || 0) : 0;
    const trialConv = enabled.trial ? Math.max(0.01, trialConversion / 100) : 1;
    const trialCostPerSignup = trialT * apiCostPerTurn;

    const subArpu = recognizedArpu + overageRevPerUser;
    const subCogsPerUser = apiCostPerSubUser + overageApiPerUser;
    const subMarginPerUser = subArpu - subCogsPerUser;
    const subMarginPct = subArpu > 0 ? (subMarginPerUser / subArpu * 100) : 0;

    // ===== Marketing funnel =====
    const budget = enabled.marketing ? (parseFloatSafe(monthlyBudget) || 0) : 0;
    const cpaVal = Math.max(1, parseFloatSafe(cpa) || 1);
    const landingRate = Math.max(0, (parseFloatSafe(landingConversion) || 0)) / 100;
    const maxVisitorsPerMonth = budget / cpaVal;
    const maxSignupsPerMonth = maxVisitorsPerMonth * landingRate;
    const packTrialConvRate = Math.max(0.01, (parseFloatSafe(packTrialConv) || 0) / 100);
    const creditTrialConvRate = Math.max(0.01, (parseFloatSafe(creditTrialConv) || 0) / 100);
    const modeTrialConvRate = activeTab === "sub" ? trialConv
      : activeTab === "credit" ? creditTrialConvRate
      : packTrialConvRate;
    const maxNewPayingFromBudget = Math.round(maxSignupsPerMonth * modeTrialConvRate);

    // ===== Monthly per-user margin by mode (for LTV) =====
    const monthlyArpuPerUser = activeTab === "sub" ? subArpu
      : activeTab === "credit" ? monthRevenuePerUser
      : (avgRevenuePerPurchase * (repRate / Math.max(0.25, rCycle)));
    const monthlyMarginPerUser = activeTab === "sub" ? subMarginPerUser
      : activeTab === "credit" ? creditMarginPerUser
      : ((avgRevenuePerPurchase - avgApiCostPerPurchase) * (repRate / Math.max(0.25, rCycle)));

    // Effective monthly churn for LTV (simple or cohort-blended)
    const effChurnForLtv = useCohortChurn
      ? (((parseFloatSafe(firstMonthChurn) || 0) + 11 * (parseFloatSafe(stableChurn) || 0)) / 12 / 100)
      : churn;
    const ltv = effChurnForLtv > 0 && monthlyMarginPerUser > 0
      ? monthlyMarginPerUser / effChurnForLtv
      : (monthlyMarginPerUser > 0 ? Infinity : 0);
    const cac = maxNewPayingFromBudget > 0 ? budget / maxNewPayingFromBudget : (budget > 0 ? Infinity : 0);
    const ltvCacRatio = cac > 0 && cac !== Infinity && ltv !== Infinity ? ltv / cac
      : (ltv === Infinity && cac > 0 && cac !== Infinity ? Infinity : 0);
    const paybackMonths = monthlyMarginPerUser > 0 && cac !== Infinity
      ? cac / monthlyMarginPerUser
      : Infinity;

    // Per-mode unit economics for 3-mode comparison table (computed regardless of activeTab)
    const safeRCycle = Math.max(0.25, rCycle);
    const packPerMonthArpu = avgRevenuePerPurchase * (repRate / safeRCycle);
    const packPerMonthMargin = (avgRevenuePerPurchase - avgApiCostPerPurchase) * (repRate / safeRCycle);
    const creditPerMonthArpu = monthRevenuePerUser;
    const creditPerMonthMargin = creditMarginPerUser;
    const subPerMonthArpu = subArpu;
    const subPerMonthMargin = subMarginPerUser;

    const packLtv = effChurnForLtv > 0 && packPerMonthMargin > 0 ? packPerMonthMargin / effChurnForLtv : (packPerMonthMargin > 0 ? Infinity : 0);
    const creditLtv = effChurnForLtv > 0 && creditPerMonthMargin > 0 ? creditPerMonthMargin / effChurnForLtv : (creditPerMonthMargin > 0 ? Infinity : 0);
    const subLtv = effChurnForLtv > 0 && subPerMonthMargin > 0 ? subPerMonthMargin / effChurnForLtv : (subPerMonthMargin > 0 ? Infinity : 0);

    const packCac = maxSignupsPerMonth * packTrialConvRate > 0 ? budget / (maxSignupsPerMonth * packTrialConvRate) : (budget > 0 ? Infinity : 0);
    const creditCac = maxSignupsPerMonth * creditTrialConvRate > 0 ? budget / (maxSignupsPerMonth * creditTrialConvRate) : (budget > 0 ? Infinity : 0);
    const subCac = maxSignupsPerMonth * trialConv > 0 ? budget / (maxSignupsPerMonth * trialConv) : (budget > 0 ? Infinity : 0);

    const safeDiv = (num, den) => (den > 0 && den !== Infinity && num !== Infinity) ? num / den : (num === Infinity && den > 0 && den !== Infinity ? Infinity : 0);
    const packLtvCac = safeDiv(packLtv, packCac);
    const creditLtvCac = safeDiv(creditLtv, creditCac);
    const subLtvCac = safeDiv(subLtv, subCac);

    const perModeComparison = {
      pack: { arpu: packPerMonthArpu, margin: packPerMonthMargin, marginPct: grossMarginPct, cac: packCac, ltv: packLtv, ltvCac: packLtvCac, breakEven: grossMarginPerPurchase > 0 ? Math.ceil((fixedBase + sCost) / grossMarginPerPurchase) : Infinity },
      credit: { arpu: creditPerMonthArpu, margin: creditPerMonthMargin, marginPct: creditMarginPct, cac: creditCac, ltv: creditLtv, ltvCac: creditLtvCac, breakEven: creditMarginPerUser > 0 ? Math.ceil((fixedBase + sCost) / creditMarginPerUser) : Infinity },
      sub: { arpu: subPerMonthArpu, margin: subPerMonthMargin, marginPct: subMarginPct, cac: subCac, ltv: subLtv, ltvCac: subLtvCac, breakEven: subMarginPerUser > 0 ? Math.ceil((fixedBase + sCost) / subMarginPerUser) : Infinity },
    };

    // Market ceiling (opt-in)
    const marketCeiling = enableMarketCeiling
      ? Math.floor((parseIntSafe(tam) || 0) * ((parseFloatSafe(som) || 0) / 100))
      : Infinity;

    let cumRevenue = 0;
    let cumCost = 0;
    let breakEvenMonth = null;
    let activeUsers = startUsers;

    // Sub-mode cohort pools (floats, tracked separately so annual users accumulate
    // over time as monthly users churn out faster).
    let monthlyPool = activeTab === "sub" ? startUsers * monthlyPct : 0;
    let annualPool = activeTab === "sub" ? startUsers * annualPct : 0;

    // Store monthly new user counts for repurchase calculation
    const newUsersByMonth = [];

    const monthsData = [];

    // Cohort churn helper: simple mode returns constant churn, advanced shifts
    // first-month high churn → transition → stable as the cohort ages.
    const dynChurnAt = (i) => {
      if (!useCohortChurn) return churn;
      const fm = (parseFloatSafe(firstMonthChurn) || 0) / 100;
      const st = (parseFloatSafe(stableChurn) || 0) / 100;
      if (i <= 1) return fm;
      if (i === 2) return (fm + st) / 2;
      return st;
    };

    for (let i = 0; i < 12; i++) {
      const qi = Math.floor(i / 3);
      const rate = qRates[qi] || 0;
      const monthChurn = dynChurnAt(i);

      let newUsersThisMonth;
      if (activeTab === "sub") {
        if (i === 0) {
          newUsersThisMonth = startUsers;
        } else {
          monthlyPool = monthlyPool * (1 - monthChurn);
          annualPool = annualPool * (1 - annualChurnNum);
          const retainedTotal = monthlyPool + annualPool;
          let grown = Math.max(0, retainedTotal * rate);
          // Apply market ceiling
          if (enableMarketCeiling && retainedTotal + grown > marketCeiling) {
            grown = Math.max(0, marketCeiling - retainedTotal);
          }
          monthlyPool += grown * monthlyPct;
          annualPool += grown * annualPct;
          activeUsers = Math.round(monthlyPool + annualPool);
          newUsersThisMonth = Math.round(grown);
        }
      } else {
        if (i === 0) {
          newUsersThisMonth = startUsers;
        } else {
          const retained = Math.round(activeUsers * (1 - monthChurn));
          let grown = Math.max(0, Math.round(retained * rate));
          if (enableMarketCeiling && retained + grown > marketCeiling) {
            grown = Math.max(0, marketCeiling - retained);
          }
          activeUsers = retained + grown;
          newUsersThisMonth = grown;
        }
      }

      newUsersByMonth.push(newUsersThisMonth);

      let newSignups = 0;
      let purchasesThisMonth;
      let monthRevenue;
      let monthApiCost;

      if (activeTab === "sub") {
        // Back-calc signups from new paying (month 0 startUsers seeded directly, no trial cost)
        newSignups = i === 0 ? newUsersThisMonth : Math.round(newUsersThisMonth / trialConv);
        const trialCost = newSignups * trialCostPerSignup;
        // Cohort-based revenue uses actual pool sizes (not a constant blend)
        const monthlyRev = monthlyPool * wMonthlyPrice;
        const annualRev = annualPool * wMonthlyPrice * (1 - annualDisc);
        const overageRev = activeUsers * overageRevPerUser;
        monthRevenue = monthlyRev + annualRev + overageRev;
        monthApiCost = activeUsers * subCogsPerUser + trialCost;
        purchasesThisMonth = newSignups;
      } else if (activeTab === "credit") {
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

      // GPU scaling: only when architecture === "selfhost"; sub mode adds ~half of trial signups
      const effectiveActiveForGPU = activeTab === "sub"
        ? activeUsers + Math.round(newSignups * 0.5)
        : activeUsers;
      const serversNeeded = architecture === "selfhost"
        ? Math.max(1, Math.ceil(effectiveActiveForGPU / uPerServer))
        : 0;
      const serverTotalCost = serversNeeded * sCost;
      const monthFixedCost = fixedBase + serverTotalCost;

      // Variable cost = revenue × (payment fee + refund rate)
      const monthVariableCost = monthRevenue * variableRate;

      const monthTotalCost = monthFixedCost + monthApiCost + monthVariableCost;
      const monthProfit = monthRevenue - monthTotalCost;

      cumRevenue += monthRevenue;
      cumCost += monthTotalCost;
      const cumProfit = cumRevenue - cumCost;

      if (breakEvenMonth === null && cumProfit >= 0) breakEvenMonth = i + 1;

      monthsData.push({
        month: i + 1, quarter: qi + 1, growthRate: rate * 100,
        activeUsers, newUsers: newUsersThisMonth, purchases: purchasesThisMonth,
        serversNeeded, serverTotalCost,
        monthRevenue, monthApiCost, monthFixedCost, monthVariableCost,
        marketingCost: budgetVal, monthTotalCost, monthProfit,
        cumRevenue, cumCost, cumProfit,
        monthChurn,
      });
    }

    const grossMarginPerPurchase = avgRevenuePerPurchase - avgApiCostPerPurchase;
    const grossMarginPct = avgRevenuePerPurchase > 0 ? (grossMarginPerPurchase / avgRevenuePerPurchase * 100) : 0;

    const creditMarginPct = monthRevenuePerUser > 0
      ? (creditMarginPerUser / monthRevenuePerUser * 100) : 0;

    // Steady-state trial drag: each active user must be "replaced" at rate blendedChurn
    // per month, and each replacement costs trialCostPerSignup / trialConv (gross-up for
    // trial dropouts). This is a per-active-user amortized ongoing cost.
    const subTrialDragPerActive = activeTab === "sub"
      ? blendedChurn * trialCostPerSignup / trialConv
      : 0;
    const subEffMargin = subMarginPerUser - subTrialDragPerActive;

    // Lower-bound break-even: base cost + one GPU server (variable scaling not modeled).
    const breakEvenUsers = activeTab === "sub"
      ? (subEffMargin > 0 ? Math.ceil((fixedBase + sCost) / subEffMargin) : Infinity)
      : activeTab === "credit"
      ? (creditMarginPerUser > 0 ? Math.ceil((fixedBase + sCost) / creditMarginPerUser) : Infinity)
      : (grossMarginPerPurchase > 0 ? Math.ceil((fixedBase + sCost) / grossMarginPerPurchase) : Infinity);

    return {
      avgRevenuePerPurchase, avgApiCostPerPurchase, grossMarginPerPurchase,
      grossMarginPct, breakEvenUsers, breakEvenMonth, months: monthsData,
      avgPricePerCredit, apiCostPerCredit, creditMarginPerUser, creditMarginPct,
      monthRevenuePerUser, monthApiCostPerUser,
      subArpu, subCogsPerUser, subMarginPerUser, subMarginPct,
      wMonthlyPrice, wIncludedTurns, recognizedArpu, blendedChurn,
      overageRevPerUser, overageApiPerUser,
      // Marketing / unit economics
      maxSignupsPerMonth, maxNewPayingFromBudget, cac, ltv, ltvCacRatio, paybackMonths,
      monthlyArpuPerUser, monthlyMarginPerUser,
      // Per-mode comparison
      perModeComparison,
      // Cost breakdown
      fixedBaseTotal: fixedBase, variableRate,
      marketCeiling, effChurnForLtv,
    };
  })();

  const updatePack = (idx, field, val) => {
    const next = [...packs];
    next[idx] = { ...next[idx], [field]: field === "name" ? val : (parseIntSafe(val) || 0) };
    setPacks(next);
  };
  const updateMix = (idx, val) => {
    const next = [...packMix]; next[idx] = parseIntSafe(val) || 0; setPackMix(next);
  };
  const updateCreditPack = (idx, field, val) => {
    const next = [...creditPacks];
    next[idx] = { ...next[idx], [field]: field === "name" ? val : (parseIntSafe(val) || 0) };
    setCreditPacks(next);
  };
  const updateCreditMix = (idx, val) => {
    const next = [...creditPackMix]; next[idx] = parseIntSafe(val) || 0; setCreditPackMix(next);
  };
  const updateSubPlan = (idx, field, val) => {
    const next = [...subPlans];
    next[idx] = { ...next[idx], [field]: field === "name" ? val : (parseIntSafe(val) || 0) };
    setSubPlans(next);
  };
  const updateSubMix = (idx, val) => {
    const next = [...subPlanMix]; next[idx] = parseIntSafe(val) || 0; setSubPlanMix(next);
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
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
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
            <p style={{ color: "#94a3b8", fontSize: 10, margin: "4px 0 0" }}>
              💾 你的調整會自動儲存在這台裝置的瀏覽器
            </p>
          </div>
          <button onClick={handleReset} style={{
            background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "#64748b",
            cursor: "pointer", whiteSpace: "nowrap",
            boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
          >
            ↻ 重設預設值
          </button>
        </div>

        {/* ===== Tab Switcher ===== */}
        <div style={{
          display: "flex", gap: 6, marginBottom: 12, padding: 4,
          background: "#ffffff", borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}>
          {[
            { k: "pack", label: isMobile ? "📦 方案" : "📦 方案計價", color: "#f59e0b" },
            { k: "credit", label: isMobile ? "⭐ 點數" : "⭐ 點數計價", color: "#34d399" },
            { k: "sub", label: isMobile ? "💎 訂閱" : "💎 訂閱制", color: "#a78bfa" },
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

        {/* ===== Assumption Summary ===== */}
        <div style={{ ...card, marginBottom: 12, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>📋 關鍵假設摘要</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, fontSize: 11 }}>
            {[
              { l: "單輪 API 成本", v: `NT$${apiCostPerTurn.toFixed(1)}`, color: "#f59e0b" },
              { l: "ARPU (本模式)", v: fmtFull(Math.round(data.monthlyArpuPerUser)), color: "#3b82f6" },
              {
                l: "毛利率",
                v: `${(data.monthlyArpuPerUser > 0 ? data.monthlyMarginPerUser / data.monthlyArpuPerUser * 100 : 0).toFixed(0)}%`,
                color: data.monthlyMarginPerUser > 0 ? "#34d399" : "#ef4444",
              },
              {
                l: "LTV / CAC",
                v: data.ltvCacRatio === Infinity ? "∞" : `${data.ltvCacRatio.toFixed(1)}x`,
                color: data.ltvCacRatio >= 3 ? "#34d399" : data.ltvCacRatio >= 1 ? "#f59e0b" : "#ef4444",
              },
              {
                l: "月流失率",
                v: useCohortChurn ? `首 ${firstMonthChurn}% → 穩 ${stableChurn}%` : `${churnRate}%`,
                color: "#ef4444",
              },
              {
                l: "平均月成長率",
                v: `${(qGrowth.reduce((a, b) => a + b, 0) / 4).toFixed(0)}%`,
                color: "#3b82f6",
              },
              { l: "固定成本總計", v: fmtFull(data.fixedBaseTotal), color: "#64748b" },
              { l: "技術架構", v: architecture === "api" ? "第三方 API" : "自建 GPU", color: architecture === "api" ? "#3b82f6" : "#a78bfa" },
            ].map((m, i) => (
              <div key={i}>
                <div style={{ color: "#94a3b8", fontSize: 9, marginBottom: 2 }}>{m.l}</div>
                <div style={{ color: m.color, fontWeight: 700 }}>{m.v}</div>
              </div>
            ))}
          </div>
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
              const suggestedPrice = Math.ceil(apiCost / 0.7); // 30% target margin
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
                    {margin < 0 && (
                      <div style={{ marginTop: 6, padding: "4px 6px", borderRadius: 4, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 9, lineHeight: 1.4 }}>
                        ⚠️ 此售價低於成本，建議最低 NT${suggestedPrice.toLocaleString()}（含 30% 毛利）
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <NumInput label="用戶平均使用率（未用完的輪數 = 額外利潤）" value={avgTurnsUsed} onChange={setAvgTurnsUsed} suffix="%" width={50} small />
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
              const suggestedPrice = Math.ceil(pack.credits * unitApiCost / 0.7);
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
                    {unitMargin < 0 && (
                      <div style={{ marginTop: 6, padding: "4px 6px", borderRadius: 4, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 9, lineHeight: 1.4 }}>
                        ⚠️ 單點售價低於成本，建議最低 NT${suggestedPrice.toLocaleString()}/包（30% 毛利）
                      </div>
                    )}
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

        {/* ===== 2. Subscription Plan Design ===== */}
        {activeTab === "sub" && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>💎</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>② 訂閱方案設計</span>
            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
              加權月費 NT${Math.round(data.wMonthlyPrice)} · 加權含輪 {Math.round(data.wIncludedTurns)}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
            {subPlans.map((plan, i) => {
              const subOn = enabled[`sub${i}`];
              const usagePct = (parseFloatSafe(subUsageRate) || 70) / 100;
              const apiCost = plan.includedTurns * usagePct * apiCostPerTurn;
              const margin = plan.monthlyPrice - apiCost;
              const marginPct = plan.monthlyPrice > 0 ? (margin / plan.monthlyPrice * 100) : 0;
              const suggestedPrice = Math.ceil(apiCost / 0.7);
              return (
                <div key={i} style={{ background: "#f8fafc", borderRadius: 12, padding: 12, border: "1px solid #e2e8f0", opacity: subOn ? 1 : 0.45 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Dot on={subOn} onClick={() => toggle(`sub${i}`)} />
                    <input value={plan.name} onChange={e => updateSubPlan(i, "name", e.target.value)} disabled={!subOn}
                      style={{ background: "transparent", border: "none", borderBottom: "1px solid #cbd5e1", color: "#1a202c", fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, padding: "2px 0 4px", outline: "none", textDecoration: subOn ? "none" : "line-through" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { l: "月費", f: "monthlyPrice", v: plan.monthlyPrice, pre: "NT$" },
                      { l: "包含輪數", f: "includedTurns", v: plan.includedTurns },
                    ].map(r => (
                      <div key={r.f} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{r.l}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                          {r.pre && <span style={{ fontSize: 10, color: "#64748b" }}>{r.pre}</span>}
                          <input value={r.v} onChange={e => updateSubPlan(i, r.f, e.target.value)}
                            style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "3px 6px", fontSize: 13, fontWeight: 600, color: "#1a202c", width: 65, textAlign: "right", outline: "none" }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: "#64748b" }}>用戶佔比</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <input value={subPlanMix[i]} onChange={e => updateSubMix(i, e.target.value)}
                          style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "3px 6px", fontSize: 13, fontWeight: 600, color: "#1a202c", width: 35, textAlign: "right", outline: "none" }} />
                        <span style={{ fontSize: 10, color: "#64748b" }}>%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, padding: "6px 0 0", borderTop: "1px solid #e2e8f0", fontSize: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ color: "#64748b" }}>API 成本（月繳）</span><span style={{ color: "#ef4444" }}>{fmt(apiCost)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>月繳毛利 (list)</span>
                      <span style={{ color: margin >= 0 ? "#34d399" : "#ef4444", fontWeight: 600 }}>{fmt(margin)} ({marginPct.toFixed(0)}%)</span>
                    </div>
                    {margin < 0 && (
                      <div style={{ marginTop: 6, padding: "4px 6px", borderRadius: 4, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 9, lineHeight: 1.4 }}>
                        ⚠️ 月費低於成本，建議最低 NT${suggestedPrice.toLocaleString()}/月（30% 毛利）
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>
            💡 上方卡片顯示的是 list price（純月繳、未套年繳折扣、不含超量加購與試用成本）。實際每用戶月毛利請看下方 KPI。
          </div>
          <NumInput label="平均使用率（未用完的輪數 = 額外利潤）" value={subUsageRate} onChange={setSubUsageRate} suffix="%" width={50} small />
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <Dot on={enabled.overage} onClick={() => toggle("overage")} />
              <span onClick={() => toggle("overage")} style={{ fontSize: 12, fontWeight: 600, color: "#64748b", cursor: "pointer", textDecoration: enabled.overage ? "none" : "line-through" }}>
                超量加購
              </span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>
                ARPU 額外貢獻 {fmtFull(Math.round(data.overageRevPerUser))}/用戶/月
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, opacity: enabled.overage ? 1 : 0.45 }}>
              <NumInput label="加購包輪數" value={overageTurns} onChange={setOverageTurns} suffix="輪" width={55} small />
              <NumInput label="加購包售價" value={overagePrice} onChange={setOveragePrice} prefix="NT$" width={55} small />
              <NumInput label="超量用戶比例" value={overageUserPct} onChange={setOverageUserPct} suffix="%" width={45} small />
              <NumInput label="平均加購數" value={overagePacksPerUser} onChange={setOveragePacksPerUser} suffix="包/月" width={45} small />
            </div>
          </div>
        </div>
        )}

        {/* ===== 3. Init users + architecture ===== */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>🎛️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>③ 初始用戶與技術架構</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
            <div>
              <NumInput label="初始付費用戶（上線第一個月）" value={initUsers} onChange={setInitUsers} suffix="人" width={80} small />
              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                {[{ l: "17", v: "17" }, { l: "50", v: "50" }, { l: "100", v: "100" }, { l: "500", v: "500" }].map(c => (
                  <Chip key={c.v} label={c.l + "人"} active={initUsers === c.v} onClick={() => setInitUsers(c.v)} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>技術架構</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setArchitecture("api")} style={{
                  flex: 1, minWidth: 140, padding: "10px 12px", borderRadius: 10,
                  border: `1px solid ${architecture === "api" ? "#3b82f6" : "#e2e8f0"}`,
                  background: architecture === "api" ? "#eff6ff" : "#ffffff",
                  color: architecture === "api" ? "#3b82f6" : "#64748b",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  textAlign: "left",
                }}>
                  <div>🌐 第三方 API</div>
                  <div style={{ fontSize: 9, fontWeight: 400, marginTop: 2 }}>OpenAI / Claude / Gemini</div>
                </button>
                <button onClick={() => setArchitecture("selfhost")} style={{
                  flex: 1, minWidth: 140, padding: "10px 12px", borderRadius: 10,
                  border: `1px solid ${architecture === "selfhost" ? "#a78bfa" : "#e2e8f0"}`,
                  background: architecture === "selfhost" ? "#f5f3ff" : "#ffffff",
                  color: architecture === "selfhost" ? "#a78bfa" : "#64748b",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  textAlign: "left",
                }}>
                  <div>🖥️ 自建推理</div>
                  <div style={{ fontSize: 9, fontWeight: 400, marginTop: 2 }}>加計 GPU 成本</div>
                </button>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
                {architecture === "api"
                  ? "單輪 API 成本已含運算費，下方 GPU 區塊會隱藏"
                  : "下方 GPU 區塊會啟用，伺服器費按活躍用戶階梯擴容"}
              </div>
            </div>
          </div>
        </div>

        {/* ===== 7. Marketing Funnel ===== */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15 }}>📣</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>⑦ 獲客成本與行銷漏斗</span>
            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
              {enabled.marketing ? `預算可觸及 ${Math.round(data.maxSignupsPerMonth).toLocaleString()} 試用/月 → ${Math.round(data.maxNewPayingFromBudget).toLocaleString()} 付費/月` : "已停用"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, opacity: enabled.marketing ? 1 : 0.45 }}>
            <NumInput label="月行銷預算" value={monthlyBudget} onChange={setMonthlyBudget} prefix="NT$" width={100} small
              on={enabled.marketing} onToggle={() => toggle("marketing")}
              tip="Google/FB 廣告、內容行銷、KOL" />
            <NumInput label="每訪客成本 (CPA)" value={cpa} onChange={setCpa} prefix="NT$" width={55} small
              tip="FB/Google 廣告 CPC NT$5-30" />
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>訪客→試用轉換率</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6" }}>{landingConversion}%</div>
              <input type="range" min={1} max={30} step={1} value={landingConversion}
                onChange={e => setLandingConversion(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#3b82f6", marginTop: 4 }} />
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>SaaS 平均 3-10%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>試用→付費轉換率</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#34d399" }}>
                {activeTab === "sub" ? trialConversion : activeTab === "credit" ? creditTrialConv : packTrialConv}%
              </div>
              <input type="range" min={1} max={100} step={1}
                value={activeTab === "sub" ? trialConversion : activeTab === "credit" ? creditTrialConv : packTrialConv}
                onChange={e => {
                  const v = Number(e.target.value);
                  if (activeTab === "sub") setTrialConversion(v);
                  else if (activeTab === "credit") setCreditTrialConv(v);
                  else setPackTrialConv(v);
                }}
                style={{ width: "100%", accentColor: "#34d399", marginTop: 4 }} />
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>SaaS 2-15%</div>
            </div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0", fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
            <span>CAC <strong style={{ color: data.ltvCacRatio >= 3 ? "#34d399" : data.ltvCacRatio >= 1 ? "#f59e0b" : "#ef4444" }}>{data.cac === Infinity ? "∞" : fmtFull(Math.round(data.cac))}</strong></span>
            {" · "}
            <span>LTV <strong style={{ color: "#3b82f6" }}>{data.ltv === Infinity ? "∞" : fmtFull(Math.round(data.ltv))}</strong></span>
            {" · "}
            <span>LTV/CAC <strong style={{
              color: data.ltvCacRatio >= 3 ? "#34d399" : data.ltvCacRatio >= 1 ? "#f59e0b" : "#ef4444",
              fontSize: 14,
            }}>{data.ltvCacRatio === Infinity ? "∞" : data.ltvCacRatio.toFixed(1)}x</strong></span>
            {" · "}
            <span>Payback <strong style={{ color: "#a78bfa" }}>{data.paybackMonths === Infinity ? "∞" : data.paybackMonths.toFixed(1) + " 月"}</strong></span>
          </div>
        </div>

        {/* ===== 8. Operating Cost Breakdown ===== */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15 }}>💰</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>⑧ 營運成本明細</span>
            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
              固定 {fmtFull(data.fixedBaseTotal)} / 月 + 變動 {(data.variableRate * 100).toFixed(1)}% 營收
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
            <NumInput label="人事成本" value={hrCost} onChange={setHrCost} prefix="NT$" width={100} small
              tip="工程師 6-12 萬、行銷 4-6 萬、客服 3-5 萬" />
            <NumInput label="辦公/雜支" value={officeCost} onChange={setOfficeCost} prefix="NT$" width={90} small
              tip="辦公空間、水電、雜支" />
            <NumInput label="第三方工具訂閱" value={toolsCost} onChange={setToolsCost} prefix="NT$" width={80} small
              tip="Slack、Notion、Analytics、監控工具" />
          </div>
          <div style={{ paddingTop: 10, borderTop: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr", gap: 10, opacity: enabled.payment ? 1 : 0.45 }}>
            <NumInput label="支付平台手續費" value={paymentFeePct} onChange={setPaymentFeePct} suffix="%" width={45} small
              on={enabled.payment} onToggle={() => toggle("payment")}
              tip="綠界 2.75%、Stripe 2.9%、LINE Pay 3%" />
            <div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>預估退款率</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444" }}>{refundRate}%</div>
              <input type="range" min={0} max={15} step={1} value={refundRate} disabled={!enabled.payment}
                onChange={e => setRefundRate(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#ef4444", marginTop: 4 }} />
              <div style={{ fontSize: 10, color: "#94a3b8" }}>台灣 7 天鑑賞期，SaaS 通常 2-5%</div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 10, color: "#94a3b8" }}>
            💡 固定成本 = 人事 + 辦公 + 工具 + 行銷預算 = {fmtFull(data.fixedBaseTotal)}/月 ｜ 變動成本 = 營收 × (手續費 + 退款率)
          </div>
        </div>

        {/* ===== 4. Churn + Repurchase / Consumption ===== */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15 }}>🔄</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>
              ④ {activeTab === "credit" ? "用戶流失與點數消耗" : activeTab === "sub" ? "用戶流失與訂閱結構" : "用戶流失與續購行為"}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
            <div style={{ opacity: enabled.churnRate ? 1 : 0.45 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                <Dot on={enabled.churnRate} onClick={() => toggle("churnRate")} />
                <span onClick={() => toggle("churnRate")} style={{ textDecoration: enabled.churnRate ? "none" : "line-through", cursor: "pointer" }}>每月流失率（Churn）</span>
              </div>
              {!useCohortChurn ? (
                <>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#ef4444" }}>{churnRate}%</div>
                  <input type="range" min={0} max={40} step={1} value={churnRate} disabled={!enabled.churnRate}
                    onChange={e => setChurnRate(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#ef4444", marginTop: 4 }} />
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {[3, 5, 8, 12, 20].map(v => (
                      <Chip key={v} label={`${v}%`} active={churnRate === v} onClick={() => setChurnRate(v)} color="#ef4444" />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <NumInput label="首月" value={firstMonthChurn} onChange={setFirstMonthChurn} suffix="%" width={40} small />
                    <NumInput label="穩定後" value={stableChurn} onChange={setStableChurn} suffix="%" width={40} small />
                  </div>
                </>
              )}
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => setUseCohortChurn(!useCohortChurn)} style={{
                  background: useCohortChurn ? "#ef4444" : "#f1f5f9",
                  color: useCohortChurn ? "#ffffff" : "#64748b",
                  border: "none", borderRadius: 6, padding: "3px 8px",
                  fontSize: 9, fontWeight: 600, cursor: "pointer",
                }}>{useCohortChurn ? "✓ 進階模式" : "進階模式"}</button>
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
                {useCohortChurn
                  ? "第 1 月首月流失、第 2 月過渡、第 3 月起穩定流失"
                  : "SaaS 平均月流失 5-8%"}
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
            ) : activeTab === "credit" ? (
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
            ) : (
              <>
                <div style={{ opacity: enabled.annual ? 1 : 0.45 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <Dot on={enabled.annual} onClick={() => toggle("annual")} />
                    <span onClick={() => toggle("annual")} style={{ textDecoration: enabled.annual ? "none" : "line-through", cursor: "pointer" }}>年繳採用率</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#a78bfa" }}>{annualAdoption}%</div>
                  <input type="range" min={0} max={100} step={1} value={annualAdoption} disabled={!enabled.annual}
                    onChange={e => setAnnualAdoption(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#a78bfa", marginTop: 4 }} />
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {[0, 15, 30, 50, 80].map(v => (
                      <Chip key={v} label={`${v}%`} active={annualAdoption === v} onClick={() => setAnnualAdoption(v)} color="#a78bfa" />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
                    多少 % 新用戶選年繳
                  </div>
                </div>
                <div style={{ opacity: enabled.annual ? 1 : 0.45 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <Dot on={enabled.annual} onClick={() => toggle("annual")} />
                    <span onClick={() => toggle("annual")} style={{ textDecoration: enabled.annual ? "none" : "line-through", cursor: "pointer" }}>年繳折扣</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#a78bfa" }}>{annualDiscount}%</div>
                  <input type="range" min={0} max={50} step={1} value={annualDiscount} disabled={!enabled.annual}
                    onChange={e => setAnnualDiscount(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#a78bfa", marginTop: 4 }} />
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {[10, 15, 20, 25, 30].map(v => (
                      <Chip key={v} label={`${v}%`} active={annualDiscount === v} onClick={() => setAnnualDiscount(v)} color="#a78bfa" />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
                    年繳折扣，2 個月免費 ≈ 17%
                  </div>
                </div>
              </>
            )}
          </div>
          {activeTab === "credit" && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 14, alignItems: "center" }}>
                <NumInput label="實際使用率（未用完的點數 = 額外利潤）" value={consumptionRate} onChange={setConsumptionRate} suffix="%" width={50} small
                  tip="100% = 買的點都用完；<100% 模擬點數浪費/過期" />
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  每用戶月營收 <span style={{ color: "#34d399", fontWeight: 700 }}>{fmtFull(Math.round(data.monthRevenuePerUser))}</span>
                  {" · "}月 API 成本 <span style={{ color: "#ef4444", fontWeight: 700 }}>{fmtFull(Math.round(data.monthApiCostPerUser))}</span>
                  {" · "}月毛利 <span style={{ color: data.creditMarginPerUser >= 0 ? "#34d399" : "#ef4444", fontWeight: 700 }}>{fmtFull(Math.round(data.creditMarginPerUser))} ({data.creditMarginPct.toFixed(0)}%)</span>
                </div>
              </div>
            </div>
          )}
          {activeTab === "sub" && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
                <NumInput label="年繳用戶月流失（鎖一年）" value={annualChurn} onChange={setAnnualChurn} suffix="%" width={45} small
                  tip="鎖約期內流失通常 1-3%" on={enabled.annual} />
                <NumInput label="新用戶體驗輪數" value={trialTurns} onChange={setTrialTurns} suffix="輪" width={50} small
                  tip="送幾輪試用，用完才算付費" on={enabled.trial} onToggle={() => toggle("trial")} />
                <div style={{ opacity: enabled.trial ? 1 : 0.45 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    <Dot on={enabled.trial} onClick={() => toggle("trial")} />
                    <span onClick={() => toggle("trial")} style={{ textDecoration: enabled.trial ? "none" : "line-through", cursor: "pointer" }}>試用轉付費率</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#34d399" }}>{trialConversion}%</div>
                  <input type="range" min={1} max={100} step={1} value={trialConversion} disabled={!enabled.trial}
                    onChange={e => setTrialConversion(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#34d399", marginTop: 4 }} />
                  <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
                    {[15, 25, 35, 50, 70].map(v => (
                      <Chip key={v} label={`${v}%`} active={trialConversion === v} onClick={() => setTrialConversion(v)} color="#34d399" />
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 10, lineHeight: 1.7 }}>
                ARPU(認列) <span style={{ color: "#a78bfa", fontWeight: 700 }}>{fmtFull(Math.round(data.subArpu))}</span>
                {" · "}月毛利 <span style={{ color: data.subMarginPerUser >= 0 ? "#34d399" : "#ef4444", fontWeight: 700 }}>{fmtFull(Math.round(data.subMarginPerUser))} ({data.subMarginPct.toFixed(0)}%)</span>
                {" · "}混合月流失 <span style={{ color: "#ef4444", fontWeight: 700 }}>{(data.blendedChurn * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>

        {/* ===== 5. Server Scaling (only when self-hosted) ===== */}
        {architecture === "selfhost" && (
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
        )}

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
            {["Q1（1-3 月，月成長率）", "Q2（4-6 月，月成長率）", "Q3（7-9 月，月成長率）", "Q4（10-12 月，月成長率）"].map((label, qi) => {
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
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
          {[
            activeTab === "sub"
              ? { label: "每用戶月毛利", value: `${fmtFull(Math.round(data.subMarginPerUser))} (${data.subMarginPct.toFixed(0)}%)`, color: data.subMarginPerUser >= 0 ? "#34d399" : "#ef4444" }
              : activeTab === "credit"
              ? { label: "每用戶月毛利", value: `${fmtFull(Math.round(data.creditMarginPerUser))} (${data.creditMarginPct.toFixed(0)}%)`, color: data.creditMarginPerUser >= 0 ? "#34d399" : "#ef4444" }
              : { label: "每次購買毛利", value: `${fmtFull(Math.round(data.grossMarginPerPurchase))} (${data.grossMarginPct.toFixed(0)}%)`, color: data.grossMarginPerPurchase >= 0 ? "#34d399" : "#ef4444" },
            {
              label: "CAC",
              value: data.cac === Infinity ? "∞" : fmtFull(Math.round(data.cac)),
              color: data.cac === Infinity ? "#ef4444" : "#f59e0b",
            },
            {
              label: "LTV",
              value: data.ltv === Infinity ? "∞" : fmtFull(Math.round(data.ltv)),
              color: "#3b82f6",
            },
            {
              label: "LTV / CAC",
              value: data.ltvCacRatio === Infinity ? "∞" : `${data.ltvCacRatio.toFixed(1)}x`,
              color: data.ltvCacRatio >= 3 ? "#34d399" : data.ltvCacRatio >= 1 ? "#f59e0b" : "#ef4444",
            },
            {
              label: "Payback (月)",
              value: data.paybackMonths === Infinity ? "∞" : data.paybackMonths.toFixed(1),
              color: data.paybackMonths <= 6 ? "#34d399" : data.paybackMonths <= 12 ? "#f59e0b" : "#ef4444",
            },
            activeTab === "sub"
              ? { label: "靜態損平衡", value: data.breakEvenUsers === Infinity ? "∞" : `${data.breakEvenUsers.toLocaleString()} 活躍訂閱`, color: "#f59e0b" }
              : activeTab === "credit"
              ? { label: "靜態損平衡", value: data.breakEvenUsers === Infinity ? "∞" : `${data.breakEvenUsers.toLocaleString()} 活躍用戶`, color: "#f59e0b" }
              : { label: "靜態損平衡", value: data.breakEvenUsers === Infinity ? "∞" : `${data.breakEvenUsers.toLocaleString()} 次購買/月`, color: "#f59e0b" },
            { label: "第 12 月活躍用戶", value: `${(data.months[11]?.activeUsers || 0).toLocaleString()} 人`, color: "#3b82f6" },
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>逐月明細</div>
            <button onClick={handleCsvExport} style={{
              background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8,
              padding: "6px 12px", fontSize: 11, fontWeight: 600, color: "#64748b",
              cursor: "pointer",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#3b82f6"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
            >📥 匯出 CSV</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, minWidth: 950 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
                  {[
                    "月份", "季/成長", "活躍", "新增",
                    activeTab === "credit" ? "點包" : activeTab === "sub" ? "新試用" : "購買",
                    ...(architecture === "selfhost" ? ["GPU"] : []),
                    "營收", "API", "固定", "行銷", "手續+退", "月損益", "累計"
                  ].map(h => (
                    <th key={h} style={{ padding: "7px 4px", textAlign: "right", color: "#94a3b8", fontWeight: 500, fontSize: 9 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.months.map(m => {
                  const qc = ["#f59e0b", "#3b82f6", "#a78bfa", "#34d399"][m.quarter - 1];
                  const pureFixed = m.monthFixedCost - m.marketingCost;
                  return (
                    <tr key={m.month} style={{ borderBottom: "1px solid #f1f5f9", background: m.month <= 3 ? "rgba(245,158,11,0.03)" : "transparent" }}>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#1a202c", fontWeight: m.month <= 3 ? 600 : 400, fontSize: 10 }}>
                        {m.month <= 3 ? `⚡${m.month}` : m.month}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <span style={{ fontSize: 9, color: qc, background: `${qc}15`, padding: "1px 5px", borderRadius: 3 }}>Q{m.quarter} +{m.growthRate}%</span>
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#3b82f6", fontWeight: 500 }}>{m.activeUsers.toLocaleString()}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#64748b" }}>+{m.newUsers.toLocaleString()}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#f59e0b" }}>{m.purchases.toLocaleString()}</td>
                      {architecture === "selfhost" && (
                        <td style={{ padding: "6px 4px", textAlign: "right", color: "#a78bfa" }}>{m.serversNeeded}</td>
                      )}
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#1a202c" }}>{fmt(m.monthRevenue)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#ef4444", opacity: 0.7 }}>{fmt(m.monthApiCost)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#ef4444", opacity: 0.5 }}>{fmt(pureFixed)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#f59e0b", opacity: 0.7 }}>{fmt(m.marketingCost)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: "#ef4444", opacity: 0.5 }}>{fmt(m.monthVariableCost)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", color: m.monthProfit >= 0 ? "#34d399" : "#ef4444", fontWeight: 600 }}>{fmt(m.monthProfit)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 700, color: m.cumProfit >= 0 ? "#34d399" : "#ef4444" }}>{fmt(m.cumProfit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 6 }}>
            ⚡ = 目標回本期 ｜
            {activeTab === "credit"
              ? " 點包 = 活躍用戶 × 月消耗點數 ÷ 加權平均點包點數"
              : activeTab === "sub"
              ? " 新試用 = 新付費 ÷ 試用轉換率（含試用後未轉換的人）"
              : " 購買 = 新用戶首購 + 舊用戶續購"}
            ｜ 固定 = 人事+辦公+工具 ｜ 行銷 = 月預算 ｜ 手續+退 = 營收 × (手續費%+退款%)
          </div>
        </div>

        {/* ===== 3-mode comparison ===== */}
        <div style={{ ...card, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#1a202c" }}>📊 三模式即時比較（基於目前參數）</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#94a3b8", fontWeight: 500, fontSize: 10 }}>指標</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#f59e0b", fontWeight: 600, fontSize: 11 }}>📦 方案計價</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#34d399", fontWeight: 600, fontSize: 11 }}>⭐ 點數計價</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#a78bfa", fontWeight: 600, fontSize: 11 }}>💎 訂閱制</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "ARPU（每用戶月營收）", key: "arpu", fmt: v => fmtFull(Math.round(v)) },
                  { label: "單用戶月毛利", key: "margin", fmt: v => fmtFull(Math.round(v)) },
                  { label: "毛利率", key: "marginPct", fmt: v => `${v.toFixed(0)}%` },
                  { label: "CAC", key: "cac", fmt: v => v === Infinity ? "∞" : fmtFull(Math.round(v)) },
                  { label: "LTV", key: "ltv", fmt: v => v === Infinity ? "∞" : fmtFull(Math.round(v)) },
                  { label: "LTV / CAC", key: "ltvCac", fmt: v => v === Infinity ? "∞" : `${v.toFixed(1)}x`, color: v => v >= 3 ? "#34d399" : v >= 1 ? "#f59e0b" : "#ef4444" },
                  { label: "損益平衡用戶數", key: "breakEven", fmt: v => v === Infinity ? "∞" : `${v.toLocaleString()}` },
                ].map(row => (
                  <tr key={row.key} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "7px 10px", color: "#64748b", fontSize: 11 }}>{row.label}</td>
                    {["pack", "credit", "sub"].map(mode => {
                      const val = data.perModeComparison[mode][row.key];
                      const color = row.color ? row.color(val) : "#1a202c";
                      const bold = activeTab === mode;
                      return (
                        <td key={mode} style={{
                          padding: "7px 10px", textAlign: "right", color,
                          fontWeight: bold ? 700 : 500,
                          background: bold ? "#f8fafc" : "transparent",
                        }}>{row.fmt(val)}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 8 }}>
            💡 目前選中的模式會以粗體高亮。LTV = 每用戶月毛利 ÷ 月流失率；CAC = 月預算 ÷ 該模式轉換後的新付費數。LTV/CAC ≥ 3x 代表單位經濟正健康。
          </div>
        </div>

        {/* ===== Scenario stress test ===== */}
        <div style={{ ...card, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#1a202c" }}>🔀 樂觀 / 基準 / 悲觀情境模擬</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#94a3b8", fontWeight: 500, fontSize: 10 }}>指標</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#34d399", fontWeight: 600, fontSize: 11 }}>🟢 樂觀</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#3b82f6", fontWeight: 600, fontSize: 11 }}>🔵 基準</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#ef4444", fontWeight: 600, fontSize: 11 }}>🔴 悲觀</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const scenarios = {
                    optimistic: { init: 1.5, growth: 1.3, churn: 0.7, trialConv: 1.3, fixed: 0.8 },
                    baseline: { init: 1, growth: 1, churn: 1, trialConv: 1, fixed: 1 },
                    pessimistic: { init: 0.5, growth: 0.5, churn: 1.5, trialConv: 0.6, fixed: 1.3 },
                  };
                  const simRun = (mul) => {
                    const marginPU = data.monthlyMarginPerUser;
                    const arpuPU = data.monthlyArpuPerUser;
                    const effFixed = data.fixedBaseTotal * mul.fixed;
                    const _churn = data.effChurnForLtv * mul.churn;
                    const _growth = (qGrowth.reduce((a, b) => a + b, 0) / 4 / 100) * mul.growth;
                    let active = (parseIntSafe(initUsers) || 0) * mul.init;
                    let cum = 0;
                    let beMonth = null;
                    for (let i = 0; i < 12; i++) {
                      if (i > 0) {
                        active = Math.max(0, active * (1 - _churn) * (1 + _growth));
                      }
                      const rev = active * arpuPU;
                      const cost = effFixed + (rev * data.variableRate) + (active * (arpuPU - marginPU));
                      cum += (rev - cost);
                      if (beMonth === null && cum >= 0) beMonth = i + 1;
                    }
                    return { active12: Math.round(active), cum12: Math.round(cum), beMonth };
                  };
                  const opt = simRun(scenarios.optimistic);
                  const base = simRun(scenarios.baseline);
                  const pes = simRun(scenarios.pessimistic);
                  const rows = [
                    { label: "第 12 月活躍用戶", val: s => `${s.active12.toLocaleString()} 人` },
                    { label: "12 月累計損益", val: s => fmt(s.cum12), color: s => s.cum12 >= 0 ? "#34d399" : "#ef4444" },
                    { label: "回本月份", val: s => s.beMonth ? `第 ${s.beMonth} 月` : "12 月內無法" },
                  ];
                  return rows.map(r => (
                    <tr key={r.label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "7px 10px", color: "#64748b", fontSize: 11 }}>{r.label}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: r.color ? r.color(opt) : "#1a202c", fontWeight: 600 }}>{r.val(opt)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: r.color ? r.color(base) : "#1a202c", fontWeight: 700, background: "#f8fafc" }}>{r.val(base)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: r.color ? r.color(pes) : "#1a202c", fontWeight: 600 }}>{r.val(pes)}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 8 }}>
            💡 樂觀情境：初始 ×1.5 / 成長 ×1.3 / 流失 ×0.7 / 試用轉換 ×1.3 / 固定成本 ×0.8。悲觀反之。此為簡化投影，只估 ARPU × 活躍用戶；完整動態（續購、年繳 cohort）仍以主要模擬為準。
          </div>
        </div>

        {/* ===== Sensitivity analysis ===== */}
        <div style={{ ...card, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#1a202c" }}>🎯 敏感性分析（各變數 ±40% 對 12 月累計損益的影響）</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #cbd5e1" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "#94a3b8", fontWeight: 500, fontSize: 10 }}>變數</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", fontWeight: 500, fontSize: 10 }}>-40%</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", fontWeight: 500, fontSize: 10 }}>-20%</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", fontWeight: 500, fontSize: 10 }}>基準</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", fontWeight: 500, fontSize: 10 }}>+20%</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", fontWeight: 500, fontSize: 10 }}>+40%</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const simRun2 = (overrides) => {
                    const marginPU = (overrides.margin ?? data.monthlyMarginPerUser);
                    const arpuPU = (overrides.arpu ?? data.monthlyArpuPerUser);
                    const effFixed = (overrides.fixed ?? data.fixedBaseTotal);
                    const _churn = (overrides.churn ?? data.effChurnForLtv);
                    const _growth = (overrides.growth ?? (qGrowth.reduce((a, b) => a + b, 0) / 4 / 100));
                    let active = (parseIntSafe(initUsers) || 0);
                    let cum = 0;
                    for (let i = 0; i < 12; i++) {
                      if (i > 0) {
                        active = Math.max(0, active * (1 - _churn) * (1 + _growth));
                      }
                      const rev = active * arpuPU;
                      const cost = effFixed + (rev * data.variableRate) + (active * (arpuPU - marginPU));
                      cum += (rev - cost);
                    }
                    return Math.round(cum);
                  };
                  const vars = [
                    { label: "每月流失率", key: "churn", base: data.effChurnForLtv, invert: true },
                    { label: "用戶成長率", key: "growth", base: qGrowth.reduce((a, b) => a + b, 0) / 4 / 100 },
                    { label: "每用戶月毛利", key: "margin", base: data.monthlyMarginPerUser },
                    { label: "固定成本", key: "fixed", base: data.fixedBaseTotal, invert: true },
                  ];
                  const baseValue = simRun2({});
                  return vars.map(v => {
                    const cells = [-0.4, -0.2, 0, 0.2, 0.4].map(delta => {
                      const mul = 1 + delta;
                      const val = simRun2({ [v.key]: v.base * mul });
                      return val;
                    });
                    return (
                      <tr key={v.label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "7px 10px", color: "#64748b", fontSize: 11 }}>{v.label}</td>
                        {cells.map((val, idx) => (
                          <td key={idx} style={{
                            padding: "7px 10px", textAlign: "right",
                            color: val >= 0 ? "#34d399" : "#ef4444",
                            fontWeight: idx === 2 ? 700 : 500,
                            background: idx === 2 ? "#f8fafc" : "transparent",
                          }}>{fmt(val)}</td>
                        ))}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 8 }}>
            💡 每一行固定其他變數，單獨調整一個變數 ±20% / ±40% 觀察對 12 月累計損益的影響。毛利率變化影響通常最大。
          </div>
        </div>

        {/* ===== Market ceiling + competitor reference ===== */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Dot on={enableMarketCeiling} onClick={() => setEnableMarketCeiling(!enableMarketCeiling)} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a202c" }}>⑨ 市場天花板（選用）</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, opacity: enableMarketCeiling ? 1 : 0.45 }}>
              <NumInput label="目標市場 (TAM)" value={tam} onChange={setTam} suffix="人" width={80} small
                tip="台灣願意月付 NT$500+ AI 工具用戶 5-20 萬" />
              <div>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>可觸及市佔 (SOM)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#a78bfa" }}>{som}%</div>
                <input type="range" min={0} max={20} step={1} value={som} disabled={!enableMarketCeiling}
                  onChange={e => setSom(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#a78bfa", marginTop: 4 }} />
              </div>
            </div>
            {enableMarketCeiling && (
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "#fef3c7", border: "1px solid #fde68a", fontSize: 11, color: "#92400e" }}>
                ⚠️ 最大可觸及 {data.marketCeiling.toLocaleString()} 人。超過此數時成長自動歸零。
              </div>
            )}
          </div>
          <div style={{ ...card, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#1a202c" }}>📊 市場定價參考</div>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.9 }}>
              <div><strong style={{ color: "#1a202c" }}>ChatGPT</strong>：免費 / Plus NT$650 / Pro NT$3,300</div>
              <div><strong style={{ color: "#1a202c" }}>Claude</strong>：免費 / Pro NT$650 / Max NT$3,300</div>
              <div><strong style={{ color: "#1a202c" }}>Gemini</strong>：免費 / Advanced NT$650</div>
              <div><strong style={{ color: "#1a202c" }}>Perplexity</strong>：免費 / Pro NT$650</div>
            </div>
            <div style={{ marginTop: 8, fontSize: 9, color: "#94a3b8", lineHeight: 1.5 }}>
              💡 你的定價需要與這些競品有明確的價值差異（例如垂直領域、中文優化、特定工作流程）。
            </div>
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
          {activeTab === "sub"
            ? " 訂閱模式：ARPU(認列) = 加權月費 × (月繳% + 年繳% × (1 − 折扣)) + 超額加購貢獻；混合月流失 = 月繳churn × 月繳% + 年繳churn × 年繳%；新付費用戶要倒推 signups（÷ 試用轉換率），signups × 體驗輪數 × 單輪成本記入當月 API 成本。"
            : activeTab === "credit"
            ? " 月營收 = 活躍用戶 × 月消耗點數 × 加權平均單點售價；API 成本依實際使用率計算（未用完的點數直接變成毛利）。"
            : " 購買次數 = 當月新增首購 + 各 cohort 依續購週期均勻觸發的回購（套用續購率，支援週期 < 1 月）。"}
          {architecture === "selfhost"
            ? `GPU 成本隨用戶數階梯增長，每滿 ${usersPerServer} 人加開一台 ${fmt(sCost)}/月。`
            : "技術架構選第三方 API，運算成本已含於單輪 API 成本，無額外 GPU 負擔。"}
          固定成本 = 人事 + 辦公 + 工具 + 行銷預算；變動成本 = 營收 × (支付手續費% + 退款率%)。
          靜態損益平衡為穩態下限；實際回本月份以「累計回本月份」為準。
        </div>
      </div>
    </div>
  );
}
