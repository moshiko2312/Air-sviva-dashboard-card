const AIR_SVIVA_LOGO = "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%20220%2090%27%3E%0A%3Cdefs%3E%3ClinearGradient%20id%3D%27g1%27%20x1%3D%270%27%20x2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%23f6a623%27/%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%23ffbd3d%27/%3E%3C/linearGradient%3E%3ClinearGradient%20id%3D%27g2%27%20x1%3D%270%27%20x2%3D%271%27%3E%3Cstop%20offset%3D%270%27%20stop-color%3D%27%2300843d%27/%3E%3Cstop%20offset%3D%271%27%20stop-color%3D%27%2318a558%27/%3E%3C/linearGradient%3E%3C/defs%3E%0A%3Cpath%20d%3D%27M17%2052%20C36%2023%2C70%2018%2C107%2037%20C80%2051%2C49%2063%2C17%2052%20Z%27%20fill%3D%27url%28%23g1%29%27/%3E%0A%3Cpath%20d%3D%27M109%2037%20C143%2016%2C185%2018%2C206%2051%20C174%2065%2C139%2056%2C109%2037%20Z%27%20fill%3D%27url%28%23g2%29%27/%3E%0A%3Cpath%20d%3D%27M25%2052%20C58%2049%2C85%2043%2C110%2037%20C137%2043%2C166%2050%2C198%2052%27%20fill%3D%27none%27%20stroke%3D%27%23ffffff%27%20stroke-opacity%3D%27.75%27%20stroke-width%3D%275%27%20stroke-linecap%3D%27round%27/%3E%0A%3Cpath%20d%3D%27M110%2038%20L110%2070%27%20stroke%3D%27%23ffffff%27%20stroke-opacity%3D%27.72%27%20stroke-width%3D%275%27%20stroke-linecap%3D%27round%27/%3E%0A%3C/svg%3E";
const AIR_SVIVA_BUILD = "2026-06-26-2";

class AirSvivaDashboardCardEditor extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this._renderedOnce) return;
    this.populateRouteSelects();
  }

  discoveredRoutes() {
    const routes = new Map();

    const add = (path, label = "") => {
      if (!path || typeof path !== "string") return;
      const clean = path.trim();
      if (!clean) return;
      const normalized = clean.startsWith("/") ? clean : `/${clean}`;
      routes.set(normalized, label || normalized);
    };

    add("/lovelace/default_view", "ברירת מחדל");
    add("/lovelace/0", "Lovelace 0");
    add("/lovelace/home", "Home");
    add("/lovelace/map", "Map");
    add("/lovelace/air", "Air");
    add("/lovelace/air-quality", "Air Quality");

    const panels = this._hass?.panels || {};
    Object.entries(panels).forEach(([panelUrl, panel]) => {
      const base = panelUrl.startsWith("/") ? panelUrl : `/${panelUrl}`;
      const title = panel?.title || panel?.config?.title || panel?.url_path || base;
      add(base, title);

      const views = panel?.config?.views || panel?.views || [];
      if (Array.isArray(views)) {
        views.forEach((view, index) => {
          const viewPath = view?.path || view?.url_path || index;
          const viewTitle = view?.title || view?.name || `View ${index}`;
          add(`${base}/${viewPath}`, `${title} / ${viewTitle}`);
        });
      }
    });

    try {
      add(window.location.pathname, "העמוד הנוכחי");
    } catch (e) {}

    add(this.config?.nav_button_path, this.config?.nav_button_path);
    add(this.config?.back_button_path, this.config?.back_button_path);

    return Array.from(routes.entries()).map(([path, label]) => ({ path, label }));
  }

  populateRouteSelects() {
    if (!this.shadowRoot) return;
    const options = this.discoveredRoutes();

    this.shadowRoot.querySelectorAll("select[data-route-select]").forEach((select) => {
      const key = select.dataset.routeTarget;
      const current = this.config?.[key] || "";
      select.innerHTML = [
        `<option value="">בחר נתיב...</option>`,
        ...options.map((route) =>
          `<option value="${route.path}" ${route.path === current ? "selected" : ""}>${route.label} — ${route.path}</option>`
        )
      ].join("");
    });
  }

  setConfig(config) {
    const merged = {
      title: "רמת איכות אוויר",
      station_name: "",
      entity_prefix: "",
      aqi_entity: "",
      station_id: "",
      full_height: true,
      show_scene: true,
      show_footer: true,
      show_legend: true,
      show_weather: true,
      show_extra_pollutants: true,
      show_extra_weather: true,
      nav_button_label: "",
      nav_button_path: "",
      show_back_button: true,
      back_button_label: "חזרה",
      back_button_path: "",
      max_width: "2200px",
      ...config,
    };

    const wasRendered = !!this._renderedOnce;
    this.config = merged;

    if (!wasRendered) {
      this.render();
      return;
    }

    // Home Assistant may call setConfig frequently while the user types.
    // Avoid full re-render after first paint to preserve caret/focus.
    this.syncFormWithConfig();
    this.populateRouteSelects();
  }

  configChanged(config) {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config },
      bubbles: true,
      composed: true,
    }));
  }

  updateValue(key, value, shouldRender = false) {
    const next = { ...this.config };
    if (["full_height", "show_scene", "show_footer", "show_legend", "show_weather", "show_extra_pollutants", "show_extra_weather"].includes(key)) {
      next[key] = value;
    } else if (key === "station_id") {
      if (value === "") delete next.station_id;
      else next.station_id = Number(value);
    } else {
      next[key] = value ?? "";
    }

    this.config = next;
    this.configChanged(next);

    // Important: do not re-render the editor on every input/change.
    // Home Assistant already refreshes the preview. Re-rendering here steals focus
    // and can jump the user out of the field.
    if (shouldRender) this.render();
  }

  syncFormWithConfig() {
    if (!this.shadowRoot) return;

    const active = this.shadowRoot.activeElement;
    const activeKey = active?.dataset?.key || "";

    this.shadowRoot.querySelectorAll("input[data-key]").forEach((input) => {
      const key = input.dataset.key;
      if (!key) return;
      if (key === activeKey && input === active) return;

      if (input.type === "checkbox") {
        input.checked = !!this.config?.[key];
        return;
      }

      const nextValue = this.config?.[key] ?? "";
      if (String(input.value) !== String(nextValue)) input.value = nextValue;
    });
  }

  render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const c = this.config || {};

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display:block;
          direction:rtl;
          font-family:var(--primary-font-family, system-ui);
          --ed-bg-1:#1f2430;
          --ed-bg-2:#131722;
          --ed-glass:rgba(255,255,255,.08);
          --ed-line:rgba(255,255,255,.12);
          --ed-text:#f2f6ff;
          --ed-muted:rgba(224,232,252,.74);
        }

        .editor {
          padding:18px;
          border-radius:24px;
          background:
            radial-gradient(circle at 14% 12%, rgba(114,146,255,.18), transparent 38%),
            radial-gradient(circle at 88% 86%, rgba(59,198,151,.11), transparent 36%),
            linear-gradient(145deg,var(--ed-bg-1),var(--ed-bg-2));
          color:var(--ed-text);
          border:1px solid var(--ed-line);
          box-shadow:0 22px 38px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.12);
          position:relative;
          overflow:hidden;
        }

        .editor:before {
          content:"";
          position:absolute;
          inset:10px;
          border-radius:18px;
          border:1px solid rgba(255,255,255,.06);
          pointer-events:none;
        }

        .head {
          display:flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          margin-bottom:16px;
          text-align:center;
          padding:4px 8px 10px;
          border-bottom:1px solid rgba(255,255,255,.08);
        }

        .head img {
          width:30px;
          height:30px;
          object-fit:contain;
          opacity:.95;
        }

        .head b {
          font-size:clamp(20px, 2.6vw, 28px);
          font-weight:900;
          letter-spacing:-.01em;
        }

        .grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
          margin-top:4px;
        }

        .grid > label:last-child:nth-child(odd) {
          grid-column:1 / -1;
        }

        label {
          display:flex;
          flex-direction:column;
          gap:8px;
          padding:12px;
          border-radius:18px;
          background:var(--ed-glass);
          border:1px solid rgba(255,255,255,.10);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 8px 14px rgba(0,0,0,.16);
        }

        label span {
          color:var(--ed-muted);
          font-size:13px;
          font-weight:700;
        }

        input, select {
          border:1px solid rgba(255,255,255,.16);
          border-radius:13px;
          padding:11px;
          background:linear-gradient(145deg, rgba(15,20,31,.72), rgba(20,27,42,.70));
          color:var(--ed-text);
          font-family:inherit;
          font-weight:650;
          outline:none;
          transition:border-color .15s ease, box-shadow .15s ease;
        }

        input:focus, select:focus {
          border-color:rgba(130,173,255,.66);
          box-shadow:0 0 0 3px rgba(102,145,255,.18);
        }

        select option {
          color:#111;
        }

        .toggle {
          flex-direction:row;
          align-items:center;
          justify-content:space-between;
          min-height:58px;
        }

        .toggle input {
          width:auto;
          transform:scale(1.2);
          accent-color:#8fb8ff;
        }

        @media(max-width:700px) {
          .grid { grid-template-columns:1fr; }
        }
      </style>

      <div class="editor">
        <div class="head">
          <img src="${AIR_SVIVA_LOGO}">
          <b>הגדרות Air Sviva Dashboard</b>
        </div>

        <div class="grid">
          <label>
            <span>כותרת</span>
            <input data-key="title" value="${c.title ?? ""}" placeholder="רמת איכות אוויר">
          </label>

          <label>
            <span>שם תחנה להצגה</span>
            <input data-key="station_name" value="${c.station_name ?? ""}" placeholder="תחנת ניטור 32">
          </label>

          <label>
            <span>Station ID</span>
            <input data-key="station_id" type="number" value="${c.station_id ?? ""}" placeholder="32">
          </label>

          <label>
            <span>Entity Prefix</span>
            <input data-key="entity_prefix" value="${c.entity_prefix ?? ""}" placeholder="sensor.sviva_station_32">
          </label>

          <label>
            <span>חיישן מדד רשמי (אופציונלי)</span>
            <input data-key="aqi_entity" value="${c.aqi_entity ?? ""}" placeholder="sensor.sviva_station_32_aqi">
          </label>

          <label>
            <span>רוחב מקסימלי</span>
            <input data-key="max_width" value="${c.max_width ?? "1420px"}" placeholder="1420px / 100%">
          </label>

          <label>
            <span>טקסט כפתור ניווט</span>
            <input data-key="nav_button_label" value="${c.nav_button_label ?? ""}" placeholder="לדוגמה: מעבר למפה">
          </label>

          <label>
            <span>נתיב ניווט</span>
            <input data-key="nav_button_path" value="${c.nav_button_path ?? ""}" placeholder="/lovelace/map או /dashboard-air">
          </label>

          <label>
            <span>בחר נתיב ניווט מהרשימה</span>
            <select data-route-target="nav_button_path" data-route-select="true"></select>
          </label>

          <label class="toggle">
            <span>הצג כפתור חזרה</span>
            <input data-key="show_back_button" type="checkbox" ${c.show_back_button !== false ? "checked" : ""}>
          </label>

          <label>
            <span>טקסט כפתור חזרה</span>
            <input data-key="back_button_label" value="${c.back_button_label ?? "חזרה"}" placeholder="חזרה">
          </label>

          <label>
            <span>נתיב כפתור חזרה</span>
            <input data-key="back_button_path" value="${c.back_button_path ?? ""}" placeholder="ריק = חזרה בדפדפן">
          </label>

          <label>
            <span>בחר נתיב חזרה מהרשימה</span>
            <select data-route-target="back_button_path" data-route-select="true"></select>
          </label>



          <label class="toggle">
            <span>גובה מלא</span>
            <input data-key="full_height" type="checkbox" ${c.full_height !== false ? "checked" : ""}>
          </label>

          <label class="toggle">
            <span>הצג איור תחתון</span>
            <input data-key="show_scene" type="checkbox" ${c.show_scene !== false ? "checked" : ""}>
          </label>

          <label class="toggle">
            <span>הצג מקרא</span>
            <input data-key="show_legend" type="checkbox" ${c.show_legend !== false ? "checked" : ""}>
          </label>

          <label class="toggle">
            <span>הצג מזג אוויר</span>
            <input data-key="show_weather" type="checkbox" ${c.show_weather !== false ? "checked" : ""}>
          </label>

          <label class="toggle">
            <span>הצג מזהמים נוספים (אוטומטי)</span>
            <input data-key="show_extra_pollutants" type="checkbox" ${c.show_extra_pollutants !== false ? "checked" : ""}>
          </label>

          <label class="toggle">
            <span>הצג מדדי מזג אוויר נוספים (אוטומטי)</span>
            <input data-key="show_extra_weather" type="checkbox" ${c.show_extra_weather !== false ? "checked" : ""}>
          </label>

          <label class="toggle">
            <span>הצג הערה תחתונה</span>
            <input data-key="show_footer" type="checkbox" ${c.show_footer !== false ? "checked" : ""}>
          </label>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll("input, select").forEach((el) => {
      const handler = () => {
        if (el.matches("select[data-route-select]")) {
          const key = el.dataset.routeTarget;
          const input = this.shadowRoot.querySelector(`input[data-key="${key}"]`);
          if (input) input.value = el.value;
          this.updateValue(key, el.value, false);
          return;
        }

        const key = el.dataset.key;
        if (!key) return;
        this.updateValue(key, el.type === "checkbox" ? el.checked : el.value, false);
      };

      el.addEventListener("change", handler);
      if (el.tagName === "INPUT" && el.type !== "checkbox") el.addEventListener("input", handler);
    });

    this._renderedOnce = true;
    if (this.populateRouteSelects) this.populateRouteSelects();
  }
}

customElements.define("air-sviva-dashboard-card-editor", AirSvivaDashboardCardEditor);

class AirSvivaDashboardCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("air-sviva-dashboard-card-editor");
  }

  static getStubConfig() {
    return {
      title: "רמת איכות אוויר",
      full_height: true,
    };
  }

  setConfig(config) {
    this.config = {
      title: "רמת איכות אוויר",
      station_name: "",
      entity_prefix: "",
      aqi_entity: "",
      station_id: "",
      full_height: true,
      show_scene: true,
      show_footer: true,
      show_legend: true,
      show_weather: true,
      show_extra_pollutants: true,
      show_extra_weather: true,
      nav_button_label: "",
      nav_button_path: "",
      show_back_button: true,
      back_button_label: "חזרה",
      back_button_path: "",
      max_width: "2200px",
      ...config,
    };

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  detectPrefix(hass) {
    const manualPrefix = String(this.config.entity_prefix || "").trim();
    if (manualPrefix) return manualPrefix.replace(/_$/, "");

    const directAqiSuffixPattern = /_(air_quality_index|general_index|israel_aqi|aqi_israel|air_quality|index|aqi)$/i;
    const configuredAqiEntity = String(this.config.aqi_entity || "").trim();
    if (configuredAqiEntity && directAqiSuffixPattern.test(configuredAqiEntity)) {
      return configuredAqiEntity.replace(directAqiSuffixPattern, "");
    }
    if (configuredAqiEntity) {
      const resolvedAqiEntity = this.resolveEntity(hass, configuredAqiEntity);
      if (hass.states?.[resolvedAqiEntity]) return "__direct_aqi__";
    }

    const stationId = this.config.station_id;
    if (stationId !== "" && stationId !== undefined && stationId !== null) {
      return `sensor.sviva_station_${stationId}`;
    }

    const suffixPattern = /_(air_quality_index|general_index|israel_aqi|aqi_israel|air_quality|index|aqi|no|no2|nox|o3|pm10|pm25|pm2_5|co|rain|rh|so2|temp|ws|wds|wd|wdd|pressure|bp|sr)$/i;
    const candidates = {};

    Object.keys(hass.states || {}).forEach((entityId) => {
      if (!entityId.startsWith("sensor.")) return;
      if (!suffixPattern.test(entityId)) return;

      // Prefer official sviva_station entities but also support similar custom names.
      if (!entityId.includes("sviva_station")) return;

      const prefix = entityId.replace(suffixPattern, "");
      candidates[prefix] = (candidates[prefix] || 0) + 1;
    });

    const best = Object.entries(candidates).sort((a, b) => b[1] - a[1])[0]?.[0];
    return best || "";
  }

  entityMap(prefix) {
    return {
      no: `${prefix}_no`,
      no2: `${prefix}_no2`,
      nox: `${prefix}_nox`,
      o3: `${prefix}_o3`,
      pm10: `${prefix}_pm10`,
      pm25: `${prefix}_pm25`,
      pm2_5: `${prefix}_pm2_5`,
      co: `${prefix}_co`,
      aqi: `${prefix}_aqi`,
      israel_aqi: `${prefix}_israel_aqi`,
      aqi_israel: `${prefix}_aqi_israel`,
      index: `${prefix}_index`,
      general_index: `${prefix}_general_index`,
      air_quality: `${prefix}_air_quality`,
      air_quality_index: `${prefix}_air_quality_index`,
      rain: `${prefix}_rain`,
      rh: `${prefix}_rh`,
      so2: `${prefix}_so2`,
      temp: `${prefix}_temp`,
      ws: `${prefix}_ws`,
      wds: `${prefix}_wds`,
      wd: `${prefix}_wd`,
      wdd: `${prefix}_wdd`,
      pressure: `${prefix}_pressure`,
      bp: `${prefix}_bp`,
      sr: `${prefix}_sr`,
    };
  }

  resolveEntity(hass, entityId) {
    if (!entityId) return "";
    if (hass.states?.[entityId]) return entityId;

    // Case-insensitive fallback for integrations that change suffix casing.
    const wanted = entityId.toLowerCase();
    return Object.keys(hass.states || {}).find((id) => id.toLowerCase() === wanted) || entityId;
  }

  stationIdFromPrefix(prefix) {
    const match = prefix.match(/sviva_station_(\d+)/i);
    return match ? match[1] : "";
  }

  isInvalidApiValue(value) {
    return value === -9999 || value === 9999;
  }

  value(hass, entity) {
    const resolved = this.resolveEntity(hass, entity);
    const state = hass.states?.[resolved]?.state;
    if (state === undefined || state === null || state === "unknown" || state === "unavailable") return "—";

    const n = Number(String(state).replace(",", "."));
    if (Number.isFinite(n) && this.isInvalidApiValue(n)) return "—";
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : state;
  }

  num(hass, entity) {
    const resolved = this.resolveEntity(hass, entity);
    const state = hass.states?.[resolved]?.state;
    if (state === undefined || state === null || state === "unknown" || state === "unavailable") return null;

    const n = Number(String(state).replace(",", "."));
    if (Number.isFinite(n) && this.isInvalidApiValue(n)) return null;
    return Number.isFinite(n) ? n : null;
  }

  pollutantLabel(key) {
    return {
      no: "NO",
      no2: "NO₂",
      nox: "NOₓ",
      o3: "O₃",
      pm10: "PM10",
      so2: "SO₂",
      pm25: "PM2.5",
      pm2_5: "PM2.5",
      co: "CO",
    }[key] || key;
  }

  normalizeSuffix(value) {
    return String(value || "").toLowerCase().replace(/[\.\s-]+/g, "_");
  }

  firstExistingEntity(hass, candidates) {
    for (const candidate of candidates || []) {
      if (!candidate) continue;
      const resolved = this.resolveEntity(hass, candidate);
      if (hass.states?.[resolved]) return resolved;
    }
    return "";
  }

  unitForEntity(hass, entityId, fallback = "") {
    const resolved = this.resolveEntity(hass, entityId);
    return hass.states?.[resolved]?.attributes?.unit_of_measurement || fallback;
  }

  directAqiEntity(hass, e) {
    const configured = String(this.config.aqi_entity || "").trim();
    if (configured) {
      const resolved = this.resolveEntity(hass, configured);
      if (hass.states?.[resolved]) return resolved;
    }

    return this.firstExistingEntity(hass, [
      e.aqi,
      e.israel_aqi,
      e.aqi_israel,
      e.index,
      e.general_index,
      e.air_quality,
      e.air_quality_index,
    ]);
  }

  labelForIsraelAqi(score) {
    if (!Number.isFinite(score)) return { label: "אין נתונים", cls: "mid" };
    if (score >= 51) return { label: "טובה", cls: "good" };
    if (score >= 0) return { label: "בינונית", cls: "mid" };
    if (score >= -200) return { label: "נמוכה", cls: "low" };
    return { label: "נמוכה מאוד", cls: "bad" };
  }

  normalizeDirectAqiScore(value) {
    if (!Number.isFinite(value)) return null;

    // Official Israel AQI is -400..100. Some APIs expose the internal 0..500
    // AQI sub-index instead, so normalize both representations for display.
    if (value > 100 && value <= 500) return 100 - value;
    return Math.max(-400, Math.min(100, Math.round(value)));
  }

  gaugeScoreForIsraelAqi(score) {
    if (!Number.isFinite(score)) return 0;
    return Math.max(0, Math.min(500, 100 - score));
  }

  israelAqiBreakpoints(key) {
    const bp = (iLo, iHi, bpLo, bpHi) => ({ iLo, iHi, bpLo, bpHi });
    return {
      pm25: [bp(0, 49, 0, 18.5), bp(50, 100, 18.6, 37), bp(101, 200, 37.5, 84), bp(201, 300, 84.5, 130), bp(301, 400, 130.5, 165), bp(401, 500, 165.5, 200)],
      pm2_5: [bp(0, 49, 0, 18.5), bp(50, 100, 18.6, 37), bp(101, 200, 37.5, 84), bp(201, 300, 84.5, 130), bp(301, 400, 130.5, 165), bp(401, 500, 165.5, 200)],
      pm10: [bp(0, 49, 0, 65), bp(50, 100, 66, 129), bp(101, 200, 130, 215), bp(201, 300, 216, 300), bp(301, 400, 301, 355), bp(401, 500, 356, 430)],
      so2: [bp(0, 49, 0, 67), bp(50, 100, 68, 133), bp(101, 200, 134, 163), bp(201, 300, 164, 191), bp(301, 400, 192, 253), bp(401, 500, 254, 303)],
      no2: [bp(0, 49, 0, 53), bp(50, 100, 54, 105), bp(101, 200, 106, 160), bp(201, 300, 161, 213), bp(301, 400, 214, 260), bp(401, 500, 261, 316)],
      o3: [bp(0, 49, 0, 35), bp(50, 100, 36, 70), bp(101, 200, 71, 97), bp(201, 300, 98, 117), bp(301, 400, 118, 155), bp(401, 500, 156, 188)],
      co: [bp(0, 49, 0, 26), bp(50, 100, 27, 51), bp(101, 200, 52, 78), bp(201, 300, 79, 104), bp(301, 400, 105, 130), bp(401, 500, 131, 156)],
      nox: [bp(0, 49, 0, 250), bp(50, 100, 251, 499), bp(101, 200, 500, 750), bp(201, 300, 751, 1000), bp(301, 400, 1001, 1200), bp(401, 500, 1201, 1400)],
    }[this.normalizeSuffix(key)] || null;
  }

  normalizeUnit(unit) {
    return String(unit || "")
      .toLowerCase()
      .replace(/μ/g, "µ")
      .replace(/\s+/g, "")
      .replace("³", "3");
  }

  molecularWeight(key) {
    return {
      co: 28.01,
      no2: 46.0055,
      nox: 46.0055,
      o3: 48,
      so2: 64.066,
    }[this.normalizeSuffix(key)] || null;
  }

  israelAqiUnit(key) {
    return {
      pm10: "ug/m3",
      pm25: "ug/m3",
      pm2_5: "ug/m3",
      co: "ppm",
      no2: "ppb",
      nox: "ppb",
      o3: "ppb",
      so2: "ppb",
    }[this.normalizeSuffix(key)] || "";
  }

  concentrationForIsraelAqi(value, item) {
    if (!Number.isFinite(value)) return null;

    const key = this.normalizeSuffix(item.key);
    const unit = this.normalizeUnit(item.unit);
    const mw = this.molecularWeight(key);
    const targetUnit = this.israelAqiUnit(key);

    if (key === "pm10" || key === "pm25" || key === "pm2_5") return Math.max(0, value);
    if (targetUnit === "ppm") {
      if (unit === "ppm") return Math.max(0, value);
      if (unit === "ppb") return Math.max(0, value / 1000);
      if (unit === "mg/m3") return mw ? Math.max(0, (value * 24.45) / mw) : Math.max(0, value);
      if (unit === "µg/m3" || unit === "ug/m3" || unit === "mcg/m3") return mw ? Math.max(0, (value * 24.45) / (mw * 1000)) : Math.max(0, value);
    }

    if (unit === "ppb") return Math.max(0, value);
    if (unit === "ppm") return Math.max(0, value * 1000);
    if (unit === "mg/m3") return mw ? Math.max(0, (value * 1000 * 24.45) / mw) : Math.max(0, value);
    if (unit === "µg/m3" || unit === "ug/m3" || unit === "mcg/m3") return mw ? Math.max(0, (value * 24.45) / mw) : Math.max(0, value);

    return Math.max(0, value);
  }

  extraSensorMeta(suffix) {
    const key = this.normalizeSuffix(suffix);
    return {
      pm25: { name: "PM2.5", desc: "חלקיקים עדינים", category: "pollutant", kind: "green", unit: "µg/m³" },
      pm2_5: { name: "PM2.5", desc: "חלקיקים עדינים", category: "pollutant", kind: "green", unit: "µg/m³" },
      co: { name: "CO", desc: "פחמן חד־חמצני", category: "pollutant", kind: "gray", unit: "ppm" },
      ws: { name: "WS", desc: "מהירות רוח", category: "weather", kind: "blue" },
      wds: { name: "WS", desc: "מהירות רוח", category: "weather", kind: "blue" },
      wd: { name: "WD", desc: "כיוון רוח", category: "weather", kind: "blue", unit: "°" },
      wdd: { name: "WD", desc: "כיוון רוח", category: "weather", kind: "blue", unit: "°" },
      pressure: { name: "Pressure", desc: "לחץ ברומטרי", category: "weather", kind: "gray" },
      bp: { name: "Pressure", desc: "לחץ ברומטרי", category: "weather", kind: "gray" },
      sr: { name: "Solar", desc: "קרינה סולארית", category: "weather", kind: "yellow" },
    }[key] || null;
  }

  buildBasePollutantItems(hass, e) {
    const pm25Entity = this.firstExistingEntity(hass, [e.pm25, e.pm2_5]);
    const coEntity = this.firstExistingEntity(hass, [e.co]);

    return [
      { key: "pm10", name: "PM10", desc: "חלקיקים נשימים", entity: e.pm10, unit: this.unitForEntity(hass, e.pm10, "µg/m³"), kind: "green" },
      { key: "pm25", name: "PM2.5", desc: "חלקיקים עדינים", entity: pm25Entity, unit: this.unitForEntity(hass, pm25Entity, "µg/m³"), kind: "green" },
      { key: "o3", name: "O₃", desc: "אוזון", entity: e.o3, unit: this.unitForEntity(hass, e.o3, "ppb"), kind: "blue" },
      { key: "so2", name: "SO₂", desc: "גופרית דו־חמצנית", entity: e.so2, unit: this.unitForEntity(hass, e.so2, "ppb"), kind: "yellow" },
      { key: "no2", name: "NO₂", desc: "חנקן דו־חמצני", entity: e.no2, unit: this.unitForEntity(hass, e.no2, "ppb"), kind: "red" },
      { key: "nox", name: "NOₓ", desc: "תחמוצות חנקן", entity: e.nox, unit: this.unitForEntity(hass, e.nox, "ppb"), kind: "red" },
      { key: "no", name: "NO", desc: "חנקן חד־חמצני", entity: e.no, unit: this.unitForEntity(hass, e.no, "ppb"), kind: "gray" },
      { key: "co", name: "CO", desc: "פחמן חד־חמצני", entity: coEntity, unit: this.unitForEntity(hass, coEntity, "ppm"), kind: "gray" },
    ];
  }

  buildBaseWeatherItems(hass, e) {
    const wsEntity = this.firstExistingEntity(hass, [e.ws, e.wds]);
    const wdEntity = this.firstExistingEntity(hass, [e.wd, e.wdd]);
    const pressureEntity = this.firstExistingEntity(hass, [e.pressure, e.bp]);

    return [
      { key: "temp", name: "טמפ׳", desc: "טמפרטורה", entity: e.temp, unit: this.unitForEntity(hass, e.temp, "°C"), kind: "orange" },
      { key: "rh", name: "לחות", desc: "לחות יחסית", entity: e.rh, unit: this.unitForEntity(hass, e.rh, "%"), kind: "blue" },
      { key: "rain", name: "גשם", desc: "משקעים", entity: e.rain, unit: this.unitForEntity(hass, e.rain, "mm"), kind: "blue" },
      { key: "ws", name: "WS", desc: "מהירות רוח", entity: wsEntity, unit: this.unitForEntity(hass, wsEntity, "m/s"), kind: "blue" },
      { key: "wd", name: "WD", desc: "כיוון רוח", entity: wdEntity, unit: this.unitForEntity(hass, wdEntity, "°"), kind: "blue" },
      { key: "pressure", name: "Pressure", desc: "לחץ ברומטרי", entity: pressureEntity, unit: this.unitForEntity(hass, pressureEntity, "hPa"), kind: "gray" },
    ];
  }

  autoDetectedItems(hass, prefix, explicitSuffixes, category) {
    const items = [];
    const known = new Set((explicitSuffixes || []).map((s) => this.normalizeSuffix(s)));
    const prefixStart = `${prefix}_`;

    Object.keys(hass.states || {}).forEach((entityId) => {
      if (!entityId.startsWith(prefixStart)) return;
      const suffixRaw = entityId.slice(prefixStart.length);
      const suffix = this.normalizeSuffix(suffixRaw);
      if (!suffix || known.has(suffix)) return;

      const meta = this.extraSensorMeta(suffix);
      const inferredCategory = meta?.category || (/temp|rh|rain|ws|wds|wd|wdd|wind|pressure|bp|sr|solar/.test(suffix) ? "weather" : "pollutant");
      if (inferredCategory !== category) return;

      const stateObj = hass.states?.[entityId];
      const unit = stateObj?.attributes?.unit_of_measurement || meta?.unit || "";
      const friendly = String(stateObj?.attributes?.friendly_name || "").trim();
      const fallbackName = suffix.toUpperCase().replace(/_/g, " ");

      if (category === "weather") {
        items.push({
          key: suffix,
          name: meta?.name || fallbackName,
          desc: meta?.desc || friendly || "מדד מזג אוויר",
          entity: entityId,
          unit,
          kind: meta?.kind || "blue",
        });
      } else {
        items.push({
          key: suffix,
          name: meta?.name || fallbackName,
          desc: meta?.desc || friendly || "מזהם אוויר",
          entity: entityId,
          unit,
          kind: meta?.kind || "gray",
        });
      }
    });

    return items;
  }

  metricItems(hass, e, prefix) {
    const base = this.buildBasePollutantItems(hass, e);
    const extras = this.config.show_extra_pollutants === false
      ? []
      : this.autoDetectedItems(hass, prefix, Object.keys(e), "pollutant");

    const all = [...base, ...extras];
    const deduped = new Map();
    all.forEach((item) => {
      const id = this.resolveEntity(hass, item.entity);
      if (!id || !hass.states?.[id]) return;
      if (!deduped.has(item.key)) deduped.set(item.key, { ...item, entity: id });
    });
    return Array.from(deduped.values());
  }

  weatherItems(hass, e, prefix) {
    const base = this.buildBaseWeatherItems(hass, e);
    const extras = this.config.show_extra_weather === false
      ? []
      : this.autoDetectedItems(hass, prefix, Object.keys(e), "weather");

    const all = [...base, ...extras];
    const deduped = new Map();
    all.forEach((item) => {
      const id = this.resolveEntity(hass, item.entity);
      if (!id || !hass.states?.[id]) return;
      if (!deduped.has(item.key)) deduped.set(item.key, { ...item, entity: id });
    });
    return Array.from(deduped.values());
  }

  scoreForItem(value, item) {
    if (!Number.isFinite(value)) return null;

    const breakpoints = this.israelAqiBreakpoints(item.key);
    const concentration = this.concentrationForIsraelAqi(value, item);
    if (!breakpoints || concentration === null) return null;

    const band = breakpoints.find((row) => concentration <= row.bpHi) || breakpoints[breakpoints.length - 1];
    const ratio = (concentration - band.bpLo) / Math.max(band.bpHi - band.bpLo, 1);
    const score = band.iLo + (band.iHi - band.iLo) * ratio;
    return Math.max(0, Math.min(500, score));
  }

  calcPollutantAqi(hass, e) {
    let worst = null;

    this.metricItems(hass, e, this.detectPrefix(hass)).forEach((item) => {
      const value = this.num(hass, item.entity);
      if (value === null) return;
      const score = this.scoreForItem(value, item);
      if (score === null) return;
      if (!worst || score > worst.score) {
        worst = { score, key: item.key, item };
      }
    });

    if (!worst) return { score: "—", gaugeScore: 0, label: "אין נתונים", cls: "mid", pollutant: "—" };

    const subIndex = Math.round(Math.max(0, Math.min(500, worst.score)));
    const score = 100 - subIndex;
    const gaugeScore = this.gaugeScoreForIsraelAqi(score);
    const { label, cls } = this.labelForIsraelAqi(score);

    return { score, gaugeScore, label, cls, pollutant: worst.key, source: "calculated" };
  }

  calcAqi(hass, e) {
    const calculated = this.calcPollutantAqi(hass, e);
    const directEntity = this.directAqiEntity(hass, e);
    const directValue = this.num(hass, directEntity);
    const directScore = this.normalizeDirectAqiScore(directValue);

    if (directScore !== null) {
      const { label, cls } = this.labelForIsraelAqi(directScore);
      return {
        score: directScore,
        gaugeScore: this.gaugeScoreForIsraelAqi(directScore),
        label,
        cls,
        pollutant: calculated.pollutant !== "—" ? calculated.pollutant : "official_aqi",
        source: "official",
        entity: directEntity,
      };
    }

    return calculated;
  }

  needleAngleForScore(score) {
    const s = Math.max(0, Math.min(500, Number(score) || 0));

    // Interpolate by the exact gauge ticks shown in the UI.
    const anchors = [
      { score: 0, angle: 0 },
      { score: 49, angle: -18 },
      { score: 100, angle: -36 },
      { score: 300, angle: -108 },
      { score: 500, angle: -180 },
    ];

    for (let i = 0; i < anchors.length - 1; i += 1) {
      const from = anchors[i];
      const to = anchors[i + 1];
      if (s >= from.score && s <= to.score) {
        const ratio = (s - from.score) / Math.max(to.score - from.score, 1);
        return Math.round(from.angle + (to.angle - from.angle) * ratio);
      }
    }

    return -180;
  }

  percentForItem(value, item) {
    if (!Number.isFinite(value)) return 0;
    const score = this.scoreForItem(value, item);
    if (score === null) return 0;
    return Math.max(0, Math.min(100, score / 5));
  }

  metricHtml(hass, item) {
    const value = this.value(hass, item.entity);
    const raw = this.num(hass, item.entity);
    const pct = this.percentForItem(raw, item);

    return `
      <article class="metric ${item.kind}">
        <div class="metric-readout">
          <div class="metric-number">
            <strong>${value}</strong>
            <small>${item.unit}</small>
          </div>
          <div class="quality-bar"><i style="left:calc(${pct}% - 5px)"></i></div>
        </div>

        <div class="metric-info">
          <b>${item.name}</b>
          <span>${item.desc}</span>
        </div>

        <div class="metric-visual">
          <div class="molecule ${item.kind}">
            <i class="ball"></i><i class="ball"></i><i class="ball"></i>
          </div>
        </div>
      </article>
    `;
  }

  weatherHtml(hass, item) {
    const value = this.value(hass, item.entity);

    return `
      <article class="metric weather ${item.kind} ${item.key === "rain" ? "weather-wide" : ""}">
        <div class="metric-readout">
          <div class="metric-number">
            <strong>${value}</strong>
            <small>${item.unit}</small>
          </div>
        </div>

        <div class="metric-info">
          <b>${item.name}</b>
          <span>${item.desc}</span>
        </div>

        <div class="metric-visual">
          <div class="molecule weather-icon ${item.kind}">
            ${item.key === "temp" ? "🌡️" : item.key === "rh" ? "💧" : item.key === "rain" ? "🌧️" : item.key === "ws" ? "💨" : item.key === "wd" ? "🧭" : item.key === "pressure" ? "⏲️" : item.key === "sr" ? "☀️" : "🌤️"}
          </div>
        </div>
      </article>
    `;
  }

  legendHtml() {
    if (this.config.show_legend === false) return "";
    return `
      <div class="legend-table">
        <div class="legend-row head"><span>רמה</span><span>טווח</span><span>צבע</span></div>
        <div class="legend-row"><b>טובה</b><span class="legend-range">51 - 100</span><i class="legend-band good"></i></div>
        <div class="legend-row"><b>בינונית</b><span class="legend-range">0 - 50</span><i class="legend-band mid"></i></div>
        <div class="legend-row"><b>נמוכה</b><span class="legend-range">-1 - -200</span><i class="legend-band low"></i></div>
        <div class="legend-row"><b>נמוכה מאוד</b><span class="legend-range">-201 - -400</span><i class="legend-band bad"></i></div>
      </div>
    `;
  }

  sceneHtml(dominant) {
    if (this.config.show_scene === false) return "";

    const name = dominant?.name || "מזהם";
    const value = dominant?.value ?? "—";
    const unit = dominant?.unit || "";

    return `
      <div class="scene">
        <div class="station">
          <div class="station-core">
            <small>${name}</small>
            <b>${value}</b>
            <span>${unit}</span>
          </div>
        </div>
        <div class="tree t1"></div>
        <div class="tree t2"></div>
        <div class="tree t3"></div>
        <div class="tree t4 orange"></div>
      </div>
    `;
  }

  navigate(path) {
    if (!path) {
      history.back();
      return;
    }

    const normalized = path.startsWith("/") ? path : `/${path}`;
    history.pushState(null, "", normalized);

    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    this.dispatchEvent(new CustomEvent("location-changed", {
      detail: { replace: false },
      bubbles: true,
      composed: true,
    }));
  }

  renderError(message) {
    this.shadowRoot.innerHTML = `
      <ha-card>
        <div style="padding:18px;color:#d65046;font-weight:800">${message}</div>
      </ha-card>
    `;
  }

  set hass(hass) {
    const prefix = this.detectPrefix(hass);
    if (!prefix) {
      this.renderError("לא נמצאו חיישנים בפורמט sensor.sviva_station_XX_* — לדוגמה sensor.sviva_station_32_pm10");
      return;
    }

    const e = this.entityMap(prefix);
    const aqi = this.calcAqi(hass, e);
    const allMetricItems = this.metricItems(hass, e, prefix);
    const allWeatherItems = this.weatherItems(hass, e, prefix);
    const dominantItem = allMetricItems.find((item) => item.key === aqi.pollutant) || null;
    const dominantLabel = dominantItem ? dominantItem.name : "—";
    const dominantValue = dominantItem ? this.value(hass, dominantItem.entity) : "—";
    const gaugeSubtitle = aqi.source === "official"
      ? (dominantItem ? `מדד רשמי: ${aqi.score} · מזהם דומיננטי מחושב: ${dominantLabel} ${dominantValue}` : `מדד רשמי: ${aqi.score}`)
      : `מבוסס על ${dominantLabel}: ${dominantValue}`;
    const stationId = this.stationIdFromPrefix(prefix);
    const stationName = this.config.station_name || (stationId ? `תחנת ניטור ${stationId}` : "Air Sviva");
    const updated = new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    const deg = this.needleAngleForScore(aqi.gaugeScore);
    const maxWidth = this.config.max_width || "2200px";

    const pollutantMetrics = allMetricItems.map((item) => this.metricHtml(hass, item)).join("");
    const weatherMetrics = this.config.show_weather === false ? "" : allWeatherItems.map((item) => this.weatherHtml(hass, item)).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display:block;
          direction:rtl;
          --air-ink:#18304b;
          --air-muted:#5e6c7c;
          --air-green:#68b55f;
          --air-yellow:#f2d34f;
          --air-orange:#ec8c31;
          --air-red:#d65046;
          --air-blue:#3c7ec5;
          --air-deep-shadow:0 34px 70px rgba(57,88,116,.26);
          --air-soft-shadow:0 14px 30px rgba(86,121,143,.16);
          font-family:var(--primary-font-family, system-ui);
        }

        ha-card {
          border:0;
          box-shadow:none;
          background:transparent;
          overflow:visible;
        }

        .screen {
          min-height:${this.config.full_height === false ? "auto" : "calc(100vh - 48px)"};
          display:grid;
          place-items:center;
          padding:26px;
          position:relative;
          overflow:hidden;
          background:
            radial-gradient(circle at 15% 87%, rgba(101,163,132,.35), transparent 30%),
            radial-gradient(circle at 88% 12%, rgba(255,255,255,.46), transparent 28%),
            linear-gradient(165deg, #edf7ff 0%, #d8ebfa 46%, #cee7dc 100%);
          border-radius:28px;
        }

        .screen:before,
        .screen:after {
          content:"";
          position:absolute;
          pointer-events:none;
          border-radius:50%;
          filter:blur(1px);
        }

        .screen:before {
          width:420px;
          height:420px;
          left:-120px;
          top:-120px;
          background:radial-gradient(circle, rgba(255,255,255,.34), rgba(255,255,255,0));
        }

        .screen:after {
          width:340px;
          height:340px;
          right:-90px;
          bottom:-80px;
          background:radial-gradient(circle, rgba(111,173,134,.26), rgba(111,173,134,0));
        }

        .dashboard {
          width:100%; max-width:${maxWidth};
          min-height:720px;
          border-radius:38px;
          padding:clamp(18px, 2.2vw, 34px);
          position:relative;
          overflow:hidden;
          background:
            radial-gradient(circle at 78% 8%, rgba(255,255,255,.88), transparent 16%),
            radial-gradient(circle at 18% 0%, rgba(255,255,255,.46), transparent 22%),
            linear-gradient(152deg, rgba(255,255,255,.90), rgba(226,239,248,.84));
          border:1px solid rgba(255,255,255,.86);
          box-shadow:var(--air-deep-shadow), inset 0 1px 0 rgba(255,255,255,.95);
          backdrop-filter:blur(4px);
          color:var(--air-ink);
        }

        .dashboard:before {
          content:"";
          position:absolute;
          inset:14px 14px auto;
          height:90px;
          border-radius:26px;
          background:linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,0));
          pointer-events:none;
        }

        .top {
          display:grid;
          grid-template-columns:minmax(92px, 124px) minmax(0, 1fr) minmax(170px, 218px);
          grid-template-areas:"logo intro refresh";
          gap:24px;
          align-items:center;
          margin-bottom:24px;
          position:relative;
          z-index:2;
        }

        .logo-box {
          grid-area:logo;
          width:126px;
          height:126px;
          border-radius:28px;
          background:linear-gradient(160deg,#ffffff,#d6e7f3);
          box-shadow:var(--air-soft-shadow), inset 0 1px 0 rgba(255,255,255,.9);
          display:grid;
          place-items:center;
        }
        .dashboard.size-compact .molecule {
          width:54px;
          height:54px;
          border-radius:16px;
        }

        .dashboard.size-large .molecule {
          width:82px;
          height:82px;
          border-radius:22px;
        }


        .logo-box img {
          width:92px;
          height:92px;
          object-fit:contain;
        }

        .intro {
          grid-area:intro;
          text-align:center;
          justify-self:center;
          width:100%;
          background:linear-gradient(160deg, rgba(255,255,255,.50), rgba(225,236,246,.24));
          border:1px solid rgba(255,255,255,.62);
          border-radius:22px;
          padding:14px 18px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.84), 0 8px 16px rgba(83,108,132,.09);
        }

        .intro h1 {
          margin:0 auto 8px;
          font-size:clamp(30px, 3vw, 52px);
          line-height:1;
          letter-spacing:-.03em;
          color:#1b2e49;
        }

        .intro p {
          max-width:760px;
          margin:0 auto;
          line-height:1.42;
          color:#2c405a;
          font-weight:600;
          font-size:clamp(13px, 1.1vw, 16px);
        }

        .refresh {
          grid-area:refresh;
          border-radius:22px;
          padding:14px 16px;
          background:linear-gradient(158deg,#f8fcff,#dceaf4);
          box-shadow:var(--air-soft-shadow), inset 0 1px 0 rgba(255,255,255,.85);
          display:grid;
          grid-template-columns:42px minmax(0,1fr);
          gap:10px;
          align-items:center;
          color:#2a3d58;
        }

        .refresh-icon {
          width:42px;
          height:42px;
          border-radius:16px;
          display:grid;
          place-items:center;
          color:#39965d;
          font-size:30px;
          font-weight:900;
        }

        .refresh small {
          display:block;
          color:#65778a;
          font-weight:700;
        }

        .refresh b {
          display:block;
          direction:ltr;
          font-size:24px;
          line-height:1;
          margin:2px 0;
        }

        .refresh-meta {
          text-align:center;
          justify-self:center;
        }

        .nav-button {
          grid-column:1 / -1;
          width:100%;
          display:block;
          justify-self:stretch;
          border:0;
          cursor:pointer;
          margin:0;
          padding:10px 12px;
          border-radius:16px;
          text-align:center;
          box-sizing:border-box;
          font-family:inherit;
          font-weight:850;
          color:#23405f;
          background:linear-gradient(160deg,#ffffff,#d8e6f1);
          box-shadow:0 10px 18px rgba(74,104,129,.18), inset 0 1px 0 rgba(255,255,255,.95);
          transition:transform .18s ease, box-shadow .18s ease;
        }

        .back-button {
          background:linear-gradient(145deg,#eef7ff,#d8e8f2);
        }

        .nav-button:active {
          transform:translateY(1px);
        }

        .nav-button:hover {
          transform:translateY(-1px);
          box-shadow:0 14px 20px rgba(74,104,129,.22), inset 0 1px 0 rgba(255,255,255,.96);
        }

        .refresh .nav-button + .nav-button {
          margin-top:8px;
        }

        .main {
          display:grid;
          grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);
          gap:30px;
          position:relative;
          z-index:2;
        }

        .panel {
          position:relative;
          border-radius:24px;
          background:linear-gradient(156deg,rgba(255,255,255,.86),rgba(225,237,246,.80));
          border:1px solid rgba(255,255,255,.88);
          box-shadow:var(--air-soft-shadow), inset 0 1px 0 rgba(255,255,255,.9);
        }

        .panel:before {
          content:"";
          position:absolute;
          left:14px;
          right:14px;
          top:10px;
          height:26px;
          border-radius:16px;
          background:linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0));
          pointer-events:none;
        }

        .gauge-panel {
          padding:26px;
          display:grid;
          grid-template-columns:1fr;
          gap:14px;
          min-height:350px;
          align-items:start;
          overflow:hidden;
        }

        .gauge-title {
          text-align:center;
          font-size:18px;
          font-weight:850;
          color:#213954;
          margin-bottom:-6px;
        }

        .gauge-subtitle {
          margin-top:-4px;
          margin-bottom:0;
          text-align:center;
          color:#4c627a;
          font-size:13px;
          font-weight:700;
        }

        .gauge-wrap {
          width:100%;
          min-height:354px;
          position:relative;
          display:grid;
          place-items:center;
        }

        .gauge {
          position:relative;
          width:min(100%,620px);
          height:340px;
          overflow:visible;
          margin-top:0;
          filter:drop-shadow(0 12px 20px rgba(73,99,121,.16));
        }

        .arc-track {
          position:absolute;
          left:50%;
          bottom:-236px;
          width:min(100%,620px);
          height:620px;
          transform:translateX(-50%);
          border-radius:50%;
          background:conic-gradient(from 270deg, rgba(153,171,188,.22) 0deg 180deg, transparent 180deg 360deg);
          -webkit-mask:radial-gradient(circle,transparent 0 57%,#000 58% 72%,transparent 73%);
          mask:radial-gradient(circle,transparent 0 57%,#000 58% 72%,transparent 73%);
        }

        .arc {
          position:absolute;
          left:50%;
          bottom:-236px;
          width:min(100%,620px);
          height:620px;
          transform:translateX(-50%);
          border-radius:50%;
          background:
            conic-gradient(from 270deg,
              #984806 0deg 72deg,
              #e22f2f 72deg 144deg,
              #f0d24c 144deg 162deg,
              #66b866 162deg 180deg,
              transparent 180deg 360deg);
          -webkit-mask:radial-gradient(circle,transparent 0 58%,#000 59% 71%,transparent 72%);
          mask:radial-gradient(circle,transparent 0 58%,#000 59% 71%,transparent 72%);
          filter:drop-shadow(0 10px 14px rgba(80,100,120,.3));
        }

        .arc:after {
          content:"";
          position:absolute;
          right:16px;
          bottom:170px;
          width:14px;
          height:14px;
          border-radius:50%;
          background:#72bf69;
          box-shadow:0 0 12px rgba(102,184,102,.55);
        }

        .needle {
          position:absolute;
          left:50%;
          bottom:108px;
          width:118px;
          height:12px;
          transform-origin:10px center;
          transform:rotate(${deg}deg);
          border-radius:999px;
          background:linear-gradient(145deg,#4fa565,#2f8a4e);
          box-shadow:0 10px 18px rgba(60,95,70,.34);
          z-index:2;
        }

        .needle:before {
          content:"";
          position:absolute;
          left:0;
          top:-6px;
          width:24px;
          height:24px;
          border-radius:50%;
          background:#77bd75;
          box-shadow:inset 6px 6px 14px rgba(95,115,135,.13), inset -6px -6px 14px rgba(255,255,255,.78);
        }

        .gauge-num {
          position:absolute;
          left:50%;
          bottom:30px;
          transform:translateX(-50%);
          text-align:center;
          z-index:5;
          pointer-events:none;
          color:${aqi.cls === "good" ? "#47985a" : aqi.cls === "mid" ? "#b89821" : aqi.cls === "low" ? "#c54842" : "#984806"};
        }

        .gauge-num strong {
          display:block;
          font-size:58px;
          line-height:.9;
          font-weight:950;
        }

        .gauge-num span {
          font-size:24px;
          font-weight:850;
        }

        .tick {
          position:absolute;
          color:#334966;
          font-size:15px;
          font-weight:700;
          text-shadow:0 1px 0 rgba(255,255,255,.75);
        }

        .t0 { right:36px; bottom:72px; }
        .t51 { right:120px; top:96px; }
        .t100 { left:50%; top:34px; transform:translateX(-50%); }
        .t200 { left:80px; top:118px; }
        .t400 { left:36px; bottom:72px; }

        .legend-table {
          border-radius:20px;
          overflow:hidden;
          background:linear-gradient(160deg, rgba(255,255,255,.68), rgba(228,238,246,.66));
          box-shadow:inset 0 1px 0 rgba(255,255,255,.92), 0 8px 16px rgba(95,115,135,.12);
          align-self:center;
          width:min(560px,100%);
          font-size:14px;
          justify-self:center;
        }

        .legend-row {
          display:grid;
          grid-template-columns:1fr 120px 90px;
          align-items:center;
          border-bottom:1px solid rgba(70,90,110,.12);
          min-height:46px;
          padding:0 12px;
          column-gap:8px;
        }

        .legend-row.head {
          background:#dae5ef;
          font-weight:850;
          color:#314b68;
        }

        .legend-row:last-child { border-bottom:0; }

        .legend-range {
          justify-self:center;
          color:#3b5069;
          font-weight:780;
          direction:ltr;
        }

        .legend-band {
          width:68px;
          height:12px;
          border-radius:999px;
          justify-self:center;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.65), 0 4px 8px rgba(80,100,120,.2);
        }

        .legend-band.good { background:linear-gradient(90deg,#4ea85a,#7dcf72); }
        .legend-band.mid { background:linear-gradient(90deg,#c8ad31,#f0d24c); }
        .legend-band.low { background:linear-gradient(90deg,#d92222,#ff4f4f); }
        .legend-band.bad { background:linear-gradient(90deg,#7e3608,#984806); }

        .scene {
          margin-top:20px;
          height:160px;
          border-radius:24px;
          overflow:hidden;
          background:
            radial-gradient(circle at 38% 26%, rgba(255,255,255,.85), transparent 9%),
            radial-gradient(circle at 71% 22%, rgba(255,255,255,.78), transparent 8%),
            linear-gradient(180deg,#b9d8ee 0%,#d9edf8 52%,#a9d092 53%,#6eae65 100%);
          box-shadow:var(--air-soft-shadow), inset 0 1px 0 rgba(255,255,255,.7);
          position:relative;
          border:1px solid rgba(255,255,255,.75);
        }

        .station {
          position:absolute;
          bottom:34px;
          left:50%;
          transform:translateX(-50%);
          width:84px;
          height:96px;
          background:linear-gradient(160deg,#f7f9fb,#ecf1f5);
          border-radius:12px;
          box-shadow:0 10px 18px rgba(60,90,80,.22), inset 0 1px 0 rgba(255,255,255,.92);
          z-index:3;
          display:grid;
          place-items:center;
        }

        .station-core {
          text-align:center;
          line-height:1;
          color:#1f3b57;
        }

        .station-core small {
          display:block;
          font-size:11px;
          font-weight:850;
          color:#5a7289;
          margin-bottom:4px;
        }

        .station-core b {
          display:block;
          font-size:24px;
          font-weight:950;
          letter-spacing:-.02em;
        }

        .station-core span {
          display:block;
          margin-top:3px;
          font-size:11px;
          font-weight:820;
          color:#5a7289;
          direction:ltr;
        }

        .station:before {
          content:"";
          position:absolute;
          left:30px;
          top:-62px;
          width:5px;
          height:64px;
          border-radius:999px;
          background:#a8b7bd;
        }

        .station:after {
          content:"";
          position:absolute;
          left:17px;
          top:-70px;
          width:32px;
          height:12px;
          border-radius:50%;
          background:#d7e0e5;
          box-shadow:0 4px 8px rgba(0,0,0,.12);
        }

        .tree {
          position:absolute;
          bottom:34px;
          width:32px;
          height:68px;
          background:#4fa557;
          border-radius:50% 50% 35% 35%;
          z-index:2;
        }

        .tree:after {
          content:"";
          position:absolute;
          bottom:-18px;
          left:14px;
          width:5px;
          height:24px;
          background:#7b6945;
          border-radius:999px;
        }

        .tree.t1 { right:54px; transform:scale(1.15); }
        .tree.t2 { right:118px; transform:scale(.82); opacity:.88; }
        .tree.t3 { left:82px; transform:scale(1.25); }
        .tree.t4 { left:165px; transform:scale(.92); }
        .tree.orange { background:#e1a040; }

        .pollution-panel {
          padding:24px;
        }

        .pollution-title {
          text-align:center;
          font-weight:850;
          font-size:20px;
          margin-bottom:16px;
          color:#253e5b;
        }

        .metrics {
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:14px;
        }

        .metrics > .metric:last-child:nth-child(odd) {
          grid-column:1 / -1;
        }

        .metric {
          position:relative;
          min-height:118px;
          border-radius:22px;
          background:linear-gradient(160deg,#f8fcff,#dbe8f2);
          box-shadow:0 12px 20px rgba(95,115,135,.16), inset 0 1px 0 rgba(255,255,255,.9);
          border:1px solid rgba(255,255,255,.9);
          display:grid;
          grid-template-columns:minmax(0, 1fr) 82px;
          grid-template-areas:
            "readout visual"
            "info visual";
          gap:12px;
          align-items:start;
          padding:16px;
          overflow:visible;
          direction:ltr;
          transition:transform .18s ease, box-shadow .18s ease;
        }

        .metric:before {
          content:"";
          position:absolute;
          inset:1px 1px auto 1px;
          height:38%;
          border-radius:20px;
          background:linear-gradient(180deg, rgba(255,255,255,.44), rgba(255,255,255,0));
          pointer-events:none;
        }

        .metric:hover {
          transform:translateY(-2px);
          box-shadow:0 16px 24px rgba(95,115,135,.2), inset 0 1px 0 rgba(255,255,255,.95);
        }

        .metric.weather {
          min-height:108px;
        }

        .metric.weather-wide {
          grid-column:1 / -1;
        }

        .metric-readout {
          grid-area:readout;
          min-width:0;
          width:100%;
          display:grid;
          gap:10px;
          align-items:start;
          justify-items:start;
          direction:ltr;
        }

        .metric-number {
          display:flex;
          align-items:baseline;
          gap:5px;
          white-space:nowrap;
          direction:ltr;
        }

        .metric-number strong {
          font-size:34px;
          font-weight:950;
          line-height:1;
          color:#18304b;
        }

        .metric-number small {
          color:#304861;
          font-size:18px;
          font-weight:860;
          line-height:1.1;
          letter-spacing:-.01em;
          background:rgba(255,255,255,.62);
          border:1px solid rgba(255,255,255,.78);
          border-radius:10px;
          padding:2px 8px;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.92);
          white-space:nowrap;
        }

        .metric-info {
          grid-area:info;
          min-width:0;
          text-align:right;
          direction:rtl;
          align-self:end;
        }

        .metric-info b {
          display:block;
          direction:rtl;
          unicode-bidi:plaintext;
          font-size:20px;
          font-weight:950;
          line-height:1.05;
          color:#18304b;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .metric-info span {
          display:block;
          margin-top:4px;
          color:#52657a;
          font-size:13px;
          line-height:1.25;
          font-weight:650;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .metric-visual {
          grid-area:visual;
          display:grid;
          place-items:center;
          width:82px;
          justify-self:end;
          overflow:visible;
        }

        .molecule {
          width:62px;
          height:62px;
          border-radius:18px;
          background:linear-gradient(165deg,#ffffff,#d8e6f1);
          box-shadow:0 8px 16px rgba(73,104,130,.16), inset 0 1px 0 rgba(255,255,255,.9);
          position:relative;
          display:grid;
          place-items:center;
          flex:0 0 auto;
        }

        .molecule .ball {
          position:absolute;
          width:13px;
          height:13px;
          border-radius:50%;
          background:#3c7ec5;
          box-shadow:inset 2px 2px 3px rgba(255,255,255,.45), inset -2px -2px 4px rgba(0,0,0,.2), 0 4px 6px rgba(50,70,90,.18);
        }

        .molecule .ball:nth-child(1) { top:13px; left:18px; }
        .molecule .ball:nth-child(2) { top:26px; left:37px; }
        .molecule .ball:nth-child(3) { top:38px; left:17px; }

        .molecule.red .ball:nth-child(1),
        .molecule.red .ball:nth-child(2) { background:#c84438; }
        .molecule.yellow .ball:nth-child(2) { background:#d7b12f; }
        .molecule.gray .ball:nth-child(1) { background:#8b939d; }
        .molecule.green .ball:nth-child(1),
        .molecule.green .ball:nth-child(2),
        .molecule.green .ball:nth-child(3) { background:#4fa557; }

        .weather-icon {
          font-size:29px;
        }

        .quality-bar {
          width:128px;
          height:14px;
          border-radius:999px;
          background:linear-gradient(90deg,
            #66b866 0%,
            #66b866 10%,
            #f0d24c 10%,
            #f0d24c 20%,
            #e22f2f 20%,
            #e22f2f 60%,
            #984806 60%,
            #984806 100%);
          position:relative;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.8), inset 4px 4px 10px rgba(95,115,135,.14);
          direction:ltr;
        }

        .quality-bar i {
          position:absolute;
          top:-4px;
          width:9px;
          height:23px;
          border-radius:999px;
          background:rgba(255,255,255,.96);
          box-shadow:0 4px 10px rgba(70,90,110,.28);
        }

        .weather-section {
          margin-top:14px;
          padding-top:14px;
          border-top:1px solid rgba(70,90,110,.12);
        }

        .footer {
          position:relative;
          z-index:2;
          margin:18px auto 0;
          width:min(720px,90%);
          border-radius:18px;
          padding:12px 18px;
          background:linear-gradient(160deg,rgba(255,255,255,.90),rgba(225,236,245,.84));
          box-shadow:var(--air-soft-shadow), inset 0 1px 0 rgba(255,255,255,.92);
          text-align:center;
          color:#3f5268;
          font-weight:650;
        }


        @media (max-width:1050px) {
          .dashboard {
            padding:22px;
          }

          .main {
            grid-template-columns:1fr;
          }

          .metric {
            min-height:112px;
          }

          .gauge {
            width:min(100%,520px);
            height:300px;
          }

          .arc,
          .arc-track {
            width:min(100%,520px);
            height:520px;
            bottom:-196px;
          }

          .needle {
            bottom:95px;
          }

          .t0,
          .t400 {
            bottom:62px;
          }
        }

        @media (max-width:1300px) {
          .top {
            grid-template-columns:minmax(84px, 104px) minmax(0, 1fr) minmax(154px, 196px);
            gap:14px;
          }

          .logo-box {
            width:104px;
            height:104px;
            border-radius:24px;
          }

          .logo-box img {
            width:78px;
            height:78px;
          }

          .intro {
            padding:10px 14px;
          }
        }

        @media (max-width:1180px) {
          .top {
            grid-template-columns:1fr auto;
            grid-template-areas:
              "intro intro"
              "refresh logo";
            align-items:start;
            gap:12px;
          }

          .intro {
            max-width:unset;
          }

          .logo-box {
            justify-self:end;
          }

          .refresh {
            justify-self:start;
          }
        }

        @media (max-width:980px) {
          .top {
            grid-template-columns:72px 1fr;
            grid-template-areas:
              "logo intro"
              "refresh refresh";
          }

          .logo-box {
            width:78px;
            height:78px;
            border-radius:20px;
          }

          .logo-box img {
            width:58px;
            height:58px;
          }

          .refresh {
            grid-column:1 / -1;
            justify-self:start;
          }

          .main {
            grid-template-columns:1fr;
          }

          .gauge-panel {
            min-height:auto;
          }

          .legend-table {
            width:min(360px,100%);
            justify-self:center;
          }
        }

        @media (max-width:620px) {
          .screen {
            padding:0;
            border-radius:0;
          }

          .dashboard {
            border-radius:24px;
            padding:14px;
            min-height:auto;
          }

          .panel {
            border-radius:20px;
          }

          .intro h1 {
            font-size:28px;
          }

          .intro p {
            font-size:13px;
          }

          .top {
            gap:12px;
          }

          .metrics {
            grid-template-columns:1fr;
          }

          .metric,
          .metric.weather-wide {
            grid-template-columns:minmax(0, 1fr) 72px;
            grid-template-areas:
              "readout visual"
              "info visual";
            min-height:108px;
            padding:13px;
          }

          .metric-readout {
            min-width:0;
          }

          .metric-info b {
            font-size:21px;
          }

          .metric-info span {
            font-size:13px;
          }

          .metric-number strong {
            font-size:30px;
          }

          .quality-bar {
            width:116px;
          }

          .molecule {
            width:56px;
            height:56px;
          }


          .metric,
          .metric.weather-wide {
            grid-template-columns:58px minmax(0, 1fr);
            grid-template-rows:auto auto;
            min-height:94px;
            padding:12px;
          }

          .metric-visual {
            grid-area:1 / 1 / 3 / 2;
          }

          .metric-info b {
            font-size:19px;
          }

          .metric-info span {
            font-size:12px;
          }

          .metric-number strong {
            font-size:26px;
          }

          .metric-number small {
            font-size:15px;
            padding:1px 6px;
            border-radius:8px;
          }

          .quality-bar {
            min-width:80px;
          }

          .molecule {
            width:52px;
            height:52px;
          }

          .gauge {
            width:min(100%,420px);
            height:246px;
          }

          .arc,
          .arc-track {
            width:min(100%,420px);
            height:420px;
            bottom:-152px;
          }

          .needle {
            bottom:75px;
          }

          .t0,
          .t400 {
            bottom:42px;
          }

          .legend-row {
            grid-template-columns:1fr 92px 74px;
            min-height:42px;
            padding:0 10px;
          }

          .legend-band {
            width:54px;
          }

          .scene {
            height:105px;
          }

          .footer {
            width:100%;
          }
        }
      </style>

      <ha-card>
        <div class="screen">
          <main class="dashboard">
            <header class="top">
              <div class="logo-box">
                <img src="${AIR_SVIVA_LOGO}">
              </div>

              <section class="intro">
                <h1>${this.config.title}</h1>
                <p>
                  ${stationName} — מדד איכות האוויר מחושב לפי נוסחת AQI ישראלית ולפי המזהם המשפיע ביותר בתחנה.
                  המדד משווה תת־מדד לכל מזהם נמדד ומציג את רמת איכות האוויר הנוכחית.
                </p>
              </section>

              <aside class="refresh">
                <div class="refresh-icon">↻</div>
                <div class="refresh-meta">
                  <small>עודכון אחרון</small>
                  <b>${updated}</b>
                  <strong>${new Date().toLocaleDateString("he-IL")}</strong>
                </div>

                ${this.config.show_back_button === false ? "" : `
                  <button class="nav-button back-button" type="button" data-nav="${this.config.back_button_path || ""}">
                    ← ${this.config.back_button_label || "חזרה"}
                  </button>
                `}

                ${this.config.nav_button_label && this.config.nav_button_path ? `
                  <button class="nav-button" type="button" data-nav="${this.config.nav_button_path}">
                    ${this.config.nav_button_label}
                  </button>
                ` : ""}
              </aside>
            </header>

            <section class="main">
              <section>
                <div class="gauge-panel panel">
                  <div class="gauge-title">מקרא של רמת איכות האוויר</div>
                  <div class="gauge-subtitle">${gaugeSubtitle}</div>

                  <div class="gauge-wrap">
                    <div class="gauge">
                      <div class="arc-track"></div>
                      <div class="arc"></div>
                      <div class="needle"></div>
                      <div class="gauge-num">
                        <strong>${aqi.score}</strong>
                        <span>${aqi.label}</span>
                      </div>
                      <span class="tick t0">100</span>
                      <span class="tick t51">51</span>
                      <span class="tick t100">0</span>
                      <span class="tick t200">-200</span>
                      <span class="tick t400">-400</span>
                    </div>
                  </div>

                  ${this.legendHtml()}
                </div>

                ${this.sceneHtml({ name: dominantLabel, value: dominantValue, unit: dominantItem?.unit || "" })}
              </section>

              <section class="pollution-panel panel">
                <div class="pollution-title">רמת איכות האוויר מחושבת עבור מזהמי האוויר האלה:</div>

                <div class="metrics">
                  ${pollutantMetrics}
                </div>

                ${weatherMetrics ? `<div class="weather-section"><div class="metrics">${weatherMetrics}</div></div>` : ""}
              </section>
            </section>

            ${this.config.show_footer === false ? "" : `
              <footer class="footer">
                מדד איכות האוויר מחושב עבור כל תחנת ניטור בנפרד ונקבע על פי המזהם שתת־המדד שלו הוא הגבוה ביותר.
              </footer>
            `}
          </main>
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => this.navigate(btn.dataset.nav));
    });
  }

  getCardSize() {
    return 12;
  }
}

customElements.define("air-sviva-dashboard-card", AirSvivaDashboardCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "air-sviva-dashboard-card",
  name: "Air Sviva Dashboard Card",
  description: "Full dashboard air quality card with auto-detected Sviva station sensors",
  preview: true,
});

console.info(`[air-sviva-dashboard-card] loaded build ${AIR_SVIVA_BUILD}`);
