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

