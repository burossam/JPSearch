const PREFS = Object.fromEntries(REGIONS.flatMap(r => r.prefs.map(p => [p.code, p])));

function renderLeftAccordion() {
  const container = document.getElementById("regionContainer");
  function alphaIndex(n) {
    // 0 -> A, 1 -> B ... 25 -> Z, 26 -> AA ...
    let x = Number.isFinite(n) ? Math.floor(n) : 0;
    if (x < 0) x = 0;
    let s = "";
    do {
      s = String.fromCharCode(65 + (x % 26)) + s;
      x = Math.floor(x / 26) - 1;
    } while (x >= 0);
    return s;
  }
  container.innerHTML = REGIONS.map((r, idx) => `
    <div class="region">
      <button class="regionHead" type="button" data-acc="head" data-index="${idx}">
        <span>${alphaIndex(idx)}. ${r.name}</span><span class="chev">▸</span>
      </button>
      <div class="regionBody" data-acc="body" data-index="${idx}" style="display:none;">
        ${r.prefs.map(p => `
          <label class="prefItem">
            <input type="checkbox" name="pref" value="${p.code}">
            ${p.name}
          </label>
        `).join("")}
      </div>
    </div>
  `).join("");
}

// ====== UI helpers ======
const state = {
  activeTab: "work", // work | job | ...（このデモは work/job を実装）
  selectedPrefCode: "",
  selectedArea: "all",
  selectedCities: new Set(),
  selectedJobCategoryId: "",
  selectedJobs: new Set(),
  selectedStations: new Set(),
  selectedStationArea: "all",
  selectedPrefConditions: new Set(),
  selectedEmployments: new Set(),
  selectedSalaries: new Set(),
  salaryActiveGroup: "yearly",
  salaryDesiredByGroup: {
    hourly: {
      min: "", // 最低時給
      max: "", // 最大時給
      minHoursPerDay: "",
      maxHoursPerDay: "",
      daysPerWeek: "",
      minDaysPerMonth: "",
      maxDaysPerMonth: "",
    },
    monthly: {
      min: "", // 最低（月給・万円）
      max: "", // 最大（月給・万円）
      bonusCountMin: "", // 最低ボーナス回数
      bonusCountMax: "", // 最大ボーナス回数
      bonusAmountMin: "", // 最低ボーナス金額（万円）
      bonusAmountMax: "", // 最大ボーナス金額（万円）
    },
    yearly: { min: "", max: "" },
  },
  selectedSkills: new Set(),
  // 「悪（除外）こだわり条件」専用
  selectedBadPrefConditions: new Set(),
  badPrefActiveGroup: "",
};
const $ = (sel) => document.querySelector(sel);

const cityListEl = $("#cityList");
const prefTitleEl = $("#prefTitle");
const cityCountEl = $("#cityCount");
const selectedCountEl = $("#selectedCount");
const selectedSummaryEl = $("#selectedSummary");
const citySearchEl = $("#citySearch");
const onlySelectedEl = $("#onlySelected");
const areaBarEl = $("#areaBar");
const areaLabelEl = $("#areaLabel");
const areaSelectEl = $("#areaSelect");
const areaCountEl = $("#areaCount");

const rightTitleEl = document.querySelector(".rightHead .rightTitle");
const rightToolsEl = document.querySelector(".rightHead .tools");
const onlyWrapEl = onlySelectedEl ? onlySelectedEl.closest(".onlyWrap") : null;
const areaBarHomeParentEl = areaBarEl ? areaBarEl.parentElement : null;
const areaBarHomeNextSibling = areaBarEl ? areaBarEl.nextSibling : null;
const cityCountHomeParentEl = cityCountEl ? cityCountEl.parentElement : null;
const cityCountHomeNextSibling = cityCountEl ? cityCountEl.nextSibling : null;

const stationAreaWrapEl = document.getElementById("stationAreaWrap");
const stationAreaSelectEl = document.getElementById("stationAreaSelect");

// ====== Simple tabs (station/pref/employment/salary/skill) ======
const SIMPLE_TAB_META = {
  station: {
    title: "最寄り駅",
    storageKey: "job:station_selection",
    placeholder: "駅を検索",
  },
  pref: {
    title: "こだわり条件",
    storageKey: "job:pref_selection",
    placeholder: "条件を検索",
  },
  employment: {
    title: "雇用形態",
    storageKey: "job:employment_selection",
    placeholder: "雇用形態を検索",
  },
  salary: {
    title: "手取り給料",
    storageKey: "job:salary_selection",
    placeholder: "年収を検索",
  },
  skill: {
    title: "スキル",
    storageKey: "job:skill_selection",
    placeholder: "スキルを検索",
  },
};

const STATION_AREAS = [
  { value: "all", label: "すべて" },
  { value: "aomori", label: "青森" },
  { value: "hirosaki", label: "弘前" },
  { value: "hachinohe", label: "八戸" },
];

const STATION_OPTIONS = [
  { code: "st-aomori", name: "青森駅", area: "aomori" },
  { code: "st-shin-aomori", name: "新青森駅", area: "aomori" },
  { code: "st-hirosaki", name: "弘前駅", area: "hirosaki" },
  { code: "st-hachinohe", name: "八戸駅", area: "hachinohe" },
];

function ensureStationAreaOptions() {
  if (!stationAreaSelectEl) return;
  const current = stationAreaSelectEl.value || state.selectedStationArea || "all";
  stationAreaSelectEl.innerHTML = STATION_AREAS
    .map((x) => `<option value="${x.value}">${x.label}</option>`)
    .join("");
  const exists = STATION_AREAS.some((x) => x.value === current);
  stationAreaSelectEl.value = exists ? current : "all";
  state.selectedStationArea = stationAreaSelectEl.value;
}

const PREF_GROUPS = ["働き方", "待遇", "職場環境"];
const PREF_OPTIONS = [
  { code: "pref-remote", name: "在宅OK", group: "働き方" },
  { code: "pref-flex", name: "フレックス", group: "働き方" },
  { code: "pref-side", name: "副業OK", group: "働き方" },
  { code: "pref-overtime", name: "残業少なめ", group: "働き方" },
  { code: "pref-bonus", name: "賞与あり", group: "待遇" },
  { code: "pref-raise", name: "昇給あり", group: "待遇" },
  { code: "pref-allow", name: "交通費支給", group: "待遇" },
  { code: "pref-insurance", name: "社会保険完備", group: "待遇" },
  { code: "pref-kids", name: "子育て支援", group: "職場環境" },
  { code: "pref-nonsmoke", name: "屋内禁煙", group: "職場環境" },
];

const EMPLOYMENT_OPTIONS = [
  { code: "emp-full", name: "正社員" },
  { code: "emp-contract", name: "契約社員" },
  { code: "emp-part", name: "パート・アルバイト" },
  { code: "emp-temp", name: "派遣" },
  { code: "emp-freelance", name: "業務委託" },
];

const SALARY_OPTIONS = [
  // 時給
  { code: "sal-h-1000", name: "時給1000円以上", group: "hourly" },
  { code: "sal-h-1200", name: "時給1200円以上", group: "hourly" },
  { code: "sal-h-1500", name: "時給1500円以上", group: "hourly" },
  // 月収
  { code: "sal-m-20", name: "月収20万円以上", group: "monthly" },
  { code: "sal-m-25", name: "月収25万円以上", group: "monthly" },
  { code: "sal-m-30", name: "月収30万円以上", group: "monthly" },
  // 年収
  { code: "sal-y-300", name: "年収300万以上", group: "yearly" },
  { code: "sal-y-400", name: "年収400万以上", group: "yearly" },
  { code: "sal-y-500", name: "年収500万以上", group: "yearly" },
  { code: "sal-y-600", name: "年収600万以上", group: "yearly" },
  { code: "sal-y-800", name: "年収800万以上", group: "yearly" },
];

const SALARY_GROUPS = [
  { id: "hourly", label: "時給" },
  { id: "monthly", label: "月給" },
  { id: "yearly", label: "年収" },
];

// salary：年収ゲージ（画像レイアウト用）
// 重複があると同じ文言が連続表示されるため、値はユニークにする
const YEARLY_GAUGE_AMOUNTS_MAN = Array.from({ length: 27 }, (_, i) => 200 + i * 50); // 200..1500（50刻み）

function getSalaryGroupLabel(groupId) {
  const g = (groupId || "").trim();
  return SALARY_GROUPS.find((x) => x.id === g)?.label ?? "年収";
}

function getSalaryDesiredForActiveGroup() {
  const group = state.salaryActiveGroup || "yearly";
  const base = { min: "", max: "" };
  if (!state.salaryDesiredByGroup) state.salaryDesiredByGroup = { hourly: base, monthly: base, yearly: base };
  if (!state.salaryDesiredByGroup.hourly) {
    state.salaryDesiredByGroup.hourly = {
      ...base,
      minHoursPerDay: "",
      maxHoursPerDay: "",
      daysPerWeek: "",
      minDaysPerMonth: "",
      maxDaysPerMonth: "",
    };
  } else {
    // 既存データ互換（後から項目追加した場合）
    if (typeof state.salaryDesiredByGroup.hourly.minHoursPerDay !== "string") state.salaryDesiredByGroup.hourly.minHoursPerDay = "";
    if (typeof state.salaryDesiredByGroup.hourly.maxHoursPerDay !== "string") state.salaryDesiredByGroup.hourly.maxHoursPerDay = "";
    if (typeof state.salaryDesiredByGroup.hourly.daysPerWeek !== "string") state.salaryDesiredByGroup.hourly.daysPerWeek = "";
    if (typeof state.salaryDesiredByGroup.hourly.minDaysPerMonth !== "string") state.salaryDesiredByGroup.hourly.minDaysPerMonth = "";
    if (typeof state.salaryDesiredByGroup.hourly.maxDaysPerMonth !== "string") state.salaryDesiredByGroup.hourly.maxDaysPerMonth = "";
  }
  if (!state.salaryDesiredByGroup.monthly) {
    state.salaryDesiredByGroup.monthly = {
      ...base,
      bonusCountMin: "",
      bonusCountMax: "",
      bonusAmountMin: "",
      bonusAmountMax: "",
    };
  } else {
    // 既存データ互換（後から項目追加した場合）
    if (typeof state.salaryDesiredByGroup.monthly.bonusCountMin !== "string") state.salaryDesiredByGroup.monthly.bonusCountMin = "";
    if (typeof state.salaryDesiredByGroup.monthly.bonusCountMax !== "string") state.salaryDesiredByGroup.monthly.bonusCountMax = "";
    if (typeof state.salaryDesiredByGroup.monthly.bonusAmountMin !== "string") state.salaryDesiredByGroup.monthly.bonusAmountMin = "";
    if (typeof state.salaryDesiredByGroup.monthly.bonusAmountMax !== "string") state.salaryDesiredByGroup.monthly.bonusAmountMax = "";
  }
  if (!state.salaryDesiredByGroup.yearly) state.salaryDesiredByGroup.yearly = { ...base };
  return state.salaryDesiredByGroup[group] ?? state.salaryDesiredByGroup.yearly;
}

function toNum(v) {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

function yen(n) {
  if (!Number.isFinite(n)) return "";
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

function yenRange(minV, maxV) {
  const a = (Number.isFinite(minV)) ? yen(minV) : "";
  const b = (Number.isFinite(maxV)) ? yen(maxV) : "";
  if (a && b) return `${a}〜${b}`;
  return a || b || "";
}

function calcMinDaysPerMonthFromDaysPerWeek(daysPerWeek) {
  const d = toNum(daysPerWeek);
  if (!Number.isFinite(d)) return "";
  const clamped = Math.max(0, Math.min(7, Math.floor(d)));
  return String(clamped * 4);
}

function updateSalaryEstimateUI() {
  if (state.activeTab !== "salary") return;
  const el = document.getElementById("salaryEstimate");
  if (!el) return;

  const group = state.salaryActiveGroup || "yearly";
  const desired = getSalaryDesiredForActiveGroup();
  const min = toNum(desired?.min);
  const max = toNum(desired?.max);

  if (group === "hourly") {
    // 時給は画面内テーブルで「合計月収」を直接出すため、ここでは何も出さない
    el.textContent = "";
    return;
  }

  if (group === "monthly") {
    if (!Number.isFinite(min) && !Number.isFinite(max)) {
      el.textContent = "月給（最低/最大）を入れると、年収の目安が表示されます";
      return;
    }

    const monthText = yenRange(min, max);
    const yearMin = Number.isFinite(min) ? (min * 12) : null;
    const yearMax = Number.isFinite(max) ? (max * 12) : null;
    const yearText = yenRange(yearMin, yearMax);

    el.innerHTML = `
      <div class="salaryEstimateRow"><span class="salaryEstimateKey">月収の目安</span><span class="salaryEstimateVal">${monthText || "-"}</span></div>
      <div class="salaryEstimateRow"><span class="salaryEstimateKey">年収の目安</span><span class="salaryEstimateVal">${yearText || "-"}</span></div>
    `;
    return;
  }

  // yearly は見込み不要（入力値そのもの）
  el.textContent = "";
}

function renderSalaryLeft() {
  const rc = document.getElementById("regionContainer");
  if (!rc) return;

  const active = state.salaryActiveGroup || "yearly";
  const exists = SALARY_GROUPS.some((g) => g.id === active);
  state.salaryActiveGroup = exists ? active : "yearly";

  rc.innerHTML = `
    <div class="jobCatList">
      ${SALARY_GROUPS.map((g) => {
        const isActive = (g.id === state.salaryActiveGroup);
        return `
          <button class="jobCatBtn ${isActive ? "active" : ""}" type="button" data-salary-group="${g.id}">
            <span>${g.label}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

const SKILL_OPTIONS = [
  { code: "skl-excel", name: "Excel" },
  { code: "skl-python", name: "Python" },
  { code: "skl-sql", name: "SQL" },
  { code: "skl-js", name: "JavaScript" },
  { code: "skl-sales", name: "営業" },
];

function isSimpleTab(tab) {
  return !!SIMPLE_TAB_META[tab];
}

function getSimpleOptions(tab) {
  if (tab === "station") return STATION_OPTIONS;
  if (tab === "pref") return PREF_OPTIONS;
  if (tab === "employment") return EMPLOYMENT_OPTIONS;
  if (tab === "salary") return SALARY_OPTIONS;
  if (tab === "skill") return SKILL_OPTIONS;
  return [];
}

function getSimpleSelectedSet(tab) {
  if (tab === "station") return state.selectedStations;
  if (tab === "pref") return state.selectedPrefConditions;
  if (tab === "employment") return state.selectedEmployments;
  if (tab === "salary") return state.selectedSalaries;
  if (tab === "skill") return state.selectedSkills;
  return null;
}

function simpleOptRowHTML(opt, selectedSet) {
  const checked = selectedSet?.has(opt.code) ? "checked" : "";
  const label = (typeof opt?.name === "string") ? opt.name : opt.code;
  return `
    <label class="cityItem">
      <input type="checkbox" name="simpleOpt" value="${opt.code}" ${checked} />
      <span class="cityName">${label}</span>
    </label>
  `;
}

function renderSimpleTab() {
  const tab = state.activeTab;
  const meta = SIMPLE_TAB_META[tab];
  const selectedSet = getSimpleSelectedSet(tab);
  const options = getSimpleOptions(tab);

  // workタブで移動/非表示にしたUIを戻す
  // station は「検索→エリア選択」に差し替え。
  // pref/employment/salary はツール類（検索/選択中のみ/エリア）を出さない
  const isStation = (tab === "station");
  const isSalary = (tab === "salary");
  const hideAllTools = (tab === "employment" || tab === "pref" || tab === "salary");

  if (stationAreaWrapEl) stationAreaWrapEl.style.display = (isStation && !hideAllTools) ? "" : "none";

  if (citySearchEl) {
    if (hideAllTools || isStation) {
      citySearchEl.value = "";
      citySearchEl.disabled = true;
      citySearchEl.style.display = "none";
    } else {
      citySearchEl.disabled = false;
      citySearchEl.style.display = "";
    }
  }
  if (onlySelectedEl) {
    if (hideAllTools || isStation) {
      onlySelectedEl.checked = false;
      onlySelectedEl.disabled = true;
    } else {
      onlySelectedEl.disabled = false;
    }
  }
  if (onlyWrapEl) onlyWrapEl.style.display = (hideAllTools || isStation) ? "none" : "";

  if (areaBarEl) {
    areaBarEl.hidden = true;
    if (areaBarHomeParentEl && areaBarEl.parentElement !== areaBarHomeParentEl) {
      if (areaBarHomeNextSibling) areaBarHomeParentEl.insertBefore(areaBarEl, areaBarHomeNextSibling);
      else areaBarHomeParentEl.appendChild(areaBarEl);
    }
  }
  if (cityCountEl && cityCountHomeParentEl && cityCountEl.parentElement !== cityCountHomeParentEl) {
    if (cityCountHomeNextSibling) cityCountHomeParentEl.insertBefore(cityCountEl, cityCountHomeNextSibling);
    else cityCountHomeParentEl.appendChild(cityCountEl);
  }

  setAreaCount("");

  // 見出し
  if (prefTitleEl) {
    if (tab === "salary") prefTitleEl.textContent = getSalaryGroupLabel(state.salaryActiveGroup);
    else prefTitleEl.textContent = meta?.title ?? "未選択";
  }
  // 件数はフィルタ後の表示件数に合わせる（stationのエリア/ salaryのカテゴリ等）
  if (cityCountEl) cityCountEl.textContent = "";

  if (!hideAllTools && !isStation && citySearchEl) citySearchEl.placeholder = meta?.placeholder ?? "検索";

  const q = (hideAllTools || isStation) ? "" : (citySearchEl?.value || "").trim();
  const onlySelected = (hideAllTools || isStation) ? false : !!onlySelectedEl?.checked;

  let visible = options;
  if (isStation) {
    ensureStationAreaOptions();
    const a = state.selectedStationArea || "all";
    if (a !== "all") visible = visible.filter((x) => (x?.area || "") === a);
  }
  if (isSalary) {
    const g = state.salaryActiveGroup || "yearly";
    visible = visible.filter((x) => (x?.group || "yearly") === g);
  }
  if (q) visible = visible.filter((x) => (x?.name || "").includes(q));
  if (onlySelected && selectedSet) visible = visible.filter((x) => selectedSet.has(x.code));

  if (cityCountEl) cityCountEl.textContent = `登録：${options.length}件`;
  setAreaCount(`表示：${visible.length}件`);

  const salaryRangeHTML = (() => {
    if (!isSalary) return "";
    const desired = getSalaryDesiredForActiveGroup();

    // 時給：週◯日から「1か月最低出勤日数」を自動算出
    // 週の回数が入力されている場合は、月の最低日数を (週×4) に同期する
    if (state.salaryDesiredByGroup.hourly) {
      const computed = calcMinDaysPerMonthFromDaysPerWeek(state.salaryDesiredByGroup.hourly.daysPerWeek);
      if (computed !== "") state.salaryDesiredByGroup.hourly.minDaysPerMonth = computed;
      else if (state.salaryDesiredByGroup.hourly.daysPerWeek === "") {
        // 週の入力が空なら、月の自動値も空にする
        state.salaryDesiredByGroup.hourly.minDaysPerMonth = "";
      }
    }
    const min = desired?.min ?? "";
    const max = desired?.max ?? "";
    const activeGroup = state.salaryActiveGroup || "yearly";
    const minHoursPerDay = desired?.minHoursPerDay ?? "";
    const maxHoursPerDay = desired?.maxHoursPerDay ?? "";
    const daysPerWeek = desired?.daysPerWeek ?? "";
    const minDaysPerMonth = desired?.minDaysPerMonth ?? "";
    const maxDaysPerMonth = desired?.maxDaysPerMonth ?? "";

    if (activeGroup === "hourly") {
      const minHourly = toNum(min);
      const maxHourly = toNum(max);
      const minH = toNum(minHoursPerDay);
      const maxH = toNum(maxHoursPerDay);
      const minD = toNum(minDaysPerMonth);
      const maxDRaw = toNum(maxDaysPerMonth);
      const maxD = Number.isFinite(maxDRaw) ? maxDRaw : minD;
      const monthlyMin = (Number.isFinite(minHourly) && Number.isFinite(minH) && Number.isFinite(minD)) ? (minHourly * minH * minD) : null;
      const monthlyMax = (Number.isFinite(maxHourly) && Number.isFinite(maxH) && Number.isFinite(maxD)) ? (maxHourly * maxH * maxD) : null;

      return `
        <div class="salaryRangeBox" aria-label="時給入力">
          <table class="salaryHourlyTable table table-sm table-bordered align-middle" aria-label="時給の設定">
            <thead>
              <tr>
                <th class="salaryHourlyTh">No</th>
                <th class="salaryHourlyTh">設定項目名</th>
                <th class="salaryHourlyTh">最低時給</th>
                <th class="salaryHourlyTh">最大時給</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="salaryHourlyNo">1</td>
                <td class="salaryHourlyLabel">最低時給</td>
                <td class="salaryHourlyCell">
                  <div class="salaryPickGroup" role="group" aria-label="最低時給">
                    ${[1000, 1200, 1500].map((v) => {
                      const isActive = String(min).trim() === String(v);
                      return `<button type="button" class="btn ${isActive ? "primary" : "ghost"} salaryPickBtn" data-salary-pick="min" data-salary-value="${v}">${v}円</button>`;
                    }).join("")}
                    <button type="button" class="btn ghost salaryPickBtn" data-salary-pick="min" data-salary-value="">クリア</button>
                  </div>
                </td>
                <td class="salaryHourlyCell">
                  <div class="salaryPickGroup" role="group" aria-label="最大時給">
                    ${[1000, 1200, 1500].map((v) => {
                      const isActive = String(max).trim() === String(v);
                      return `<button type="button" class="btn ${isActive ? "primary" : "ghost"} salaryPickBtn" data-salary-pick="max" data-salary-value="${v}">${v}円</button>`;
                    }).join("")}
                    <button type="button" class="btn ghost salaryPickBtn" data-salary-pick="max" data-salary-value="">クリア</button>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="salaryHourlyNo">2</td>
                <td class="salaryHourlyLabel">1日最低労働時間</td>
                <td class="salaryHourlyCell">
                  <input id="salaryMinHoursPerDay" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(minHoursPerDay).replaceAll('"', '&quot;')}" />
                </td>
                <td class="salaryHourlyCell">
                  <input id="salaryMaxHoursPerDay" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(maxHoursPerDay).replaceAll('"', '&quot;')}" />
                </td>
              </tr>
              <tr>
                <td class="salaryHourlyNo">3</td>
                <td class="salaryHourlyLabel">1週間に何日働くか？</td>
                <td class="salaryHourlyCell">
                  <input id="salaryDaysPerWeek" class="salaryRangeInput" type="number" inputmode="numeric" min="0" max="7" step="1" value="${String(daysPerWeek).replaceAll('"', '&quot;')}" />
                </td>
                <td class="salaryHourlyCell"></td>
              </tr>
              <tr>
                <td class="salaryHourlyNo">4</td>
                <td class="salaryHourlyLabel">1か月最低出勤日数</td>
                <td class="salaryHourlyCell">
                  <input id="salaryMinDaysPerMonth" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(minDaysPerMonth).replaceAll('"', '&quot;')}" readonly />
                </td>
                <td class="salaryHourlyCell"></td>
              </tr>
              <tr>
                <td class="salaryHourlyNo">5</td>
                <td class="salaryHourlyLabel">合計月収</td>
                <td class="salaryHourlyCell"><div id="salaryMonthlyMin" class="salaryHourlyResult">${monthlyMin == null ? "" : yen(monthlyMin)}</div></td>
                <td class="salaryHourlyCell"><div id="salaryMonthlyMax" class="salaryHourlyResult">${monthlyMax == null ? "" : yen(monthlyMax)}</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    if (activeGroup === "monthly") {
      // 単位は「万円」
      const bonusCountMin = desired?.bonusCountMin ?? "";
      const bonusCountMax = desired?.bonusCountMax ?? "";
      const bonusAmountMin = desired?.bonusAmountMin ?? "";
      const bonusAmountMax = desired?.bonusAmountMax ?? "";

      const minMonthlyMan = toNum(min);
      const maxMonthlyMan = toNum(max);
      const minBonusCount = toNum(bonusCountMin);
      const maxBonusCount = toNum(bonusCountMax);
      const minBonusAmountMan = toNum(bonusAmountMin);
      const maxBonusAmountMan = toNum(bonusAmountMax);

      const yearMinMan = Number.isFinite(minMonthlyMan) ? (minMonthlyMan * 12) : null;
      const yearMaxMan = Number.isFinite(maxMonthlyMan) ? (maxMonthlyMan * 12) : null;
      const bonusTotalMinMan = (Number.isFinite(minBonusCount) && Number.isFinite(minBonusAmountMan)) ? (minBonusCount * minBonusAmountMan) : null;
      const bonusTotalMaxMan = (Number.isFinite(maxBonusCount) && Number.isFinite(maxBonusAmountMan)) ? (maxBonusCount * maxBonusAmountMan) : null;
      const grandMinMan = (Number.isFinite(yearMinMan) && Number.isFinite(bonusTotalMinMan)) ? (yearMinMan + bonusTotalMinMan) : null;
      const grandMaxMan = (Number.isFinite(yearMaxMan) && Number.isFinite(bonusTotalMaxMan)) ? (yearMaxMan + bonusTotalMaxMan) : null;

      const fmtMan = (n) => (Number.isFinite(n) ? (Math.round(n * 10) / 10).toLocaleString("ja-JP") : "");

      return `
        <div class="salaryRangeBox" aria-label="月給入力">
          <table class="salaryMonthlyTable table table-sm table-bordered align-middle" aria-label="月給の設定">
            <thead>
              <tr>
                <th class="salaryMonthlyUnit" colspan="4">単位（万円）</th>
              </tr>
              <tr>
                <th class="salaryMonthlyTh salaryMonthlyNo" scope="col">No.</th>
                <th class="salaryMonthlyTh" scope="col">内容</th>
                <th class="salaryMonthlyTh" scope="col">最大</th>
                <th class="salaryMonthlyTh" scope="col">最低</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="salaryMonthlyCell salaryMonthlyNo">1</td>
                <td class="salaryMonthlyCell">希望月給</td>
                <td class="salaryMonthlyCell">
                  <input id="salaryMax" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(max).replaceAll('"', '&quot;')}" />
                </td>
                <td class="salaryMonthlyCell">
                  <input id="salaryMin" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(min).replaceAll('"', '&quot;')}" />
                </td>
              </tr>
              <tr>
                <td class="salaryMonthlyCell salaryMonthlyNo">2</td>
                <td class="salaryMonthlyCell">年収</td>
                <td class="salaryMonthlyCell"><div id="salaryMonthlyYearMax" class="salaryMonthlyResult">${fmtMan(yearMaxMan)}</div></td>
                <td class="salaryMonthlyCell"><div id="salaryMonthlyYearMin" class="salaryMonthlyResult">${fmtMan(yearMinMan)}</div></td>
              </tr>
              <tr>
                <td class="salaryMonthlyCell salaryMonthlyNo">3</td>
                <td class="salaryMonthlyCell">ボーナス回数</td>
                <td class="salaryMonthlyCell">
                  <input id="salaryMonthlyBonusCountMax" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(bonusCountMax).replaceAll('"', '&quot;')}" />
                </td>
                <td class="salaryMonthlyCell">
                  <input id="salaryMonthlyBonusCountMin" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(bonusCountMin).replaceAll('"', '&quot;')}" />
                </td>
              </tr>
              <tr>
                <td class="salaryMonthlyCell salaryMonthlyNo">4</td>
                <td class="salaryMonthlyCell">ボーナス金額</td>
                <td class="salaryMonthlyCell">
                  <input id="salaryMonthlyBonusAmountMax" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(bonusAmountMax).replaceAll('"', '&quot;')}" />
                </td>
                <td class="salaryMonthlyCell">
                  <input id="salaryMonthlyBonusAmountMin" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(bonusAmountMin).replaceAll('"', '&quot;')}" />
                </td>
              </tr>
              <tr>
                <td class="salaryMonthlyCell salaryMonthlyNo">5</td>
                <td class="salaryMonthlyCell">金額合計</td>
                <td class="salaryMonthlyCell"><div id="salaryMonthlyGrandMax" class="salaryMonthlyResult">${fmtMan(grandMaxMan)}</div></td>
                <td class="salaryMonthlyCell"><div id="salaryMonthlyGrandMin" class="salaryMonthlyResult">${fmtMan(grandMinMan)}</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }

    if (activeGroup === "yearly") {
      // 単位は「万円」
      const minMan = toNum(min);
      const maxMan = toNum(max);
      const minPick = Number.isFinite(minMan) ? String(Math.round(minMan)) : "";
      const maxPick = Number.isFinite(maxMan) ? String(Math.round(maxMan)) : "";

      const fmt = (n) => (Number.isFinite(n) ? String(Math.round(n)).toLocaleString("ja-JP") : "");

      const rows = YEARLY_GAUGE_AMOUNTS_MAN.map((amountMan, idx) => {
        const n = idx + 1;
        const a = amountMan;
        const b = amountMan;
        const aStr = (a != null) ? String(a) : "";
        const bStr = (b != null) ? String(b) : "";
        const isMinChecked = aStr && (aStr === minPick);
        const isMaxChecked = bStr && (bStr === maxPick);
        return `
          <tr>
            <td class="salaryYearlyCell salaryYearlyNo">${n}</td>
            <td class="salaryYearlyCell">
              ${aStr ? `
                <label class="salaryYearlyPick">
                  <input type="checkbox" name="salaryYearlyMinPick" value="${aStr}" ${isMinChecked ? "checked" : ""} />
                  <span>${fmt(a)}万円以上</span>
                </label>
              ` : ""}
            </td>
            <td class="salaryYearlyCell salaryYearlyCount"></td>
            <td class="salaryYearlyCell">
              ${bStr ? `
                <label class="salaryYearlyPick">
                  <input type="checkbox" name="salaryYearlyMaxPick" value="${bStr}" ${isMaxChecked ? "checked" : ""} />
                  <span>${fmt(b)}万円まで</span>
                </label>
              ` : ""}
            </td>
            <td class="salaryYearlyCell salaryYearlyCount"></td>
          </tr>
        `;
      }).join("");

      return `
        <div class="salaryRangeBox" aria-label="年収入力">
          <table class="salaryYearlyDesiredTable table table-sm table-bordered align-middle" aria-label="希望年収金額">
            <thead>
              <tr>
                <th class="salaryYearlyUnit" colspan="3">希望年収金額　単位（万円）</th>
              </tr>
              <tr>
                <th class="salaryYearlyTh salaryYearlyNo" scope="col">No.</th>
                <th class="salaryYearlyTh" scope="col">最低</th>
                <th class="salaryYearlyTh" scope="col">最大</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="salaryYearlyCell salaryYearlyNo">1</td>
                <td class="salaryYearlyCell">
                  <div class="salaryYearlyInputWrap">
                    <input id="salaryMin" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(min).replaceAll('"', '&quot;')}" />
                    <span class="salaryYearlySuffix">以上</span>
                  </div>
                </td>
                <td class="salaryYearlyCell">
                  <div class="salaryYearlyInputWrap">
                    <input id="salaryMax" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(max).replaceAll('"', '&quot;')}" />
                    <span class="salaryYearlySuffix">まで</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="salaryYearlyNote">希望の年収金額にチェックしてください</div>

          <div class="salaryYearlyGaugeWrap" aria-label="年収ゲージ（スクロール）">
            <table class="salaryYearlyGaugeTable table table-sm table-bordered align-middle" aria-label="年収ゲージ">
              <thead>
                <tr>
                  <th class="salaryYearlyTh salaryYearlyNo" scope="col">No.</th>
                  <th class="salaryYearlyTh" scope="col">最低</th>
                  <th class="salaryYearlyTh" scope="col">件数</th>
                  <th class="salaryYearlyTh" scope="col">最大</th>
                  <th class="salaryYearlyTh" scope="col">件数</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    return `
      <div class="salaryRangeBox" aria-label="希望額設定">
        <div class="salaryRangeRow">
          <span class="salaryRangeLabel">最低希望額</span>
          <input id="salaryMin" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(min).replaceAll('"', '&quot;')}" />
        </div>
        <div class="salaryRangeRow">
          <span class="salaryRangeLabel">最大希望額</span>
          <input id="salaryMax" class="salaryRangeInput" type="number" inputmode="numeric" min="0" step="1" value="${String(max).replaceAll('"', '&quot;')}" />
        </div>
        <div id="salaryEstimate" class="salaryEstimate"></div>
      </div>
    `;
  })();

  // salary（手取り給料）は、チェックボックス＋文言リスト自体を表示しない（要件）
  const listHTML = isSalary
    ? ""
    : (visible.length
        ? visible.map((x) => simpleOptRowHTML(x, selectedSet)).join("")
        : `<div class="empty">該当なし</div>`);

  cityListEl.innerHTML = `${salaryRangeHTML}${listHTML}`;

  if (isSalary) updateSalaryEstimateUI();

  // footer summary
  updateSelectedCount();
  updateSummary();
}

let prefSelectAllEl = null;

function ensurePrefSelectAllUI() {
  if (!rightTitleEl) return;
  if (prefSelectAllEl) return;

  const label = document.createElement("label");
  label.className = "prefAllPick";
  label.innerHTML = `<input id="prefSelectAll" type="checkbox" />`;
  rightTitleEl.prepend(label);
  prefSelectAllEl = label.querySelector("#prefSelectAll");
}

function updatePrefSelectAllUI(prefCode) {
  ensurePrefSelectAllUI();
  if (!prefSelectAllEl) return;

  if (!prefCode) {
    prefSelectAllEl.checked = false;
    prefSelectAllEl.disabled = true;
    return;
  }

  const pool = getPoolForPref(prefCode);
  const allSelected = pool.length > 0 && pool.every((c) => isCitySelected(prefCode, c.code));
  prefSelectAllEl.checked = allSelected;
  prefSelectAllEl.disabled = pool.length === 0;
}

const modalEl = document.querySelector(".modal");
const leftTitleEl = document.getElementById("leftTitle");
const leftHelpEl = document.getElementById("leftHelp");

const ENTRY_URL = "./work_location_modal_demo_entry.html";

function toPlainTextLabel(value) {
  if (typeof value !== "string") return "";
  if (!value.includes("<")) return value;
  const div = document.createElement("div");
  div.innerHTML = value;
  for (const ruby of Array.from(div.querySelectorAll("ruby"))) {
    const rb = ruby.querySelector("rb");
    ruby.replaceWith(document.createTextNode((rb?.textContent || "").trim()));
  }
  return (div.textContent || "").trim();
}

function cityKey(prefCode, cityCode) {
  return `${prefCode}:${cityCode}`;
}

function isCitySelected(prefCode, cityCode) {
  return state.selectedCities.has(cityKey(prefCode, cityCode));
}

function setCitySelected(prefCode, cityCode, selected) {
  const key = cityKey(prefCode, cityCode);
  if (selected) state.selectedCities.add(key);
  else state.selectedCities.delete(key);
}

function clearPrefSelections(prefCode) {
  if (!prefCode) return;
  const prefix = `${prefCode}:`;
  for (const key of Array.from(state.selectedCities)) {
    if (key.startsWith(prefix)) state.selectedCities.delete(key);
  }
}

function getPoolForPref(prefCode) {
  if (prefCode === "01") {
    const pool = [];
    pool.push(...SAPPORO_WARDS);
    for (const area of Object.keys(HOKKAIDO_GROUPED)) {
      for (const bureauRaw of Object.keys(HOKKAIDO_GROUPED[area])) {
        pool.push(...HOKKAIDO_GROUPED[area][bureauRaw]);
      }
    }
    return pool;
  }
  if (prefCode === "02") {
    const pool = [];
    pool.push(...AOMORI_AOMORI_CITY_AREAS);
    for (const areaName of Object.keys(AOMORI_GROUPED)) {
      const districts = AOMORI_GROUPED[areaName];
      for (const dName of Object.keys(districts)) pool.push(...districts[dName]);
    }
    return pool;
  }
  if (prefCode === "03") return Object.values(IWATE_GROUPED).flat();
  if (prefCode === "04") return Object.values(MIYAGI_GROUPED).flat();
  if (prefCode === "05") return [...AKITA_AKITA_CITY_AREAS, ...AKITA_MUNICIPALITIES];
  if (prefCode === "06") return [...YAMAGATA_YAMAGATA_CITY_AREAS, ...YAMAGATA_MUNICIPALITIES];
  if (prefCode === "07") return [...FUKUSHIMA_FUKUSHIMA_CITY_AREAS, ...FUKUSHIMA_MUNICIPALITIES];
  if (prefCode === "08") return [...IBARAKI_ALL_CITIES];
  if (prefCode === "09") return [...TOCHIGI_ALL_CITIES];
  if (prefCode === "10") return [...GUNMA_ALL_CITIES];
  if (prefCode === "11") {
    const wardsRaw = Array.isArray(SAITAMA_SAITAMA_CITY_WARDS) ? SAITAMA_SAITAMA_CITY_WARDS : [];
    const otherWardsRaw = wardsRaw.filter((c) => c?.code !== "11103" && c?.code !== "11107");
    const omiyaAreasRaw = Array.isArray(SAITAMA_OMIYA_AREAS) ? SAITAMA_OMIYA_AREAS : [];
    const urawaAreasRaw = Array.isArray(SAITAMA_URAWA_AREAS) ? SAITAMA_URAWA_AREAS : [];

    const grouped = (typeof SAITAMA_GROUPED === "object" && SAITAMA_GROUPED) ? SAITAMA_GROUPED : {};
    const groupOrder = ["埼玉東部", "埼玉西武", "埼玉南部", "埼玉北部", "秩父地域"];
    const others = [];
    for (const gName of groupOrder) {
      const raw = Array.isArray(grouped[gName]) ? grouped[gName] : [];
      others.push(...raw);
    }

    return [...otherWardsRaw, ...omiyaAreasRaw, ...urawaAreasRaw, ...others];
  }
  if (prefCode === "13") return [...TOKYO_ALL_CITIES];
  if (prefCode === "14") return [...KANAGAWA_ALL_CITIES];
  return [];
}

function renderSaitama() {
  const blocks = [];
  const wardsRaw = Array.isArray(SAITAMA_SAITAMA_CITY_WARDS) ? SAITAMA_SAITAMA_CITY_WARDS : [];
  const otherWardsRaw = wardsRaw.filter((c) => c?.code !== "11103" && c?.code !== "11107");
  const omiyaAreasRaw = Array.isArray(SAITAMA_OMIYA_AREAS) ? SAITAMA_OMIYA_AREAS : [];
  const urawaAreasRaw = Array.isArray(SAITAMA_URAWA_AREAS) ? SAITAMA_URAWA_AREAS : [];
  const grouped = (typeof SAITAMA_GROUPED === "object" && SAITAMA_GROUPED) ? SAITAMA_GROUPED : {};
  const groupOrder = ["埼玉東部", "埼玉西武", "埼玉南部", "埼玉北部", "秩父地域"];

  const areaKey = state.selectedArea || "all";
  const isWardArea = (areaKey === "大宮区" || areaKey === "浦和区");
  const showSaitamaCity = (areaKey === "all");
  const showOmiya = (areaKey === "all" || areaKey === "大宮区");
  const showUrawa = (areaKey === "all" || areaKey === "浦和区");

  const otherWardsVisible = showSaitamaCity ? applyFilters(otherWardsRaw) : [];
  const omiyaAreasVisible = showOmiya ? applyFilters(omiyaAreasRaw) : [];
  const urawaAreasVisible = showUrawa ? applyFilters(urawaAreasRaw) : [];

  const targetGroups = (areaKey === "all") ? groupOrder : isWardArea ? [] : groupOrder.filter((x) => x === areaKey);

  let visibleTotal = 0;
  visibleTotal += otherWardsVisible.length;
  visibleTotal += omiyaAreasVisible.length;
  visibleTotal += urawaAreasVisible.length;

  // さいたま市：区（大宮区は町丁目で別枠にする）
  if (showSaitamaCity) {
    const saitamaCityPoolRaw = [...otherWardsRaw, ...omiyaAreasRaw, ...urawaAreasRaw];
    const wardsAllSelected = saitamaCityPoolRaw.length > 0 && saitamaCityPoolRaw.every((c) => isCitySelected("11", c.code));
    const wardsAllChecked = wardsAllSelected ? "checked" : "";
    const saitamaVisibleCount = otherWardsVisible.length + omiyaAreasVisible.length + urawaAreasVisible.length;

    blocks.push(
      `<div class="cityBox">` +
        `<div class="cityBoxHead">` +
          `<label class="cityBoxPick">` +
            `<input class="saitamaCitySelectAll" type="checkbox" ${wardsAllChecked} />` +
            `<span>さいたま市</span>` +
          `</label>` +
          `<span class="badge">${saitamaVisibleCount}件</span>` +
        `</div>` +
        `<div class="cityGroupGrid cityGroupGrid--3col">` +
          otherWardsVisible.map(cityRowHTML).join("") +
        `</div>` +
      `</div>`
    );
  }

  // 大宮区：町丁目
  if (omiyaAreasVisible.length) {
    const omiyaAllSelected = omiyaAreasRaw.length > 0 && omiyaAreasRaw.every((c) => isCitySelected("11", c.code));
    const omiyaAllChecked = omiyaAllSelected ? "checked" : "";
    blocks.push(
      `<div class="cityBox">` +
        `<div class="cityBoxHead">` +
          `<label class="cityBoxPick">` +
            `<input class="omiyaAreaSelectAll" type="checkbox" ${omiyaAllChecked} />` +
            `<span>大宮区</span>` +
          `</label>` +
          `<span class="badge">${omiyaAreasVisible.length}件</span>` +
        `</div>` +
        `<div class="cityGroupGrid cityGroupGrid--3col">` +
          omiyaAreasVisible.map(cityRowHTML).join("") +
        `</div>` +
      `</div>`
    );
  }

  // 浦和区：町名
  if (urawaAreasVisible.length) {
    const urawaAllSelected = urawaAreasRaw.length > 0 && urawaAreasRaw.every((c) => isCitySelected("11", c.code));
    const urawaAllChecked = urawaAllSelected ? "checked" : "";
    blocks.push(
      `<div class="cityBox">` +
        `<div class="cityBoxHead">` +
          `<label class="cityBoxPick">` +
            `<input class="urawaAreaSelectAll" type="checkbox" ${urawaAllChecked} />` +
            `<span>浦和区</span>` +
          `</label>` +
          `<span class="badge">${urawaAreasVisible.length}件</span>` +
        `</div>` +
        `<div class="cityGroupGrid cityGroupGrid--3col">` +
          urawaAreasVisible.map(cityRowHTML).join("") +
        `</div>` +
      `</div>`
    );
  }

  // さいたま市以外：指定の5区分で表示（エリア選択に応じて絞り込み）
  for (const gName of targetGroups) {
    const raw = Array.isArray(grouped[gName]) ? grouped[gName] : [];
    if (raw.length === 0) continue;
    const visible = applyFilters(raw);
    if (visible.length === 0) continue;

    visibleTotal += visible.length;

    blocks.push(
      `<div class="sectionTitleRow">` +
        `<span class="areaHeaderTitle">${gName}</span>` +
        `<span class="badge">${visible.length}件</span>` +
      `</div>`
    );
    blocks.push(
      `<div class="cityGroupGrid cityGroupGrid--3col">` +
        visible.map(cityRowHTML).join("") +
      `</div>`
    );
  }

  if (cityListEl) cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;

  if (cityCountEl) {
    const registered = new Set();
    for (const c of otherWardsRaw) registered.add(c.code);
    for (const c of omiyaAreasRaw) registered.add(c.code);
    for (const c of urawaAreasRaw) registered.add(c.code);
    for (const gName of groupOrder) {
      const raw = Array.isArray(grouped[gName]) ? grouped[gName] : [];
      for (const c of raw) registered.add(c.code);
    }
    cityCountEl.textContent = `登録：${registered.size}件`;
  }

  setAreaCount(`表示：${visibleTotal}件`);
}

const AREA_OPTIONS_BY_PREF = {
  "01": [
    { value: "all", label: "すべて" },
    { value: "sapporo", label: "札幌市（10区）" },
    { value: "doto", label: "道東" },
    { value: "dohoku", label: "道北" },
    { value: "dochuo", label: "道央" },
    { value: "donan", label: "道南" },
  ],
  "02": [
    { value: "all", label: "すべて" },
    { value: "aomori_city", label: "青森市（街・エリア）" },
    { value: "tsugaru", label: "津軽" },
    { value: "nanbu", label: "南部" },
    { value: "shimokita", label: "下北" },
  ],
  "03": [
    { value: "all", label: "すべて" },
    { value: "県北", label: "県北" },
    { value: "県央", label: "県央" },
    { value: "沿岸", label: "沿岸" },
    { value: "県南", label: "県南" },
  ],
  "04": [
    { value: "all", label: "すべて" },
    { value: "仙台", label: "仙台" },
    { value: "松島", label: "松島" },
    { value: "三陸", label: "三陸" },
    { value: "県北", label: "県北" },
    { value: "県南", label: "県南" },
  ],
  "05": [
    { value: "all", label: "すべて" },
    { value: "秋田市", label: "秋田市" },
    { value: "県北", label: "県北" },
    { value: "県央", label: "県央" },
    { value: "県南", label: "県南" },
  ],
  "06": [
    { value: "all", label: "すべて" },
    { value: "山形市", label: "山形市" },
    { value: "村山", label: "村山" },
    { value: "置賜", label: "置賜" },
    { value: "庄内", label: "庄内" },
    { value: "最上", label: "最上" },
  ],
  "07": [
    { value: "all", label: "すべて" },
    { value: "福島市", label: "福島市" },
    { value: "中通り", label: "中通り" },
    { value: "浜通り", label: "浜通り" },
    { value: "会津", label: "会津" },
  ],
  "08": [
    { value: "all", label: "すべて" },
    { value: "水戸", label: "水戸" },
    { value: "つくば", label: "つくば" },
    { value: "日立", label: "日立" },
    { value: "県央", label: "県央" },
    { value: "県北", label: "県北" },
    { value: "県南西部", label: "県南西部" },
    { value: "県南東部", label: "県南東部" },
    { value: "鹿行", label: "鹿行" },
  ],
  "14": [
    { value: "all", label: "すべて" },
    { value: "横浜地域", label: "横浜地域" },
    { value: "川崎地域", label: "川崎地域" },
    { value: "相模原地域", label: "相模原地域" },
    { value: "県央地域", label: "神奈川県央地域" },
    { value: "横須賀三浦地域", label: "横須賀三浦地域" },
    { value: "湘南地域", label: "湘南地域" },
    { value: "県西地域", label: "神奈川県西地域" },
  ],
  "10": [
    { value: "all", label: "すべて" },
    { value: "前橋市", label: "前橋市" },
    { value: "高崎市", label: "高崎市" },
    { value: "太田市", label: "太田市" },
    { value: "伊勢崎市", label: "伊勢崎市" },
    { value: "桐生市", label: "桐生市" },
    { value: "中毛", label: "中毛" },
    { value: "西毛", label: "西毛" },
    { value: "東毛", label: "東毛" },
    { value: "北毛", label: "北毛" },
  ],
  "11": [
    { value: "all", label: "すべて" },
    { value: "大宮区", label: "さいたま市 大宮区" },
    { value: "浦和区", label: "さいたま市 浦和区" },
    { value: "埼玉東部", label: "埼玉東部" },
    { value: "埼玉西武", label: "埼玉西武" },
    { value: "埼玉南部", label: "埼玉南部" },
    { value: "埼玉北部", label: "埼玉北部" },
    { value: "秩父地域", label: "秩父地域" },
  ],
  "13": [
    { value: "all", label: "すべて" },
    { value: "すべての東京２３区", label: "すべての東京２３区" },
    { value: "渋谷区", label: "渋谷区" },
    { value: "品川区", label: "品川区" },
    { value: "新宿区", label: "新宿区" },
    { value: "港区", label: "港区" },
    { value: "千代田区", label: "千代田区" },
    { value: "豊島区", label: "豊島区" },
    { value: "中央区", label: "中央区" },
    { value: "文京区", label: "文京区" },
    { value: "目黒区", label: "目黒区" },
    { value: "世田谷区", label: "世田谷区" },
    { value: "中野区", label: "中野区" },
    { value: "杉並区", label: "杉並区" },
    { value: "大田区", label: "大田区" },
    { value: "江東区", label: "江東区" },
    { value: "その他の２３区", label: "その他の２３区" },
    { value: "多摩市", label: "多摩市" },
    { value: "八王子市", label: "八王子市" },
    { value: "立川市", label: "立川市" },
    { value: "武蔵野市", label: "武蔵野市" },
    { value: "府中市", label: "府中市" },
    { value: "三鷹市", label: "三鷹市" },
    { value: "町田市", label: "町田市" },
    { value: "日野市", label: "日野市" },
    { value: "青梅市", label: "青梅市" },
    { value: "昭島市", label: "昭島市" },
  ],
};

function renderKanagawa() {
  function kanagawaAreaDisplayName(areaName) {
    if (areaName === "県央地域") return "神奈川県央地域";
    if (areaName === "県西地域") return "神奈川県西地域";
    return areaName;
  }

  const blocks = [];
  let visibleTotal = 0;

  const areaKey = state.selectedArea || "all";

  // 上から「横浜市 → 川崎市 → 相模原市」になるように枠順を調整
  const areaOrder = ["横浜地域", "川崎地域", "相模原地域", "県央地域", "横須賀三浦地域", "湘南地域", "県西地域"];
  const chosenAreas = (areaKey === "all") ? areaOrder : [areaKey];

  for (const areaName of chosenAreas) {
    const citiesAll = KANAGAWA_GROUPED[areaName] ?? [];
    const areaTitle = kanagawaAreaDisplayName(areaName);

    // 「横浜地域」は「横浜市」枠を作り、その中に18区（市区町村）を表示する
    if (areaName === "横浜地域") {
      const nishiTownsRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14103-"));
      const nishiTownsVisible = applyFilters(nishiTownsRaw);

      const nakaTownsRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14104-"));
      const nakaTownsVisible = applyFilters(nakaTownsRaw);

      const kanagawaTownsRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14102-"));
      const kanagawaTownsVisible = applyFilters(kanagawaTownsRaw);

      const wardsRaw = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14100") return false;
        if (code === "14102") return false; // 神奈川区は「横浜市神奈川区」枠へ分離
        if (typeof code === "string" && code.startsWith("14102-")) return false;
        if (code === "14103") return false; // 西区は「横浜市西区」枠へ分離
        if (typeof code === "string" && code.startsWith("14103-")) return false;
        if (code === "14104") return false; // 中区は「横浜市中区」枠へ分離
        if (typeof code === "string" && code.startsWith("14104-")) return false;
        return true;
      });
      const wardsVisible = applyFilters(wardsRaw);

      const areaVisibleTotal = wardsVisible.length + nishiTownsVisible.length + nakaTownsVisible.length + kanagawaTownsVisible.length;
      visibleTotal += areaVisibleTotal;

      const areaPoolRaw = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14100") return false;
        if (code === "14102") return false;
        if (code === "14103") return false;
        if (code === "14104") return false;
        return true;
      });
      const areaAllSelected = areaPoolRaw.length > 0 && areaPoolRaw.every((c) => isCitySelected("14", c.code));
      const areaAllChecked = areaAllSelected ? "checked" : "";

      const kanagawaAllSelected = kanagawaTownsRaw.length > 0 && kanagawaTownsRaw.every((c) => isCitySelected("14", c.code));
      const kanagawaAllChecked = kanagawaAllSelected ? "checked" : "";

      const nishiAllSelected = nishiTownsRaw.length > 0 && nishiTownsRaw.every((c) => isCitySelected("14", c.code));
      const nishiAllChecked = nishiAllSelected ? "checked" : "";

      const nakaAllSelected = nakaTownsRaw.length > 0 && nakaTownsRaw.every((c) => isCitySelected("14", c.code));
      const nakaAllChecked = nakaAllSelected ? "checked" : "";

      const wardsAllSelected = wardsRaw.length > 0 && wardsRaw.every((c) => isCitySelected("14", c.code));
      const wardsAllChecked = wardsAllSelected ? "checked" : "";

      blocks.push(
        `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
          `<span class="areaHeaderLeft">` +
            `<label class="areaPick">` +
              `<input class="kanagawaAreaSelectAll" type="checkbox" data-area="${areaName}" ${areaAllChecked} />` +
            `</label>` +
          `</span>` +
          `<span class="areaHeaderTitle">${areaTitle}</span>` +
          `<span class="badge">${areaVisibleTotal}件</span>` +
        `</div>`
      );

      if (areaVisibleTotal === 0) {
        blocks.push(`<div class="empty">該当なし</div>`);
        continue;
      }

      if (nishiTownsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="yokohama_nishi" ${nishiAllChecked} />` +
                `<span>横浜市西区</span>` +
              `</label>` +
              `<span class="badge">${nishiTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              nishiTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (nakaTownsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="yokohama_naka" ${nakaAllChecked} />` +
                `<span>横浜市中区</span>` +
              `</label>` +
              `<span class="badge">${nakaTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              nakaTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (kanagawaTownsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="yokohama_kanagawa" ${kanagawaAllChecked} />` +
                `<span>横浜市神奈川区</span>` +
              `</label>` +
              `<span class="badge">${kanagawaTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              kanagawaTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (wardsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="yokohama" ${wardsAllChecked} />` +
                `<span>横浜市</span>` +
              `</label>` +
              `<span class="badge">${wardsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              wardsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }
      continue;
    }

    // 「川崎地域」は「川崎市」枠を作り、その中に7区を表示する
    if (areaName === "川崎地域") {
      const kawasakiWardTownsRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14131-"));
      const kawasakiWardTownsVisible = applyFilters(kawasakiWardTownsRaw);

      const saiwaikuTownsRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14132-"));
      const saiwaikuTownsVisible = applyFilters(saiwaikuTownsRaw);

      const nakaharaTownsRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14133-"));
      const nakaharaTownsVisible = applyFilters(nakaharaTownsRaw);

      const wardsRaw = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14130") return false;
        if (code === "14131") return false; // 川崎区は「川崎市川崎区」枠へ分離
        if (typeof code === "string" && code.startsWith("14131-")) return false;
        if (code === "14132") return false; // 幸区は「川崎市幸区」枠へ分離
        if (typeof code === "string" && code.startsWith("14132-")) return false;
        if (code === "14133") return false; // 中原区は「川崎市中原区」枠へ分離
        if (typeof code === "string" && code.startsWith("14133-")) return false;
        return true;
      });
      const wardsVisible = applyFilters(wardsRaw);

      const areaVisibleTotal = wardsVisible.length + kawasakiWardTownsVisible.length + saiwaikuTownsVisible.length + nakaharaTownsVisible.length;
      visibleTotal += areaVisibleTotal;

      const areaPoolRaw = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14130") return false;
        if (code === "14131") return false;
        if (code === "14132") return false;
        if (code === "14133") return false;
        return true;
      });
      const areaAllSelected = areaPoolRaw.length > 0 && areaPoolRaw.every((c) => isCitySelected("14", c.code));
      const areaAllChecked = areaAllSelected ? "checked" : "";

      const kawasakiWardAllSelected = kawasakiWardTownsRaw.length > 0 && kawasakiWardTownsRaw.every((c) => isCitySelected("14", c.code));
      const kawasakiWardAllChecked = kawasakiWardAllSelected ? "checked" : "";

      const saiwaikuAllSelected = saiwaikuTownsRaw.length > 0 && saiwaikuTownsRaw.every((c) => isCitySelected("14", c.code));
      const saiwaikuAllChecked = saiwaikuAllSelected ? "checked" : "";

      const nakaharaAllSelected = nakaharaTownsRaw.length > 0 && nakaharaTownsRaw.every((c) => isCitySelected("14", c.code));
      const nakaharaAllChecked = nakaharaAllSelected ? "checked" : "";

      const wardsAllSelected = wardsRaw.length > 0 && wardsRaw.every((c) => isCitySelected("14", c.code));
      const wardsAllChecked = wardsAllSelected ? "checked" : "";

      blocks.push(
        `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
          `<span class="areaHeaderLeft">` +
            `<label class="areaPick">` +
              `<input class="kanagawaAreaSelectAll" type="checkbox" data-area="${areaName}" ${areaAllChecked} />` +
            `</label>` +
          `</span>` +
          `<span class="areaHeaderTitle">${areaTitle}</span>` +
          `<span class="badge">${areaVisibleTotal}件</span>` +
        `</div>`
      );

      if (areaVisibleTotal === 0) {
        blocks.push(`<div class="empty">該当なし</div>`);
        continue;
      }

      if (kawasakiWardTownsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="kawasaki_kawasaki" ${kawasakiWardAllChecked} />` +
                `<span>川崎市川崎区</span>` +
              `</label>` +
              `<span class="badge">${kawasakiWardTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              kawasakiWardTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (saiwaikuTownsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="kawasaki_saiwai" ${saiwaikuAllChecked} />` +
                `<span>川崎市幸区</span>` +
              `</label>` +
              `<span class="badge">${saiwaikuTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              saiwaikuTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (nakaharaTownsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="kawasaki_nakahara" ${nakaharaAllChecked} />` +
                `<span>川崎市中原区</span>` +
              `</label>` +
              `<span class="badge">${nakaharaTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              nakaharaTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (wardsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="kawasaki" ${wardsAllChecked} />` +
                `<span>川崎市</span>` +
              `</label>` +
              `<span class="badge">${wardsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              wardsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }
      continue;
    }

    // 「相模原地域」は「相模原市」枠を作り、その中に3区を表示する
    if (areaName === "相模原地域") {
      const chuoTownsRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14152-"));
      const chuoTownsVisible = applyFilters(chuoTownsRaw);

      const midoriTownsRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14151-"));
      const midoriTownsVisible = applyFilters(midoriTownsRaw);

      const minamiTownsRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14153-"));
      const minamiTownsVisible = applyFilters(minamiTownsRaw);

      const wardsRaw = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14150") return false;
        if (code === "14152") return false; // 中央区は「相模原市中央区」枠へ分離
        if (typeof code === "string" && code.startsWith("14152-")) return false;
        if (code === "14151") return false; // 緑区は「相模原市緑区」枠へ分離
        if (typeof code === "string" && code.startsWith("14151-")) return false;
        if (code === "14153") return false; // 南区は「相模原市南区」枠へ分離
        if (typeof code === "string" && code.startsWith("14153-")) return false;
        return true;
      });
      const wardsVisible = applyFilters(wardsRaw);

      const areaVisibleTotal = wardsVisible.length + chuoTownsVisible.length + midoriTownsVisible.length + minamiTownsVisible.length;
      visibleTotal += areaVisibleTotal;

      const areaPoolRaw = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14150") return false;
        if (code === "14151") return false;
        if (code === "14152") return false;
        if (code === "14153") return false;
        return true;
      });
      const areaAllSelected = areaPoolRaw.length > 0 && areaPoolRaw.every((c) => isCitySelected("14", c.code));
      const areaAllChecked = areaAllSelected ? "checked" : "";

      const chuoAllSelected = chuoTownsRaw.length > 0 && chuoTownsRaw.every((c) => isCitySelected("14", c.code));
      const chuoAllChecked = chuoAllSelected ? "checked" : "";

      const midoriAllSelected = midoriTownsRaw.length > 0 && midoriTownsRaw.every((c) => isCitySelected("14", c.code));
      const midoriAllChecked = midoriAllSelected ? "checked" : "";

      const minamiAllSelected = minamiTownsRaw.length > 0 && minamiTownsRaw.every((c) => isCitySelected("14", c.code));
      const minamiAllChecked = minamiAllSelected ? "checked" : "";

      const wardsAllSelected = wardsRaw.length > 0 && wardsRaw.every((c) => isCitySelected("14", c.code));
      const wardsAllChecked = wardsAllSelected ? "checked" : "";

      blocks.push(
        `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
          `<span class="areaHeaderLeft">` +
            `<label class="areaPick">` +
              `<input class="kanagawaAreaSelectAll" type="checkbox" data-area="${areaName}" ${areaAllChecked} />` +
            `</label>` +
          `</span>` +
          `<span class="areaHeaderTitle">${areaTitle}</span>` +
          `<span class="badge">${areaVisibleTotal}件</span>` +
        `</div>`
      );

      if (areaVisibleTotal === 0) {
        blocks.push(`<div class="empty">該当なし</div>`);
        continue;
      }

      if (chuoTownsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="sagamihara_chuo" ${chuoAllChecked} />` +
                `<span>相模原市中央区</span>` +
              `</label>` +
              `<span class="badge">${chuoTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              chuoTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (midoriTownsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="sagamihara_midori" ${midoriAllChecked} />` +
                `<span>相模原市緑区</span>` +
              `</label>` +
              `<span class="badge">${midoriTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              midoriTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (minamiTownsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="sagamihara_minami" ${minamiAllChecked} />` +
                `<span>相模原市南区</span>` +
              `</label>` +
              `<span class="badge">${minamiTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              minamiTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (wardsVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="sagamihara" ${wardsAllChecked} />` +
                `<span>相模原市</span>` +
              `</label>` +
              `<span class="badge">${wardsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              wardsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }
      continue;
    }

    // 「湘南地域」は「藤沢市」枠（町名）を作り、その下にその他の市町を並べる
    if (areaName === "湘南地域") {
      const fujisawaAreasRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14205-"));
      const fujisawaAreasVisible = applyFilters(fujisawaAreasRaw);

      const fujisawaAllSelected = fujisawaAreasRaw.length > 0 && fujisawaAreasRaw.every((c) => isCitySelected("14", c.code));
      const fujisawaAllChecked = fujisawaAllSelected ? "checked" : "";

      const othersRaw = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14205") return false;
        if (typeof code === "string" && code.startsWith("14205-")) return false;
        return true;
      });
      const othersVisible = applyFilters(othersRaw);

      const areaVisibleTotal = fujisawaAreasVisible.length + othersVisible.length;
      visibleTotal += areaVisibleTotal;

      const areaPoolRaw = citiesAll.filter((c) => c?.code !== "14205");
      const areaAllSelected = areaPoolRaw.length > 0 && areaPoolRaw.every((c) => isCitySelected("14", c.code));
      const areaAllChecked = areaAllSelected ? "checked" : "";

      blocks.push(
        `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
          `<span class="areaHeaderLeft">` +
            `<label class="areaPick">` +
              `<input class="kanagawaAreaSelectAll" type="checkbox" data-area="${areaName}" ${areaAllChecked} />` +
            `</label>` +
          `</span>` +
          `<span class="areaHeaderTitle">${areaTitle}</span>` +
          `<span class="badge">${areaVisibleTotal}件</span>` +
        `</div>`
      );

      if (areaVisibleTotal === 0) {
        blocks.push(`<div class="empty">該当なし</div>`);
        continue;
      }

      if (fujisawaAreasVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="fujisawa" ${fujisawaAllChecked} />` +
                `<span>藤沢市</span>` +
              `</label>` +
              `<span class="badge">${fujisawaAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              fujisawaAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (othersVisible.length > 0) {
        blocks.push(...othersVisible.map(cityRowHTML));
      }
      continue;
    }

    // 「県央地域」は「厚木市」枠（町名）を作り、その下にその他の市町を並べる
    if (areaName === "県央地域") {
      const atsugiAreasRaw = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14212-"));
      const atsugiAreasVisible = applyFilters(atsugiAreasRaw);

      const atsugiAllSelected = atsugiAreasRaw.length > 0 && atsugiAreasRaw.every((c) => isCitySelected("14", c.code));
      const atsugiAllChecked = atsugiAllSelected ? "checked" : "";

      const othersRaw = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14212") return false;
        if (typeof code === "string" && code.startsWith("14212-")) return false;
        return true;
      });
      const othersVisible = applyFilters(othersRaw);

      const areaVisibleTotal = atsugiAreasVisible.length + othersVisible.length;
      visibleTotal += areaVisibleTotal;

      const areaPoolRaw = citiesAll.filter((c) => c?.code !== "14212");
      const areaAllSelected = areaPoolRaw.length > 0 && areaPoolRaw.every((c) => isCitySelected("14", c.code));
      const areaAllChecked = areaAllSelected ? "checked" : "";

      blocks.push(
        `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
          `<span class="areaHeaderLeft">` +
            `<label class="areaPick">` +
              `<input class="kanagawaAreaSelectAll" type="checkbox" data-area="${areaName}" ${areaAllChecked} />` +
            `</label>` +
          `</span>` +
          `<span class="areaHeaderTitle">${areaTitle}</span>` +
          `<span class="badge">${areaVisibleTotal}件</span>` +
        `</div>`
      );

      if (areaVisibleTotal === 0) {
        blocks.push(`<div class="empty">該当なし</div>`);
        continue;
      }

      if (atsugiAreasVisible.length > 0) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<label class="cityBoxPick">` +
                `<input class="kanagawaCitySelectAll" type="checkbox" data-city="atsugi" ${atsugiAllChecked} />` +
                `<span>厚木市</span>` +
              `</label>` +
              `<span class="badge">${atsugiAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              atsugiAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (othersVisible.length > 0) {
        blocks.push(...othersVisible.map(cityRowHTML));
      }
      continue;
    }

    const list = applyFilters(citiesAll);
    visibleTotal += list.length;

    const showAreaSelectAll = (areaName === "横須賀三浦地域" || areaName === "県西地域");
    const areaAllSelected = citiesAll.length > 0 && citiesAll.every((c) => isCitySelected("14", c.code));
    const areaAllChecked = areaAllSelected ? "checked" : "";
    const areaHeaderLeft = showAreaSelectAll
      ? (
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="kanagawaAreaSelectAll" type="checkbox" data-area="${areaName}" ${areaAllChecked} />` +
          `</label>` +
        `</span>`
      )
      : `<span class="areaHeaderLeft"></span>`;

    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `${areaHeaderLeft}` +
        `<span class="areaHeaderTitle">${areaTitle}</span>` +
        `<span class="badge">${list.length}件</span>` +
      `</div>`
    );

    if (list.length === 0) {
      blocks.push(`<div class="empty">該当なし</div>`);
      continue;
    }

    blocks.push(...list.map(cityRowHTML));
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  cityCountEl.textContent = `登録：${KANAGAWA_ALL_CITIES.length}件`;
  setAreaCount(`表示：${visibleTotal}件`);
}

function renderTokyo() {
  const blocks = [];
  let visibleTotal = 0;

  const areaKey = state.selectedArea || "all";
  const allCitiesRaw = TOKYO_ALL_CITIES;

  const isWardsAll = areaKey === "すべての東京２３区";
  const isWardsOthersOnly = areaKey === "その他の２３区";
  const isWardOnly = [
    "渋谷区",
    "品川区",
    "新宿区",
    "港区",
    "千代田区",
    "豊島区",
    "中央区",
    "文京区",
    "目黒区",
    "世田谷区",
    "中野区",
    "杉並区",
    "大田区",
    "江東区",
  ].includes(areaKey);

  const isTamaCityOnly = [
    "多摩市",
    "八王子市",
    "立川市",
    "武蔵野市",
    "府中市",
    "三鷹市",
    "町田市",
    "日野市",
    "青梅市",
    "昭島市",
  ].includes(areaKey);

  // 「すべて」表示時のみ、最上段に「東京都（全選択）」を出す
  if (areaKey === "all") {
    const listAllVisible = applyFilters(allCitiesRaw);
    const prefAllSelected = allCitiesRaw.length > 0 && allCitiesRaw.every((c) => isCitySelected("13", c.code));
    const prefAllChecked = prefAllSelected ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="tokyoPrefSelectAll" type="checkbox" ${prefAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">東京都</span>` +
        `<span class="badge">${listAllVisible.length}件</span>` +
      `</div>`
    );
  }

  const groupOrder = ["23区", "多摩", "西多摩", "島しょ"];
  for (const gName of groupOrder) {
    const wantsThisGroup =
      (areaKey === "all") ||
      (areaKey === gName) ||
      (gName === "23区" && (isWardsAll || isWardsOthersOnly || isWardOnly)) ||
      (gName === "多摩" && isTamaCityOnly);
    if (!wantsThisGroup) continue;
    const raw = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED[gName] ?? []) : [];
    if (raw.length === 0) continue;

    // 23区は「渋谷区枠」「品川区枠」を前橋市のように区切って表示
    if (gName === "23区") {
      const wardsRaw = raw;

      const shibuyaCity = wardsRaw.find((c) => c?.code === "13113") ?? { code: "13113", name: "渋谷区" };
      const shibuyaAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13113-"));
      const shibuyaAreasVisible = applyFilters(shibuyaAreasRaw);
      const shibuyaPool = [shibuyaCity, ...shibuyaAreasRaw];

      const shinagawaCity = wardsRaw.find((c) => c?.code === "13109") ?? { code: "13109", name: "品川区" };
      const shinagawaAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13109-"));
      const shinagawaAreasVisible = applyFilters(shinagawaAreasRaw);
      const shinagawaPool = [shinagawaCity, ...shinagawaAreasRaw];

      const shinjukuCity = wardsRaw.find((c) => c?.code === "13104") ?? { code: "13104", name: "新宿区" };
      const shinjukuAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13104-"));
      const shinjukuAreasVisible = applyFilters(shinjukuAreasRaw);
      const shinjukuPool = [shinjukuCity, ...shinjukuAreasRaw];

      const minatoCity = wardsRaw.find((c) => c?.code === "13103") ?? { code: "13103", name: "港区" };
      const minatoAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13103-"));
      const minatoAreasVisible = applyFilters(minatoAreasRaw);
      const minatoPool = [minatoCity, ...minatoAreasRaw];

      const chiyodaCity = wardsRaw.find((c) => c?.code === "13101") ?? { code: "13101", name: "千代田区" };
      const chiyodaAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13101-"));
      const chiyodaAreasVisible = applyFilters(chiyodaAreasRaw);
      const chiyodaPool = [chiyodaCity, ...chiyodaAreasRaw];

      const toshimaCity = wardsRaw.find((c) => c?.code === "13116") ?? { code: "13116", name: "豊島区" };
      const toshimaAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13116-"));
      const toshimaAreasVisible = applyFilters(toshimaAreasRaw);
      const toshimaPool = [toshimaCity, ...toshimaAreasRaw];

      const chuoCity = wardsRaw.find((c) => c?.code === "13102") ?? { code: "13102", name: "中央区" };
      const chuoAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13102-"));
      const chuoAreasVisible = applyFilters(chuoAreasRaw);
      const chuoPool = [chuoCity, ...chuoAreasRaw];

      const bunkyoCity = wardsRaw.find((c) => c?.code === "13105") ?? { code: "13105", name: "文京区" };
      const bunkyoAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13105-"));
      const bunkyoAreasVisible = applyFilters(bunkyoAreasRaw);
      const bunkyoPool = [bunkyoCity, ...bunkyoAreasRaw];

      const meguroCity = wardsRaw.find((c) => c?.code === "13110") ?? { code: "13110", name: "目黒区" };
      const meguroAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13110-"));
      const meguroAreasVisible = applyFilters(meguroAreasRaw);
      const meguroPool = [meguroCity, ...meguroAreasRaw];

      const setagayaCity = wardsRaw.find((c) => c?.code === "13112") ?? { code: "13112", name: "世田谷区" };
      const setagayaAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13112-"));
      const setagayaAreasVisible = applyFilters(setagayaAreasRaw);
      const setagayaPool = [setagayaCity, ...setagayaAreasRaw];

      const nakanoCity = wardsRaw.find((c) => c?.code === "13114") ?? { code: "13114", name: "中野区" };
      const nakanoAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13114-"));
      const nakanoAreasVisible = applyFilters(nakanoAreasRaw);
      const nakanoPool = [nakanoCity, ...nakanoAreasRaw];

      const suginamiCity = wardsRaw.find((c) => c?.code === "13115") ?? { code: "13115", name: "杉並区" };
      const suginamiAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13115-"));
      const suginamiAreasVisible = applyFilters(suginamiAreasRaw);
      const suginamiPool = [suginamiCity, ...suginamiAreasRaw];

      const otaCity = wardsRaw.find((c) => c?.code === "13111") ?? { code: "13111", name: "大田区" };
      const otaAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13111-"));
      const otaAreasVisible = applyFilters(otaAreasRaw);
      const otaPool = [otaCity, ...otaAreasRaw];

      const kotoCity = wardsRaw.find((c) => c?.code === "13108") ?? { code: "13108", name: "江東区" };
      const kotoAreasRaw = wardsRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13108-"));
      const kotoAreasVisible = applyFilters(kotoAreasRaw);
      const kotoPool = [kotoCity, ...kotoAreasRaw];

      const othersRaw = wardsRaw.filter((c) => {
        const code = (typeof c?.code === "string") ? c.code : "";
        if (code === "13113" || code.startsWith("13113-")) return false;
        if (code === "13109" || code.startsWith("13109-")) return false;
        if (code === "13104" || code.startsWith("13104-")) return false;
        if (code === "13103" || code.startsWith("13103-")) return false;
        if (code === "13101" || code.startsWith("13101-")) return false;
        if (code === "13116" || code.startsWith("13116-")) return false;
        if (code === "13102" || code.startsWith("13102-")) return false;
        if (code === "13108" || code.startsWith("13108-")) return false;
        if (code === "13105" || code.startsWith("13105-")) return false;
        if (code === "13110" || code.startsWith("13110-")) return false;
        if (code === "13111" || code.startsWith("13111-")) return false;
        if (code === "13112" || code.startsWith("13112-")) return false;
        if (code === "13114" || code.startsWith("13114-")) return false;
        if (code === "13115" || code.startsWith("13115-")) return false;
        return true;
      });
      const othersVisible = applyFilters(othersRaw);

      const selectedWardVisibleCount =
        (areaKey === "渋谷区") ? shibuyaAreasVisible.length :
        (areaKey === "品川区") ? shinagawaAreasVisible.length :
        (areaKey === "新宿区") ? shinjukuAreasVisible.length :
        (areaKey === "港区") ? minatoAreasVisible.length :
        (areaKey === "千代田区") ? chiyodaAreasVisible.length :
        (areaKey === "豊島区") ? toshimaAreasVisible.length :
        (areaKey === "中央区") ? chuoAreasVisible.length :
        (areaKey === "文京区") ? bunkyoAreasVisible.length :
        (areaKey === "目黒区") ? meguroAreasVisible.length :
        (areaKey === "世田谷区") ? setagayaAreasVisible.length :
        (areaKey === "中野区") ? nakanoAreasVisible.length :
        (areaKey === "杉並区") ? suginamiAreasVisible.length :
        (areaKey === "大田区") ? otaAreasVisible.length :
        (areaKey === "江東区") ? kotoAreasVisible.length :
        0;

      const sectionVisibleCount = isWardOnly
        ? selectedWardVisibleCount
        : isWardsOthersOnly
          ? othersVisible.length
          : (shibuyaAreasVisible.length + shinagawaAreasVisible.length + shinjukuAreasVisible.length + minatoAreasVisible.length + chiyodaAreasVisible.length + toshimaAreasVisible.length + chuoAreasVisible.length + bunkyoAreasVisible.length + meguroAreasVisible.length + setagayaAreasVisible.length + nakanoAreasVisible.length + suginamiAreasVisible.length + otaAreasVisible.length + kotoAreasVisible.length + othersVisible.length);
      if (sectionVisibleCount === 0) continue;
      visibleTotal += sectionVisibleCount;

      // 個別表示（北関東の「前橋市」などと同じイメージ）
      if (isWardsOthersOnly) {
        blocks.push(
          `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
            `<span class="areaHeaderLeft"></span>` +
            `<span class="areaHeaderTitle">その他の２３区</span>` +
            `<span class="badge">${othersVisible.length}件</span>` +
          `</div>`
        );

        blocks.push(
          `<div class="cityGroupGrid cityGroupGrid--3col">` +
            othersVisible.map(cityRowHTML).join("") +
          `</div>`
        );
        continue;
      }

      // 「すべての東京２３区」行：渋谷区の上に常に表示（others がある/ないに関係なく先頭に置く）
      if (!isWardOnly) {
        const wardsAllSelected = wardsRaw.length > 0 && wardsRaw.every((c) => isCitySelected("13", c.code));
        const wardsAllChecked = wardsAllSelected ? "checked" : "";
        blocks.push(
          `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
            `<span class="areaHeaderLeft">` +
              `<label class="areaPick">` +
                `<input class="tokyoAreaSelectAll" data-area="23区" type="checkbox" ${wardsAllChecked} />` +
              `</label>` +
            `</span>` +
            `<span class="areaHeaderTitle">すべての東京２３区</span>` +
            `<span class="badge">${sectionVisibleCount}件</span>` +
          `</div>`
        );
      }

      const allSelected = wardsRaw.length > 0 && wardsRaw.every((c) => isCitySelected("13", c.code));
      const allChecked = allSelected ? "checked" : "";
      const wardHeaderTitle = "その他の23区";
      const wardHeaderHTML =
        `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
          `<span class="areaHeaderLeft">` +
            `<label class="areaPick">` +
              `<input class="tokyoAreaSelectAll" data-area="${gName}" type="checkbox" ${allChecked} />` +
            `</label>` +
          `</span>` +
          `<span class="areaHeaderTitle">${wardHeaderTitle}</span>` +
          `<span class="badge">${sectionVisibleCount}件</span>` +
        `</div>`;
      const deferWardHeader = !isWardOnly && othersVisible.length > 0;
      if (!isWardOnly && !deferWardHeader) blocks.push(wardHeaderHTML);

      if (shibuyaAreasVisible.length && (!isWardOnly || areaKey === "渋谷区")) {
        const shibuyaAllSelected = shibuyaPool.length > 0 && shibuyaPool.every((c) => isCitySelected("13", c.code));
        const shibuyaAllChecked = shibuyaAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoShibuyaSelectAll" type="checkbox" ${shibuyaAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">渋谷区</span>` +
              `<span class="badge">${shibuyaAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              shibuyaAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (shinagawaAreasVisible.length && (!isWardOnly || areaKey === "品川区")) {
        const shinagawaAllSelected = shinagawaPool.length > 0 && shinagawaPool.every((c) => isCitySelected("13", c.code));
        const shinagawaAllChecked = shinagawaAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoShinagawaSelectAll" type="checkbox" ${shinagawaAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">品川区</span>` +
              `<span class="badge">${shinagawaAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              shinagawaAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (shinjukuAreasVisible.length && (!isWardOnly || areaKey === "新宿区")) {
        const shinjukuAllSelected = shinjukuPool.length > 0 && shinjukuPool.every((c) => isCitySelected("13", c.code));
        const shinjukuAllChecked = shinjukuAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoShinjukuSelectAll" type="checkbox" ${shinjukuAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">新宿区</span>` +
              `<span class="badge">${shinjukuAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              shinjukuAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (minatoAreasVisible.length && (!isWardOnly || areaKey === "港区")) {
        const minatoAllSelected = minatoPool.length > 0 && minatoPool.every((c) => isCitySelected("13", c.code));
        const minatoAllChecked = minatoAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoMinatoSelectAll" type="checkbox" ${minatoAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">港区</span>` +
              `<span class="badge">${minatoAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              minatoAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (chiyodaAreasVisible.length && (!isWardOnly || areaKey === "千代田区")) {
        const chiyodaAllSelected = chiyodaPool.length > 0 && chiyodaPool.every((c) => isCitySelected("13", c.code));
        const chiyodaAllChecked = chiyodaAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoChiyodaSelectAll" type="checkbox" ${chiyodaAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">千代田区</span>` +
              `<span class="badge">${chiyodaAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              chiyodaAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (toshimaAreasVisible.length && (!isWardOnly || areaKey === "豊島区")) {
        const toshimaAllSelected = toshimaPool.length > 0 && toshimaPool.every((c) => isCitySelected("13", c.code));
        const toshimaAllChecked = toshimaAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoToshimaSelectAll" type="checkbox" ${toshimaAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">豊島区</span>` +
              `<span class="badge">${toshimaAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              toshimaAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (chuoAreasVisible.length && (!isWardOnly || areaKey === "中央区")) {
        const chuoAllSelected = chuoPool.length > 0 && chuoPool.every((c) => isCitySelected("13", c.code));
        const chuoAllChecked = chuoAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoChuoSelectAll" type="checkbox" ${chuoAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">中央区</span>` +
              `<span class="badge">${chuoAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              chuoAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (bunkyoAreasVisible.length && (!isWardOnly || areaKey === "文京区")) {
        const bunkyoAllSelected = bunkyoPool.length > 0 && bunkyoPool.every((c) => isCitySelected("13", c.code));
        const bunkyoAllChecked = bunkyoAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoBunkyoSelectAll" type="checkbox" ${bunkyoAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">文京区</span>` +
              `<span class="badge">${bunkyoAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              bunkyoAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (meguroAreasVisible.length && (!isWardOnly || areaKey === "目黒区")) {
        const meguroAllSelected = meguroPool.length > 0 && meguroPool.every((c) => isCitySelected("13", c.code));
        const meguroAllChecked = meguroAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoMeguroSelectAll" type="checkbox" ${meguroAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">目黒区</span>` +
              `<span class="badge">${meguroAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              meguroAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (setagayaAreasVisible.length && (!isWardOnly || areaKey === "世田谷区")) {
        const setagayaAllSelected = setagayaPool.length > 0 && setagayaPool.every((c) => isCitySelected("13", c.code));
        const setagayaAllChecked = setagayaAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoSetagayaSelectAll" type="checkbox" ${setagayaAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">世田谷区</span>` +
              `<span class="badge">${setagayaAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              setagayaAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (nakanoAreasVisible.length && (!isWardOnly || areaKey === "中野区")) {
        const nakanoAllSelected = nakanoPool.length > 0 && nakanoPool.every((c) => isCitySelected("13", c.code));
        const nakanoAllChecked = nakanoAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoNakanoSelectAll" type="checkbox" ${nakanoAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">中野区</span>` +
              `<span class="badge">${nakanoAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              nakanoAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (suginamiAreasVisible.length && (!isWardOnly || areaKey === "杉並区")) {
        const suginamiAllSelected = suginamiPool.length > 0 && suginamiPool.every((c) => isCitySelected("13", c.code));
        const suginamiAllChecked = suginamiAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoSuginamiSelectAll" type="checkbox" ${suginamiAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">杉並区</span>` +
              `<span class="badge">${suginamiAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              suginamiAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (otaAreasVisible.length && (!isWardOnly || areaKey === "大田区")) {
        const otaAllSelected = otaPool.length > 0 && otaPool.every((c) => isCitySelected("13", c.code));
        const otaAllChecked = otaAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoOtaSelectAll" type="checkbox" ${otaAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">大田区</span>` +
              `<span class="badge">${otaAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              otaAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (kotoAreasVisible.length && (!isWardOnly || areaKey === "江東区")) {
        const kotoAllSelected = kotoPool.length > 0 && kotoPool.every((c) => isCitySelected("13", c.code));
        const kotoAllChecked = kotoAllSelected ? "checked" : "";
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft">` +
                `<label class="areaPick">` +
                  `<input class="tokyoKotoSelectAll" type="checkbox" ${kotoAllChecked} />` +
                `</label>` +
              `</span>` +
              `<span class="areaHeaderTitle">江東区</span>` +
              `<span class="badge">${kotoAreasVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              kotoAreasVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (othersVisible.length && !isWardOnly) {
        blocks.push(
          wardHeaderHTML +
          `<div class="cityGroupGrid cityGroupGrid--3col">` +
            othersVisible.map(cityRowHTML).join("") +
          `</div>`
        );
      }

      continue;
    }

    // 多摩は「多摩市」枠を多摩セクションの先頭に表示
    if (gName === "多摩") {
      const tamaRaw = raw;
      const tamaCity = tamaRaw.find((c) => c?.code === "13224") ?? { code: "13224", name: "多摩市" };
      const tamaAreasRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13224-"));
      const tamaAreasVisible = applyFilters(tamaAreasRaw);

      const hachiojiCity = tamaRaw.find((c) => c?.code === "13201") ?? { code: "13201", name: "八王子市" };
      const hachiojiTownsRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13201-town-"));
      const hachiojiTownsVisible = applyFilters(hachiojiTownsRaw);

      const tachikawaCity = tamaRaw.find((c) => c?.code === "13202") ?? { code: "13202", name: "立川市" };
      const tachikawaTownsRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13202-town-"));
      const tachikawaTownsVisible = applyFilters(tachikawaTownsRaw);

      const musashinoCity = tamaRaw.find((c) => c?.code === "13203") ?? { code: "13203", name: "武蔵野市" };
      const musashinoTownsRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13203-town-"));
      const musashinoTownsVisible = applyFilters(musashinoTownsRaw);

      const mitakaCity = tamaRaw.find((c) => c?.code === "13204") ?? { code: "13204", name: "三鷹市" };
      const mitakaTownsRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13204-town-"));
      const mitakaTownsVisible = applyFilters(mitakaTownsRaw);

      const machidaCity = tamaRaw.find((c) => c?.code === "13209") ?? { code: "13209", name: "町田市" };
      const machidaTownsRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13209-town-"));
      const machidaTownsVisible = applyFilters(machidaTownsRaw);

      const hinoCity = tamaRaw.find((c) => c?.code === "13212") ?? { code: "13212", name: "日野市" };
      const hinoTownsRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13212-town-"));
      const hinoTownsVisible = applyFilters(hinoTownsRaw);

      const omeCity = tamaRaw.find((c) => c?.code === "13205") ?? { code: "13205", name: "青梅市" };
      const omeTownsRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13205-town-"));
      const omeTownsVisible = applyFilters(omeTownsRaw);

      const akishimaCity = tamaRaw.find((c) => c?.code === "13207") ?? { code: "13207", name: "昭島市" };
      const akishimaTownsRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13207-town-"));
      const akishimaTownsVisible = applyFilters(akishimaTownsRaw);

      const fuchuCity = tamaRaw.find((c) => c?.code === "13206") ?? { code: "13206", name: "府中市" };
      const fuchuTownsRaw = tamaRaw.filter((c) => typeof c?.code === "string" && c.code.startsWith("13206-town-"));
      const fuchuTownsVisible = applyFilters(fuchuTownsRaw);

      const othersRaw = tamaRaw.filter((c) => {
        const code = (typeof c?.code === "string") ? c.code : "";
        if (code === "13224" || code.startsWith("13224-")) return false;
        if (code === "13201" || code.startsWith("13201-town-")) return false;
        if (code === "13202" || code.startsWith("13202-town-")) return false;
        if (code === "13203" || code.startsWith("13203-town-")) return false;
        if (code === "13204" || code.startsWith("13204-town-")) return false;
        if (code === "13205" || code.startsWith("13205-town-")) return false;
        if (code === "13206" || code.startsWith("13206-town-")) return false;
        if (code === "13207" || code.startsWith("13207-town-")) return false;
        if (code === "13209" || code.startsWith("13209-town-")) return false;
        if (code === "13212" || code.startsWith("13212-town-")) return false;
        return true;
      });
      const othersVisible = applyFilters(othersRaw);

      const selectedTamaVisibleCount =
        (areaKey === "多摩市") ? tamaAreasVisible.length :
        (areaKey === "八王子市") ? hachiojiTownsVisible.length :
        (areaKey === "立川市") ? tachikawaTownsVisible.length :
        (areaKey === "武蔵野市") ? musashinoTownsVisible.length :
        (areaKey === "府中市") ? fuchuTownsVisible.length :
        (areaKey === "三鷹市") ? mitakaTownsVisible.length :
        (areaKey === "町田市") ? machidaTownsVisible.length :
        (areaKey === "日野市") ? hinoTownsVisible.length :
        (areaKey === "青梅市") ? omeTownsVisible.length :
        (areaKey === "昭島市") ? akishimaTownsVisible.length :
        0;

      const sectionVisibleCount = isTamaCityOnly
        ? selectedTamaVisibleCount
        : (tamaAreasVisible.length + hachiojiTownsVisible.length + tachikawaTownsVisible.length + musashinoTownsVisible.length + fuchuTownsVisible.length + mitakaTownsVisible.length + machidaTownsVisible.length + hinoTownsVisible.length + omeTownsVisible.length + akishimaTownsVisible.length + othersVisible.length);
      if (sectionVisibleCount === 0) continue;
      visibleTotal += sectionVisibleCount;

      if (!isTamaCityOnly) {
        const allSelected = tamaRaw.length > 0 && tamaRaw.every((c) => isCitySelected("13", c.code));
        const allChecked = allSelected ? "checked" : "";
        blocks.push(
          `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
            `<span class="areaHeaderLeft">` +
              `<label class="areaPick">` +
                `<input class="tokyoAreaSelectAll" data-area="${gName}" type="checkbox" ${allChecked} />` +
              `</label>` +
            `</span>` +
            `<span class="areaHeaderTitle">${gName}</span>` +
            `<span class="badge">${sectionVisibleCount}件</span>` +
          `</div>`
        );
      }

      if (tamaAreasVisible.length && (!isTamaCityOnly || areaKey === "多摩市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">多摩市</span>` +
              `<span class="badge">${tamaAreasVisible.length}件</span>` +
            `</div>` +
            renderMiniGroupedTownHTML(tamaAreasVisible, { mode: "gojuon" }) +
          `</div>`
        );
      }

      if (hachiojiTownsVisible.length && (!isTamaCityOnly || areaKey === "八王子市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">${hachiojiCity.name}</span>` +
              `<span class="badge">${hachiojiTownsVisible.length}件</span>` +
            `</div>` +
            renderMiniGroupedTownHTML(hachiojiTownsVisible, { mode: "codeRange", codePrefix: "13201-town-" }) +
          `</div>`
        );
      }

      if (tachikawaTownsVisible.length && (!isTamaCityOnly || areaKey === "立川市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">${tachikawaCity.name}</span>` +
              `<span class="badge">${tachikawaTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              tachikawaTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (musashinoTownsVisible.length && (!isTamaCityOnly || areaKey === "武蔵野市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">${musashinoCity.name}</span>` +
              `<span class="badge">${musashinoTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              musashinoTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (fuchuTownsVisible.length && (!isTamaCityOnly || areaKey === "府中市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">${fuchuCity.name}</span>` +
              `<span class="badge">${fuchuTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              fuchuTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      // 指定順：府中市枠の下に三鷹市枠
      if (mitakaTownsVisible.length && (!isTamaCityOnly || areaKey === "三鷹市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">${mitakaCity.name}</span>` +
              `<span class="badge">${mitakaTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              mitakaTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      // 指定順：三鷹市枠の下に町田市枠
      if (machidaTownsVisible.length && (!isTamaCityOnly || areaKey === "町田市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">${machidaCity.name}</span>` +
              `<span class="badge">${machidaTownsVisible.length}件</span>` +
            `</div>` +
            renderMiniGroupedTownHTML(machidaTownsVisible, { mode: "gojuon" }) +
          `</div>`
        );
      }

      // 指定順：町田市枠の下に日野市枠
      if (hinoTownsVisible.length && (!isTamaCityOnly || areaKey === "日野市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">${hinoCity.name}</span>` +
              `<span class="badge">${hinoTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              hinoTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      // 指定順：日野市枠の下に青梅市枠
      if (omeTownsVisible.length && (!isTamaCityOnly || areaKey === "青梅市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">${omeCity.name}</span>` +
              `<span class="badge">${omeTownsVisible.length}件</span>` +
            `</div>` +
            renderMiniGroupedTownHTML(omeTownsVisible, { mode: "gojuon" }) +
          `</div>`
        );
      }

      // 指定順：青梅市枠の下に昭島市枠
      if (akishimaTownsVisible.length && (!isTamaCityOnly || areaKey === "昭島市")) {
        blocks.push(
          `<div class="cityBox">` +
            `<div class="cityBoxHead">` +
              `<span class="areaHeaderLeft"></span>` +
              `<span class="areaHeaderTitle">${akishimaCity.name}</span>` +
              `<span class="badge">${akishimaTownsVisible.length}件</span>` +
            `</div>` +
            `<div class="cityGroupGrid cityGroupGrid--3col">` +
              akishimaTownsVisible.map(cityRowHTML).join("") +
            `</div>` +
          `</div>`
        );
      }

      if (othersVisible.length && !isTamaCityOnly) {
        blocks.push(
          `<div class="cityGroupGrid cityGroupGrid--3col">` +
            othersVisible.map(cityRowHTML).join("") +
          `</div>`
        );
      }

      continue;
    }

    const visible = applyFilters(raw);
    if (visible.length === 0) continue;
    visibleTotal += visible.length;

    const allSelected = raw.length > 0 && raw.every((c) => isCitySelected("13", c.code));
    const allChecked = allSelected ? "checked" : "";

    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="tokyoAreaSelectAll" data-area="${gName}" type="checkbox" ${allChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">${gName}</span>` +
        `<span class="badge">${visible.length}件</span>` +
      `</div>`
    );

    // 市区町村行は常に3列固定
    blocks.push(
      `<div class="cityGroupGrid cityGroupGrid--3col">` +
        visible.map(cityRowHTML).join("") +
      `</div>`
    );
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  cityCountEl.textContent = `登録：${allCitiesRaw.length}件`;
  setAreaCount(`表示：${visibleTotal}件`);
}

function setAreaBarVisible(visible) {
  if (!areaBarEl) return;
  areaBarEl.hidden = !visible;
}

function ensureAreaOptionsForPref(prefCode) {
  const opts = AREA_OPTIONS_BY_PREF[prefCode];
  if (!areaSelectEl || !areaLabelEl) return;

  if (!prefCode || !opts) {
    setAreaBarVisible(false);
    return;
  }

  setAreaBarVisible(true);
  areaLabelEl.textContent = "エリア";
  areaSelectEl.innerHTML = opts
    .map((o) => `<option value="${o.value}">${o.label}</option>`)
    .join("");

  if (!opts.some((o) => o.value === state.selectedArea)) state.selectedArea = "all";
  areaSelectEl.value = state.selectedArea;
}

function setAreaCount(text) {
  if (!areaCountEl) return;
  areaCountEl.textContent = text || "";
}

function backToEntry() {
  // 可能なら「リンク元から来た」前提で履歴戻り（自然な戻り方）
  try {
    if (document.referrer) {
      const refPath = new URL(document.referrer).pathname;
      if (refPath.endsWith("/work_location_modal_demo_entry.html") && history.length > 1) {
        history.back();
        return;
      }
    }
  } catch {
    // file:// などで URL() が失敗するケースは無視してフォールバック
  }

  // フォールバック：常にリンク元へ遷移
  window.location.href = ENTRY_URL;
}

function updateSelectedCount() {
  if (state.activeTab === "job") {
    selectedCountEl.textContent = `${state.selectedJobs.size}件`;
    return;
  }

  if (state.activeTab === "work") {
    const checked = document.querySelectorAll('input[name="pref"]:checked').length;
    selectedCountEl.textContent = `${checked}件`;
    return;
  }

  const set = getSimpleSelectedSet(state.activeTab);
  selectedCountEl.textContent = `${set ? set.size : 0}件`;
}

// ====== Job helpers ======
function jobKey(categoryId, jobCode) {
  return `${categoryId}:${jobCode}`;
}

function isJobSelected(categoryId, jobCode) {
  return state.selectedJobs.has(jobKey(categoryId, jobCode));
}

function setJobSelected(categoryId, jobCode, selected) {
  const key = jobKey(categoryId, jobCode);
  if (selected) state.selectedJobs.add(key);
  else state.selectedJobs.delete(key);
}

function getJobCategoryById(categoryId) {
  if (!categoryId) return null;
  return (Array.isArray(JOB_CATEGORIES) ? JOB_CATEGORIES : []).find((c) => c.id === categoryId) ?? null;
}

function getJobCountForJob(categoryId, jobCode) {
  // デモ用：安定した“それっぽい数”を生成（本番はAPI/DBに差し替え）
  const key = `${categoryId}-${jobCode}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const base = 120;
  const spread = 6000;
  return base + (h % spread);
}

function jobCountBadgeHTML(categoryId, jobCode) {
  const n = getJobCountForJob(categoryId, jobCode);
  return `<span class="countBadge">${n}件</span>`;
}

function jobRowHTML(categoryId, job) {
  const checked = isJobSelected(categoryId, job.code) ? "checked" : "";
  return `
    <label class="cityItem">
      <input type="checkbox" name="job" value="${job.code}" data-job-cat="${categoryId}" ${checked} />
      <span class="cityName">${job.name}</span>
      ${jobCountBadgeHTML(categoryId, job.code)}
    </label>
  `;
}

function renderJobLeft() {
  const container = document.getElementById("regionContainer");
  if (!container) return;
  const categories = Array.isArray(JOB_CATEGORIES) ? JOB_CATEGORIES : [];
  container.innerHTML = `
    <div class="jobCatList">
      ${categories.map((c) => {
        const active = c.id === state.selectedJobCategoryId ? "active" : "";
        return `<button class="jobCatBtn ${active}" type="button" data-job-cat="${c.id}">
          <span>${c.name}</span>
          <span class="jobCatChevron">▸</span>
        </button>`;
      }).join("")}
    </div>
  `;
}

function renderJobs() {
  // 右側タイトル類の付け替え
  if (prefTitleEl) prefTitleEl.textContent = "未選択";
  if (citySearchEl) citySearchEl.placeholder = "職種を検索";
  setAreaBarVisible(false);

  const cat = getJobCategoryById(state.selectedJobCategoryId);
  if (!cat) {
    if (cityCountEl) cityCountEl.textContent = "";
    if (cityListEl) cityListEl.innerHTML = `<div class="empty">左で職種カテゴリを選択すると、右に職種が表示されます</div>`;
    setAreaCount("");
    return;
  }

  if (prefTitleEl) prefTitleEl.textContent = cat.name;

  const q = (citySearchEl?.value ?? "").trim();
  const onlySelected = !!onlySelectedEl?.checked;

  const blocks = [];
  let visibleTotal = 0;
  let flatTotal = 0;

  for (const g of (cat.groups ?? [])) {
    const all = Array.isArray(g.jobs) ? g.jobs : [];
    flatTotal += all.length;

    let list = all;
    if (q) list = list.filter((x) => x.name.includes(q));
    if (onlySelected) list = list.filter((x) => isJobSelected(cat.id, x.code));
    if (list.length === 0) continue;

    visibleTotal += list.length;
    blocks.push(`<div class="sectionTitle">${g.name}<span class="badge">${list.length}件</span></div>`);
    blocks.push(...list.map((j) => jobRowHTML(cat.id, j)));
  }

  if (cityListEl) cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  if (cityCountEl) cityCountEl.textContent = `登録：${flatTotal}件`;
  setAreaCount(`表示：${visibleTotal}件`);
}

function getJobCount(prefCode, cityCode) {
  // デモ用：コードから安定した“それっぽい数”を生成（本番はAPI/DB/集計値に差し替え）
  const key = `${prefCode}-${cityCode}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  // 札幌中心部は多め、地方は少なめ…みたいなバイアスを少し入れる
  const base = (prefCode === "01") ? 800 : (prefCode === "02") ? 120 : 200;
  const spread = (prefCode === "01") ? 2500 : (prefCode === "02") ? 600 : 900;
  return base + (h % spread);
}

function countBadgeHTML(prefCode, cityCode) {
  const n = getJobCount(prefCode, cityCode);
  return `<span class="countBadge">${n}</span>`;
}

function normalizeRubyLabel(nameHtml) {
  const value = (typeof nameHtml === "string") ? nameHtml : "";
  if (!value) return "";
  if (value.includes("<ruby")) return value;

  // 例：南足柄市（<rb>みなみあしがらし</rb>） → <ruby><rb>南足柄市</rb><rt>みなみあしがらし</rt></ruby>
  const m = value.match(/^(.+?)（\s*<rb>([\s\S]*?)<\/rb>\s*）$/);
  if (!m) return value;

  const base = (m[1] || "").trim();
  const reading = (m[2] || "").trim();
  if (!base || !reading) return value;
  return `<ruby><rb>${base}</rb><rt>${reading}</rt></ruby>`;
}

function cityRowHTML(c) {
  const checked = isCitySelected(state.selectedPrefCode, c.code) ? "checked" : "";
  const label = normalizeRubyLabel(c.name);
  return `
    <label class="cityItem">
      <input type="checkbox" name="city" value="${c.code}" ${checked} />
      <span class="cityName">${label}</span>
      ${countBadgeHTML(state.selectedPrefCode, c.code)}
    </label>
  `;
}

// 「総合振興局」を表示上は外す（例：オホーツク総合振興局→オホーツク）
const stripBureau = (name) => name.replace("総合振興局","").replace("振興局","");

// ====== Rendering ======
function applyFilters(list) {
  const prefCode = state.selectedPrefCode;
  const q = citySearchEl.value.trim();
  const onlySelected = onlySelectedEl.checked;
  let out = list;
  if (q) out = out.filter(c => c.name.includes(q));
  if (onlySelected && prefCode) out = out.filter(c => isCitySelected(prefCode, c.code));
  return out;
}

function extractReadingKana(nameHtml) {
  if (typeof nameHtml !== "string") return "";

  // ルビ（<rt>）優先
  if (nameHtml.includes("<rt")) {
    const div = document.createElement("div");
    div.innerHTML = nameHtml;
    const rt = div.querySelector("ruby rt");
    const kana = (rt?.textContent || "").trim();
    if (kana) return kana;
  }

  // 括弧内（例：宕（<rb>あたご</rb>））
  const start = nameHtml.indexOf("（");
  const end = nameHtml.indexOf("）", start + 1);
  if (start >= 0 && end > start) {
    const inner = nameHtml.slice(start + 1, end);
    const div = document.createElement("div");
    div.innerHTML = inner;
    return (div.textContent || "").trim();
  }

  // 先頭がかなならそれを使う（例：みなみ野）
  const plain = toPlainTextLabel(nameHtml);
  const ch = (plain || "").trim().charAt(0);
  if (!ch) return "";
  if (/^[\u3040-\u309F\u30A0-\u30FF]/.test(ch)) return ch;
  return "";
}

function gojuonRowLabelFromKanaChar(ch) {
  if (!ch) return "その他";
  const c = String(ch).charAt(0);
  const rows = [
    { label: "あ行", chars: "ぁあぃいぅうぇえぉおゔ" },
    { label: "か行", chars: "かがきぎくぐけげこご" },
    { label: "さ行", chars: "さざしじすずせぜそぞ" },
    { label: "た行", chars: "ただちぢつづてでとど" },
    { label: "な行", chars: "なにぬねの" },
    { label: "は行", chars: "はばぱひびぴふぶぷへべぺほぼぽ" },
    { label: "ま行", chars: "まみむめも" },
    { label: "や行", chars: "ゃやゅゆょよ" },
    { label: "ら行", chars: "らりるれろ" },
    { label: "わ行", chars: "ゎわをん" },
  ];
  for (const r of rows) {
    if (r.chars.includes(c)) return r.label;
  }
  return "その他";
}

function renderMiniGroupedTownHTML(items, options) {
  const mode = options?.mode || "gojuon"; // gojuon | codeRange
  const codePrefix = options?.codePrefix || "";
  const rowOrder = ["あ行","か行","さ行","た行","な行","は行","ま行","や行","ら行","わ行","その他"];

  if (mode === "codeRange" && codePrefix) {
    const buckets = new Map();
    const rangeSize = 40;
    const sorted = [...items].sort((a, b) => String(a.code).localeCompare(String(b.code)));
    for (const c of sorted) {
      const m = String(c.code || "").match(/-(\d{3})$/);
      const n = m ? Number(m[1]) : NaN;
      if (!Number.isFinite(n)) {
        const key = "その他";
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(c);
        continue;
      }
      const start = Math.floor((n - 1) / rangeSize) * rangeSize + 1;
      const end = start + rangeSize - 1;
      const key = `${String(start).padStart(3,"0")}〜${String(end).padStart(3,"0")}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    }

    const blocks = [];
    for (const [key, list] of buckets.entries()) {
      if (!list.length) continue;
      blocks.push(`<div class="sectionTitle">${key}<span class="badge">${list.length}件</span></div>`);
      blocks.push(`<div class="cityGroupGrid cityGroupGrid--3col">${list.map(cityRowHTML).join("")}</div>`);
    }
    return blocks.join("");
  }

  const groups = new Map();
  for (const c of items) {
    const kana = extractReadingKana(c.name);
    const row = gojuonRowLabelFromKanaChar(kana);
    if (!groups.has(row)) groups.set(row, []);
    groups.get(row).push(c);
  }

  const out = [];
  for (const row of rowOrder) {
    const list = groups.get(row) || [];
    if (!list.length) continue;
    out.push(`<div class="sectionTitle">${row}<span class="badge">${list.length}件</span></div>`);
    out.push(`<div class="cityGroupGrid cityGroupGrid--3col">${list.map(cityRowHTML).join("")}</div>`);
  }
  return out.join("");
}

function addSection(blocks, title, items) {
  if (!items || items.length === 0) return;
  blocks.push(`<div class="sectionTitle">${title}<span class="badge">${items.length}件</span></div>`);
  blocks.push(...items.map(cityRowHTML));
}

function renderHokkaido() {
  const blocks = [];
  const areaValue = state.selectedArea || "all";
  const valueToAreaName = { doto: "道東", dohoku: "道北", dochuo: "道央", donan: "道南" };
  const onlyAreaName = valueToAreaName[areaValue] || null;

  let visibleTotal = 0;

  // 「すべて」表示時のみ、最上段に「北海道（全選択）」を出す
  if (areaValue === "all") {
    const allCities = [];
    allCities.push(...SAPPORO_WARDS);
    for (const aName of Object.keys(HOKKAIDO_GROUPED)) {
      const bureaus = HOKKAIDO_GROUPED[aName] ?? {};
      for (const bName of Object.keys(bureaus)) allCities.push(...(bureaus[bName] ?? []));
    }

    const listAll = applyFilters(allCities);
    const allSelectedPref = allCities.length > 0 && allCities.every((c) => isCitySelected("01", c.code));
    const allCheckedPref = allSelectedPref ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="hokkaidoPrefSelectAll" type="checkbox" ${allCheckedPref} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">北海道（全選択）</span>` +
        `<span class="badge">${listAll.length}件</span>` +
      `</div>`
    );
  }

  if (areaValue === "all" || areaValue === "sapporo") {
    const listRaw = SAPPORO_WARDS;
    const wards = applyFilters(listRaw);
    visibleTotal += wards.length;

    const allSelected = listRaw.length > 0 && listRaw.every((c) => isCitySelected("01", c.code));
    const allChecked = allSelected ? "checked" : "";

    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="hokkaidoAreaSelectAll" type="checkbox" data-area="sapporo" ${allChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">札幌市（10区）</span>` +
        `<span class="badge">${wards.length}件</span>` +
      `</div>`
    );
    blocks.push(...wards.map(cityRowHTML));
  }

  const areaOrder = ["道東","道北","道央","道南"];
  for (const areaName of areaOrder) {
    if (onlyAreaName && areaName !== onlyAreaName) continue;
    const bureaus = HOKKAIDO_GROUPED[areaName];

    const areaRaw = Object.values(bureaus ?? {}).flat();
    const areaAllSelected = areaRaw.length > 0 && areaRaw.every((c) => isCitySelected("01", c.code));
    const areaAllChecked = areaAllSelected ? "checked" : "";

    // count
    let areaCount = 0;
    for (const bName of Object.keys(bureaus)) areaCount += applyFilters(bureaus[bName]).length;
    if (areaCount === 0) continue;
    visibleTotal += areaCount;

    const valueKey = Object.entries(valueToAreaName).find(([, v]) => v === areaName)?.[0] ?? "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="hokkaidoAreaSelectAll" type="checkbox" data-area="${valueKey}" ${areaAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">${areaName}</span>` +
        `<span class="badge">${areaCount}件</span>` +
      `</div>`
    );
    for (const bureauNameRaw of Object.keys(bureaus)) {
      const list = applyFilters(bureaus[bureauNameRaw]);
      if (list.length === 0) continue;
      const bureauName = stripBureau(bureauNameRaw);
      blocks.push(`<div class="subTitle">${bureauName}<span class="badge">${list.length}件</span></div>`);
      blocks.push(...list.map(cityRowHTML));
    }
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  setAreaCount(`表示：${visibleTotal}件`);
  const flatCount = SAPPORO_WARDS.length + Object.values(HOKKAIDO_GROUPED).flatMap(x => Object.values(x)).flat().length;
  cityCountEl.textContent = `${flatCount}件（デモ抜粋）`;
}

function renderAomori() {
  const blocks = [];

  // ✅まず「津軽/南部/下北」を出す（その中で“青森市の街(例)”を先頭に置く）
  const prefCode = state.selectedPrefCode;
  const q = citySearchEl.value.trim();
  const onlySelected = onlySelectedEl.checked;

  const apply = (list) => {
    let out = list;
    if (q) out = out.filter(c => c.name.includes(q));
    if (onlySelected && prefCode) out = out.filter(c => isCitySelected(prefCode, c.code));
    return out;
  };

  const areaValue = state.selectedArea || "all";
  const valueToAreaName = { tsugaru: "津軽", nanbu: "南部", shimokita: "下北" };
  const onlyAreaName = valueToAreaName[areaValue] || null;
  const showAomoriCity = (areaValue === "all" || areaValue === "aomori_city");
  const showOtherAreas = (areaValue === "all" || Object.prototype.hasOwnProperty.call(valueToAreaName, areaValue));

  let visibleTotal = 0;

  // 「すべて」表示時のみ、最上段に「青森県（全選択）」を出す
  if (areaValue === "all") {
    const allCities = [];
    allCities.push(...AOMORI_AOMORI_CITY_AREAS);
    for (const aName of Object.keys(AOMORI_GROUPED)) {
      const districts = AOMORI_GROUPED[aName] ?? {};
      for (const dName of Object.keys(districts)) allCities.push(...(districts[dName] ?? []));
    }

    const listAll = apply(allCities);
    const allSelectedPref = allCities.length > 0 && allCities.every((c) => isCitySelected("02", c.code));
    const allCheckedPref = allSelectedPref ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="aomoriPrefSelectAll" type="checkbox" ${allCheckedPref} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">青森県</span>` +
        `<span class="badge">${listAll.length}件</span>` +
      `</div>`
    );
  }

  const areaOrder = ["津軽","南部","下北"];
  if (showOtherAreas) {
    for (const areaName of areaOrder) {
      if (onlyAreaName && areaName !== onlyAreaName) continue;
      const districts = AOMORI_GROUPED[areaName];

    const areaAll = Object.values(districts ?? {}).flat();
    const areaAllSelected = areaAll.length > 0 && areaAll.every((c) => isCitySelected("02", c.code));
    const areaAllChecked = areaAllSelected ? "checked" : "";

    // area内合計
    let areaCount = 0;
    for (const dName of Object.keys(districts)) areaCount += apply(districts[dName]).length;
    if (areaCount === 0) continue;
    visibleTotal += areaCount;

    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="aomoriAreaSelectAll" type="checkbox" data-area="${areaName}" ${areaAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">${areaName}</span>` +
        `<span class="badge">${areaCount}件</span>` +
      `</div>`
    );
      for (const districtName of Object.keys(districts)) {
        const list = apply(districts[districtName]);
        if (list.length === 0) continue;
        blocks.push(`<div class="subTitle">${districtName}<span class="badge">${list.length}件</span></div>`);
        blocks.push(...list.map(cityRowHTML));
      }
    }
  }

  // 青森市（街・エリア）は末尾へ移動
  if (showAomoriCity) {
    const listRaw = AOMORI_AOMORI_CITY_AREAS;
    const aomoriAreas = apply(listRaw);
    visibleTotal += aomoriAreas.length;

    const allSelected = listRaw.length > 0 && listRaw.every((c) => isCitySelected("02", c.code));
    const allChecked = allSelected ? "checked" : "";

    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="aomoriAreaSelectAll" type="checkbox" data-area="aomori_city" ${allChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">青森市（街・エリア）</span>` +
        `<span class="badge">${aomoriAreas.length}件</span>` +
      `</div>`
    );
    blocks.push(...aomoriAreas.map(cityRowHTML));
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  setAreaCount(`表示：${visibleTotal}件`);

  // 件数（登録）
  const flatCount =
    AOMORI_AOMORI_CITY_AREAS.length +
    Object.values(AOMORI_GROUPED).flatMap(x => Object.values(x)).flat().length;
  cityCountEl.textContent = `登録：${flatCount}件`;
}

function renderIwate() {
  const blocks = [];

  const areaKey = state.selectedArea || "all";
  const areaOrder = ["県北", "県央", "沿岸", "県南"];
  const chosenAreas = (areaKey === "all") ? areaOrder : [areaKey];

  let visibleTotal = 0;

  // 「すべて」表示時のみ、最上段に「岩手県（全選択）」を出す
  if (areaKey === "all") {
    const allCities = Object.values(IWATE_GROUPED).flat();
    const listAll = applyFilters(allCities);
    const allSelectedPref = allCities.length > 0 && allCities.every((c) => isCitySelected("03", c.code));
    const allCheckedPref = allSelectedPref ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="iwatePrefSelectAll" type="checkbox" ${allCheckedPref} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">岩手県</span>` +
        `<span class="badge">${listAll.length}件</span>` +
      `</div>`
    );

    // 盛岡市だけを県北の上へ（「すべて」表示時のみ）
    const morioka = (IWATE_GROUPED["県央"] ?? []).find((c) => c.code === "03201");
    if (morioka) {
      const moriokaList = applyFilters([morioka]);
      visibleTotal += moriokaList.length;
      if (moriokaList.length) blocks.push(cityRowHTML(morioka));
    }
  }

  for (const name of chosenAreas) {
    // 「すべて」表示時は、盛岡市(03201)を県央から抜いて先頭に出す
    const listRawBase = IWATE_GROUPED[name] ?? [];
    const listRaw = (areaKey === "all" && name === "県央")
      ? listRawBase.filter((c) => c.code !== "03201")
      : listRawBase;
    const list = applyFilters(listRaw);
    visibleTotal += list.length;

    const allSelected = listRaw.length > 0 && listRaw.every((c) => isCitySelected("03", c.code));
    const allChecked = allSelected ? "checked" : "";

    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="iwateAreaSelectAll" type="checkbox" data-area="${name}" ${allChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">${name}</span>` +
        `<span class="badge">${list.length}件</span>` +
      `</div>`
    );

    blocks.push(...list.map(cityRowHTML));
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  const flatCount = Object.values(IWATE_GROUPED).flat().length;
  cityCountEl.textContent = `登録：${flatCount}件`;
  setAreaCount(`表示：${visibleTotal}件`);
}

function areaMultiSelectHTML(areaName, citiesAll) {
  const options = citiesAll.map((c) => {
    const selected = isCitySelected("04", c.code) ? "selected" : "";
    return `<option value="${c.code}" ${selected}>${c.name}</option>`;
  }).join("");
  return `<select class="areaMultiSelect" multiple size="6" data-area="${areaName}">${options}</select>`;
}

function cityRowHTMLWithArea(c, areaName) {
  const checked = isCitySelected(state.selectedPrefCode, c.code) ? "checked" : "";
  const label = normalizeRubyLabel(c.name);
  return `
    <label class="cityItem">
      <input type="checkbox" name="city" value="${c.code}" data-area="${areaName}" ${checked} />
      <span class="cityName">${label}</span>
      ${countBadgeHTML(state.selectedPrefCode, c.code)}
    </label>
  `;
}

function renderMiyagi() {
  const blocks = [];

  const areaKey = state.selectedArea || "all";
  // 宮城は「仙台・松島」を最上段にする
  const areaOrder = ["仙台", "松島", "三陸", "県北", "県南"];
  const chosenAreas = (areaKey === "all") ? areaOrder : [areaKey];

  let visibleTotal = 0;

  // 「すべて」表示時のみ、最上段に「宮城県（全選択）」を出す
  if (areaKey === "all") {
    const allCities = Object.values(MIYAGI_GROUPED).flat();
    const listAll = applyFilters(allCities);
    const allSelectedPref = allCities.length > 0 && allCities.every((c) => isCitySelected("04", c.code));
    const allCheckedPref = allSelectedPref ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="miyagiPrefSelectAll" type="checkbox" ${allCheckedPref} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">宮城県</span>` +
        `<span class="badge">${listAll.length}件</span>` +
      `</div>`
    );
  }

  for (const areaName of chosenAreas) {
    const citiesAll = MIYAGI_GROUPED[areaName] ?? [];
    const list = applyFilters(citiesAll);
    visibleTotal += list.length;

    const allSelected = citiesAll.length > 0 && citiesAll.every((c) => isCitySelected("04", c.code));
    const allChecked = allSelected ? "checked" : "";

    // チェックボックス：左、エリア名：中央、該当件数：右
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="areaSelectAll" type="checkbox" data-area="${areaName}" ${allChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">${areaName}</span>` +
        `<span class="badge">${list.length}件</span>` +
      `</div>`
    );

    if (list.length === 0) {
      blocks.push(`<div class="empty">該当なし</div>`);
      continue;
    }

    blocks.push(...list.map((c) => cityRowHTMLWithArea(c, areaName)));
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  const flatCount = Object.values(MIYAGI_GROUPED).flat().length;
  cityCountEl.textContent = `登録：${flatCount}件`;
  setAreaCount(`表示：${visibleTotal}件`);
}

function renderNormalPref(prefCode) {
  cityListEl.innerHTML = `<div class="empty">このデモは「北海道(01)」「青森県(02)」「岩手県(03)」「宮城県(04)」「秋田県(05)」「山形県(06)」「福島県(07)」「茨城県(08)」「栃木県(09)」の右側表示を実装済みです。<br/>他県も同様に拡張できます。</div>`;
  cityCountEl.textContent = "";
  setAreaCount("");
}

function renderTochigi() {
  const blocks = [];
  let visibleTotal = 0;

  const prefCode = state.selectedPrefCode;
  const allCitiesRaw = TOCHIGI_ALL_CITIES;

  // 一番上：栃木県（全選択）
  {
    const listAllVisible = applyFilters(allCitiesRaw);
    const prefAllSelected = allCitiesRaw.length > 0 && allCitiesRaw.every((c) => isCitySelected("09", c.code));
    const prefAllChecked = prefAllSelected ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="tochigiPrefSelectAll" type="checkbox" ${prefAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">栃木県</span>` +
        `<span class="badge">${listAllVisible.length}件</span>` +
      `</div>`
    );
  }

  // 宇都宮（枠）
  {
    const utsunomiyaCity = { code: "09201", name: "宇都宮市" };
    const utsunomiyaRaw = [utsunomiyaCity, ...TOCHIGI_UTSUNOMIYA_AREAS];
    const utsunomiyaVisible = applyFilters(utsunomiyaRaw);
    visibleTotal += utsunomiyaVisible.length;

    const utsunomiyaAllSelected =
      utsunomiyaRaw.length > 0 && utsunomiyaRaw.every((c) => isCitySelected("09", c.code));
    const utsunomiyaAllChecked = utsunomiyaAllSelected ? "checked" : "";

    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="tochigiUtsunomiyaSelectAll" type="checkbox" ${utsunomiyaAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">宇都宮</span>` +
        `<span class="badge">${utsunomiyaVisible.length}件</span>` +
      `</div>`
    );

    // 宇都宮市（市）を先頭に
    const utsCityVisible = applyFilters([utsunomiyaCity]);
    blocks.push(...utsCityVisible.map(cityRowHTML));

    // その下：ア行〜ラ行
    const kanaOrder = ["ア行", "カ行", "サ行", "タ行", "ナ行", "ハ行", "マ行", "ヤ行", "ラ行"];
    for (const kana of kanaOrder) {
      const groupRaw = TOCHIGI_UTSUNOMIYA_AREAS_GROUPED[kana] ?? [];
      const groupVisible = applyFilters(groupRaw);
      if (groupVisible.length === 0) continue;
      blocks.push(`<div class="subTitle">${kana}<span class="badge">${groupVisible.length}件</span></div>`);
      blocks.push(...groupVisible.map(cityRowHTML));
    }
  }

  // その他：栃木県の市区町村（宇都宮市以外）
  {
    const othersVisible = applyFilters(TOCHIGI_MUNICIPALITIES);
    visibleTotal += othersVisible.length;
    blocks.push(`<div class="sectionTitle">その他<span class="badge">${othersVisible.length}件</span></div>`);
    blocks.push(...othersVisible.map(cityRowHTML));
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  cityCountEl.textContent = `登録：${allCitiesRaw.length}件`;
  setAreaCount(`表示：${visibleTotal}件`);
}

function renderGunma() {
  const blocks = [];
  let visibleTotal = 0;

  const areaKey = state.selectedArea || "all";

  const allCitiesRaw = GUNMA_ALL_CITIES;

  // 「すべて」表示時のみ、最上段に「群馬県（全選択）」を出す
  if (areaKey === "all") {
    const listAllVisible = applyFilters(allCitiesRaw);
    const prefAllSelected = allCitiesRaw.length > 0 && allCitiesRaw.every((c) => isCitySelected("10", c.code));
    const prefAllChecked = prefAllSelected ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="gunmaPrefSelectAll" type="checkbox" ${prefAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">群馬県</span>` +
        `<span class="badge">${listAllVisible.length}件</span>` +
      `</div>`
    );
  }

  // 前橋（枠）
  if (areaKey === "all" || areaKey === "前橋市") {
    const maebashiCity = { code: "10201", name: "前橋市" };
    const maebashiAreasRaw = (Array.isArray(GUNMA_MAEBASHI_AREAS) ? GUNMA_MAEBASHI_AREAS : []);

    // チェックの対象は「前橋市 + 地区」だが、表示は「地区のみ」にする（重複の前橋市行を消す）
    const maebashiPool = [maebashiCity, ...maebashiAreasRaw];
    const maebashiAreasVisible = applyFilters(maebashiAreasRaw);
    visibleTotal += maebashiAreasVisible.length;

    const maebashiAllSelected = maebashiPool.length > 0 && maebashiPool.every((c) => isCitySelected("10", c.code));
    const maebashiAllChecked = maebashiAllSelected ? "checked" : "";

    // ヘッダ：左にチェック、右に件数
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="gunmaMaebashiSelectAll" type="checkbox" ${maebashiAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">前橋市</span>` +
        `<span class="badge">${maebashiAreasVisible.length}件</span>` +
      `</div>`
    );

    // 前橋市枠は常に3列固定（ここだけは崩さない）
    blocks.push(
      `<div class="cityGroupGrid cityGroupGrid--maebashi">` +
        maebashiAreasVisible.map(cityRowHTML).join("") +
      `</div>`
    );
  }

  // 高崎（枠）
  if (areaKey === "all" || areaKey === "高崎市") {
    const takasakiCity = { code: "10202", name: "高崎市" };
    const takasakiRaw = [takasakiCity, ...(Array.isArray(GUNMA_TAKASAKI_AREAS) ? GUNMA_TAKASAKI_AREAS : [])];
    const takasakiVisible = applyFilters(takasakiRaw);
    visibleTotal += takasakiVisible.length;

    const takasakiAllSelected = takasakiRaw.length > 0 && takasakiRaw.every((c) => isCitySelected("10", c.code));
    const takasakiAllChecked = takasakiAllSelected ? "checked" : "";

    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="gunmaTakasakiSelectAll" type="checkbox" ${takasakiAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">高崎市</span>` +
        `<span class="badge">${takasakiVisible.length}件</span>` +
      `</div>`
    );

    // 高崎枠は3列固定
    blocks.push(
      `<div class="cityGroupGrid cityGroupGrid--3col">` +
        takasakiVisible.map(cityRowHTML).join("") +
      `</div>`
    );
  }

  // 太田市（枠）
  if (areaKey === "all" || areaKey === "太田市") {
    const otaCity = { code: "10205", name: "太田市" };
    const otaAreasRaw = (Array.isArray(GUNMA_OTA_AREAS) ? GUNMA_OTA_AREAS : []);

    // チェックの対象は「太田市 + 町名」だが、表示は「町名のみ」にする（重複の太田市行を消す）
    const otaPool = [otaCity, ...otaAreasRaw];
    const otaAreasVisible = applyFilters(otaAreasRaw);
    visibleTotal += otaAreasVisible.length;

    const otaAllSelected = otaPool.length > 0 && otaPool.every((c) => isCitySelected("10", c.code));
    const otaAllChecked = otaAllSelected ? "checked" : "";

    // ヘッダ：左にチェック、右に件数
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="gunmaOtaSelectAll" type="checkbox" ${otaAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">太田市</span>` +
        `<span class="badge">${otaAreasVisible.length}件</span>` +
      `</div>`
    );

    // 太田市枠（町名）は3列固定
    blocks.push(
      `<div class="cityGroupGrid cityGroupGrid--3col">` +
        otaAreasVisible.map(cityRowHTML).join("") +
      `</div>`
    );
  }

  // 伊勢崎市（枠）
  if (areaKey === "all" || areaKey === "伊勢崎市") {
    const isesakiCity = { code: "10204", name: "伊勢崎市" };
    const isesakiAreasRaw = (Array.isArray(GUNMA_ISESAKI_AREAS) ? GUNMA_ISESAKI_AREAS : []);

    // チェックの対象は「伊勢崎市 + 町名」だが、表示は「町名のみ」にする（重複の伊勢崎市行を消す）
    const isesakiPool = [isesakiCity, ...isesakiAreasRaw];
    const isesakiAreasVisible = applyFilters(isesakiAreasRaw);
    visibleTotal += isesakiAreasVisible.length;

    const isesakiAllSelected =
      isesakiPool.length > 0 && isesakiPool.every((c) => isCitySelected("10", c.code));
    const isesakiAllChecked = isesakiAllSelected ? "checked" : "";

    // ヘッダ：左にチェック、右に件数
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="gunmaIsesakiSelectAll" type="checkbox" ${isesakiAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">伊勢崎市</span>` +
        `<span class="badge">${isesakiAreasVisible.length}件</span>` +
      `</div>`
    );

    // 伊勢崎市枠（町名）は3列固定
    blocks.push(
      `<div class="cityGroupGrid cityGroupGrid--3col">` +
        isesakiAreasVisible.map(cityRowHTML).join("") +
      `</div>`
    );
  }

  // 桐生市（枠）
  if (areaKey === "all" || areaKey === "桐生市") {
    const kiryuCity = { code: "10203", name: "桐生市" };
    const kiryuGroupedRaw = (typeof GUNMA_KIRYU_AREAS_GROUPED === "object" && GUNMA_KIRYU_AREAS_GROUPED)
      ? GUNMA_KIRYU_AREAS_GROUPED
      : {};

    const groupOrder = [
      "中央地域",
      "新里地域",
      "黒保根地域",
      "桐生市その他",
    ];

    const kiryuAreasRaw = groupOrder.flatMap((k) => (Array.isArray(kiryuGroupedRaw[k]) ? kiryuGroupedRaw[k] : []));
    const kiryuPool = [kiryuCity, ...kiryuAreasRaw];

    let kiryuVisibleTotal = 0;
    const groupVisibleMap = Object.fromEntries(
      groupOrder.map((k) => {
        const raw = (Array.isArray(kiryuGroupedRaw[k]) ? kiryuGroupedRaw[k] : []);
        const visible = applyFilters(raw);
        kiryuVisibleTotal += visible.length;
        return [k, visible];
      })
    );

    visibleTotal += kiryuVisibleTotal;

    const kiryuAllSelected = kiryuPool.length > 0 && kiryuPool.every((c) => isCitySelected("10", c.code));
    const kiryuAllChecked = kiryuAllSelected ? "checked" : "";

    // ヘッダ：左にチェック、右に件数
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="gunmaKiryuSelectAll" type="checkbox" ${kiryuAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">桐生市</span>` +
        `<span class="badge">${kiryuVisibleTotal}件</span>` +
      `</div>`
    );

    // 桐生市枠（町名）は3列固定。見出しは枠内で全幅表示
    const inner = [];
    for (const k of groupOrder) {
      const visible = groupVisibleMap[k] ?? [];
      if (visible.length === 0) continue;
      inner.push(`<div class="subTitle">${k}<span class="badge">${visible.length}件</span></div>`);
      inner.push(...visible.map(cityRowHTML));
    }

    blocks.push(
      `<div class="cityGroupGrid cityGroupGrid--3col">` +
        inner.join("") +
      `</div>`
    );
  }

  // その他枠：群馬の地方区分（中毛/西毛/東毛/北毛）
  {
    const groupOrder = ["中毛", "西毛", "東毛", "北毛"];
    for (const gName of groupOrder) {
      if (areaKey !== "all" && areaKey !== gName) continue;
      const raw = (typeof GUNMA_GROUPED === "object" && GUNMA_GROUPED) ? (GUNMA_GROUPED[gName] ?? []) : [];
      const visible = applyFilters(raw);
      if (visible.length === 0) continue;
      visibleTotal += visible.length;

      const allSelected = raw.length > 0 && raw.every((c) => isCitySelected("10", c.code));
      const allChecked = allSelected ? "checked" : "";

      blocks.push(
        `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
          `<span class="areaHeaderLeft">` +
            `<label class="areaPick">` +
              `<input class="gunmaGroupSelectAll" data-area="${gName}" type="checkbox" ${allChecked} />` +
            `</label>` +
          `</span>` +
          `<span class="areaHeaderTitle">${gName}</span>` +
          `<span class="badge">${visible.length}件</span>` +
        `</div>`
      );

      // 地方区分も「市区町村行は常に3列固定」にする
      blocks.push(
        `<div class="cityGroupGrid cityGroupGrid--3col">` +
          visible.map(cityRowHTML).join("") +
        `</div>`
      );
    }
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  cityCountEl.textContent = `登録：${allCitiesRaw.length}件`;
  setAreaCount(`表示：${visibleTotal}件`);
}

function renderIbaraki() {
  const blocks = [];

  const areaKey = state.selectedArea || "all";

  const allCitiesRaw = IBARAKI_ALL_CITIES;
  let visibleTotal = 0;

  // 「すべて」表示時のみ、最上段に「茨城県（全選択）」を出す
  if (areaKey === "all") {
    const listAllVisible = applyFilters(allCitiesRaw);
    const prefAllSelected = allCitiesRaw.length > 0 && allCitiesRaw.every((c) => isCitySelected("08", c.code));
    const prefAllChecked = prefAllSelected ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="ibarakiPrefSelectAll" type="checkbox" ${prefAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">茨城県</span>` +
        `<span class="badge">${listAllVisible.length}件</span>` +
      `</div>`
    );
  }

  // 水戸（枠）
  if (areaKey === "all" || areaKey === "水戸") {
    const mitoRaw = [{ code: "08201", name: "水戸市" }, ...IBARAKI_MITO_AREAS];
    const mitoVisible = applyFilters(mitoRaw);
    visibleTotal += mitoVisible.length;
    const mitoAllSelected = mitoRaw.length > 0 && mitoRaw.every((c) => isCitySelected("08", c.code));
    const mitoAllChecked = mitoAllSelected ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="ibarakiMitoSelectAll" type="checkbox" ${mitoAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">水戸</span>` +
        `<span class="badge">${mitoVisible.length}件</span>` +
      `</div>`
    );
    blocks.push(...mitoVisible.map(cityRowHTML));
  }

  // つくば（枠）
  if (areaKey === "all" || areaKey === "つくば") {
    const tsukubaRaw = [{ code: "08220", name: "つくば市" }, ...IBARAKI_TSUKUBA_AREAS];
    const tsukubaVisible = applyFilters(tsukubaRaw);
    visibleTotal += tsukubaVisible.length;
    const tsukubaAllSelected = tsukubaRaw.length > 0 && tsukubaRaw.every((c) => isCitySelected("08", c.code));
    const tsukubaAllChecked = tsukubaAllSelected ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="ibarakiTsukubaSelectAll" type="checkbox" ${tsukubaAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">つくば</span>` +
        `<span class="badge">${tsukubaVisible.length}件</span>` +
      `</div>`
    );
    blocks.push(...tsukubaVisible.map(cityRowHTML));
  }

  // 日立（枠）
  if (areaKey === "all" || areaKey === "日立") {
    const hitachiRaw = [{ code: "08202", name: "日立市" }, ...IBARAKI_HITACHI_AREAS];
    const hitachiVisible = applyFilters(hitachiRaw);
    visibleTotal += hitachiVisible.length;
    const hitachiAllSelected = hitachiRaw.length > 0 && hitachiRaw.every((c) => isCitySelected("08", c.code));
    const hitachiAllChecked = hitachiAllSelected ? "checked" : "";
    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="ibarakiHitachiSelectAll" type="checkbox" ${hitachiAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">日立</span>` +
        `<span class="badge">${hitachiVisible.length}件</span>` +
      `</div>`
    );
    blocks.push(...hitachiVisible.map(cityRowHTML));
  }

  // 県央/県北/県南/鹿行
  const groupOrder = ["県央", "県北", "県南西部", "県南東部", "鹿行"];
  for (const gName of groupOrder) {
    if (areaKey !== "all" && areaKey !== gName) continue;

    const listRaw = (typeof IBARAKI_GROUPED === "object" && IBARAKI_GROUPED) ? (IBARAKI_GROUPED[gName] ?? []) : [];
    const listVisible = applyFilters(listRaw);
    visibleTotal += listVisible.length;

    const groupAllSelected = listRaw.length > 0 && listRaw.every((c) => isCitySelected("08", c.code));
    const groupAllChecked = groupAllSelected ? "checked" : "";

    blocks.push(
      `<div class="sectionTitleRow sectionTitleRow--miyagi">` +
        `<span class="areaHeaderLeft">` +
          `<label class="areaPick">` +
            `<input class="ibarakiGroupSelectAll" type="checkbox" data-area="${gName}" ${groupAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="areaHeaderTitle">${gName}</span>` +
        `<span class="badge">${listVisible.length}件</span>` +
      `</div>`
    );
    blocks.push(...listVisible.map(cityRowHTML));
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  cityCountEl.textContent = `登録：${allCitiesRaw.length}件`;
  setAreaCount(`表示：${visibleTotal}件`);
}

function renderFukushima() {
  const blocks = [];

  const prefCode = state.selectedPrefCode;
  const q = citySearchEl.value.trim();
  const onlySelected = onlySelectedEl.checked;
  const areaKey = state.selectedArea || "all";

  const apply = (list) => {
    let out = list;
    if (q) out = out.filter((c) => c.name.includes(q));
    if (onlySelected && prefCode) out = out.filter((c) => isCitySelected(prefCode, c.code));
    return out;
  };

  // 福島市（最上段）+ 町名（その下：あ行〜わ行）
  const fukushimaCity = { code: "07201", name: "福島市" };
  const cityList = apply([fukushimaCity]);
  const areaFlat = apply(FUKUSHIMA_FUKUSHIMA_CITY_AREAS);
  const boxCount = cityList.length + areaFlat.length;

  const fukushimaAllSelected = [fukushimaCity, ...FUKUSHIMA_FUKUSHIMA_CITY_AREAS]
    .every((c) => isCitySelected("07", c.code));
  const fukushimaAllChecked = fukushimaAllSelected ? "checked" : "";

  let boxVisible = 0;
  if (areaKey === "all" || areaKey === "福島市") {
    boxVisible = boxCount;
    blocks.push(`<div class="fukushimaBox">`);
    blocks.push(
      `<div class="fukushimaBoxHead">` +
        `<span class="fukushimaBoxLeft">` +
          `<label class="areaPick">` +
            `<input class="fukushimaSelectAll" type="checkbox" ${fukushimaAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="fukushimaBoxTitle">福島県</span>` +
        `<span class="badge">${boxCount}</span>` +
      `</div>`
    );

    blocks.push(`<div class="fukushimaBoxGrid">`);
    blocks.push(...cityList.map(cityRowHTML));

    // グループ見出し（あ行〜わ行）と町名
    for (const [kana, itemsRaw] of Object.entries(FUKUSHIMA_FUKUSHIMA_CITY_AREAS_GROUPED)) {
      const items = apply(itemsRaw);
      if (items.length === 0) continue;
      blocks.push(`<div class="fukushimaKanaTitle">福島市${kana}</div>`);
      blocks.push(...items.map(cityRowHTML));
    }

    blocks.push(`</div>`);
    blocks.push(`</div>`);
  }

  // 福島市以外：中通り / 浜通り / 会津 の枠へ配置
  const groupOrder = ["中通り", "浜通り", "会津"];
  let groupsVisible = 0;
  for (const gName of groupOrder) {
    if (areaKey !== "all" && areaKey !== gName) continue;

    const listRaw = (typeof FUKUSHIMA_GROUPED === "object" && FUKUSHIMA_GROUPED) ? (FUKUSHIMA_GROUPED[gName] ?? []) : [];
    const list = apply(listRaw);
    if (list.length === 0) continue;
    groupsVisible += list.length;

    const groupAllSelected = listRaw.length > 0 && listRaw.every((c) => isCitySelected("07", c.code));
    const groupAllChecked = groupAllSelected ? "checked" : "";

    blocks.push(`<div class="fukushimaRegionBox">`);
    blocks.push(
      `<div class="fukushimaRegionBoxHead">` +
        `<span class="fukushimaRegionBoxLeft">` +
          `<label class="areaPick">` +
            `<input class="fukushimaGroupSelectAll" type="checkbox" data-area="${gName}" ${groupAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="fukushimaRegionBoxTitle">${gName}</span>` +
        `<span class="badge">${list.length}</span>` +
      `</div>`
    );
    blocks.push(`<div class="fukushimaRegionGrid">`);
    blocks.push(...list.map(cityRowHTML));
    blocks.push(`</div>`);
    blocks.push(`</div>`);
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  const flatCount = FUKUSHIMA_MUNICIPALITIES.length + FUKUSHIMA_FUKUSHIMA_CITY_AREAS.length;
  cityCountEl.textContent = `登録：${flatCount}件`;
  setAreaCount(`表示：${boxVisible + groupsVisible}件`);
}

function renderAkita() {
  const blocks = [];

  const prefCode = state.selectedPrefCode;
  const q = citySearchEl.value.trim();
  const onlySelected = onlySelectedEl.checked;
  const areaKey = state.selectedArea || "all";

  const apply = (list) => {
    let out = list;
    if (q) out = out.filter(c => c.name.includes(q));
    if (onlySelected && prefCode) out = out.filter(c => isCitySelected(prefCode, c.code));
    return out;
  };

  // 秋田市（囲み）
  const akitaCity = { code: "05201", name: "秋田市" };
  const cityList = apply([akitaCity]);
  const areaList = apply(AKITA_AKITA_CITY_AREAS);
  const akitaBoxCount = cityList.length + areaList.length;

  const akitaAllSelected = [akitaCity, ...AKITA_AKITA_CITY_AREAS]
    .every((c) => isCitySelected("05", c.code));
  const akitaAllChecked = akitaAllSelected ? "checked" : "";

  if (areaKey === "all" || areaKey === "秋田市") {
    blocks.push(`<div class="akitaBox">`);
    blocks.push(
      `<div class="akitaBoxHead">` +
        `<span class="akitaBoxLeft">` +
          `<label class="areaPick">` +
            `<input class="akitaSelectAll" type="checkbox" ${akitaAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="akitaBoxTitle">秋田県</span>` +
        `<span class="badge">${akitaBoxCount}件</span>` +
      `</div>`
    );
    blocks.push(`<div class="akitaBoxGrid">`);
    blocks.push(...cityList.map(cityRowHTML));
    blocks.push(...areaList.map(cityRowHTML));
    blocks.push(`</div>`);
    blocks.push(`</div>`);
  }

  // 県北/県央/県南
  const groupOrder = ["県北", "県央", "県南"];
  let othersVisible = 0;
  for (const gName of groupOrder) {
    if (areaKey !== "all" && areaKey !== gName) continue;
    const list = apply(AKITA_GROUPED[gName] ?? []);
    othersVisible += list.length;

    const groupAllSelected = (AKITA_GROUPED[gName] ?? []).length > 0 && (AKITA_GROUPED[gName] ?? [])
      .every((c) => isCitySelected("05", c.code));
    const groupAllChecked = groupAllSelected ? "checked" : "";

    blocks.push(
      `<div class="akitaGroupTitle">` +
        `<span class="akitaGroupLeft">` +
          `<label class="areaPick">` +
            `<input class="akitaGroupSelectAll" type="checkbox" data-area="${gName}" ${groupAllChecked} />` +
          `</label>` +
          `<span>${gName}</span>` +
        `</span>` +
        `<span class="badge">${list.length}件</span>` +
      `</div>`
    );
    blocks.push(...list.map(cityRowHTML));
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;
  const flatCount = AKITA_MUNICIPALITIES.length + AKITA_AKITA_CITY_AREAS.length;
  cityCountEl.textContent = `登録：${flatCount}件`;
  const akitaVisible = (areaKey === "all" || areaKey === "秋田市") ? akitaBoxCount : 0;
  setAreaCount(`表示：${akitaVisible + othersVisible}件`);
}

function renderYamagata() {
  const blocks = [];

  const prefCode = state.selectedPrefCode;
  const q = citySearchEl.value.trim();
  const onlySelected = onlySelectedEl.checked;
  const areaKey = state.selectedArea || "all";

  const apply = (list) => {
    let out = list;
    if (q) out = out.filter((c) => c.name.includes(q));
    if (onlySelected && prefCode) out = out.filter((c) => isCitySelected(prefCode, c.code));
    return out;
  };

  // 山形市（最上段）+ 町名（その下）
  const yamagataCity = { code: "06201", name: "山形市" };
  const cityList = apply([yamagataCity]);
  const areaList = apply(YAMAGATA_YAMAGATA_CITY_AREAS);
  const boxCount = cityList.length + areaList.length;

  const yamagataAllSelected = [yamagataCity, ...YAMAGATA_YAMAGATA_CITY_AREAS]
    .every((c) => isCitySelected("06", c.code));
  const yamagataAllChecked = yamagataAllSelected ? "checked" : "";

  let boxVisible = 0;
  if (areaKey === "all" || areaKey === "山形市") {
    boxVisible = boxCount;
    blocks.push(`<div class="yamagataBox">`);
    blocks.push(
      `<div class="yamagataBoxHead">` +
        `<span class="yamagataBoxLeft">` +
          `<label class="areaPick">` +
            `<input class="yamagataSelectAll" type="checkbox" ${yamagataAllChecked} />` +
          `</label>` +
        `</span>` +
        `<span class="yamagataBoxTitle">山形県</span>` +
        `<span class="badge">${boxCount}</span>` +
      `</div>`
    );
    blocks.push(`<div class="yamagataBoxGrid">`);
    blocks.push(...cityList.map(cityRowHTML));
    blocks.push(...areaList.map(cityRowHTML));
    blocks.push(`</div>`);
    blocks.push(`</div>`);
  }

  // 村山 / 置賜 / 庄内 / 最上
  const groupOrder = ["村山", "置賜", "庄内", "最上"];
  const chosenGroups = (areaKey === "all")
    ? groupOrder
    : (groupOrder.includes(areaKey) ? [areaKey] : []);

  let groupsVisible = 0;
  for (const gName of chosenGroups) {
    const listRaw = YAMAGATA_GROUPED[gName] ?? [];
    const list = apply(listRaw);
    groupsVisible += list.length;
    if (list.length === 0) continue;

    const groupAllSelected = listRaw.length > 0 && listRaw.every((c) => isCitySelected("06", c.code));
    const groupAllChecked = groupAllSelected ? "checked" : "";

    blocks.push(
      `<div class="sectionTitleRow">` +
        `<span class="yamagataGroupLeft">` +
          `<label class="areaPick">` +
            `<input class="yamagataGroupSelectAll" type="checkbox" data-area="${gName}" ${groupAllChecked} />` +
          `</label>` +
          `<span>${gName}</span>` +
        `</span>` +
        `<span class="badge">${list.length}</span>` +
      `</div>`
    );
    blocks.push(...list.map(cityRowHTML));
  }

  cityListEl.innerHTML = blocks.length ? blocks.join("") : `<div class="empty">該当なし</div>`;

  const flatCount = YAMAGATA_MUNICIPALITIES.length + YAMAGATA_YAMAGATA_CITY_AREAS.length;
  cityCountEl.textContent = `登録：${flatCount}件`;

  setAreaCount(`表示：${boxVisible + groupsVisible}件`);
}

function updateSummary() {
  if (isSimpleTab(state.activeTab)) {
    const meta = SIMPLE_TAB_META[state.activeTab];
    const options = getSimpleOptions(state.activeTab);
    const selectedSet = getSimpleSelectedSet(state.activeTab);
    if (!selectedSet || selectedSet.size === 0) {
      selectedSummaryEl.textContent = meta?.title ?? "未選択";
      return;
    }

    const names = options
      .filter((x) => selectedSet.has(x.code))
      .map((x) => x.name)
      .filter(Boolean);
    selectedSummaryEl.textContent = names.length ? names.join(" / ") : "未選択";
    return;
  }

  if (state.activeTab === "job") {
    if (state.selectedJobs.size === 0) {
      selectedSummaryEl.textContent = state.selectedJobCategoryId
        ? (getJobCategoryById(state.selectedJobCategoryId)?.name ?? "未選択")
        : "未選択";
      return;
    }

    const byCat = new Map();
    for (const key of state.selectedJobs) {
      const [catId, jobCode] = key.split(":");
      if (!catId || !jobCode) continue;
      if (!byCat.has(catId)) byCat.set(catId, []);
      byCat.get(catId).push(jobCode);
    }

    const parts = [];
    for (const [catId, codes] of byCat.entries()) {
      const cat = getJobCategoryById(catId);
      const catName = cat?.name ?? catId;
      const pool = (cat?.groups ?? []).flatMap((g) => (Array.isArray(g.jobs) ? g.jobs : []));
      const names = codes
        .map((code) => pool.find((x) => x.code === code)?.name ?? code)
        .filter(Boolean);
      parts.push(`${catName}：${names.join(" / ")}`);
    }
    selectedSummaryEl.textContent = parts.join(" ｜ ");
    return;
  }

  if (state.selectedCities.size === 0) {
    selectedSummaryEl.textContent = state.selectedPrefCode ? (PREFS[state.selectedPrefCode]?.name ?? "未選択") : "未選択";
    return;
  }

  const byPref = new Map();
  for (const key of state.selectedCities) {
    const [prefCode, cityCode] = key.split(":");
    if (!prefCode || !cityCode) continue;
    if (!byPref.has(prefCode)) byPref.set(prefCode, []);
    byPref.get(prefCode).push(cityCode);
  }

  const parts = [];
  for (const [prefCode, codes] of byPref.entries()) {
    const prefName = PREFS[prefCode]?.name ?? prefCode;
    const pool = getPoolForPref(prefCode);
    const names = codes
      .map(code => toPlainTextLabel(pool.find(x => x.code === code)?.name ?? code))
      .filter(Boolean);
    parts.push(`${prefName}：${names.join(" / ")}`);
  }

  selectedSummaryEl.textContent = parts.join(" ｜ ");
}

function buildSelectionLines() {
  if (state.selectedCities.size === 0) return [];

  const byPref = new Map();
  for (const key of state.selectedCities) {
    const [prefCode, cityCode] = key.split(":");
    if (!prefCode || !cityCode) continue;
    if (!byPref.has(prefCode)) byPref.set(prefCode, []);
    byPref.get(prefCode).push(cityCode);
  }

  const lines = [];
  for (const [prefCode, codes] of byPref.entries()) {
    const prefName = PREFS[prefCode]?.name ?? prefCode;
    const pool = getPoolForPref(prefCode);
    const names = codes
      .map(code => toPlainTextLabel(pool.find(x => x.code === code)?.name ?? code))
      .filter(Boolean);
    lines.push(`${prefName}: ${names.join(" / ")}`);
  }
  return lines;
}

function buildJobSelectionLines() {
  if (state.selectedJobs.size === 0) return [];

  const byCat = new Map();
  for (const key of state.selectedJobs) {
    const [catId, jobCode] = key.split(":");
    if (!catId || !jobCode) continue;
    if (!byCat.has(catId)) byCat.set(catId, []);
    byCat.get(catId).push(jobCode);
  }

  const lines = [];
  for (const [catId, codes] of byCat.entries()) {
    const cat = getJobCategoryById(catId);
    const catName = cat?.name ?? catId;
    const pool = (cat?.groups ?? []).flatMap((g) => (Array.isArray(g.jobs) ? g.jobs : []));
    const names = codes
      .map((code) => pool.find((x) => x.code === code)?.name ?? code)
      .filter(Boolean);
    lines.push(`${catName}: ${names.join(" / ")}`);
  }
  return lines;
}

function persistSelectionForEntry() {
  const payload = {
    savedAt: new Date().toISOString(),
    summary: selectedSummaryEl?.textContent ?? "",
    lines: buildSelectionLines(),
    cityKeys: Array.from(state.selectedCities),
  };

  try {
    localStorage.setItem("job:work_location_selection", JSON.stringify(payload));
  } catch {
    // file:// などで Storage が使えない場合は無視
  }
}

function persistJobSelectionForEntry() {
  const payload = {
    savedAt: new Date().toISOString(),
    summary: selectedSummaryEl?.textContent ?? "",
    lines: buildJobSelectionLines(),
    jobKeys: Array.from(state.selectedJobs),
  };

  try {
    localStorage.setItem("job:job_selection", JSON.stringify(payload));
  } catch {
    // file:// などで Storage が使えない場合は無視
  }
}

function buildSimpleSelectionLines(tab) {
  const options = getSimpleOptions(tab);
  const selectedSet = getSimpleSelectedSet(tab);
  if (!selectedSet || selectedSet.size === 0) return [];

  return options
    .filter((x) => selectedSet.has(x.code))
    .map((x) => x.name)
    .filter(Boolean);
}

function buildSalarySelectionLines() {
  const base = buildSimpleSelectionLines("salary");

  const group = state.salaryActiveGroup || "yearly";
  const desired = getSalaryDesiredForActiveGroup();
  if (!desired) return base;

  const lines = [...base];

  const range = (a, b, unit) => {
    const left = a ? `${a}${unit}` : "";
    const right = b ? `${b}${unit}` : "";
    if (left && right) return `${left}〜${right}`;
    return left || right || "";
  };

  if (group === "hourly") {
    const min = (desired.min || "").trim();
    const max = (desired.max || "").trim();
    const minH = (desired.minHoursPerDay || "").trim();
    const maxH = (desired.maxHoursPerDay || "").trim();
    const daysPerWeek = (desired.daysPerWeek || "").trim();
    const minDaysPerMonth = (desired.minDaysPerMonth || "").trim();

    const wageText = range(min, max, "円");
    if (wageText) lines.push(`時給: ${wageText}`);
    const hoursText = range(minH, maxH, "時間");
    if (hoursText) lines.push(`1日労働時間: ${hoursText}`);
    if (daysPerWeek) lines.push(`1週間: ${daysPerWeek}日`);
    if (minDaysPerMonth) lines.push(`1か月最低出勤日数: ${minDaysPerMonth}日`);
    return lines;
  }

  if (group === "monthly") {
    const min = (desired.min || "").trim();
    const max = (desired.max || "").trim();
    const text = range(min, max, "万円");
    if (text) lines.push(`月給: ${text}`);
    return lines;
  }

  // yearly
  {
    const min = (desired.min || "").trim();
    const max = (desired.max || "").trim();
    const text = range(min, max, "万円");
    if (text) lines.push(`年収: ${text}`);
  }
  return lines;
}

function persistSimpleSelectionForEntry(tab) {
  const meta = SIMPLE_TAB_META[tab];
  if (!meta?.storageKey) return;

  const payload = {
    savedAt: new Date().toISOString(),
    summary: selectedSummaryEl?.textContent ?? "",
    lines: (tab === "salary") ? buildSalarySelectionLines() : buildSimpleSelectionLines(tab),
    keys: Array.from(getSimpleSelectedSet(tab) || []),
    tab,
  };

  if (tab === "salary") {
    payload.desiredByGroup = state.salaryDesiredByGroup;
    payload.activeGroup = state.salaryActiveGroup;
  }

  try {
    localStorage.setItem(meta.storageKey, JSON.stringify(payload));
  } catch {
    // file:// などで Storage が使えない場合は無視
  }
}

function renderCities() {
  if (state.activeTab === "job") {
    renderJobLeft();
    renderJobs();
    return;
  }

  if (isSimpleTab(state.activeTab)) {
    renderSimpleTab();
    return;
  }

  const prefCode = state.selectedPrefCode;
  prefTitleEl.textContent = PREFS[prefCode]?.name ?? "未選択";

  // workタブ：検索UI/選択中のみ を消し、エリアセレクト＋総件数のレイアウトに寄せる
  const workToolsMode = (state.activeTab === "work");
  if (modalEl) modalEl.classList.toggle("workToolsMode", workToolsMode);

  if (workToolsMode) {
    if (citySearchEl) {
      citySearchEl.value = "";
      citySearchEl.disabled = true;
      citySearchEl.style.display = "none";
    }
    if (onlySelectedEl) {
      onlySelectedEl.checked = false;
      onlySelectedEl.disabled = true;
    }
    if (onlyWrapEl) onlyWrapEl.style.display = "none";
  } else {
    if (citySearchEl) {
      citySearchEl.disabled = false;
      citySearchEl.style.display = "";
    }
    if (onlySelectedEl) onlySelectedEl.disabled = false;
    if (onlyWrapEl) onlyWrapEl.style.display = "";
  }

  // エリアセレクトを右上へ移動
  if (areaBarEl && rightToolsEl && workToolsMode) {
    if (areaBarEl.parentElement !== rightToolsEl) rightToolsEl.prepend(areaBarEl);
  }
  if (areaBarEl && !workToolsMode) {
    if (areaBarHomeParentEl && areaBarEl.parentElement !== areaBarHomeParentEl) {
      if (areaBarHomeNextSibling) areaBarHomeParentEl.insertBefore(areaBarEl, areaBarHomeNextSibling);
      else areaBarHomeParentEl.appendChild(areaBarEl);
    }
  }

  // 総件数（都道府県の全体件数）を右上へ移動
  if (cityCountEl && rightToolsEl && workToolsMode) {
    if (cityCountEl.parentElement !== rightToolsEl) rightToolsEl.appendChild(cityCountEl);
  }
  if (cityCountEl && !workToolsMode) {
    if (cityCountHomeParentEl && cityCountEl.parentElement !== cityCountHomeParentEl) {
      if (cityCountHomeNextSibling) cityCountHomeParentEl.insertBefore(cityCountEl, cityCountHomeNextSibling);
      else cityCountHomeParentEl.appendChild(cityCountEl);
    }
  }

  if (workToolsMode && areaLabelEl) areaLabelEl.textContent = "エリア選択";
  updatePrefSelectAllUI(prefCode);

  if (citySearchEl) citySearchEl.placeholder = "市区町村を検索";

  ensureAreaOptionsForPref(prefCode);
  if (!prefCode) {
    setAreaCount("");
  }

  if (!prefCode) {
    cityCountEl.textContent = "";
    cityListEl.innerHTML = `<div class="empty">左で都道府県を選択すると、右に市区町村が表示されます</div>`;
    return;
  }

  if (prefCode === "01") renderHokkaido();
  else if (prefCode === "02") renderAomori();
  else if (prefCode === "03") renderIwate();
  else if (prefCode === "04") renderMiyagi();
  else if (prefCode === "05") renderAkita();
  else if (prefCode === "06") renderYamagata();
  else if (prefCode === "07") renderFukushima();
  else if (prefCode === "08") renderIbaraki();
  else if (prefCode === "09") renderTochigi();
  else if (prefCode === "10") renderGunma();
  else if (prefCode === "11") renderSaitama();
  else if (prefCode === "13") renderTokyo();
  else if (prefCode === "14") renderKanagawa();
  else renderNormalPref(prefCode);
}

function setActiveTab(tab) {
  const next = tab || "work";
  state.activeTab = next;

  const tabs = Array.from(document.querySelectorAll(".tabs .tab"));
  tabs.forEach((b) => b.classList.remove("active"));
  const found = tabs.find((b) => (b instanceof HTMLButtonElement) && b.getAttribute("data-tab") === next);
  if (found) found.classList.add("active");

  if (modalEl) modalEl.classList.toggle("jobMode", next === "job");
  if (modalEl) modalEl.classList.toggle("simpleMode", isSimpleTab(next));
  if (modalEl) modalEl.classList.toggle("salaryMode", next === "salary");

  if (leftTitleEl) {
    if (next === "job") leftTitleEl.textContent = "職種を選ぶ";
    else if (isSimpleTab(next)) leftTitleEl.textContent = SIMPLE_TAB_META[next]?.title ?? "条件を選ぶ";
    else leftTitleEl.textContent = "都道府県選択";
  }
  if (leftHelpEl) leftHelpEl.style.display = (next === "work") ? "block" : "none";

  // こだわり条件タブから「悪」を押す導線は削除（要件）
  const badBtn = document.getElementById("badPrefBtn");
  if (badBtn) badBtn.style.display = "none";

  // 「エリア」セレクトは work と station 以外では出さない（要件）
  const allowAreaSelect = (next === "work" || next === "station");

  if (stationAreaWrapEl) {
    stationAreaWrapEl.style.display = (next === "station") ? "" : "none";
  }

  if (areaBarEl) {
    if (allowAreaSelect && next === "work") {
      areaBarEl.style.display = "";
      // hidden のON/OFFは各render側で管理
    } else {
      areaBarEl.hidden = true;
      areaBarEl.style.display = "none";
    }
  }

  if (next === "job") {
    const cats = Array.isArray(JOB_CATEGORIES) ? JOB_CATEGORIES : [];
    if (!state.selectedJobCategoryId && cats.length) state.selectedJobCategoryId = cats[0].id;
    renderJobLeft();
  } else if (next === "work") {
    renderLeftAccordion();
  } else if (next === "salary") {
    renderSalaryLeft();
  } else {
    // simple tabs は左を使わないため、念のため空にする
    const rc = document.getElementById("regionContainer");
    if (rc) rc.innerHTML = "";
  }

  // 検索UIは共通。プレースホルダ等は各renderが設定。
  renderCities();
  updateSelectedCount();
  updateSummary();

  // URL へ反映（可能なら）
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    history.replaceState(null, "", url.toString());
  } catch {
    // file:// などは無視
  }
}

// ====== Events ======
document.addEventListener("click", (e) => {
  const t = e.target;

  // tabs
  const tabBtn = t.closest?.(".tabs .tab");
  if (tabBtn instanceof HTMLButtonElement) {
    const tab = tabBtn.getAttribute("data-tab") || "work";
    const next = (tab === "work" || tab === "job" || isSimpleTab(tab)) ? tab : "work";
    setActiveTab(next);
    return;
  }

  // job category
  const catBtn = t.closest?.(".jobCatBtn");
  if (catBtn instanceof HTMLButtonElement) {
    const salaryGroup = catBtn.getAttribute("data-salary-group") || "";
    if (salaryGroup) {
      state.salaryActiveGroup = salaryGroup;
      renderSalaryLeft();
      renderCities();
      updateSummary();
      return;
    }

    const catId = catBtn.getAttribute("data-job-cat") || "";
    state.selectedJobCategoryId = catId;
    renderCities();
    updateSummary();
    return;
  }

  // salary（時給）：最低/最大時給のプリセット選択（入口ページ6番へ転記）
  const pickBtn = t.closest?.("button[data-salary-pick][data-salary-value]");
  if (pickBtn instanceof HTMLButtonElement) {
    if (state.activeTab !== "salary") return;
    if ((state.salaryActiveGroup || "yearly") !== "hourly") return;

    const which = pickBtn.getAttribute("data-salary-pick") || "";
    const value = (pickBtn.getAttribute("data-salary-value") ?? "").trim();
    if (which !== "min" && which !== "max") return;

    const desired = getSalaryDesiredForActiveGroup();
    if (which === "min") desired.min = value;
    if (which === "max") desired.max = value;

    renderCities();
    updateSummary();
    persistSimpleSelectionForEntry("salary");
    return;
  }

  const head = t.closest?.(".regionHead");
  if (head) {
    if (state.activeTab !== "work") return;
    const idx = head.getAttribute("data-index");
    const body = document.querySelector(`.regionBody[data-index="${idx}"]`);
    const chev = head.querySelector(".chev");
    const isHidden = body.style.display === "none";
    body.style.display = isHidden ? "block" : "none";
    if (chev) chev.textContent = isHidden ? "▾" : "▸";
  }
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLSelectElement)) return;

  // salary：希望額（最低/最大）
  if (state.activeTab === "salary" && t instanceof HTMLInputElement && (
    t.matches("#salaryMin") || t.matches("#salaryMax") ||
    t.matches("#salaryMinHoursPerDay") || t.matches("#salaryMaxHoursPerDay") ||
    t.matches("#salaryDaysPerWeek") ||
    t.matches("#salaryMinDaysPerMonth") || t.matches("#salaryMaxDaysPerMonth") ||
    t.matches("#salaryMonthlyBonusCountMin") || t.matches("#salaryMonthlyBonusCountMax") ||
    t.matches("#salaryMonthlyBonusAmountMin") || t.matches("#salaryMonthlyBonusAmountMax")
  )) {
    const desired = getSalaryDesiredForActiveGroup();
    const v = (t.value || "").trim();
    if (t.matches("#salaryMin")) desired.min = v;
    if (t.matches("#salaryMax")) desired.max = v;
    if (t.matches("#salaryMinHoursPerDay")) desired.minHoursPerDay = v;
    if (t.matches("#salaryMaxHoursPerDay")) desired.maxHoursPerDay = v;
    if (t.matches("#salaryDaysPerWeek")) {
      desired.daysPerWeek = v;
      desired.minDaysPerMonth = calcMinDaysPerMonthFromDaysPerWeek(v);

      const minDaysInput = document.getElementById("salaryMinDaysPerMonth");
      if (minDaysInput instanceof HTMLInputElement) {
        const nextVal = desired.minDaysPerMonth;
        if ((minDaysInput.value || "").trim() !== nextVal) minDaysInput.value = nextVal;
      }
    }
    if (t.matches("#salaryMinDaysPerMonth")) desired.minDaysPerMonth = v;
    if (t.matches("#salaryMaxDaysPerMonth")) desired.maxDaysPerMonth = v;
    if (t.matches("#salaryMonthlyBonusCountMin")) desired.bonusCountMin = v;
    if (t.matches("#salaryMonthlyBonusCountMax")) desired.bonusCountMax = v;
    if (t.matches("#salaryMonthlyBonusAmountMin")) desired.bonusAmountMin = v;
    if (t.matches("#salaryMonthlyBonusAmountMax")) desired.bonusAmountMax = v;

    // 時給ページは「合計月収」をその場で更新
    if (state.salaryActiveGroup === "hourly") {
      const minHourly = toNum(desired?.min);
      const maxHourly = toNum(desired?.max);
      const minH = toNum(desired?.minHoursPerDay);
      const maxH = toNum(desired?.maxHoursPerDay);
      const minD = toNum(desired?.minDaysPerMonth);
      const maxDRaw = toNum(desired?.maxDaysPerMonth);
      const maxD = Number.isFinite(maxDRaw) ? maxDRaw : minD;
      const monthlyMin = (Number.isFinite(minHourly) && Number.isFinite(minH) && Number.isFinite(minD)) ? (minHourly * minH * minD) : null;
      const monthlyMax = (Number.isFinite(maxHourly) && Number.isFinite(maxH) && Number.isFinite(maxD)) ? (maxHourly * maxH * maxD) : null;
      const outMin = document.getElementById("salaryMonthlyMin");
      const outMax = document.getElementById("salaryMonthlyMax");
      if (outMin) outMin.textContent = (monthlyMin == null) ? "" : yen(monthlyMin);
      if (outMax) outMax.textContent = (monthlyMax == null) ? "" : yen(monthlyMax);
    }

    // 入力変更時点で入口ページ（6番目）へ転記
    persistSimpleSelectionForEntry("salary");

    // 月給ページは「年収/金額合計」をその場で更新（単位：万円）
    if (state.salaryActiveGroup === "monthly") {
      const minMonthlyMan = toNum(desired?.min);
      const maxMonthlyMan = toNum(desired?.max);
      const minBonusCount = toNum(desired?.bonusCountMin);
      const maxBonusCount = toNum(desired?.bonusCountMax);
      const minBonusAmountMan = toNum(desired?.bonusAmountMin);
      const maxBonusAmountMan = toNum(desired?.bonusAmountMax);

      const yearMinMan = Number.isFinite(minMonthlyMan) ? (minMonthlyMan * 12) : null;
      const yearMaxMan = Number.isFinite(maxMonthlyMan) ? (maxMonthlyMan * 12) : null;
      const bonusTotalMinMan = (Number.isFinite(minBonusCount) && Number.isFinite(minBonusAmountMan)) ? (minBonusCount * minBonusAmountMan) : null;
      const bonusTotalMaxMan = (Number.isFinite(maxBonusCount) && Number.isFinite(maxBonusAmountMan)) ? (maxBonusCount * maxBonusAmountMan) : null;
      const grandMinMan = (Number.isFinite(yearMinMan) && Number.isFinite(bonusTotalMinMan)) ? (yearMinMan + bonusTotalMinMan) : null;
      const grandMaxMan = (Number.isFinite(yearMaxMan) && Number.isFinite(bonusTotalMaxMan)) ? (yearMaxMan + bonusTotalMaxMan) : null;

      const fmtMan = (n) => (Number.isFinite(n) ? (Math.round(n * 10) / 10).toLocaleString("ja-JP") : "");
      const yearMinEl = document.getElementById("salaryMonthlyYearMin");
      const yearMaxEl = document.getElementById("salaryMonthlyYearMax");
      const grandMinEl = document.getElementById("salaryMonthlyGrandMin");
      const grandMaxEl = document.getElementById("salaryMonthlyGrandMax");
      if (yearMinEl) yearMinEl.textContent = fmtMan(yearMinMan);
      if (yearMaxEl) yearMaxEl.textContent = fmtMan(yearMaxMan);
      if (grandMinEl) grandMinEl.textContent = fmtMan(grandMinMan);
      if (grandMaxEl) grandMaxEl.textContent = fmtMan(grandMaxMan);
    }

    updateSalaryEstimateUI();
    // 入口ページで表示できるように保存（選択ボタン押下時にも保存されるが、入力も保持したい）
    persistSimpleSelectionForEntry("salary");
    return;
  }

  // salary：年収ゲージ（最低/最大）のチェック
  if (state.activeTab === "salary" && t instanceof HTMLInputElement && (
    t.matches('input[name="salaryYearlyMinPick"]') ||
    t.matches('input[name="salaryYearlyMaxPick"]')
  )) {
    const desired = getSalaryDesiredForActiveGroup();
    const v = (t.value || "").trim();
    if (t.matches('input[name="salaryYearlyMinPick"]')) desired.min = t.checked ? v : "";
    if (t.matches('input[name="salaryYearlyMaxPick"]')) desired.max = t.checked ? v : "";

    // 入力欄も表示更新するため再描画
    persistSimpleSelectionForEntry("salary");
    renderSimpleTab("salary");
    return;
  }

  // エリア選択（北海道/青森/岩手/宮城 共通）
  if (t instanceof HTMLSelectElement && t.matches("#areaSelect")) {
    state.selectedArea = t.value;
    renderCities();
    return;
  }

  // 北海道：北海道（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.hokkaidoPrefSelectAll")) {
    if (state.selectedPrefCode !== "01") return;
    const checked = t.checked;
    const allCities = [];
    allCities.push(...SAPPORO_WARDS);
    for (const aName of Object.keys(HOKKAIDO_GROUPED)) {
      const bureaus = HOKKAIDO_GROUPED[aName] ?? {};
      for (const bName of Object.keys(bureaus)) allCities.push(...(bureaus[bName] ?? []));
    }
    for (const c of allCities) setCitySelected("01", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 北海道：札幌市（10区）/道東/道北/道央/道南（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.hokkaidoAreaSelectAll")) {
    if (state.selectedPrefCode !== "01") return;
    const key = t.getAttribute("data-area") || "";
    const checked = t.checked;
    const valueToAreaName = { doto: "道東", dohoku: "道北", dochuo: "道央", donan: "道南" };
    let pool = [];
    if (key === "sapporo") {
      pool = SAPPORO_WARDS;
    } else if (key && (valueToAreaName[key] != null)) {
      const areaName = valueToAreaName[key];
      const bureaus = HOKKAIDO_GROUPED[areaName] ?? {};
      pool = Object.values(bureaus).flat();
    }
    for (const c of pool) setCitySelected("01", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 宮城：エリア枠の「全選択」チェックボックス
  if (t instanceof HTMLInputElement && t.matches("input.areaSelectAll")) {
    if (state.selectedPrefCode !== "04") return;
    const areaName = t.getAttribute("data-area") || "";
    const citiesAll = MIYAGI_GROUPED[areaName] ?? [];
    for (const c of citiesAll) setCitySelected("04", c.code, t.checked);
    updateSummary();
    renderCities();
    return;
  }

  // 宮城：宮城県（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.miyagiPrefSelectAll")) {
    if (state.selectedPrefCode !== "04") return;
    const checked = t.checked;
    const allCities = Object.values(MIYAGI_GROUPED).flat();
    for (const c of allCities) setCitySelected("04", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 青森：青森県（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.aomoriPrefSelectAll")) {
    if (state.selectedPrefCode !== "02") return;
    const checked = t.checked;
    const allCities = [];
    allCities.push(...AOMORI_AOMORI_CITY_AREAS);
    for (const aName of Object.keys(AOMORI_GROUPED)) {
      const districts = AOMORI_GROUPED[aName] ?? {};
      for (const dName of Object.keys(districts)) allCities.push(...(districts[dName] ?? []));
    }
    for (const c of allCities) setCitySelected("02", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 青森：青森市（街・エリア）/津軽/南部/下北（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.aomoriAreaSelectAll")) {
    if (state.selectedPrefCode !== "02") return;
    const key = t.getAttribute("data-area") || "";
    const checked = t.checked;
    let pool = [];
    if (key === "aomori_city") {
      pool = AOMORI_AOMORI_CITY_AREAS;
    } else if (key && (AOMORI_GROUPED[key] != null)) {
      pool = Object.values(AOMORI_GROUPED[key] ?? {}).flat();
    }
    for (const c of pool) setCitySelected("02", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 岩手：岩手県（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.iwatePrefSelectAll")) {
    if (state.selectedPrefCode !== "03") return;
    const checked = t.checked;
    const allCities = Object.values(IWATE_GROUPED).flat();
    for (const c of allCities) setCitySelected("03", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 岩手：県北/県央/沿岸/県南（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.iwateAreaSelectAll")) {
    if (state.selectedPrefCode !== "03") return;
    const areaName = t.getAttribute("data-area") || "";
    const citiesAll = IWATE_GROUPED[areaName] ?? [];
    for (const c of citiesAll) setCitySelected("03", c.code, t.checked);
    updateSummary();
    renderCities();
    return;
  }

  // 茨城：茨城県（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.ibarakiPrefSelectAll")) {
    if (state.selectedPrefCode !== "08") return;
    const checked = t.checked;
    for (const c of IBARAKI_ALL_CITIES) setCitySelected("08", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 茨城：水戸（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.ibarakiMitoSelectAll")) {
    if (state.selectedPrefCode !== "08") return;
    const checked = t.checked;
    const pool = [{ code: "08201", name: "水戸市" }, ...IBARAKI_MITO_AREAS];
    for (const c of pool) setCitySelected("08", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 茨城：つくば（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.ibarakiTsukubaSelectAll")) {
    if (state.selectedPrefCode !== "08") return;
    const checked = t.checked;
    const pool = [{ code: "08220", name: "つくば市" }, ...IBARAKI_TSUKUBA_AREAS];
    for (const c of pool) setCitySelected("08", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 茨城：日立（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.ibarakiHitachiSelectAll")) {
    if (state.selectedPrefCode !== "08") return;
    const checked = t.checked;
    const pool = [{ code: "08202", name: "日立市" }, ...IBARAKI_HITACHI_AREAS];
    for (const c of pool) setCitySelected("08", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 茨城：県央/県北/県南/鹿行（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.ibarakiGroupSelectAll")) {
    if (state.selectedPrefCode !== "08") return;
    const areaName = t.getAttribute("data-area") || "";
    const checked = t.checked;
    const list = (typeof IBARAKI_GROUPED === "object" && IBARAKI_GROUPED) ? (IBARAKI_GROUPED[areaName] ?? []) : [];
    for (const c of list) setCitySelected("08", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 栃木：栃木県（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tochigiPrefSelectAll")) {
    if (state.selectedPrefCode !== "09") return;
    const checked = t.checked;
    for (const c of TOCHIGI_ALL_CITIES) setCitySelected("09", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 栃木：宇都宮（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tochigiUtsunomiyaSelectAll")) {
    if (state.selectedPrefCode !== "09") return;
    const checked = t.checked;
    const pool = [{ code: "09201", name: "宇都宮市" }, ...TOCHIGI_UTSUNOMIYA_AREAS];
    for (const c of pool) setCitySelected("09", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 埼玉：さいたま市（大宮区は町丁目を含む）（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.saitamaCitySelectAll")) {
    if (state.selectedPrefCode !== "11") return;
    const checked = t.checked;
    const wardsRaw = Array.isArray(SAITAMA_SAITAMA_CITY_WARDS) ? SAITAMA_SAITAMA_CITY_WARDS : [];
    const otherWardsRaw = wardsRaw.filter((c) => c?.code !== "11103" && c?.code !== "11107");
    const omiyaAreasRaw = Array.isArray(SAITAMA_OMIYA_AREAS) ? SAITAMA_OMIYA_AREAS : [];
    const urawaAreasRaw = Array.isArray(SAITAMA_URAWA_AREAS) ? SAITAMA_URAWA_AREAS : [];
    const pool = [...otherWardsRaw, ...omiyaAreasRaw, ...urawaAreasRaw];
    for (const c of pool) setCitySelected("11", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 埼玉：大宮区（町丁目）（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.omiyaAreaSelectAll")) {
    if (state.selectedPrefCode !== "11") return;
    const checked = t.checked;
    const omiyaAreasRaw = Array.isArray(SAITAMA_OMIYA_AREAS) ? SAITAMA_OMIYA_AREAS : [];
    for (const c of omiyaAreasRaw) setCitySelected("11", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 埼玉：浦和区（町名）（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.urawaAreaSelectAll")) {
    if (state.selectedPrefCode !== "11") return;
    const checked = t.checked;
    const urawaAreasRaw = Array.isArray(SAITAMA_URAWA_AREAS) ? SAITAMA_URAWA_AREAS : [];
    for (const c of urawaAreasRaw) setCitySelected("11", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 群馬：群馬県（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.gunmaPrefSelectAll")) {
    if (state.selectedPrefCode !== "10") return;
    const checked = t.checked;
    for (const c of GUNMA_ALL_CITIES) setCitySelected("10", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 群馬：前橋（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.gunmaMaebashiSelectAll")) {
    if (state.selectedPrefCode !== "10") return;
    const checked = t.checked;
    const pool = [{ code: "10201", name: "前橋市" }, ...(Array.isArray(GUNMA_MAEBASHI_AREAS) ? GUNMA_MAEBASHI_AREAS : [])];
    for (const c of pool) setCitySelected("10", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 群馬：高崎（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.gunmaTakasakiSelectAll")) {
    if (state.selectedPrefCode !== "10") return;
    const checked = t.checked;
    const pool = [{ code: "10202", name: "高崎市" }, ...(Array.isArray(GUNMA_TAKASAKI_AREAS) ? GUNMA_TAKASAKI_AREAS : [])];
    for (const c of pool) setCitySelected("10", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 群馬：太田市（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.gunmaOtaSelectAll")) {
    if (state.selectedPrefCode !== "10") return;
    const checked = t.checked;
    const pool = [{ code: "10205", name: "太田市" }, ...(Array.isArray(GUNMA_OTA_AREAS) ? GUNMA_OTA_AREAS : [])];
    for (const c of pool) setCitySelected("10", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 群馬：伊勢崎市（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.gunmaIsesakiSelectAll")) {
    if (state.selectedPrefCode !== "10") return;
    const checked = t.checked;
    const pool = [{ code: "10204", name: "伊勢崎市" }, ...(Array.isArray(GUNMA_ISESAKI_AREAS) ? GUNMA_ISESAKI_AREAS : [])];
    for (const c of pool) setCitySelected("10", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 群馬：桐生市（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.gunmaKiryuSelectAll")) {
    if (state.selectedPrefCode !== "10") return;
    const checked = t.checked;
    const pool = [{ code: "10203", name: "桐生市" }, ...(Array.isArray(GUNMA_KIRYU_AREAS) ? GUNMA_KIRYU_AREAS : [])];
    for (const c of pool) setCitySelected("10", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 群馬：中毛/西毛/東毛/北毛（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.gunmaGroupSelectAll")) {
    if (state.selectedPrefCode !== "10") return;
    const areaName = t.getAttribute("data-area") || "";
    const checked = t.checked;
    const list = (typeof GUNMA_GROUPED === "object" && GUNMA_GROUPED)
      ? (GUNMA_GROUPED[areaName] ?? [])
      : [];
    for (const c of list) setCitySelected("10", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：東京都（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoPrefSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    for (const c of TOKYO_ALL_CITIES) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：23区/多摩/西多摩/島しょ（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoAreaSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const areaName = t.getAttribute("data-area") || "";
    const checked = t.checked;
    const list = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED)
      ? (TOKYO_GROUPED[areaName] ?? [])
      : [];
    for (const c of list) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 神奈川：横須賀三浦地域 / 県西地域（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.kanagawaAreaSelectAll")) {
    if (state.selectedPrefCode !== "14") return;
    const areaName = t.getAttribute("data-area") || "";
    const checked = t.checked;
    const list = (typeof KANAGAWA_GROUPED === "object" && KANAGAWA_GROUPED)
      ? (KANAGAWA_GROUPED[areaName] ?? [])
      : [];
    const pool = (areaName === "横浜地域")
      ? list.filter((c) => c?.code !== "14100" && c?.code !== "14102" && c?.code !== "14103" && c?.code !== "14104")
      : (areaName === "川崎地域")
        ? list.filter((c) => {
          const code = c?.code;
          if (code === "14130") return false;
          if (code === "14131") return false;
          if (code === "14132") return false;
          if (code === "14133") return false;
          return true;
        })
        : (areaName === "相模原地域")
          ? list.filter((c) => {
            const code = c?.code;
            if (code === "14150") return false;
            if (code === "14151") return false;
            if (code === "14152") return false;
            if (code === "14153") return false;
            return true;
          })
          : (areaName === "湘南地域")
            ? list.filter((c) => c?.code !== "14205")
            : (areaName === "県央地域")
              ? list.filter((c) => c?.code !== "14212")
              : list;
    for (const c of pool) setCitySelected("14", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 神奈川：横浜市 / 川崎市 / 相模原市 / 厚木市 / 藤沢市（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.kanagawaCitySelectAll")) {
    if (state.selectedPrefCode !== "14") return;
    const key = t.getAttribute("data-city") || "";
    const checked = t.checked;
    let pool = [];

    if (key === "yokohama") {
      const citiesAll = KANAGAWA_GROUPED["横浜地域"] ?? [];
      pool = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14100") return false;
        if (code === "14102") return false;
        if (typeof code === "string" && code.startsWith("14102-")) return false;
        if (code === "14103") return false;
        if (typeof code === "string" && code.startsWith("14103-")) return false;
        if (code === "14104") return false;
        if (typeof code === "string" && code.startsWith("14104-")) return false;
        return true;
      });
    }

    if (key === "yokohama_nishi") {
      const citiesAll = KANAGAWA_GROUPED["横浜地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14103-"));
    }

    if (key === "yokohama_naka") {
      const citiesAll = KANAGAWA_GROUPED["横浜地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14104-"));
    }

    if (key === "yokohama_kanagawa") {
      const citiesAll = KANAGAWA_GROUPED["横浜地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14102-"));
    }

    if (key === "kawasaki") {
      const citiesAll = KANAGAWA_GROUPED["川崎地域"] ?? [];
      pool = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14130") return false;
        if (code === "14131") return false;
        if (typeof code === "string" && code.startsWith("14131-")) return false;
        if (code === "14132") return false;
        if (typeof code === "string" && code.startsWith("14132-")) return false;
        if (code === "14133") return false;
        if (typeof code === "string" && code.startsWith("14133-")) return false;
        return true;
      });
    }

    if (key === "kawasaki_kawasaki") {
      const citiesAll = KANAGAWA_GROUPED["川崎地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14131-"));
    }

    if (key === "kawasaki_saiwai") {
      const citiesAll = KANAGAWA_GROUPED["川崎地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14132-"));
    }

    if (key === "kawasaki_nakahara") {
      const citiesAll = KANAGAWA_GROUPED["川崎地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14133-"));
    }

    if (key === "sagamihara") {
      const citiesAll = KANAGAWA_GROUPED["相模原地域"] ?? [];
      pool = citiesAll.filter((c) => {
        const code = c?.code;
        if (code === "14150") return false;
        if (code === "14152") return false;
        if (typeof code === "string" && code.startsWith("14152-")) return false;
        if (code === "14151") return false;
        if (typeof code === "string" && code.startsWith("14151-")) return false;
        if (code === "14153") return false;
        if (typeof code === "string" && code.startsWith("14153-")) return false;
        return true;
      });
    }

    if (key === "sagamihara_chuo") {
      const citiesAll = KANAGAWA_GROUPED["相模原地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14152-"));
    }

    if (key === "sagamihara_midori") {
      const citiesAll = KANAGAWA_GROUPED["相模原地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14151-"));
    }

    if (key === "sagamihara_minami") {
      const citiesAll = KANAGAWA_GROUPED["相模原地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14153-"));
    }

    if (key === "atsugi") {
      const citiesAll = KANAGAWA_GROUPED["県央地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14212-"));
    }

    if (key === "fujisawa") {
      const citiesAll = KANAGAWA_GROUPED["湘南地域"] ?? [];
      pool = citiesAll.filter((c) => typeof c?.code === "string" && c.code.startsWith("14205-"));
    }

    for (const c of pool) setCitySelected("14", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：渋谷区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoShibuyaSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13113" || c.code.startsWith("13113-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：品川区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoShinagawaSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13109" || c.code.startsWith("13109-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：新宿区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoShinjukuSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13104" || c.code.startsWith("13104-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：港区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoMinatoSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13103" || c.code.startsWith("13103-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：千代田区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoChiyodaSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13101" || c.code.startsWith("13101-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：豊島区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoToshimaSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13116" || c.code.startsWith("13116-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：中央区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoChuoSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13102" || c.code.startsWith("13102-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：文京区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoBunkyoSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13105" || c.code.startsWith("13105-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：目黒区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoMeguroSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13110" || c.code.startsWith("13110-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：世田谷区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoSetagayaSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13112" || c.code.startsWith("13112-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：中野区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoNakanoSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13114" || c.code.startsWith("13114-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：杉並区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoSuginamiSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13115" || c.code.startsWith("13115-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：大田区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoOtaSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13111" || c.code.startsWith("13111-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 東京：江東区（全選択）
  if (t instanceof HTMLInputElement && t.matches("input.tokyoKotoSelectAll")) {
    if (state.selectedPrefCode !== "13") return;
    const checked = t.checked;
    const wards = (typeof TOKYO_GROUPED === "object" && TOKYO_GROUPED) ? (TOKYO_GROUPED["23区"] ?? []) : [];
    const pool = wards.filter((c) => typeof c?.code === "string" && (c.code === "13108" || c.code.startsWith("13108-")));
    for (const c of pool) setCitySelected("13", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 秋田：秋田市枠の「全選択」チェックボックス
  if (t instanceof HTMLInputElement && t.matches("input.akitaSelectAll")) {
    if (state.selectedPrefCode !== "05") return;
    const checked = t.checked;
    const pool = [{ code: "05201", name: "秋田市" }, ...AKITA_AKITA_CITY_AREAS];
    for (const c of pool) setCitySelected("05", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 福島：福島市枠の「全選択」チェックボックス
  if (t instanceof HTMLInputElement && t.matches("input.fukushimaSelectAll")) {
    if (state.selectedPrefCode !== "07") return;
    const checked = t.checked;
    const pool = [{ code: "07201", name: "福島市" }, ...FUKUSHIMA_FUKUSHIMA_CITY_AREAS];
    for (const c of pool) setCitySelected("07", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 福島：中通り/浜通り/会津 枠の「全選択」チェックボックス
  if (t instanceof HTMLInputElement && t.matches("input.fukushimaGroupSelectAll")) {
    if (state.selectedPrefCode !== "07") return;
    const areaName = t.getAttribute("data-area") || "";
    const checked = t.checked;
    const list = (typeof FUKUSHIMA_GROUPED === "object" && FUKUSHIMA_GROUPED)
      ? (FUKUSHIMA_GROUPED[areaName] ?? [])
      : [];
    for (const c of list) setCitySelected("07", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 秋田：県北/県央/県南 枠の「全選択」チェックボックス
  if (t instanceof HTMLInputElement && t.matches("input.akitaGroupSelectAll")) {
    if (state.selectedPrefCode !== "05") return;
    const areaName = t.getAttribute("data-area") || "";
    const citiesAll = AKITA_GROUPED[areaName] ?? [];
    for (const c of citiesAll) setCitySelected("05", c.code, t.checked);
    updateSummary();
    renderCities();
    return;
  }

  // 山形：山形市枠の「全選択」チェックボックス
  if (t instanceof HTMLInputElement && t.matches("input.yamagataSelectAll")) {
    if (state.selectedPrefCode !== "06") return;
    const checked = t.checked;
    const pool = [{ code: "06201", name: "山形市" }, ...YAMAGATA_YAMAGATA_CITY_AREAS];
    for (const c of pool) setCitySelected("06", c.code, checked);
    updateSummary();
    renderCities();
    return;
  }

  // 山形：村山/置賜/庄内/最上 枠の「全選択」チェックボックス
  if (t instanceof HTMLInputElement && t.matches("input.yamagataGroupSelectAll")) {
    if (state.selectedPrefCode !== "06") return;
    const areaName = t.getAttribute("data-area") || "";
    const citiesAll = YAMAGATA_GROUPED[areaName] ?? [];
    for (const c of citiesAll) setCitySelected("06", c.code, t.checked);
    updateSummary();
    renderCities();
    return;
  }

  // 都道府県選択
  if (t instanceof HTMLInputElement && t.matches('input[name="pref"]')) {
    updateSelectedCount();

    if (t.checked) {
      state.selectedPrefCode = t.value;

      // demo: 検索UIはクリア（選択状態は保持して都道府県を跨いで選べるように）
      citySearchEl.value = "";
      onlySelectedEl.checked = false;

      renderCities();
      updateSummary();
    } else {
      // 都道府県のチェックを外したら、その都道府県の市区町村選択だけ解除
      clearPrefSelections(t.value);

      if (state.selectedPrefCode === t.value) {
        state.selectedPrefCode = "";
        renderCities();
        updateSummary();
      } else {
        updateSummary();
      }
    }
  }

  // 市区町村チェック
  if (t instanceof HTMLInputElement && t.matches('input[name="city"]')) {
    const prefCode = state.selectedPrefCode;
    if (prefCode) setCitySelected(prefCode, t.value, t.checked);
    updateSummary();

    // 宮城は複数selectと同期が必要なので再描画で合わせる
    if (prefCode === "04") renderCities();
  }

  // station/pref/employment/salary/skill の簡易チェック
  if (t instanceof HTMLInputElement && t.matches('input[name="simpleOpt"]')) {
    const set = getSimpleSelectedSet(state.activeTab);
    if (set) {
      if (t.checked) set.add(t.value);
      else set.delete(t.value);
    }
    updateSelectedCount();
    updateSummary();
    if (onlySelectedEl?.checked) renderCities();
  }

  // 都道府県内すべて（右側見出し左のチェック）
  if (t instanceof HTMLInputElement && t.matches("#prefSelectAll")) {
    const prefCode = state.selectedPrefCode;
    if (!prefCode) return;
    const pool = getPoolForPref(prefCode);
    for (const c of pool) setCitySelected(prefCode, c.code, t.checked);
    renderCities();
    updateSummary();
  }

  // 職種チェック
  if (t instanceof HTMLInputElement && t.matches('input[name="job"]')) {
    const catId = t.getAttribute("data-job-cat") || state.selectedJobCategoryId;
    if (catId) setJobSelected(catId, t.value, t.checked);
    updateSelectedCount();
    updateSummary();
    // 選択中のみフィルタ中なら再描画
    if (onlySelectedEl?.checked) renderCities();
  }
});

citySearchEl.addEventListener("input", renderCities);
onlySelectedEl.addEventListener("change", renderCities);

if (stationAreaSelectEl) {
  stationAreaSelectEl.addEventListener("change", () => {
    if (state.activeTab !== "station") return;
    state.selectedStationArea = stationAreaSelectEl.value || "all";
    renderCities();
  });
}

$("#clearBtn").addEventListener("click", () => {
  if (state.activeTab === "job") {
    state.selectedJobCategoryId = "";
    state.selectedJobs.clear();
    citySearchEl.value = "";
    onlySelectedEl.checked = false;
    renderCities();
    updateSelectedCount();
    updateSummary();
    return;
  }

  if (isSimpleTab(state.activeTab)) {
    const set = getSimpleSelectedSet(state.activeTab);
    set?.clear();

    if (state.activeTab === "salary") {
      state.salaryDesiredByGroup = {
        hourly: {
          min: "",
          max: "",
          minHoursPerDay: "",
          maxHoursPerDay: "",
          daysPerWeek: "",
          minDaysPerMonth: "",
          maxDaysPerMonth: "",
        },
        monthly: {
          min: "",
          max: "",
          bonusCountMin: "",
          bonusCountMax: "",
          bonusAmountMin: "",
          bonusAmountMax: "",
        },
        yearly: { min: "", max: "" },
      };
    }

    citySearchEl.value = "";
    onlySelectedEl.checked = false;
    renderCities();
    updateSelectedCount();
    updateSummary();
    return;
  }

  document.querySelectorAll('input[name="pref"]').forEach((x) => x.checked = false);
  updateSelectedCount();

  state.selectedPrefCode = "";
  state.selectedCities.clear();
  citySearchEl.value = "";
  onlySelectedEl.checked = false;

  renderCities();
  updateSummary();
});

$("#searchBtn").addEventListener("click", () => {
  console.log("選択", {
    tab: state.activeTab,
    prefCode: state.selectedPrefCode,
    cityCodes: Array.from(state.selectedCities),
    jobCategoryId: state.selectedJobCategoryId,
    jobKeys: Array.from(state.selectedJobs),
  });

  // 入口ページで表示できるように保存
  if (state.activeTab === "job") persistJobSelectionForEntry();
  else if (isSimpleTab(state.activeTab)) persistSimpleSelectionForEntry(state.activeTab);
  else persistSelectionForEntry();
  // デモ：検索実行後はリンク元へ戻す
  backToEntry();
});

$("#closeBtn").addEventListener("click", () => {
  // デモ：×でリンク元へ戻す
  backToEntry();
});

// ====== 悪（除外）こだわり条件モーダル ======
(() => {
  const backdrop = document.getElementById("badPrefModalBackdrop");
  const openBtn = document.getElementById("badPrefBtn");
  const closeBtn = document.getElementById("badPrefCloseBtn");
  const clearBtn = document.getElementById("badClearBtn");
  const saveBtn = document.getElementById("badSaveBtn");
  const groupContainer = document.getElementById("badRegionContainer");
  const listEl = document.getElementById("badList");
  const searchEl = document.getElementById("badSearch");
  const onlyEl = document.getElementById("badOnlySelected");
  const countEl = document.getElementById("badSelectedCount");
  const summaryEl = document.getElementById("badSelectedSummary");
  const titleEl = document.getElementById("badPrefTitle");
  const totalEl = document.getElementById("badCount");

  if (!backdrop || !openBtn || !closeBtn || !clearBtn || !saveBtn || !groupContainer || !listEl) return;

  function persistBadPrefSelection() {
    const lines = PREF_OPTIONS
      .filter((x) => state.selectedBadPrefConditions.has(x.code))
      .map((x) => x.name)
      .filter(Boolean);
    const payload = {
      savedAt: new Date().toISOString(),
      summary: (summaryEl?.textContent || "").trim(),
      lines,
      keys: Array.from(state.selectedBadPrefConditions),
    };
    try {
      localStorage.setItem("job:pref_bad_selection", JSON.stringify(payload));
    } catch {
      // file:// などは無視
    }
  }

  function updateBadHeaderAndFooter(visibleOptions) {
    if (countEl) countEl.textContent = `${state.selectedBadPrefConditions.size}件`;
    if (summaryEl) {
      const names = PREF_OPTIONS
        .filter((x) => state.selectedBadPrefConditions.has(x.code))
        .map((x) => x.name)
        .filter(Boolean);
      summaryEl.textContent = names.length ? names.join(" / ") : "未選択";
    }
    if (titleEl) titleEl.textContent = "悪（除外）";
    if (totalEl) totalEl.textContent = `登録：${(visibleOptions?.length ?? 0)}件`;
  }

  function renderBadLeft() {
    const active = state.badPrefActiveGroup || (PREF_GROUPS[0] || "");
    state.badPrefActiveGroup = active;

    groupContainer.innerHTML = `
      <div class="jobCatList">
        ${PREF_GROUPS.map((g) => {
          const isActive = (g === active);
          return `
            <button class="jobCatBtn ${isActive ? "active" : ""}" type="button" data-bad-group="${g}">
              <span>${g}</span>
              <span class="jobCatChevron">▸</span>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderBadList() {
    const group = state.badPrefActiveGroup || (PREF_GROUPS[0] || "");
    const q = (searchEl?.value || "").trim();
    const onlySelected = !!onlyEl?.checked;

    let pool = PREF_OPTIONS.filter((x) => (x.group || "") === group);
    if (q) pool = pool.filter((x) => (x?.name || "").includes(q));
    if (onlySelected) pool = pool.filter((x) => state.selectedBadPrefConditions.has(x.code));

    listEl.innerHTML = pool.length
      ? pool.map((x) => {
          const checked = state.selectedBadPrefConditions.has(x.code) ? "checked" : "";
          return `
            <label class="cityItem">
              <input type="checkbox" name="badPrefOpt" value="${x.code}" ${checked} />
              <span class="cityName">${x.name}</span>
            </label>
          `;
        }).join("")
      : `<div class="empty">該当なし</div>`;

    updateBadHeaderAndFooter(pool);
  }

  function open() {
    if (!state.badPrefActiveGroup) state.badPrefActiveGroup = PREF_GROUPS[0] || "";
    if (searchEl) searchEl.value = "";
    if (onlyEl) onlyEl.checked = false;
    renderBadLeft();
    renderBadList();
    backdrop.hidden = false;
  }

  function close() {
    backdrop.hidden = true;
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  // 背景クリックで閉じる（モーダル本体クリックは無視）
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  groupContainer.addEventListener("click", (e) => {
    const btn = e.target.closest?.("button[data-bad-group]");
    if (!(btn instanceof HTMLButtonElement)) return;
    const g = btn.getAttribute("data-bad-group") || "";
    state.badPrefActiveGroup = g;
    renderBadLeft();
    renderBadList();
  });

  listEl.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (!t.matches('input[name="badPrefOpt"]')) return;
    if (t.checked) state.selectedBadPrefConditions.add(t.value);
    else state.selectedBadPrefConditions.delete(t.value);
    renderBadList();
  });

  if (searchEl) searchEl.addEventListener("input", renderBadList);
  if (onlyEl) onlyEl.addEventListener("change", renderBadList);

  clearBtn.addEventListener("click", () => {
    state.selectedBadPrefConditions.clear();
    if (searchEl) searchEl.value = "";
    if (onlyEl) onlyEl.checked = false;
    renderBadList();
  });

  saveBtn.addEventListener("click", () => {
    persistBadPrefSelection();
    close();
  });
})();

// init
(() => {
  // URL でタブ初期選択（例: ?tab=job）
  let tab = "work";
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("tab");
    if (q === "work" || q === "job" || isSimpleTab(q)) tab = q;
  } catch {
    // file:// などで URL 解析が崩れるケースは無視
  }

  // 初期描画（work用を一度生成してから、タブで上書き）
  renderLeftAccordion();
  setActiveTab(tab);
})();
