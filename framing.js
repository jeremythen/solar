(() => {
  "use strict";

  const STORAGE_KEY = "solar241-structures-v1";
  const M_TO_IN = 39.37007874;

  /** Dimensiones reales en pulgadas (nominal → actual). */
  const PROFILES = {
    "2x4": { id: "2x4", label: "2×4", kind: "lumber", t: 1.5, d: 3.5, color: "#c4a35a" },
    "2x6": { id: "2x6", label: "2×6", kind: "lumber", t: 1.5, d: 5.5, color: "#b8924a" },
    "2x8": { id: "2x8", label: "2×8", kind: "lumber", t: 1.5, d: 7.25, color: "#a67c3a" },
    "2x10": { id: "2x10", label: "2×10", kind: "lumber", t: 1.5, d: 9.25, color: "#8f6a2e" },
    "4x4": { id: "4x4", label: "4×4", kind: "lumber", t: 3.5, d: 3.5, color: "#8b5a2b" },
    "4x6": { id: "4x6", label: "4×6", kind: "lumber", t: 3.5, d: 5.5, color: "#7a4e24" },
    "sheet-4x8": {
      id: "sheet-4x8",
      label: "Plancha 4×8 ft",
      kind: "sheet",
      w: 48,
      h: 96,
      color: "rgba(180,140,80,0.35)",
    },
  };

  const state = {
    structures: loadAll(),
    activeId: null, // areaId or blank id
    tool: "select",
    profile: "2x4",
    oc: 16,
    snap: true,
    showGrid: true,
    selectedMemberId: null,
    dpr: 1,
    cssW: 0,
    cssH: 0,
    baseScale: 1,
    userZoom: 1,
    panX: -24,
    panY: -24,
    drag: null,
    spaceDown: false,
  };

  const els = {
    viewLot: document.getElementById("view-lot"),
    viewFraming: document.getElementById("view-framing"),
    tabs: [...document.querySelectorAll(".tab")],
    tabNote: document.getElementById("framing-tab-note"),
    title: document.getElementById("framing-title"),
    meta: document.getElementById("framing-meta"),
    emptyPanel: document.getElementById("framing-empty-panel"),
    toolsWrap: document.getElementById("framing-tools-wrap"),
    profile: document.getElementById("framing-profile"),
    oc: document.getElementById("framing-oc"),
    snap: document.getElementById("framing-snap"),
    grid: document.getElementById("framing-grid"),
    wFt: document.getElementById("framing-w-ft"),
    dFt: document.getElementById("framing-d-ft"),
    btnFit: document.getElementById("btn-framing-fit"),
    btnBlank: document.getElementById("btn-framing-blank"),
    btnDel: document.getElementById("btn-framing-del"),
    btnClear: document.getElementById("btn-framing-clear"),
    selEmpty: document.getElementById("framing-sel-empty"),
    selEditor: document.getElementById("framing-sel-editor"),
    selInfo: document.getElementById("framing-sel-info"),
    bom: document.getElementById("framing-bom"),
    cursor: document.getElementById("framing-cursor"),
    status: document.getElementById("framing-status"),
    stage: document.getElementById("framing-stage"),
    canvas: document.getElementById("framing-canvas"),
    tools: [...document.querySelectorAll("[data-ftool]")],
  };

  const ctx = els.canvas.getContext("2d");

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveAll() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.structures));
  }

  function uid(prefix = "m") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  function active() {
    return state.activeId ? state.structures[state.activeId] : null;
  }

  function ensureStructure(id, opts = {}) {
    if (!state.structures[id]) {
      state.structures[id] = {
        id,
        name: opts.name || "Estructura",
        widthIn: opts.widthIn || 10 * 12,
        depthIn: opts.depthIn || 12 * 12,
        members: [],
        updatedAt: new Date().toISOString(),
      };
    } else if (opts.name) {
      state.structures[id].name = opts.name;
    }
    if (opts.widthIn) state.structures[id].widthIn = opts.widthIn;
    if (opts.depthIn) state.structures[id].depthIn = opts.depthIn;
    saveAll();
    return state.structures[id];
  }

  function snapIn(v) {
    if (!state.snap) return v;
    return Math.round(v);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function scale() {
    return state.baseScale * state.userZoom;
  }

  /** Mundo framing: pulgadas, origen esquina frente-izq, Y hacia el fondo (arriba en pantalla). */
  function worldToScreen(x, y) {
    const s = scale();
    return { x: (x - state.panX) * s, y: (state.panY - y) * s };
  }

  function screenToWorld(sx, sy) {
    const s = scale();
    return { x: sx / s + state.panX, y: state.panY - sy / s };
  }

  function fitView() {
    const st = active();
    if (!st) return;
    const pad = 36;
    const worldW = st.widthIn + pad * 2;
    const worldH = st.depthIn + pad * 2;
    state.baseScale = Math.min(state.cssW / worldW, state.cssH / worldH);
    state.userZoom = 1;
    const viewW = state.cssW / scale();
    const viewH = state.cssH / scale();
    state.panX = (st.widthIn - viewW) / 2;
    state.panY = st.depthIn / 2 + viewH / 2;
    draw();
  }

  function resize() {
    if (!els.viewFraming.classList.contains("active")) return;
    const rect = els.stage.getBoundingClientRect();
    state.cssW = rect.width;
    state.cssH = rect.height;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.width = Math.max(1, Math.floor(rect.width * state.dpr));
    els.canvas.height = Math.max(1, Math.floor(rect.height * state.dpr));
    els.canvas.style.width = `${rect.width}px`;
    els.canvas.style.height = `${rect.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    if (active()) fitView();
    else draw();
  }

  function memberLengthIn(m) {
    if (m.kind === "sheet") return null;
    return Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
  }

  function fmtLenIn(inches) {
    const ft = Math.floor(inches / 12);
    const inn = +(inches - ft * 12).toFixed(1);
    if (ft <= 0) return `${inn}″`;
    if (inn < 0.05) return `${ft}′`;
    return `${ft}′-${inn}″`;
  }

  function draw() {
    ctx.clearRect(0, 0, state.cssW, state.cssH);
    const g = ctx.createLinearGradient(0, 0, state.cssW, state.cssH);
    g.addColorStop(0, "#f3efe6");
    g.addColorStop(1, "#e7e0d2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.cssW, state.cssH);

    const st = active();
    if (!st) {
      ctx.fillStyle = "#5c6f64";
      ctx.font = '500 15px "DM Sans", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("Abre un área desde Terreno para diseñar framing", state.cssW / 2, state.cssH / 2);
      return;
    }

    // footprint
    const a = worldToScreen(0, 0);
    const b = worldToScreen(st.widthIn, 0);
    const c = worldToScreen(st.widthIn, st.depthIn);
    const d = worldToScreen(0, st.depthIn);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = "#efe6d4";
    ctx.fill();
    ctx.strokeStyle = "#3d2e1a";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (state.showGrid) drawGrid(st);
    for (const m of st.members) drawMember(m, m.id === state.selectedMemberId);
    drawDraft();
  }

  function drawGrid(st) {
    const step = 12;
    ctx.save();
    const a = worldToScreen(0, 0);
    const c = worldToScreen(st.widthIn, st.depthIn);
    ctx.beginPath();
    ctx.rect(
      Math.min(a.x, c.x),
      Math.min(a.y, c.y),
      Math.abs(c.x - a.x),
      Math.abs(c.y - a.y)
    );
    ctx.clip();
    for (let x = 0; x <= st.widthIn + 0.01; x += step) {
      const p0 = worldToScreen(x, 0);
      const p1 = worldToScreen(x, st.depthIn);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = x % 48 === 0 ? "rgba(61,46,26,0.28)" : "rgba(61,46,26,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (let y = 0; y <= st.depthIn + 0.01; y += step) {
      const p0 = worldToScreen(0, y);
      const p1 = worldToScreen(st.widthIn, y);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = y % 48 === 0 ? "rgba(61,46,26,0.28)" : "rgba(61,46,26,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMember(m, selected) {
    const p = PROFILES[m.profile] || PROFILES["2x4"];
    if (m.kind === "sheet") {
      const w = p.w;
      const h = p.h;
      const corners = sheetCorners(m.x, m.y, w, h, m.rot || 0).map((pt) => worldToScreen(pt.x, pt.y));
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.fillStyle = selected ? "rgba(180,140,80,0.55)" : p.color;
      ctx.fill();
      ctx.strokeStyle = selected ? "#1a2a22" : "#6b542e";
      ctx.lineWidth = selected ? 2.25 : 1.25;
      ctx.stroke();
      const mid = worldToScreen(m.x + w / 2, m.y + h / 2);
      ctx.fillStyle = "#3d2e1a";
      ctx.font = '600 11px "DM Sans", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.label, mid.x, mid.y);
      return;
    }

    // lumber as thick segment using thickness t in plan (on flat / edge approx)
    const thick = p.t;
    const ang = Math.atan2(m.y2 - m.y1, m.x2 - m.x1);
    const nx = Math.cos(ang + Math.PI / 2) * (thick / 2);
    const ny = Math.sin(ang + Math.PI / 2) * (thick / 2);
    const pts = [
      worldToScreen(m.x1 + nx, m.y1 + ny),
      worldToScreen(m.x2 + nx, m.y2 + ny),
      worldToScreen(m.x2 - nx, m.y2 - ny),
      worldToScreen(m.x1 - nx, m.y1 - ny),
    ];
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = selected ? "#e0b45a" : p.color;
    ctx.fill();
    ctx.strokeStyle = selected ? "#1a2a22" : "#3d2e1a";
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
  }

  function sheetCorners(x, y, w, h, rotDeg) {
    const rot = (rotDeg * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const locals = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ];
    return locals.map(([lx, ly]) => ({
      x: x + lx * cos - ly * sin,
      y: y + lx * sin + ly * cos,
    }));
  }

  function drawDraft() {
    const d = state.drag;
    if (!d) return;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#1f5c3f";
    ctx.lineWidth = 1.5;
    if (d.kind === "lumber" || d.kind === "wall") {
      const p0 = worldToScreen(d.x0, d.y0);
      const p1 = worldToScreen(d.x1, d.y1);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      const len = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
      ctx.setLineDash([]);
      ctx.fillStyle = "#1a2a22";
      ctx.font = '500 12px "IBM Plex Mono", monospace';
      ctx.fillText(fmtLenIn(len), p1.x + 6, p1.y - 6);
    } else if (d.kind === "sheet") {
      const p = PROFILES[state.profile];
      const m = { kind: "sheet", profile: state.profile, x: d.x0, y: d.y0, rot: 0 };
      drawMember(m, true);
    }
    ctx.restore();
  }

  function hitMember(wx, wy) {
    const st = active();
    if (!st) return null;
    for (let i = st.members.length - 1; i >= 0; i--) {
      const m = st.members[i];
      if (m.kind === "sheet") {
        const p = PROFILES[m.profile];
        // inverse rotate point into sheet local
        const rot = -((m.rot || 0) * Math.PI) / 180;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const dx = wx - m.x;
        const dy = wy - m.y;
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        if (lx >= 0 && ly >= 0 && lx <= p.w && ly <= p.h) return m;
      } else {
        const dist = distToSegment(wx, wy, m.x1, m.y1, m.x2, m.y2);
        const thick = (PROFILES[m.profile]?.t || 1.5) / 2 + 1.5;
        if (dist <= thick) return m;
      }
    }
    return null;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function addLumber(x1, y1, x2, y2, profile = state.profile) {
    const st = active();
    if (!st) return;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 2) return;
    st.members.push({
      id: uid(),
      kind: "lumber",
      profile,
      role: "member",
      x1,
      y1,
      x2,
      y2,
    });
    st.updatedAt = new Date().toISOString();
    saveAll();
    renderBom();
    draw();
  }

  function addSheet(x, y, profile = state.profile) {
    const st = active();
    if (!st) return;
    st.members.push({
      id: uid(),
      kind: "sheet",
      profile,
      x,
      y,
      rot: 0,
    });
    st.updatedAt = new Date().toISOString();
    saveAll();
    renderBom();
    draw();
  }

  /** Auto wall: plates along line + studs at OC. */
  function addAutoWall(x1, y1, x2, y2) {
    const st = active();
    if (!st) return;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 6) return;
    const profile = state.profile in PROFILES && PROFILES[state.profile].kind === "lumber" ? state.profile : "2x4";
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    // plates
    st.members.push({
      id: uid(),
      kind: "lumber",
      profile,
      role: "bottom-plate",
      x1,
      y1,
      x2,
      y2,
    });
    st.members.push({
      id: uid(),
      kind: "lumber",
      profile,
      role: "top-plate",
      x1: x1 + uy * 3.5,
      y1: y1 - ux * 3.5,
      x2: x2 + uy * 3.5,
      y2: y2 - ux * 3.5,
    });

    // studs — perpendicular, length = wall height in plan view used as stud depth representation (7.5 ft default wall height as stud length in plan is wrong)
    // In plan view, studs are short ticks across the wall thickness. Better: studs as short members perpendicular to wall spanning plate width.
    const studLen = 3.5; // across wall thickness in plan (2x4 depth)
    const oc = state.oc;
    const count = Math.max(1, Math.round(len / oc));
    for (let i = 0; i <= count; i++) {
      const t = (i / count) * len;
      const cx = x1 + ux * t;
      const cy = y1 + uy * t;
      const sx1 = cx - uy * 0;
      const sy1 = cy + ux * 0;
      const sx2 = cx + uy * studLen;
      const sy2 = cy - ux * studLen;
      st.members.push({
        id: uid(),
        kind: "lumber",
        profile,
        role: "stud",
        x1: sx1,
        y1: sy1,
        x2: sx2,
        y2: sy2,
      });
    }

    // Also store cut lengths for studs as wall height metadata for BOM
    st.wallHeightIn = st.wallHeightIn || 90; // 7'6"
    st.updatedAt = new Date().toISOString();
    saveAll();
    els.status.textContent = `Muro: ${fmtLenIn(len)} · studs @ ${oc}″`;
    renderBom();
    draw();
  }

  function renderBom() {
    const st = active();
    if (!st) {
      els.bom.textContent = "—";
      return;
    }
    const groups = {};
    for (const m of st.members) {
      const p = PROFILES[m.profile] || { label: m.profile };
      if (m.kind === "sheet") {
        const key = `${p.label}`;
        groups[key] = groups[key] || { count: 0, lengths: [] };
        groups[key].count += 1;
      } else {
        let len = memberLengthIn(m);
        // Studs in plan are short; BOM uses wall height for studs
        if (m.role === "stud") len = st.wallHeightIn || 90;
        const key = p.label;
        groups[key] = groups[key] || { count: 0, lengths: [] };
        groups[key].count += 1;
        groups[key].lengths.push(len);
      }
    }
    const lines = Object.entries(groups).map(([label, g]) => {
      if (!g.lengths.length) return `${g.count}× ${label}`;
      const total = g.lengths.reduce((a, b) => a + b, 0);
      return `${g.count}× ${label}  (Σ ${fmtLenIn(total)})`;
    });
    els.bom.innerHTML = lines.length
      ? lines.map((l) => `<div>${l}</div>`).join("")
      : '<div class="muted">Sin piezas aún</div>';
  }

  function syncUI() {
    const st = active();
    const has = Boolean(st);
    els.emptyPanel.classList.toggle("hidden", has);
    els.toolsWrap.classList.toggle("hidden", !has);
    if (!st) {
      els.title.textContent = "Estructura";
      els.meta.textContent = "Abre un área desde Terreno para empezar";
      els.tabNote.textContent = "Sin estructura abierta";
      renderBom();
      draw();
      return;
    }
    els.title.textContent = st.name;
    els.meta.textContent = `${(st.widthIn / 12).toFixed(1)} × ${(st.depthIn / 12).toFixed(1)} ft · ${st.members.length} piezas`;
    els.tabNote.textContent = st.name;
    els.wFt.value = (st.widthIn / 12).toFixed(2);
    els.dFt.value = (st.depthIn / 12).toFixed(2);
    syncSelection();
    renderBom();
  }

  function syncSelection() {
    const st = active();
    const m = st?.members.find((x) => x.id === state.selectedMemberId);
    if (!m) {
      els.selEmpty.classList.remove("hidden");
      els.selEditor.classList.add("hidden");
      return;
    }
    els.selEmpty.classList.add("hidden");
    els.selEditor.classList.remove("hidden");
    const p = PROFILES[m.profile];
    if (m.kind === "sheet") {
      els.selInfo.textContent = `${p.label} @ ${fmtLenIn(m.x)}, ${fmtLenIn(m.y)}`;
    } else {
      const len = m.role === "stud" ? active().wallHeightIn || 90 : memberLengthIn(m);
      els.selInfo.textContent = `${p.label}${m.role ? ` · ${m.role}` : ""} · ${fmtLenIn(len)}`;
    }
  }

  function setTool(tool) {
    state.tool = tool;
    els.tools.forEach((b) => b.classList.toggle("active", b.dataset.ftool === tool));
    els.stage.classList.toggle("tool-rect", tool !== "select");
    els.status.textContent =
      tool === "lumber"
        ? "Arrastra para colocar un palo"
        : tool === "sheet"
          ? "Clic para colocar plancha 4×8"
          : tool === "wall"
            ? "Traza la línea del muro (plates + studs)"
            : "Seleccionar";
  }

  function openFromArea(area) {
    const widthIn =
      area.shape === "circle" ? area.r * 2 * M_TO_IN : (area.w || 3) * M_TO_IN;
    const depthIn =
      area.shape === "circle" ? area.r * 2 * M_TO_IN : (area.h || 3) * M_TO_IN;
    ensureStructure(area.id, {
      name: area.label || "Estructura",
      widthIn: Math.max(48, widthIn),
      depthIn: Math.max(48, depthIn),
    });
    state.activeId = area.id;
    state.selectedMemberId = null;
    switchTab("framing");
    syncUI();
    requestAnimationFrame(() => {
      resize();
      fitView();
    });
    els.status.textContent = `Framing: ${area.label || area.id}`;
  }

  function openBlank() {
    const id = uid("blank");
    ensureStructure(id, { name: "Framing libre", widthIn: 10 * 12, depthIn: 12 * 12 });
    state.activeId = id;
    state.selectedMemberId = null;
    switchTab("framing");
    syncUI();
    requestAnimationFrame(() => {
      resize();
      fitView();
    });
  }

  function switchTab(tab) {
    els.tabs.forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    els.viewLot.classList.toggle("active", tab === "lot");
    els.viewFraming.classList.toggle("active", tab === "framing");
    if (tab === "framing") {
      requestAnimationFrame(() => {
        resize();
        draw();
      });
    } else if (window.SolarLot?.redraw) {
      window.SolarLot.redraw();
    }
  }

  function pointerPos(e) {
    const rect = els.canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (!active()) return;
    if (e.button === 1 || (e.button === 0 && (state.spaceDown || e.altKey))) {
      const { sx, sy } = pointerPos(e);
      state.drag = { kind: "pan", sx, sy, panX: state.panX, panY: state.panY };
      els.stage.classList.add("panning");
      els.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const { sx, sy } = pointerPos(e);
    let w = screenToWorld(sx, sy);
    w = { x: snapIn(w.x), y: snapIn(w.y) };

    if (state.tool === "lumber" || state.tool === "wall") {
      state.drag = { kind: state.tool, x0: w.x, y0: w.y, x1: w.x, y1: w.y };
      els.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (state.tool === "sheet") {
      const p = PROFILES[state.profile];
      if (!p || p.kind !== "sheet") {
        els.status.textContent = "Elige una plancha en Perfil";
        return;
      }
      addSheet(w.x, w.y, state.profile);
      return;
    }

    const hit = hitMember(w.x, w.y);
    state.selectedMemberId = hit ? hit.id : null;
    syncSelection();
    if (hit) {
      state.drag = {
        kind: "move-member",
        id: hit.id,
        ox: w.x,
        oy: w.y,
        start: JSON.parse(JSON.stringify(hit)),
      };
      els.canvas.setPointerCapture(e.pointerId);
      els.stage.classList.add("dragging");
    }
    draw();
  }

  function onPointerMove(e) {
    const { sx, sy } = pointerPos(e);
    const w = screenToWorld(sx, sy);
    els.cursor.textContent = `${(w.x / 12).toFixed(2)} ft , ${(w.y / 12).toFixed(2)} ft  (${w.x.toFixed(0)}″, ${w.y.toFixed(0)}″)`;

    if (!state.drag) return;
    const d = state.drag;
    if (d.kind === "pan") {
      const s = scale();
      state.panX = d.panX - (sx - d.sx) / s;
      state.panY = d.panY + (sy - d.sy) / s;
      draw();
      return;
    }
    if (d.kind === "lumber" || d.kind === "wall") {
      d.x1 = snapIn(w.x);
      d.y1 = snapIn(w.y);
      draw();
      return;
    }
    if (d.kind === "move-member") {
      const st = active();
      const m = st.members.find((x) => x.id === d.id);
      if (!m) return;
      const ddx = snapIn(w.x) - d.ox;
      const ddy = snapIn(w.y) - d.oy;
      if (m.kind === "sheet") {
        m.x = d.start.x + ddx;
        m.y = d.start.y + ddy;
      } else {
        m.x1 = d.start.x1 + ddx;
        m.y1 = d.start.y1 + ddy;
        m.x2 = d.start.x2 + ddx;
        m.y2 = d.start.y2 + ddy;
      }
      draw();
    }
  }

  function onPointerUp() {
    const d = state.drag;
    els.stage.classList.remove("dragging", "panning");
    if (!d) return;
    if (d.kind === "lumber") {
      addLumber(d.x0, d.y0, d.x1, d.y1);
    } else if (d.kind === "wall") {
      addAutoWall(d.x0, d.y0, d.x1, d.y1);
    } else if (d.kind === "move-member") {
      const st = active();
      if (st) {
        st.updatedAt = new Date().toISOString();
        saveAll();
        renderBom();
      }
    }
    state.drag = null;
    draw();
  }

  function onWheel(e) {
    if (!active()) return;
    e.preventDefault();
    const { sx, sy } = pointerPos(e);
    const before = screenToWorld(sx, sy);
    state.userZoom = clamp(state.userZoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.3, 5);
    const after = screenToWorld(sx, sy);
    state.panX += before.x - after.x;
    state.panY += before.y - after.y;
    draw();
  }

  // populate profile select
  els.profile.innerHTML = Object.values(PROFILES)
    .map((p) => `<option value="${p.id}">${p.label}${p.kind === "sheet" ? "" : ` (${p.t}×${p.d}″)`}</option>`)
    .join("");
  els.profile.value = "2x4";

  els.tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  els.tools.forEach((b) => b.addEventListener("click", () => setTool(b.dataset.ftool)));
  els.profile.addEventListener("change", () => {
    state.profile = els.profile.value;
    if (PROFILES[state.profile]?.kind === "sheet" && state.tool === "lumber") setTool("sheet");
    if (PROFILES[state.profile]?.kind === "lumber" && state.tool === "sheet") setTool("lumber");
  });
  els.oc.addEventListener("change", () => {
    state.oc = Number(els.oc.value) || 16;
  });
  els.snap.addEventListener("change", () => {
    state.snap = els.snap.checked;
  });
  els.grid.addEventListener("change", () => {
    state.showGrid = els.grid.checked;
    draw();
  });
  els.btnFit.addEventListener("click", fitView);
  els.btnBlank.addEventListener("click", openBlank);
  els.btnDel.addEventListener("click", () => {
    const st = active();
    if (!st || !state.selectedMemberId) return;
    st.members = st.members.filter((m) => m.id !== state.selectedMemberId);
    state.selectedMemberId = null;
    saveAll();
    syncSelection();
    renderBom();
    draw();
  });
  els.btnClear.addEventListener("click", () => {
    const st = active();
    if (!st?.members.length) return;
    if (!confirm("¿Vaciar todas las piezas de este framing?")) return;
    st.members = [];
    saveAll();
    state.selectedMemberId = null;
    syncUI();
    draw();
  });
  ["change", "input"].forEach((ev) => {
    els.wFt.addEventListener(ev, () => {
      const st = active();
      if (!st) return;
      st.widthIn = Math.max(24, (Number(els.wFt.value) || 10) * 12);
      saveAll();
      syncUI();
      draw();
    });
    els.dFt.addEventListener(ev, () => {
      const st = active();
      if (!st) return;
      st.depthIn = Math.max(24, (Number(els.dFt.value) || 12) * 12);
      saveAll();
      syncUI();
      draw();
    });
  });

  els.canvas.addEventListener("pointerdown", onPointerDown);
  els.canvas.addEventListener("pointermove", onPointerMove);
  els.canvas.addEventListener("pointerup", onPointerUp);
  els.canvas.addEventListener("pointercancel", onPointerUp);
  els.canvas.addEventListener("wheel", onWheel, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (!els.viewFraming.classList.contains("active")) return;
    if (e.code === "Space") {
      state.spaceDown = true;
      e.preventDefault();
    }
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "v" || e.key === "V") setTool("select");
    if (e.key === "l" || e.key === "L") setTool("lumber");
    if (e.key === "w" || e.key === "W") setTool("wall");
    if (e.key === "Delete" || e.key === "Backspace") {
      els.btnDel.click();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") state.spaceDown = false;
  });
  window.addEventListener("resize", resize);

  window.SolarFraming = {
    openFromArea,
    openBlank,
    switchTab,
    getStructures: () => state.structures,
    setStructures(data, { merge = false } = {}) {
      if (!data || typeof data !== "object") return;
      if (merge) {
        state.structures = { ...state.structures, ...data };
      } else {
        state.structures = { ...data };
      }
      saveAll();
      if (state.activeId && !state.structures[state.activeId]) state.activeId = null;
      syncUI();
      draw();
    },
    hasStructure(areaId) {
      return Boolean(state.structures[areaId]?.members?.length);
    },
  };

  setTool("select");
  syncUI();
})();
