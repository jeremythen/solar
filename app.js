(() => {
  "use strict";

  /** Geometría del solar: lado izquierdo vertical, frente y fondo horizontales. */
  const PLOT = {
    front: 24.2,
    back: 20.02,
    depth: 25.01,
    right: 25.26,
    area: 552.83,
  };

  const DEFAULT_TREES = [
    { id: 1, name: "", x: 2.3, y: 5.6 },
    { id: 2, name: "", x: 4.1, y: 9.7 },
    { id: 3, name: "", x: 6.5, y: 0 },
    { id: 4, name: "", x: 6.6, y: 1 },
    { id: 5, name: "", x: 9.5, y: 4.5 },
    { id: 6, name: "", x: 10, y: 4 },
    { id: 7, name: "", x: 10.8, y: 7.2 },
    { id: 8, name: "", x: 11.2, y: 4.4 },
    { id: 9, name: "", x: 11.5, y: 6 },
    { id: 10, name: "", x: 16.5, y: 8.7 },
    { id: 11, name: "", x: 18.1, y: 6.1 },
    { id: 12, name: "", x: 19.9, y: 8.6 },
    { id: 13, name: "", x: 1.6, y: 16.3 },
  ];

  const STORAGE_KEY = "solar241-areas-v1";
  const TREES_KEY = "solar241-trees-v1";
  const UNIT_KEY = "solar241-unit-v1";
  const PAD_M = 2.2;
  const TREE_R_M = 0.45;
  const MIN_SIZE_M = 0.5;
  const MIN_RADIUS_M = 0.25;
  /** 1 metro = 3.280839895 pies (internacional) */
  const M_TO_FT = 3.280839895;
  const FT_TO_M = 1 / M_TO_FT;

  const stage = document.getElementById("stage");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  const els = {
    toolButtons: [...document.querySelectorAll(".tool")],
    areaLabel: document.getElementById("area-label"),
    areaW: document.getElementById("area-w"),
    areaH: document.getElementById("area-h"),
    areaColor: document.getElementById("area-color"),
    btnPlace: document.getElementById("btn-place"),
    shapeButtons: [...document.querySelectorAll("[data-place-shape]")],
    fieldAreaH: document.getElementById("field-area-h"),
    fieldSelH: document.getElementById("field-sel-h"),
    unitButtons: [...document.querySelectorAll(".unit-btn")],
    brandKicker: document.getElementById("brand-kicker"),
    brandMeta: document.getElementById("brand-meta"),
    lblAreaW: document.getElementById("lbl-area-w"),
    lblAreaH: document.getElementById("lbl-area-h"),
    lblGrid: document.getElementById("lbl-grid"),
    lblSelX: document.getElementById("lbl-sel-x"),
    lblSelY: document.getElementById("lbl-sel-y"),
    lblSelW: document.getElementById("lbl-sel-w"),
    lblSelH: document.getElementById("lbl-sel-h"),
    lblTreeX: document.getElementById("lbl-tree-x"),
    lblTreeY: document.getElementById("lbl-tree-y"),
    lblSelTreeX: document.getElementById("lbl-sel-tree-x"),
    lblSelTreeY: document.getElementById("lbl-sel-tree-y"),
    treeName: document.getElementById("tree-name"),
    treeX: document.getElementById("tree-x"),
    treeY: document.getElementById("tree-y"),
    btnAddTree: document.getElementById("btn-add-tree"),
    btnTreeTool: document.getElementById("btn-tree-tool"),
    btnLockAll: document.getElementById("btn-lock-all"),
    btnUnlockAll: document.getElementById("btn-unlock-all"),
    treeSelection: document.getElementById("tree-selection"),
    selTreeLocked: document.getElementById("sel-tree-locked"),
    selTreeName: document.getElementById("sel-tree-name"),
    selTreeX: document.getElementById("sel-tree-x"),
    selTreeY: document.getElementById("sel-tree-y"),
    btnDeleteTree: document.getElementById("btn-delete-tree"),
    toggleGrid: document.getElementById("toggle-grid"),
    toggleTrees: document.getElementById("toggle-trees"),
    toggleDims: document.getElementById("toggle-dims"),
    btnZoomIn: document.getElementById("btn-zoom-in"),
    btnZoomOut: document.getElementById("btn-zoom-out"),
    btnFit: document.getElementById("btn-fit"),
    zoomLabel: document.getElementById("zoom-label"),
    selectionEmpty: document.getElementById("selection-empty"),
    selectionEditor: document.getElementById("selection-editor"),
    selLabel: document.getElementById("sel-label"),
    selX: document.getElementById("sel-x"),
    selY: document.getElementById("sel-y"),
    selW: document.getElementById("sel-w"),
    selH: document.getElementById("sel-h"),
    selRot: document.getElementById("sel-rot"),
    fieldSelRot: document.getElementById("field-sel-rot"),
    btnRotCcw: document.getElementById("btn-rot-ccw"),
    btnRotCw: document.getElementById("btn-rot-cw"),
    btnAlignRight: document.getElementById("btn-align-right"),
    selColor: document.getElementById("sel-color"),
    btnDelete: document.getElementById("btn-delete"),
    btnExport: document.getElementById("btn-export"),
    btnImport: document.getElementById("btn-import"),
    importFile: document.getElementById("import-file"),
    btnClear: document.getElementById("btn-clear"),
    treeList: document.getElementById("tree-list"),
    treeCount: document.getElementById("tree-count"),
    cursorReadout: document.getElementById("cursor-readout"),
    status: document.getElementById("status"),
    labelDialog: document.getElementById("label-dialog"),
    labelForm: document.getElementById("label-form"),
    dialogLabel: document.getElementById("dialog-label"),
    dialogCancel: document.getElementById("dialog-cancel"),
    treeDialog: document.getElementById("tree-dialog"),
    treeForm: document.getElementById("tree-form"),
    dialogTreeName: document.getElementById("dialog-tree-name"),
    treeDialogCancel: document.getElementById("tree-dialog-cancel"),
  };

  const state = {
    tool: "select",
    placeShape: "rect",
    unit: loadUnit(),
    areas: loadAreas(),
    trees: loadTrees(),
    selectedId: null,
    selectedTreeId: null,
    editingTreeId: null,
    showGrid: true,
    showTrees: true,
    showDims: true,
    dpr: 1,
    cssW: 0,
    cssH: 0,
    /** metros por píxel CSS a zoom 1 (ajustado a caber) */
    baseScale: 1,
    userZoom: 1,
    /** pan en metros del origen del mundo (esquina superior-izq del viewport) */
    panX: -PAD_M,
    panY: -PAD_M,
    drag: null,
    editingId: null,
    hoverId: null,
    spaceDown: false,
  };

  function normalizeTree(t, fallbackId = 1) {
    return {
      id: Number.isFinite(Number(t.id)) ? Number(t.id) : fallbackId,
      name: typeof t.name === "string" ? t.name.trim() : "",
      x: Number(t.x) || 0,
      y: Number(t.y) || 0,
      // Sin valor previo: bloqueado por defecto (evita mover coordenadas medidas)
      locked: t.locked === undefined ? true : Boolean(t.locked),
    };
  }

  function isCircle(area) {
    return area && area.shape === "circle";
  }

  function normalizeArea(a) {
    if (!a || typeof a !== "object") return null;
    if (a.shape === "circle" || (a.r != null && a.w == null && a.h == null)) {
      return {
        id: a.id || uid(),
        shape: "circle",
        label: a.label || "Área",
        x: Number(a.x) || 0,
        y: Number(a.y) || 0,
        r: Math.max(MIN_RADIUS_M, Number(a.r) || MIN_RADIUS_M),
        color: a.color || "#2f6f4e",
      };
    }
    const w = Math.max(MIN_SIZE_M, Number(a.w) || 1);
    const h = Math.max(MIN_SIZE_M, Number(a.h) || 1);
    let x = Number(a.x) || 0;
    let y = Number(a.y) || 0;
    // Formato antiguo: x,y = esquina frente-izquierda. Nuevo: centro.
    if (!a.centered) {
      x += w / 2;
      y += h / 2;
    }
    return {
      id: a.id || uid(),
      shape: "rect",
      label: a.label || "Área",
      x,
      y,
      w,
      h,
      rot: Number.isFinite(Number(a.rot)) ? Number(a.rot) : 0,
      centered: true,
      color: a.color || "#2f6f4e",
    };
  }

  function degToRad(d) {
    return (d * Math.PI) / 180;
  }

  function normalizeDeg(d) {
    let x = d % 360;
    if (x > 180) x -= 360;
    if (x <= -180) x += 360;
    return +x.toFixed(2);
  }

  /** Ángulo del lado derecho del solar (grados, desde +X hacia +Y). */
  function rightEdgeAngleDeg() {
    return (Math.atan2(PLOT.depth, PLOT.back - PLOT.front) * 180) / Math.PI;
  }

  function localToWorld(area, lx, ly) {
    const rot = degToRad(area.rot || 0);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    return {
      x: area.x + lx * cos - ly * sin,
      y: area.y + lx * sin + ly * cos,
    };
  }

  function worldToLocal(area, wx, wy) {
    const rot = degToRad(area.rot || 0);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const dx = wx - area.x;
    const dy = wy - area.y;
    return {
      x: dx * cos + dy * sin,
      y: -dx * sin + dy * cos,
    };
  }

  function rectCorners(area) {
    const hw = area.w / 2;
    const hh = area.h / 2;
    return [
      { name: "nw", ...localToWorld(area, -hw, -hh) },
      { name: "ne", ...localToWorld(area, hw, -hh) },
      { name: "se", ...localToWorld(area, hw, hh) },
      { name: "sw", ...localToWorld(area, -hw, hh) },
    ];
  }

  function rectRotateHandle(area) {
    return localToWorld(area, 0, -(area.h / 2) - 0.9);
  }

  function loadAreas() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeArea).filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveAreas() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.areas));
  }

  function loadTrees() {
    try {
      const raw = localStorage.getItem(TREES_KEY);
      if (!raw) return DEFAULT_TREES.map((t) => normalizeTree(t));
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) {
        return DEFAULT_TREES.map((t) => normalizeTree(t));
      }
      return parsed.map((t, i) => normalizeTree(t, i + 1));
    } catch {
      return DEFAULT_TREES.map((t) => normalizeTree(t));
    }
  }

  function saveTrees() {
    localStorage.setItem(TREES_KEY, JSON.stringify(state.trees));
  }

  function nextTreeId() {
    return state.trees.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  }

  function loadUnit() {
    const u = localStorage.getItem(UNIT_KEY);
    return u === "ft" ? "ft" : "m";
  }

  function saveUnit() {
    localStorage.setItem(UNIT_KEY, state.unit);
  }

  function uid() {
    return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function isFeet() {
    return state.unit === "ft";
  }

  function unitSuffix() {
    return isFeet() ? "ft" : "m";
  }

  function unitSuffix2() {
    return isFeet() ? "ft²" : "m²";
  }

  /** metros → unidad de pantalla */
  function toDisplay(meters) {
    return isFeet() ? meters * M_TO_FT : meters;
  }

  /** unidad de pantalla → metros */
  function fromDisplay(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return isFeet() ? n * FT_TO_M : n;
  }

  /** paso de cuadrícula en metros (1 m o 1 ft) */
  function gridStepM() {
    return isFeet() ? FT_TO_M : 1;
  }

  function fmtLen(meters, digits = 2) {
    return toDisplay(meters).toFixed(digits);
  }

  function fmtArea(m2, digits = 2) {
    const v = isFeet() ? m2 * M_TO_FT * M_TO_FT : m2;
    return v.toFixed(digits);
  }

  function minSizeDisplay() {
    return toDisplay(MIN_SIZE_M);
  }

  /** Ancho del solar en Y (interpolación lineal frente→fondo). */
  function widthAtY(y) {
    const t = clamp(y / PLOT.depth, 0, 1);
    return PLOT.front + (PLOT.back - PLOT.front) * t;
  }

  function rightEdgeX(y) {
    return widthAtY(y);
  }

  function pointInPlot(x, y) {
    if (y < 0 || y > PLOT.depth || x < 0) return false;
    return x <= rightEdgeX(y);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function scale() {
    return state.baseScale * state.userZoom;
  }

  /** panY = coordenada Y del mundo en el borde superior de la pantalla (Y crece hacia el fondo / arriba). */
  function worldToScreen(x, y) {
    const s = scale();
    return {
      x: (x - state.panX) * s,
      y: (state.panY - y) * s,
    };
  }

  function screenToWorld(sx, sy) {
    const s = scale();
    return {
      x: sx / s + state.panX,
      y: state.panY - sy / s,
    };
  }

  function fitView() {
    const worldW = PLOT.front + PAD_M * 2;
    const worldH = PLOT.depth + PAD_M * 2;
    state.baseScale = Math.min(state.cssW / worldW, state.cssH / worldH);
    state.userZoom = 1;
    const viewW = state.cssW / scale();
    const viewH = state.cssH / scale();
    state.panX = (PLOT.front - viewW) / 2;
    // Centro el solar: arriba = fondo, abajo = frente
    state.panY = PLOT.depth / 2 + viewH / 2;
    updateZoomLabel();
    draw();
  }

  /** Rectángulo en pantalla a partir de (x,y) mundo = esquina frente-izquierda y tamaño en metros. */
  function areaScreenRect(x, y, w, h) {
    const a = worldToScreen(x, y);
    const b = worldToScreen(x + w, y + h);
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    };
  }

  function setZoom(next) {
    const cx = state.cssW / 2;
    const cy = state.cssH / 2;
    const before = screenToWorld(cx, cy);
    state.userZoom = clamp(next, 0.35, 4.5);
    const after = screenToWorld(cx, cy);
    state.panX += before.x - after.x;
    state.panY += before.y - after.y;
    updateZoomLabel();
    draw();
  }

  function updateZoomLabel() {
    els.zoomLabel.textContent = `${Math.round(state.userZoom * 100)}%`;
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    state.cssW = rect.width;
    state.cssH = rect.height;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * state.dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * state.dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    if (!state.baseScale || state.baseScale === 1) fitView();
    else draw();
  }

  function plotPath() {
    const a = worldToScreen(0, 0);
    const b = worldToScreen(PLOT.front, 0);
    const c = worldToScreen(PLOT.back, PLOT.depth);
    const d = worldToScreen(0, PLOT.depth);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
  }

  function drawGrid() {
    if (!state.showGrid) return;
    const s = scale();
    const step = gridStepM();
    const viewH = state.cssH / s;
    const x0 = state.panX - step;
    const x1 = state.panX + state.cssW / s + step;
    const y0 = state.panY - viewH - step;
    const y1 = state.panY + step;
    const i0 = Math.floor(x0 / step);
    const i1 = Math.ceil(x1 / step);
    const j0 = Math.floor(y0 / step);
    const j1 = Math.ceil(y1 / step);

    ctx.save();
    plotPath();
    ctx.clip();

    for (let i = i0; i <= i1; i++) {
      const x = i * step;
      const p0 = worldToScreen(x, y0);
      const p1 = worldToScreen(x, y1);
      const major = i % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = major ? "rgba(36,54,44,0.28)" : "rgba(36,54,44,0.12)";
      ctx.lineWidth = major ? 1.25 : 1;
      ctx.stroke();
    }
    for (let j = j0; j <= j1; j++) {
      const y = j * step;
      const p0 = worldToScreen(x0, y);
      const p1 = worldToScreen(x1, y);
      const major = j % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = major ? "rgba(36,54,44,0.28)" : "rgba(36,54,44,0.12)";
      ctx.lineWidth = major ? 1.25 : 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAxisLabels() {
    if (!state.showGrid) return;
    const s = scale();
    const step = gridStepM();
    ctx.save();
    ctx.font = `500 ${Math.max(10, Math.min(12, s * 0.42))}px "IBM Plex Mono", monospace`;
    ctx.fillStyle = "rgba(36,54,44,0.55)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const maxI = Math.ceil(PLOT.front / step);
    for (let i = 0; i <= maxI; i += 5) {
      const x = i * step;
      const p = worldToScreen(x, -0.55);
      ctx.fillText(`${i}`, p.x, p.y);
    }
    ctx.textAlign = "right";
    const maxJ = Math.ceil(PLOT.depth / step);
    for (let j = 0; j <= maxJ; j += 5) {
      const y = j * step;
      const p = worldToScreen(-0.45, y);
      ctx.fillText(`${j}`, p.x, p.y);
    }
    ctx.restore();
  }

  function drawPlot() {
    plotPath();
    ctx.fillStyle = "#cfdcc9";
    ctx.fill();

    drawGrid();

    plotPath();
    ctx.strokeStyle = "#24362c";
    ctx.lineWidth = 2.25;
    ctx.setLineDash([10, 5, 2, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (state.showDims) drawDimensions();
  }

  function drawDimensions() {
    ctx.save();
    ctx.font = `600 ${Math.max(11, Math.min(14, scale() * 0.48))}px "DM Sans", sans-serif`;
    ctx.fillStyle = "#1a2a22";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const u = unitSuffix();
    const frontMid = worldToScreen(PLOT.front / 2, -1.05);
    ctx.fillText(`${fmtLen(PLOT.front)} ${u}  (frente)`, frontMid.x, frontMid.y);

    const backMid = worldToScreen(PLOT.back / 2, PLOT.depth + 1.05);
    ctx.fillText(`${fmtLen(PLOT.back)} ${u}  (fondo)`, backMid.x, backMid.y);

    ctx.save();
    const leftMid = worldToScreen(-1.15, PLOT.depth / 2);
    ctx.translate(leftMid.x, leftMid.y);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${fmtLen(PLOT.depth)} ${u}`, 0, 0);
    ctx.restore();

    const rightY = PLOT.depth / 2;
    const rightX = (PLOT.front + PLOT.back) / 2 + 1.35;
    const rightMid = worldToScreen(rightX, rightY);
    const angle = Math.atan2(PLOT.depth, PLOT.back - PLOT.front);
    ctx.save();
    ctx.translate(rightMid.x, rightMid.y);
    ctx.rotate(angle - Math.PI / 2);
    ctx.fillText(`~${fmtLen(PLOT.right)} ${u}`, 0, 0);
    ctx.restore();

    const center = worldToScreen(PLOT.back / 2 + 1.5, PLOT.depth / 2);
    ctx.globalAlpha = 0.55;
    ctx.font = `600 ${Math.max(13, Math.min(18, scale() * 0.55))}px "DM Sans", sans-serif`;
    ctx.fillText(`${fmtArea(PLOT.area)} ${unitSuffix2()}`, center.x, center.y);
    ctx.restore();
  }

  function drawAreas() {
    for (const area of state.areas) {
      const s = scale();
      const selected = area.id === state.selectedId;
      const hover = area.id === state.hoverId;
      ctx.save();
      ctx.fillStyle = hexToRgba(area.color, selected || hover ? 0.42 : 0.32);
      ctx.strokeStyle = selected ? "#1a2a22" : area.color;
      ctx.lineWidth = selected ? 2.5 : 1.75;

      if (isCircle(area)) {
        const c = worldToScreen(area.x, area.y);
        const rr = area.r * s;
        ctx.beginPath();
        ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (selected) drawCircleHandles(area);

        const label = area.label || "Área";
        const fontSize = Math.max(11, Math.min(16, rr * 0.35));
        ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
        ctx.fillStyle = "#122018";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        wrapText(ctx, label, c.x, c.y - fontSize * 0.15, rr * 1.6, fontSize * 1.2);

        const meta = `⌀ ${fmtLen(area.r * 2, 1)} ${unitSuffix()}`;
        ctx.font = `500 ${Math.max(9, fontSize * 0.72)}px "IBM Plex Mono", monospace`;
        ctx.fillStyle = "rgba(18,32,24,0.7)";
        ctx.fillText(meta, c.x, c.y + Math.min(rr * 0.55, fontSize * 1.4));
      } else {
        const corners = rectCorners(area).map((c) => worldToScreen(c.x, c.y));
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const center = worldToScreen(area.x, area.y);
        const label = area.label || "Área";
        const fontSize = Math.max(11, Math.min(16, Math.min(area.w, area.h) * s * 0.22));
        ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
        ctx.fillStyle = "#122018";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        wrapText(ctx, label, center.x, center.y - fontSize * 0.1, Math.min(area.w, area.h) * s * 0.85, fontSize * 1.2);

        const rotLabel = area.rot ? ` · ${normalizeDeg(area.rot)}°` : "";
        const meta = `${fmtLen(area.w, 1)}×${fmtLen(area.h, 1)} ${unitSuffix()}${rotLabel}`;
        ctx.font = `500 ${Math.max(9, fontSize * 0.72)}px "IBM Plex Mono", monospace`;
        ctx.fillStyle = "rgba(18,32,24,0.7)";
        ctx.fillText(meta, center.x, center.y + fontSize * 1.05);

        if (selected) drawRectHandles(area);
      }
      ctx.restore();
    }
  }

  function drawRectHandles(area) {
    const corners = rectCorners(area);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#1a2a22";
    ctx.lineWidth = 1.5;
    for (const c of corners) {
      const p = worldToScreen(c.x, c.y);
      ctx.beginPath();
      ctx.rect(p.x - 4, p.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    }

    const rh = rectRotateHandle(area);
    const tip = worldToScreen(rh.x, rh.y);
    const topWorld = localToWorld(area, 0, -area.h / 2);
    const top = worldToScreen(topWorld.x, topWorld.y);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.strokeStyle = "rgba(26,42,34,0.55)";
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#1f5c3f";
    ctx.lineWidth = 1.75;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 3.2, -0.8, 2.2);
    ctx.stroke();
  }

  function drawCircleHandles(area) {
    const pts = [
      worldToScreen(area.x + area.r, area.y),
      worldToScreen(area.x - area.r, area.y),
      worldToScreen(area.x, area.y + area.r),
      worldToScreen(area.x, area.y - area.r),
    ];
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#1a2a22";
    ctx.lineWidth = 1.5;
    for (const p of pts) {
      ctx.beginPath();
      ctx.rect(p.x - 4, p.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    }
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function wrapText(c, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (c.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((ln, i) => c.fillText(ln, x, startY + i * lineHeight));
  }

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawTrees() {
    if (!state.showTrees) return;
    const s = scale();
    const named = [];

    for (const tree of state.trees) {
      const p = worldToScreen(tree.x, tree.y);
      const r = TREE_R_M * s;
      const selected = tree.id === state.selectedTreeId;

      ctx.beginPath();
      ctx.arc(p.x, p.y, r * (selected ? 1.85 : 1.55), 0, Math.PI * 2);
      ctx.fillStyle = selected ? "rgba(29,107,58,0.22)" : "rgba(29,107,58,0.12)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = "#1d6b3a";
      ctx.fill();
      ctx.strokeStyle = selected ? "#122018" : "#0f3d22";
      ctx.lineWidth = selected ? 2.25 : 1.25;
      ctx.stroke();

      ctx.fillStyle = "#f4faf6";
      ctx.font = `600 ${Math.max(9, Math.min(12, r))}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(tree.id), p.x, p.y + 0.5);

      if (tree.locked) {
        drawTreeLockBadge(p.x + r * 0.85, p.y - r * 0.85, Math.max(8, r * 0.7));
      }

      if (tree.name) named.push({ tree, p, r, selected });
    }

    // Etiquetas flotantes encima, al final, para que no las tapen otros árboles
    for (const { tree, p, r, selected } of named) {
      drawTreeNameTag(tree.name, p.x, p.y, r, selected);
    }
  }

  function drawTreeLockBadge(x, y, size) {
    const s = size;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(247, 250, 246, 0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(36, 54, 44, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // candado simple
    ctx.strokeStyle = "#1f5c3f";
    ctx.fillStyle = "#1f5c3f";
    ctx.lineWidth = Math.max(1.2, s * 0.12);
    ctx.beginPath();
    ctx.arc(0, -s * 0.18, s * 0.22, Math.PI, 0, false);
    ctx.stroke();
    ctx.fillRect(-s * 0.28, -s * 0.12, s * 0.56, s * 0.42);
    ctx.restore();
  }

  function drawTreeNameTag(name, cx, cy, treeR, selected) {
    const text = String(name).trim();
    if (!text) return;

    const fontSize = 11;
    ctx.save();
    ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let label = text;
    const maxW = 92;
    if (ctx.measureText(label).width > maxW) {
      while (label.length > 1 && ctx.measureText(`${label}…`).width > maxW) {
        label = label.slice(0, -1);
      }
      label = `${label}…`;
    }

    const padX = 6;
    const padY = 3;
    const tw = ctx.measureText(label).width;
    const bw = tw + padX * 2;
    const bh = fontSize + padY * 2;
    const tip = 4;
    const gap = 3;
    const bx = cx - bw / 2;
    const by = cy - treeR - gap - tip - bh;

    ctx.shadowColor = "rgba(26, 42, 34, 0.18)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1;

    ctx.beginPath();
    const rr = 7;
    ctx.moveTo(bx + rr, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr);
    ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr);
    ctx.lineTo(cx + tip, by + bh);
    ctx.lineTo(cx, by + bh + tip);
    ctx.lineTo(cx - tip, by + bh);
    ctx.arcTo(bx, by + bh, bx, by, rr);
    ctx.arcTo(bx, by, bx + bw, by, rr);
    ctx.closePath();

    ctx.fillStyle = selected ? "#1f5c3f" : "rgba(255, 255, 255, 0.94)";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = selected ? "#1f5c3f" : "rgba(36, 54, 44, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = selected ? "#f4faf6" : "#1a2a22";
    ctx.fillText(label, cx, by + bh / 2 + 0.5);
    ctx.restore();
  }

  function hitTree(wx, wy) {
    const tol = TREE_R_M * 1.6;
    let best = null;
    let bestD = tol;
    for (let i = state.trees.length - 1; i >= 0; i--) {
      const t = state.trees[i];
      const d = Math.hypot(wx - t.x, wy - t.y);
      if (d <= bestD) {
        best = t;
        bestD = d;
      }
    }
    return best;
  }

  function getSelectedTree() {
    return state.trees.find((t) => t.id === state.selectedTreeId) || null;
  }

  function selectTree(id) {
    state.selectedTreeId = id;
    if (id != null) state.selectedId = null;
    syncSelectionUI();
    syncTreeSelectionUI();
    renderTreeList();
    draw();
  }

  function syncTreeSelectionUI() {
    const t = getSelectedTree();
    if (!t) {
      els.treeSelection.classList.add("hidden");
      return;
    }
    els.treeSelection.classList.remove("hidden");
    els.selTreeLocked.checked = Boolean(t.locked);
    els.selTreeName.value = t.name;
    els.selTreeX.value = fmtLen(t.x);
    els.selTreeY.value = fmtLen(t.y);
    els.selTreeX.disabled = Boolean(t.locked);
    els.selTreeY.disabled = Boolean(t.locked);
  }

  function applyTreeSelectionFields() {
    const t = getSelectedTree();
    if (!t) return;
    t.name = els.selTreeName.value.trim();
    t.locked = els.selTreeLocked.checked;
    if (!t.locked) {
      t.x = fromDisplay(els.selTreeX.value);
      t.y = fromDisplay(els.selTreeY.value);
    }
    els.selTreeX.disabled = t.locked;
    els.selTreeY.disabled = t.locked;
    saveTrees();
    renderTreeList();
    draw();
  }

  function setTreesLocked(locked) {
    for (const t of state.trees) t.locked = locked;
    saveTrees();
    syncTreeSelectionUI();
    renderTreeList();
    draw();
    els.status.textContent = locked
      ? "Todos los árboles bloqueados"
      : "Todos los árboles desbloqueados";
  }

  function toggleTreeLocked(id) {
    const t = state.trees.find((x) => x.id === id);
    if (!t) return;
    t.locked = !t.locked;
    saveTrees();
    if (state.selectedTreeId === id) syncTreeSelectionUI();
    renderTreeList();
    draw();
    els.status.textContent = t.locked
      ? `Árbol #${id} bloqueado`
      : `Árbol #${id} desbloqueado`;
  }

  function addTreeAt(x, y, name = "", { promptName = false } = {}) {
    const tree = {
      id: nextTreeId(),
      name: (name || "").trim(),
      x: +Number(x).toFixed(2),
      y: +Number(y).toFixed(2),
      locked: false,
    };
    state.trees.push(tree);
    saveTrees();
    selectTree(tree.id);
    els.status.textContent = tree.name
      ? `Árbol #${tree.id}: ${tree.name}`
      : `Árbol #${tree.id} agregado`;
    if (promptName) openTreeNameDialog(tree);
    return tree;
  }

  function addTreeFromForm() {
    const x = fromDisplay(els.treeX.value);
    const y = fromDisplay(els.treeY.value);
    const name = els.treeName.value.trim();
    addTreeAt(x, y, name);
    els.treeName.value = "";
  }

  function deleteSelectedTree() {
    if (state.selectedTreeId == null) return;
    const id = state.selectedTreeId;
    state.trees = state.trees.filter((t) => t.id !== id);
    state.selectedTreeId = null;
    saveTrees();
    syncTreeSelectionUI();
    renderTreeList();
    draw();
    els.status.textContent = `Árbol #${id} eliminado`;
  }

  function openTreeNameDialog(tree) {
    state.editingTreeId = tree.id;
    els.dialogTreeName.value = tree.name;
    els.treeDialog.showModal();
    els.dialogTreeName.focus();
    els.dialogTreeName.select();
  }

  function drawDraft() {
    const d = state.drag;
    if (!d) return;
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = els.areaColor.value;
    ctx.fillStyle = hexToRgba(els.areaColor.value, 0.2);
    ctx.lineWidth = 1.75;
    ctx.font = `500 12px "IBM Plex Mono", monospace`;
    ctx.fillStyle = "#1a2a22";

    if (d.kind === "create") {
      const x = Math.min(d.x0, d.x1);
      const y = Math.min(d.y0, d.y1);
      const w = Math.abs(d.x1 - d.x0);
      const h = Math.abs(d.y1 - d.y0);
      if (w < 0.05 || h < 0.05) {
        ctx.restore();
        return;
      }
      const r = areaScreenRect(x, y, w, h);
      ctx.beginPath();
      roundRect(ctx, r.x, r.y, r.w, r.h, 4);
      ctx.fillStyle = hexToRgba(els.areaColor.value, 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#1a2a22";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${fmtLen(w, 1)} × ${fmtLen(h, 1)} ${unitSuffix()}`, r.x + 4, r.y - 4);
    } else if (d.kind === "create-circle") {
      const rad = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
      if (rad < 0.05) {
        ctx.restore();
        return;
      }
      const c = worldToScreen(d.x0, d.y0);
      const rr = rad * scale();
      ctx.beginPath();
      ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(els.areaColor.value, 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#1a2a22";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(`⌀ ${fmtLen(rad * 2, 1)} ${unitSuffix()}`, c.x + 4, c.y - rr - 4);
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, state.cssW, state.cssH);

    // fondo suave
    const g = ctx.createLinearGradient(0, 0, state.cssW, state.cssH);
    g.addColorStop(0, "#eef3ec");
    g.addColorStop(1, "#e2ebe0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.cssW, state.cssH);

    drawPlot();
    drawAxisLabels();
    drawAreas();
    drawTrees();
    drawDraft();
  }

  function hitArea(wx, wy) {
    for (let i = state.areas.length - 1; i >= 0; i--) {
      const a = state.areas[i];
      if (isCircle(a)) {
        if (Math.hypot(wx - a.x, wy - a.y) <= a.r) return a;
      } else {
        const local = worldToLocal(a, wx, wy);
        if (Math.abs(local.x) <= a.w / 2 && Math.abs(local.y) <= a.h / 2) return a;
      }
    }
    return null;
  }

  function hitHandle(area, wx, wy) {
    const tol = 0.4 / state.userZoom;
    if (isCircle(area)) {
      const pts = [
        { name: "e", x: area.x + area.r, y: area.y },
        { name: "w", x: area.x - area.r, y: area.y },
        { name: "n", x: area.x, y: area.y + area.r },
        { name: "s", x: area.x, y: area.y - area.r },
      ];
      for (const c of pts) {
        if (Math.abs(wx - c.x) <= tol && Math.abs(wy - c.y) <= tol) return c.name;
      }
      return null;
    }
    const rh = rectRotateHandle(area);
    if (Math.hypot(wx - rh.x, wy - rh.y) <= tol * 1.4) return "rotate";
    for (const c of rectCorners(area)) {
      if (Math.abs(wx - c.x) <= tol && Math.abs(wy - c.y) <= tol) return c.name;
    }
    return null;
  }

  function selectArea(id) {
    state.selectedId = id;
    if (id != null) state.selectedTreeId = null;
    syncSelectionUI();
    syncTreeSelectionUI();
    renderTreeList();
    draw();
  }

  function getSelected() {
    return state.areas.find((a) => a.id === state.selectedId) || null;
  }

  function syncSelectionUI() {
    const a = getSelected();
    if (!a) {
      els.selectionEmpty.classList.remove("hidden");
      els.selectionEditor.classList.add("hidden");
      return;
    }
    els.selectionEmpty.classList.add("hidden");
    els.selectionEditor.classList.remove("hidden");
    els.selLabel.value = a.label;
    els.selX.value = fmtLen(a.x);
    els.selY.value = fmtLen(a.y);
    els.selColor.value = a.color;
    const u = unitSuffix();
    if (isCircle(a)) {
      els.lblSelX.textContent = `Centro X (${u})`;
      els.lblSelY.textContent = `Centro Y (${u})`;
      els.lblSelW.textContent = `Radio (${u})`;
      els.selW.value = fmtLen(a.r);
      els.fieldSelH.classList.add("hidden");
      els.fieldSelRot.classList.add("hidden");
    } else {
      els.lblSelX.textContent = `Centro X (${u})`;
      els.lblSelY.textContent = `Centro Y (${u})`;
      els.lblSelW.textContent = `Ancho (${u})`;
      els.lblSelH.textContent = `Alto (${u})`;
      els.selW.value = fmtLen(a.w);
      els.selH.value = fmtLen(a.h);
      els.selRot.value = String(normalizeDeg(a.rot || 0));
      els.fieldSelH.classList.remove("hidden");
      els.fieldSelRot.classList.remove("hidden");
    }
  }

  function applySelectionFields() {
    const a = getSelected();
    if (!a) return;
    a.label = els.selLabel.value.trim() || "Área";
    a.x = fromDisplay(els.selX.value);
    a.y = fromDisplay(els.selY.value);
    a.color = els.selColor.value;
    if (isCircle(a)) {
      a.r = Math.max(MIN_RADIUS_M, fromDisplay(els.selW.value) || MIN_RADIUS_M);
    } else {
      a.w = Math.max(MIN_SIZE_M, fromDisplay(els.selW.value) || MIN_SIZE_M);
      a.h = Math.max(MIN_SIZE_M, fromDisplay(els.selH.value) || MIN_SIZE_M);
      a.rot = normalizeDeg(Number(els.selRot.value) || 0);
      a.centered = true;
    }
    saveAreas();
    draw();
  }

  function nudgeRotation(delta) {
    const a = getSelected();
    if (!a || isCircle(a)) return;
    a.rot = normalizeDeg((a.rot || 0) + delta);
    a.centered = true;
    saveAreas();
    syncSelectionUI();
    draw();
    els.status.textContent = `Rotación: ${a.rot}°`;
  }

  function alignSelectedToRightEdge() {
    const a = getSelected();
    if (!a || isCircle(a)) return;
    a.rot = normalizeDeg(rightEdgeAngleDeg());
    a.centered = true;
    saveAreas();
    syncSelectionUI();
    draw();
    els.status.textContent = `Alineado al lado derecho (${a.rot}°)`;
  }

  function setPlaceShape(shape) {
    state.placeShape = shape === "circle" ? "circle" : "rect";
    els.shapeButtons.forEach((b) =>
      b.classList.toggle("active", b.dataset.placeShape === state.placeShape)
    );
    refreshPlaceShapeUI();
  }

  function refreshPlaceShapeUI() {
    const u = unitSuffix();
    const circle = state.placeShape === "circle";
    els.lblAreaW.textContent = circle ? `Diámetro (${u})` : `Ancho (${u})`;
    els.lblAreaH.textContent = `Alto (${u})`;
    els.fieldAreaH.classList.toggle("hidden", circle);
  }

  function setUnit(unit, { convertInputs = true } = {}) {
    if (unit !== "m" && unit !== "ft") return;
    if (unit === state.unit) {
      refreshUnitUI();
      return;
    }

    if (convertInputs) {
      const factor = unit === "ft" ? M_TO_FT : FT_TO_M;
      for (const input of [els.areaW, els.areaH, els.treeX, els.treeY]) {
        const n = Number(input.value);
        if (Number.isFinite(n)) input.value = (n * factor).toFixed(2);
      }
    }

    state.unit = unit;
    saveUnit();
    refreshUnitUI();
    syncSelectionUI();
    syncTreeSelectionUI();
    renderTreeList();
    draw();
    els.status.textContent = unit === "ft" ? "Unidades: pies (ft)" : "Unidades: metros (m)";
  }

  function refreshUnitUI() {
    const u = unitSuffix();
    els.unitButtons.forEach((b) => b.classList.toggle("active", b.dataset.unit === state.unit));
    els.brandKicker.textContent = `Lote 241 · ${fmtArea(PLOT.area)} ${unitSuffix2()}`;
    els.brandMeta.textContent = `Frente ${fmtLen(PLOT.front)} ${u} · Fondo ${fmtLen(PLOT.back)} ${u} · Prof. ${fmtLen(PLOT.depth)} ${u}`;
    els.lblGrid.textContent = `Cuadrícula 1 ${u}`;
    els.lblTreeX.textContent = `X (${u})`;
    els.lblTreeY.textContent = `Y (${u})`;
    els.lblSelTreeX.textContent = `X (${u})`;
    els.lblSelTreeY.textContent = `Y (${u})`;
    refreshPlaceShapeUI();
    syncSelectionUI();

    const minDisp = +minSizeDisplay().toFixed(2);
    for (const input of [els.areaW, els.areaH, els.selW, els.selH]) {
      input.min = String(minDisp);
      input.step = isFeet() ? "0.5" : "0.1";
    }
    for (const input of [els.treeX, els.treeY, els.selTreeX, els.selTreeY]) {
      input.step = isFeet() ? "0.5" : "0.1";
    }
  }

  function setTool(tool) {
    state.tool = tool;
    els.toolButtons.forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
    stage.classList.toggle("tool-rect", tool === "rect");
    stage.classList.toggle("tool-circle", tool === "circle");
    stage.classList.toggle("tool-tree", tool === "tree");
    if (tool === "rect") setPlaceShape("rect");
    if (tool === "circle") setPlaceShape("circle");
    els.status.textContent =
      tool === "rect"
        ? "Arrastra para dibujar un rectángulo"
        : tool === "circle"
          ? "Arrastra desde el centro para dibujar un círculo"
          : tool === "tree"
            ? "Haz clic en el plano para plantar un árbol"
            : "Listo";
  }

  function placeCentered() {
    const label = els.areaLabel.value.trim() || "Área";
    const color = els.areaColor.value;
    let area;
    if (state.placeShape === "circle") {
      const diameter = Math.max(MIN_SIZE_M, fromDisplay(els.areaW.value) || 1);
      const r = diameter / 2;
      area = {
        id: uid(),
        shape: "circle",
        label,
        x: clamp((PLOT.back + PLOT.front) / 4, r, PLOT.front - r),
        y: clamp(PLOT.depth / 2, r, PLOT.depth - r),
        r,
        color,
      };
    } else {
      const w = Math.max(MIN_SIZE_M, fromDisplay(els.areaW.value) || 1);
      const h = Math.max(MIN_SIZE_M, fromDisplay(els.areaH.value) || 1);
      area = {
        id: uid(),
        shape: "rect",
        label,
        x: clamp((PLOT.back + PLOT.front) / 4, w / 2, PLOT.front - w / 2),
        y: clamp(PLOT.depth / 2, h / 2, PLOT.depth - h / 2),
        w,
        h,
        rot: 0,
        centered: true,
        color,
      };
    }
    state.areas.push(area);
    saveAreas();
    selectArea(area.id);
    els.status.textContent = `Colocada: ${area.label}`;
  }

  function deleteSelected() {
    if (state.selectedTreeId != null) {
      deleteSelectedTree();
      return;
    }
    if (!state.selectedId) return;
    state.areas = state.areas.filter((a) => a.id !== state.selectedId);
    state.selectedId = null;
    saveAreas();
    syncSelectionUI();
    draw();
    els.status.textContent = "Área eliminada";
  }

  function openLabelDialog(area) {
    state.editingId = area.id;
    els.dialogLabel.value = area.label;
    els.labelDialog.showModal();
    els.dialogLabel.focus();
    els.dialogLabel.select();
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (e.button === 1 || (e.button === 0 && (state.spaceDown || e.altKey))) {
      const { sx, sy } = pointerPos(e);
      state.drag = { kind: "pan", sx, sy, panX: state.panX, panY: state.panY };
      stage.classList.add("panning");
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    stage.focus({ preventScroll: true });
    const { sx, sy } = pointerPos(e);
    const w = screenToWorld(sx, sy);

    if (state.tool === "tree") {
      const name = els.treeName.value.trim();
      addTreeAt(w.x, w.y, name, { promptName: !name });
      if (name) els.treeName.value = "";
      return;
    }

    if (state.tool === "rect") {
      state.drag = { kind: "create", x0: w.x, y0: w.y, x1: w.x, y1: w.y };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (state.tool === "circle") {
      state.drag = { kind: "create-circle", x0: w.x, y0: w.y, x1: w.x, y1: w.y };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const treeHit = state.showTrees ? hitTree(w.x, w.y) : null;
    if (treeHit) {
      selectTree(treeHit.id);
      if (treeHit.locked) {
        els.status.textContent = `Árbol #${treeHit.id} bloqueado — desbloquéalo para mover`;
        return;
      }
      state.drag = {
        kind: "move-tree",
        id: treeHit.id,
        ox: w.x - treeHit.x,
        oy: w.y - treeHit.y,
      };
      canvas.setPointerCapture(e.pointerId);
      stage.classList.add("dragging");
      return;
    }

    const selected = getSelected();
    if (selected) {
      const handle = hitHandle(selected, w.x, w.y);
      if (handle) {
        if (handle === "rotate") {
          state.drag = { kind: "rotate", id: selected.id };
        } else {
          state.drag = {
            kind: "resize",
            id: selected.id,
            handle,
            start: { ...selected },
          };
        }
        canvas.setPointerCapture(e.pointerId);
        stage.classList.add("dragging");
        return;
      }
    }

    const hit = hitArea(w.x, w.y);
    if (hit) {
      selectArea(hit.id);
      state.drag = {
        kind: "move",
        id: hit.id,
        ox: w.x - hit.x,
        oy: w.y - hit.y,
      };
      canvas.setPointerCapture(e.pointerId);
      stage.classList.add("dragging");
    } else {
      selectArea(null);
      selectTree(null);
    }
  }

  function onPointerMove(e) {
    const { sx, sy } = pointerPos(e);
    const w = screenToWorld(sx, sy);
    const u = unitSuffix();
    els.cursorReadout.textContent = `x ${fmtLen(w.x)} ${u} · y ${fmtLen(w.y)} ${u}${
      pointInPlot(w.x, w.y) ? "" : "  (fuera)"
    }`;

    if (!state.drag) {
      const hit = hitArea(w.x, w.y);
      const nextHover = hit ? hit.id : null;
      if (nextHover !== state.hoverId) {
        state.hoverId = nextHover;
        draw();
      }
      return;
    }

    const d = state.drag;
    if (d.kind === "pan") {
      const s = scale();
      state.panX = d.panX - (sx - d.sx) / s;
      state.panY = d.panY + (sy - d.sy) / s;
      draw();
      return;
    }
    if (d.kind === "create" || d.kind === "create-circle") {
      d.x1 = w.x;
      d.y1 = w.y;
      draw();
      return;
    }
    if (d.kind === "move") {
      const a = state.areas.find((x) => x.id === d.id);
      if (!a) return;
      a.x = +(w.x - d.ox).toFixed(2);
      a.y = +(w.y - d.oy).toFixed(2);
      syncSelectionUI();
      draw();
      return;
    }
    if (d.kind === "move-tree") {
      const t = state.trees.find((x) => x.id === d.id);
      if (!t || t.locked) return;
      t.x = +(w.x - d.ox).toFixed(2);
      t.y = +(w.y - d.oy).toFixed(2);
      syncTreeSelectionUI();
      renderTreeList();
      draw();
      return;
    }
    if (d.kind === "rotate") {
      const a = state.areas.find((x) => x.id === d.id);
      if (!a || isCircle(a)) return;
      let ang = (Math.atan2(w.y - a.y, w.x - a.x) * 180) / Math.PI + 90;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      a.rot = normalizeDeg(ang);
      a.centered = true;
      syncSelectionUI();
      draw();
      return;
    }
    if (d.kind === "resize") {
      const a = state.areas.find((x) => x.id === d.id);
      if (!a) return;
      const s0 = d.start;
      if (isCircle(a)) {
        a.r = +Math.max(MIN_RADIUS_M, Math.hypot(w.x - s0.x, w.y - s0.y)).toFixed(2);
        syncSelectionUI();
        draw();
        return;
      }
      resizeRectCorner(a, d.handle, w.x, w.y, s0);
      syncSelectionUI();
      draw();
    }
  }

  function resizeRectCorner(area, handle, wx, wy, start) {
    const signs = {
      nw: [-1, -1],
      ne: [1, -1],
      sw: [-1, 1],
      se: [1, 1],
    };
    const [sx, sy] = signs[handle] || [1, 1];
    const rot = degToRad(start.rot || 0);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const oppLocalX = -sx * (start.w / 2);
    const oppLocalY = -sy * (start.h / 2);
    const oppWorld = {
      x: start.x + oppLocalX * cos - oppLocalY * sin,
      y: start.y + oppLocalX * sin + oppLocalY * cos,
    };
    const dx = wx - oppWorld.x;
    const dy = wy - oppWorld.y;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    const newW = Math.max(MIN_SIZE_M, Math.abs(lx));
    const newH = Math.max(MIN_SIZE_M, Math.abs(ly));
    area.w = +newW.toFixed(2);
    area.h = +newH.toFixed(2);
    area.rot = start.rot || 0;
    area.centered = true;
    area.x = +(oppWorld.x + (sx * newW) / 2 * cos + (sy * newH) / 2 * -sin).toFixed(2);
    area.y = +(oppWorld.y + (sx * newW) / 2 * sin + (sy * newH) / 2 * cos).toFixed(2);
  }

  function onPointerUp(e) {
    const d = state.drag;
    stage.classList.remove("dragging", "panning");
    if (!d) return;

    if (d.kind === "create") {
      const x = Math.min(d.x0, d.x1);
      const y = Math.min(d.y0, d.y1);
      const w = Math.abs(d.x1 - d.x0);
      const h = Math.abs(d.y1 - d.y0);
      state.drag = null;
      if (w >= MIN_SIZE_M && h >= MIN_SIZE_M) {
        const area = {
          id: uid(),
          shape: "rect",
          label: els.areaLabel.value.trim() || "Área",
          x: +(x + w / 2).toFixed(2),
          y: +(y + h / 2).toFixed(2),
          w: +w.toFixed(2),
          h: +h.toFixed(2),
          rot: 0,
          centered: true,
          color: els.areaColor.value,
        };
        state.areas.push(area);
        saveAreas();
        selectArea(area.id);
        openLabelDialog(area);
        els.status.textContent = `Creada: ${fmtLen(area.w, 1)}×${fmtLen(area.h, 1)} ${unitSuffix()}`;
      } else {
        draw();
        els.status.textContent = `Área demasiado pequeña (mín. ${minSizeDisplay().toFixed(1)} ${unitSuffix()})`;
      }
      return;
    }

    if (d.kind === "create-circle") {
      const r = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
      state.drag = null;
      if (r >= MIN_RADIUS_M) {
        const area = {
          id: uid(),
          shape: "circle",
          label: els.areaLabel.value.trim() || "Área",
          x: +d.x0.toFixed(2),
          y: +d.y0.toFixed(2),
          r: +r.toFixed(2),
          color: els.areaColor.value,
        };
        state.areas.push(area);
        saveAreas();
        selectArea(area.id);
        openLabelDialog(area);
        els.status.textContent = `Círculo: ⌀ ${fmtLen(area.r * 2, 1)} ${unitSuffix()}`;
      } else {
        draw();
        els.status.textContent = `Círculo demasiado pequeño (mín. radio ${toDisplay(MIN_RADIUS_M).toFixed(1)} ${unitSuffix()})`;
      }
      return;
    }

    if (d.kind === "move" || d.kind === "resize" || d.kind === "rotate") {
      saveAreas();
      els.status.textContent =
        d.kind === "rotate" ? `Rotación: ${getSelected()?.rot ?? 0}°` : "Área actualizada";
    }
    if (d.kind === "move-tree") {
      saveTrees();
      els.status.textContent = "Árbol movido";
    }
    state.drag = null;
  }

  function onDblClick(e) {
    const { sx, sy } = pointerPos(e);
    const w = screenToWorld(sx, sy);
    const treeHit = state.showTrees ? hitTree(w.x, w.y) : null;
    if (treeHit) {
      selectTree(treeHit.id);
      openTreeNameDialog(treeHit);
      return;
    }
    const hit = hitArea(w.x, w.y);
    if (hit) {
      selectArea(hit.id);
      openLabelDialog(hit);
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const { sx, sy } = pointerPos(e);
    const before = screenToWorld(sx, sy);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    state.userZoom = clamp(state.userZoom * factor, 0.35, 4.5);
    const after = screenToWorld(sx, sy);
    state.panX += before.x - after.x;
    state.panY += before.y - after.y;
    updateZoomLabel();
    draw();
  }

  function exportJSON() {
    const payload = {
      plot: PLOT,
      trees: state.trees,
      areas: state.areas,
      unit: state.unit,
      unitsNote: "Todas las medidas en areas/trees/plot están en metros.",
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "solar-241-diseno.json";
    a.click();
    URL.revokeObjectURL(url);
    els.status.textContent = "JSON exportado";
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.areas) && !Array.isArray(data.trees)) {
          throw new Error("Falta areas[] o trees[]");
        }
        if (Array.isArray(data.areas)) {
          state.areas = data.areas.map(normalizeArea).filter(Boolean);
          saveAreas();
        }
        if (Array.isArray(data.trees)) {
          state.trees = data.trees.map((t, i) => normalizeTree(t, i + 1));
          saveTrees();
        }
        state.selectedId = null;
        state.selectedTreeId = null;
        if (data.unit === "m" || data.unit === "ft") setUnit(data.unit, { convertInputs: false });
        syncSelectionUI();
        syncTreeSelectionUI();
        renderTreeList();
        draw();
        els.status.textContent = `Importado: ${state.areas.length} áreas, ${state.trees.length} árboles`;
      } catch (err) {
        els.status.textContent = `Error al importar: ${err.message}`;
      }
    };
    reader.readAsText(file);
  }

  function renderTreeList() {
    const u = unitSuffix();
    els.treeCount.textContent = String(state.trees.length);
    els.treeList.innerHTML = state.trees
      .map((t) => {
        const named = t.name
          ? `<span class="tname">${escapeHtml(t.name)}</span>`
          : `<span class="tname unnamed">Sin nombre</span>`;
        const selected = t.id === state.selectedTreeId ? " selected" : "";
        const lockedClass = t.locked ? " locked" : "";
        const lockTitle = t.locked ? "Desbloquear posición" : "Bloquear posición";
        return `<li class="${selected}${lockedClass}" data-tree-id="${t.id}">
          <span class="num">${t.id}</span>
          <span class="meta">${named}<span class="coords">${fmtLen(t.x)} × ${fmtLen(t.y)} ${u}${
            t.locked ? " · fijo" : ""
          }</span></span>
          <button type="button" class="icon-btn lock-btn${t.locked ? " is-locked" : ""}" data-lock-tree="${t.id}" title="${lockTitle}">${
            t.locked ? "▣" : "□"
          }</button>
          <button type="button" class="icon-btn" data-del-tree="${t.id}" title="Eliminar">✕</button>
        </li>`;
      })
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Eventos UI
  els.toolButtons.forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
  els.shapeButtons.forEach((b) =>
    b.addEventListener("click", () => setPlaceShape(b.dataset.placeShape))
  );
  els.unitButtons.forEach((b) => b.addEventListener("click", () => setUnit(b.dataset.unit)));
  els.btnPlace.addEventListener("click", placeCentered);
  els.btnAddTree.addEventListener("click", addTreeFromForm);
  els.btnTreeTool.addEventListener("click", () => setTool("tree"));
  els.btnDeleteTree.addEventListener("click", deleteSelectedTree);
  els.btnLockAll.addEventListener("click", () => setTreesLocked(true));
  els.btnUnlockAll.addEventListener("click", () => setTreesLocked(false));
  els.treeList.addEventListener("click", (e) => {
    const lockBtn = e.target.closest("[data-lock-tree]");
    if (lockBtn) {
      e.stopPropagation();
      toggleTreeLocked(Number(lockBtn.dataset.lockTree));
      return;
    }
    const del = e.target.closest("[data-del-tree]");
    if (del) {
      e.stopPropagation();
      const id = Number(del.dataset.delTree);
      selectTree(id);
      deleteSelectedTree();
      return;
    }
    const row = e.target.closest("[data-tree-id]");
    if (row) selectTree(Number(row.dataset.treeId));
  });
  els.treeList.addEventListener("dblclick", (e) => {
    const row = e.target.closest("[data-tree-id]");
    if (!row) return;
    const tree = state.trees.find((t) => t.id === Number(row.dataset.treeId));
    if (tree) {
      selectTree(tree.id);
      openTreeNameDialog(tree);
    }
  });
  els.toggleGrid.addEventListener("change", () => {
    state.showGrid = els.toggleGrid.checked;
    draw();
  });
  els.toggleTrees.addEventListener("change", () => {
    state.showTrees = els.toggleTrees.checked;
    draw();
  });
  els.toggleDims.addEventListener("change", () => {
    state.showDims = els.toggleDims.checked;
    draw();
  });
  els.btnZoomIn.addEventListener("click", () => setZoom(state.userZoom * 1.15));
  els.btnZoomOut.addEventListener("click", () => setZoom(state.userZoom / 1.15));
  els.btnFit.addEventListener("click", fitView);
  els.btnDelete.addEventListener("click", deleteSelected);
  els.btnExport.addEventListener("click", exportJSON);
  els.btnImport.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files?.[0];
    if (file) importJSON(file);
    els.importFile.value = "";
  });
  els.btnClear.addEventListener("click", () => {
    if (!state.areas.length) return;
    if (confirm("¿Borrar todas las áreas del plano?")) {
      state.areas = [];
      state.selectedId = null;
      saveAreas();
      syncSelectionUI();
      draw();
    }
  });

  els.btnRotCcw.addEventListener("click", () => nudgeRotation(-15));
  els.btnRotCw.addEventListener("click", () => nudgeRotation(15));
  els.btnAlignRight.addEventListener("click", alignSelectedToRightEdge);

  ["input", "change"].forEach((ev) => {
    for (const el of [els.selLabel, els.selX, els.selY, els.selW, els.selH, els.selRot, els.selColor]) {
      el.addEventListener(ev, applySelectionFields);
    }
    for (const el of [els.selTreeName, els.selTreeX, els.selTreeY, els.selTreeLocked]) {
      el.addEventListener(ev, applyTreeSelectionFields);
    }
  });

  els.labelForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const a = state.areas.find((x) => x.id === state.editingId);
    if (a) {
      a.label = els.dialogLabel.value.trim() || "Área";
      saveAreas();
      syncSelectionUI();
      draw();
    }
    els.labelDialog.close();
    state.editingId = null;
  });
  els.dialogCancel.addEventListener("click", () => {
    els.labelDialog.close();
    state.editingId = null;
  });

  els.treeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = state.trees.find((x) => x.id === state.editingTreeId);
    if (t) {
      t.name = els.dialogTreeName.value.trim();
      saveTrees();
      syncTreeSelectionUI();
      renderTreeList();
      draw();
    }
    els.treeDialog.close();
    state.editingTreeId = null;
  });
  els.treeDialogCancel.addEventListener("click", () => {
    els.treeDialog.close();
    state.editingTreeId = null;
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("dblclick", onDblClick);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      state.spaceDown = true;
      if (!e.target.matches("input, textarea")) e.preventDefault();
    }
    if (e.target.matches("input, textarea")) return;
    if (e.key === "v" || e.key === "V") setTool("select");
    if (e.key === "r" || e.key === "R") setTool("rect");
    if (e.key === "c" || e.key === "C") setTool("circle");
    if (e.key === "t" || e.key === "T") setTool("tree");
    if (e.key === "[") nudgeRotation(e.shiftKey ? -5 : -15);
    if (e.key === "]") nudgeRotation(e.shiftKey ? 5 : 15);
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelected();
    }
    if (e.key === "Escape") {
      selectArea(null);
      selectTree(null);
      setTool("select");
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") state.spaceDown = false;
  });

  window.addEventListener("resize", () => {
    const z = state.userZoom;
    const pan = { x: state.panX, y: state.panY };
    resize();
    // preservar zoom/pan relativo tras resize
    state.userZoom = z;
    state.panX = pan.x;
    state.panY = pan.y;
    updateZoomLabel();
    draw();
  });

  // Los valores por defecto del HTML están en metros; convertir si se restauran pies.
  if (state.unit === "ft") {
    for (const input of [els.areaW, els.areaH, els.treeX, els.treeY]) {
      const n = Number(input.value);
      if (Number.isFinite(n)) input.value = (n * M_TO_FT).toFixed(2);
    }
  }
  setPlaceShape(state.placeShape);
  refreshUnitUI();
  renderTreeList();
  setTool("select");
  syncSelectionUI();
  syncTreeSelectionUI();
  resize();
  fitView();
})();
