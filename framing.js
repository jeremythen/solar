(() => {
  "use strict";

  const STORAGE_KEY = "solar241-structures-v2";
  const LEGACY_KEY = "solar241-structures-v1";
  const M_TO_IN = 39.37007874;

  const PROFILES = {
    "2x4": { id: "2x4", label: "2×4", kind: "lumber", t: 1.5, d: 3.5, color: "#c4a35a" },
    "2x6": { id: "2x6", label: "2×6", kind: "lumber", t: 1.5, d: 5.5, color: "#b8924a" },
    "2x8": { id: "2x8", label: "2×8", kind: "lumber", t: 1.5, d: 7.25, color: "#a67c3a" },
    "2x10": { id: "2x10", label: "2×10", kind: "lumber", t: 1.5, d: 9.25, color: "#8f6a2e" },
    "2x12": { id: "2x12", label: "2×12", kind: "lumber", t: 1.5, d: 11.25, color: "#7d5e28" },
    "4x4": { id: "4x4", label: "4×4", kind: "lumber", t: 3.5, d: 3.5, color: "#8b5a2b" },
    "4x6": { id: "4x6", label: "4×6", kind: "lumber", t: 3.5, d: 5.5, color: "#7a4e24" },
    "sheet-4x8": { id: "sheet-4x8", label: "Plancha 4×8", kind: "sheet", w: 48, h: 96, color: "rgba(180,140,80,0.35)" },
  };

  const state = {
    structures: loadAll(),
    activeId: null,
    tool: "select",
    view: "plan", // plan | elev | 3d
    elevWall: "front",
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
    rot3d: 0.55,
    elev3d: 0.45,
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
    wallH: document.getElementById("framing-wall-h"),
    pitch: document.getElementById("framing-pitch"),
    overhang: document.getElementById("framing-overhang"),
    doorSize: document.getElementById("framing-door"),
    windowSize: document.getElementById("framing-window"),
    elevWall: document.getElementById("framing-elev-wall"),
    elevWallField: document.getElementById("elev-wall-field"),
    btnFit: document.getElementById("btn-framing-fit"),
    btnBlank: document.getElementById("btn-framing-blank"),
    btnDel: document.getElementById("btn-framing-del"),
    btnClear: document.getElementById("btn-framing-clear"),
    btnShell: document.getElementById("btn-gen-shell"),
    btnJoists: document.getElementById("btn-gen-joists"),
    btnRoof: document.getElementById("btn-gen-roof"),
    btnSheathing: document.getElementById("btn-gen-sheathing"),
    selEmpty: document.getElementById("framing-sel-empty"),
    selEditor: document.getElementById("framing-sel-editor"),
    selInfo: document.getElementById("framing-sel-info"),
    bom: document.getElementById("framing-bom"),
    cursor: document.getElementById("framing-cursor"),
    status: document.getElementById("framing-status"),
    stage: document.getElementById("framing-stage"),
    canvas: document.getElementById("framing-canvas"),
    tools: [...document.querySelectorAll("[data-ftool]")],
    views: [...document.querySelectorAll("[data-fview]")],
  };

  const ctx = els.canvas.getContext("2d");

  function loadAll() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem(LEGACY_KEY);
        if (raw) {
          const legacy = JSON.parse(raw);
          const migrated = {};
          for (const [id, st] of Object.entries(legacy || {})) {
            migrated[id] = migrateStructure(st);
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
        return {};
      }
      const parsed = JSON.parse(raw);
      const out = {};
      for (const [id, st] of Object.entries(parsed || {})) out[id] = migrateStructure(st);
      return out;
    } catch {
      return {};
    }
  }

  function migrateStructure(st) {
    const wallHeightIn = st.wallHeightIn || 90;
    const members = (st.members || []).map((m) => normalizeMember(m, wallHeightIn));
    return {
      id: st.id,
      name: st.name || "Estructura",
      widthIn: st.widthIn || 120,
      depthIn: st.depthIn || 144,
      wallHeightIn,
      roofPitch: st.roofPitch ?? 6,
      overhangIn: st.overhangIn ?? 12,
      members,
      updatedAt: st.updatedAt || new Date().toISOString(),
    };
  }

  function normalizeMember(m, wallHeightIn) {
    if (!m) return m;
    if (m.kind === "opening") return { ...m };
    if (m.kind === "sheet") {
      return {
        id: m.id,
        kind: "sheet",
        profile: m.profile || "sheet-4x8",
        role: m.role || "sheathing",
        ax: m.ax ?? m.x ?? 0,
        ay: m.ay ?? m.y ?? 0,
        az: m.az ?? 0,
        rot: m.rot || 0,
        face: m.face || "front",
      };
    }
    if (m.ax != null) return { ...m, kind: "lumber" };
    // legacy 2D
    if (m.role === "stud") {
      const x = ((m.x1 || 0) + (m.x2 || 0)) / 2;
      const y = ((m.y1 || 0) + (m.y2 || 0)) / 2;
      return {
        id: m.id,
        kind: "lumber",
        profile: m.profile || "2x4",
        role: "stud",
        ax: x,
        ay: y,
        az: 0,
        bx: x,
        by: y,
        bz: wallHeightIn,
      };
    }
    return {
      id: m.id,
      kind: "lumber",
      profile: m.profile || "2x4",
      role: m.role || "member",
      ax: m.x1 || 0,
      ay: m.y1 || 0,
      az: m.role === "top-plate" ? wallHeightIn : 0,
      bx: m.x2 || 0,
      by: m.y2 || 0,
      bz: m.role === "top-plate" ? wallHeightIn : 0,
    };
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
        widthIn: opts.widthIn || 120,
        depthIn: opts.depthIn || 144,
        wallHeightIn: opts.wallHeightIn || 90,
        roofPitch: 6,
        overhangIn: 12,
        members: [],
        updatedAt: new Date().toISOString(),
      };
    } else {
      if (opts.name) state.structures[id].name = opts.name;
      if (opts.widthIn) state.structures[id].widthIn = opts.widthIn;
      if (opts.depthIn) state.structures[id].depthIn = opts.depthIn;
    }
    saveAll();
    return state.structures[id];
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function snapIn(v) {
    return state.snap ? Math.round(v) : v;
  }
  function scale() {
    return state.baseScale * state.userZoom;
  }

  function fmtLenIn(inches) {
    const ft = Math.floor(inches / 12 + 1e-9);
    const inn = +Math.abs(inches - ft * 12).toFixed(1);
    if (ft <= 0) return `${inn}″`;
    if (inn < 0.05) return `${ft}′`;
    return `${ft}′-${inn}″`;
  }

  function parseSize(str, fallbackW, fallbackH) {
    const m = String(str || "").match(/(\d+(?:\.\d)?)\s*[x×]\s*(\d+(?:\.\d)?)/i);
    if (!m) return { w: fallbackW, h: fallbackH };
    return { w: Number(m[1]), h: Number(m[2]) };
  }

  function memberLen(m) {
    if (m.kind !== "lumber") return 0;
    return Math.hypot(m.bx - m.ax, m.by - m.ay, m.bz - m.az);
  }

  function lumber(profile, role, ax, ay, az, bx, by, bz) {
    return { id: uid(), kind: "lumber", profile, role, ax, ay, az, bx, by, bz };
  }

  function wallDefs(st) {
    const W = st.widthIn;
    const D = st.depthIn;
    return {
      front: { id: "front", label: "Frente", x1: 0, y1: 0, x2: W, y2: 0, inward: [0, 1] },
      back: { id: "back", label: "Fondo", x1: 0, y1: D, x2: W, y2: D, inward: [0, -1] },
      left: { id: "left", label: "Izquierda", x1: 0, y1: 0, x2: 0, y2: D, inward: [1, 0] },
      right: { id: "right", label: "Derecha", x1: W, y1: 0, x2: W, y2: D, inward: [-1, 0] },
    };
  }

  // ——— Generators ———
  function buildWall(st, wallKey, profile = "2x4", oc = 16, { clearRole = true } = {}) {
    const wdef = wallDefs(st)[wallKey];
    if (!wdef) return;
    if (clearRole) {
      st.members = st.members.filter(
        (m) => !(m.wall === wallKey && ["stud", "bottom-plate", "top-plate", "king", "jack", "header", "cripple", "sill"].includes(m.role))
      );
    }
    const H = st.wallHeightIn;
    const len = Math.hypot(wdef.x2 - wdef.x1, wdef.y2 - wdef.y1);
    const ux = (wdef.x2 - wdef.x1) / len;
    const uy = (wdef.y2 - wdef.y1) / len;
    st.members.push({
      ...lumber(profile, "bottom-plate", wdef.x1, wdef.y1, 0, wdef.x2, wdef.y2, 0),
      wall: wallKey,
    });
    st.members.push({
      ...lumber(profile, "top-plate", wdef.x1, wdef.y1, H, wdef.x2, wdef.y2, H),
      wall: wallKey,
    });
    // second top plate
    st.members.push({
      ...lumber(profile, "top-plate", wdef.x1, wdef.y1, H + 1.5, wdef.x2, wdef.y2, H + 1.5),
      wall: wallKey,
    });

    const openings = st.members.filter((m) => m.kind === "opening" && m.wall === wallKey);
    const blocked = [];
    for (const op of openings) {
      blocked.push([op.offset, op.offset + op.width]);
      frameOpening(st, wallKey, op, profile);
    }

    const n = Math.max(1, Math.round(len / oc));
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * len;
      if (blocked.some(([a, b]) => t > a + 0.5 && t < b - 0.5)) continue;
      const x = wdef.x1 + ux * t;
      const y = wdef.y1 + uy * t;
      st.members.push({
        ...lumber(profile, "stud", x, y, 1.5, x, y, H),
        wall: wallKey,
      });
    }
  }

  function frameOpening(st, wallKey, op, profile) {
    const wdef = wallDefs(st)[wallKey];
    const len = Math.hypot(wdef.x2 - wdef.x1, wdef.y2 - wdef.y1);
    const ux = (wdef.x2 - wdef.x1) / len;
    const uy = (wdef.y2 - wdef.y1) / len;
    const H = st.wallHeightIn;
    const L = op.offset;
    const R = op.offset + op.width;
    const sill = op.type === "window" ? op.sill || 36 : 0;
    const head = sill + op.height;

    const at = (t, z0, z1, role) => {
      const x = wdef.x1 + ux * t;
      const y = wdef.y1 + uy * t;
      st.members.push({ ...lumber(profile, role, x, y, z0, x, y, z1), wall: wallKey });
    };

    // king studs full height
    at(L - 1.5, 1.5, H, "king");
    at(R + 1.5, 1.5, H, "king");
    // jack studs under header
    at(L, 1.5, head, "jack");
    at(R, 1.5, head, "jack");
    // header (use 2x6 doubled conceptually as one 2x8/2x10)
    const headerProfile = op.width > 48 ? "2x10" : op.width > 36 ? "2x8" : "2x6";
    const hx1 = wdef.x1 + ux * L;
    const hy1 = wdef.y1 + uy * L;
    const hx2 = wdef.x1 + ux * R;
    const hy2 = wdef.y1 + uy * R;
    st.members.push({
      ...lumber(headerProfile, "header", hx1, hy1, head, hx2, hy2, head),
      wall: wallKey,
    });
    if (op.type === "window") {
      st.members.push({
        ...lumber(profile, "sill", hx1, hy1, sill, hx2, hy2, sill),
        wall: wallKey,
      });
      // cripples below sill
      const span = R - L;
      const n = Math.max(1, Math.round(span / 16));
      for (let i = 0; i <= n; i++) {
        const t = L + (i / n) * span;
        at(t, 1.5, sill, "cripple");
      }
      // cripples above header
      for (let i = 0; i <= n; i++) {
        const t = L + (i / n) * span;
        at(t, head + (PROFILES[headerProfile]?.d || 5.5), H, "cripple");
      }
    } else {
      // door: cripples above header only
      const span = R - L;
      const n = Math.max(1, Math.round(span / 16));
      for (let i = 0; i <= n; i++) {
        const t = L + (i / n) * span;
        at(t, head + (PROFILES[headerProfile]?.d || 5.5), H, "cripple");
      }
    }
  }

  function buildShell() {
    const st = active();
    if (!st) return;
    const profile = lumberProfile();
    // clear wall framing but keep openings/joists/rafters/sheets
    st.members = st.members.filter(
      (m) =>
        m.kind === "opening" ||
        ["joist", "rim", "rafter", "ridge", "collar", "sheathing", "roof-sheet"].includes(m.role) ||
        m.kind === "sheet"
    );
    for (const key of ["front", "back", "left", "right"]) {
      buildWall(st, key, profile, state.oc, { clearRole: false });
    }
    // default door on front center if none
    if (!st.members.some((m) => m.kind === "opening")) {
      const door = parseSize(els.doorSize.value, 36, 80);
      const offset = st.widthIn / 2 - door.w / 2;
      st.members.push({
        id: uid("op"),
        kind: "opening",
        type: "door",
        wall: "front",
        offset,
        width: door.w,
        height: door.h,
        sill: 0,
      });
      buildWall(st, "front", profile, state.oc, { clearRole: true });
    }
    touch(st);
    els.status.textContent = "Caja de 4 muros generada";
    refresh();
  }

  function buildJoists() {
    const st = active();
    if (!st) return;
    st.members = st.members.filter((m) => m.role !== "joist" && m.role !== "rim");
    const profile = "2x8";
    const oc = state.oc;
    const W = st.widthIn;
    const D = st.depthIn;
    // rim joists
    st.members.push(lumber(profile, "rim", 0, 0, 0, W, 0, 0));
    st.members.push(lumber(profile, "rim", 0, D, 0, W, D, 0));
    st.members.push(lumber(profile, "rim", 0, 0, 0, 0, D, 0));
    st.members.push(lumber(profile, "rim", W, 0, 0, W, D, 0));
    // joists spanning depth (front to back)
    const n = Math.max(1, Math.round(W / oc));
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * W;
      st.members.push(lumber(profile, "joist", x, 0, 0, x, D, 0));
    }
    touch(st);
    els.status.textContent = `Joists ${PROFILES[profile].label} @ ${oc}″`;
    refresh();
  }

  function buildRoof() {
    const st = active();
    if (!st) return;
    st.members = st.members.filter(
      (m) => !["rafter", "ridge", "collar", "roof-sheet"].includes(m.role)
    );
    const pitch = Number(els.pitch.value) || st.roofPitch || 6;
    st.roofPitch = pitch;
    const overhang = Number(els.overhang.value) || st.overhangIn || 12;
    st.overhangIn = overhang;
    const W = st.widthIn;
    const D = st.depthIn;
    const H = st.wallHeightIn + 3; // above double top plate
    const half = W / 2;
    const rise = (half + overhang) * (pitch / 12);
    const ridgeZ = H + rise;
    const profile = "2x6";
    const oc = state.oc;

    // ridge beam along depth at center
    st.members.push(lumber("2x8", "ridge", half, -overhang, ridgeZ, half, D + overhang, ridgeZ));

    const n = Math.max(1, Math.round((D + 2 * overhang) / oc));
    for (let i = 0; i <= n; i++) {
      const y = -overhang + (i / n) * (D + 2 * overhang);
      // left rafter
      st.members.push(
        lumber(profile, "rafter", -overhang, y, H, half, y, ridgeZ)
      );
      // right rafter
      st.members.push(
        lumber(profile, "rafter", W + overhang, y, H, half, y, ridgeZ)
      );
      // collar tie every other
      if (i % 2 === 0 && y >= 0 && y <= D) {
        const cz = H + rise * 0.45;
        const inset = half * 0.35;
        st.members.push(lumber("2x4", "collar", inset, y, cz, W - inset, y, cz));
      }
    }
    touch(st);
    els.status.textContent = `Techo ${pitch}/12 · rafters ${PROFILES[profile].label}`;
    refresh();
  }

  function buildSheathing() {
    const st = active();
    if (!st) return;
    st.members = st.members.filter((m) => m.role !== "sheathing" && !(m.kind === "sheet" && m.role === "sheathing"));
    const H = st.wallHeightIn + 3;
    const faces = [
      { face: "front", x: 0, y: 0, along: st.widthIn },
      { face: "back", x: 0, y: st.depthIn, along: st.widthIn },
      { face: "left", x: 0, y: 0, along: st.depthIn },
      { face: "right", x: st.widthIn, y: 0, along: st.depthIn },
    ];
    for (const f of faces) {
      let pos = 0;
      while (pos < f.along - 1) {
        const piece = Math.min(48, f.along - pos);
        st.members.push({
          id: uid(),
          kind: "sheet",
          profile: "sheet-4x8",
          role: "sheathing",
          face: f.face,
          ax: f.face === "left" || f.face === "right" ? f.x : f.x + pos,
          ay: f.face === "front" || f.face === "back" ? f.y : f.y + pos,
          az: 0,
          along: piece,
          tall: Math.min(96, H),
          rot: 0,
        });
        pos += 48;
      }
    }
    touch(st);
    els.status.textContent = "Planchas de muro colocadas (aprox.)";
    refresh();
  }

  function lumberProfile() {
    const p = PROFILES[state.profile];
    return p && p.kind === "lumber" ? state.profile : "2x4";
  }

  function touch(st) {
    st.updatedAt = new Date().toISOString();
    saveAll();
  }

  function addOpening(wallKey, type, clickT) {
    const st = active();
    if (!st) return;
    const size =
      type === "door"
        ? parseSize(els.doorSize.value, 36, 80)
        : parseSize(els.windowSize.value, 36, 36);
    const wdef = wallDefs(st)[wallKey];
    const wallLen = Math.hypot(wdef.x2 - wdef.x1, wdef.y2 - wdef.y1);
    let offset = clamp((clickT ?? wallLen / 2) - size.w / 2, 3, wallLen - size.w - 3);
    const end = offset + size.w;
    st.members = st.members.filter((m) => {
      if (m.kind !== "opening" || m.wall !== wallKey) return true;
      const a = m.offset;
      const b = m.offset + m.width;
      return b < offset - 1 || a > end + 1; // quita solapes
    });
    st.members.push({
      id: uid("op"),
      kind: "opening",
      type,
      wall: wallKey,
      offset,
      width: size.w,
      height: size.h,
      sill: type === "window" ? 36 : 0,
    });
    buildWall(st, wallKey, lumberProfile(), state.oc, { clearRole: true });
    touch(st);
    els.status.textContent = `${type === "door" ? "Puerta" : "Ventana"} ${size.w}×${size.h}″ en ${wallKey}`;
    refresh();
  }

  function nearestWall(wx, wy) {
    const st = active();
    if (!st) return null;
    let best = null;
    let bestD = 18;
    for (const [key, w] of Object.entries(wallDefs(st))) {
      const d = distToSegment(wx, wy, w.x1, w.y1, w.x2, w.y2);
      if (d < bestD) {
        bestD = d;
        const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
        const t = clamp(((wx - w.x1) * (w.x2 - w.x1) + (wy - w.y1) * (w.y2 - w.y1)) / (len * len), 0, 1) * len;
        best = { key, t, dist: d };
      }
    }
    return best;
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // ——— Projection ———
  function project(x, y, z) {
    if (state.view === "plan") {
      return worldToScreenPlan(x, y);
    }
    if (state.view === "elev") {
      return worldToScreenElev(x, y, z);
    }
    return worldToScreen3d(x, y, z);
  }

  function worldToScreenPlan(x, y) {
    const s = scale();
    return { x: (x - state.panX) * s, y: (state.panY - y) * s };
  }

  function screenToWorldPlan(sx, sy) {
    const s = scale();
    return { x: sx / s + state.panX, y: state.panY - sy / s };
  }

  function worldToScreenElev(x, y, z) {
    const st = active();
    const s = scale();
    const wall = state.elevWall;
    let along = 0;
    if (wall === "front" || wall === "back") along = x;
    else along = y;
    // elev: X = along wall, Y screen = up = z
    return { x: (along - state.panX) * s, y: (state.panY - z) * s };
  }

  function screenToWorldElev(sx, sy) {
    const s = scale();
    const along = sx / s + state.panX;
    const z = state.panY - sy / s;
    const st = active();
    if (state.elevWall === "front") return { x: along, y: 0, z };
    if (state.elevWall === "back") return { x: along, y: st.depthIn, z };
    if (state.elevWall === "left") return { x: 0, y: along, z };
    return { x: st.widthIn, y: along, z };
  }

  function worldToScreen3d(x, y, z) {
    const st = active();
    const cx = st.widthIn / 2;
    const cy = st.depthIn / 2;
    const dx = x - cx;
    const dy = y - cy;
    const cos = Math.cos(state.rot3d);
    const sin = Math.sin(state.rot3d);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const isoX = rx - ry;
    const isoY = (rx + ry) * 0.5 * Math.cos(state.elev3d) - z * Math.sin(state.elev3d + 0.2);
    const s = scale() * 0.55;
    return {
      x: state.cssW / 2 + (isoX - state.panX) * s,
      y: state.cssH / 2 + (isoY - state.panY) * s * 0.15 + isoY * s * 0.02,
    };
  }

  // Fix 3d y formula to be cleaner
  function project3d(x, y, z) {
    const st = active();
    const cx = st.widthIn / 2;
    const cy = st.depthIn / 2;
    let dx = x - cx;
    let dy = y - cy;
    const cos = Math.cos(state.rot3d);
    const sin = Math.sin(state.rot3d);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    const ang = 0.5;
    const ix = (rx - ry) * Math.cos(ang);
    const iy = (rx + ry) * Math.sin(ang) * 0.5 - z;
    const s = scale() * 0.5;
    return {
      x: state.cssW / 2 + ix * s - state.panX * 0.3,
      y: state.cssH * 0.62 + iy * s - state.panY * 0.3,
    };
  }

  function fitView() {
    const st = active();
    if (!st) return;
    if (state.view === "3d") {
      state.baseScale = Math.min(state.cssW, state.cssH) / Math.max(st.widthIn, st.depthIn, st.wallHeightIn) * 1.1;
      state.userZoom = 1;
      state.panX = 0;
      state.panY = 0;
      draw();
      return;
    }
    if (state.view === "elev") {
      const along = state.elevWall === "left" || state.elevWall === "right" ? st.depthIn : st.widthIn;
      const H = st.wallHeightIn + 48;
      const pad = 24;
      state.baseScale = Math.min(state.cssW / (along + pad * 2), state.cssH / (H + pad * 2));
      state.userZoom = 1;
      const viewW = state.cssW / scale();
      const viewH = state.cssH / scale();
      state.panX = (along - viewW) / 2;
      state.panY = H / 2 + viewH / 2 - 12;
      draw();
      return;
    }
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

  // ——— Draw ———
  function draw() {
    ctx.clearRect(0, 0, state.cssW, state.cssH);
    const g = ctx.createLinearGradient(0, 0, state.cssW, state.cssH);
    g.addColorStop(0, state.view === "3d" ? "#dfe8f0" : "#f3efe6");
    g.addColorStop(1, state.view === "3d" ? "#c5d3e0" : "#e7e0d2");
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

    if (state.view === "plan") drawPlan(st);
    else if (state.view === "elev") drawElev(st);
    else draw3d(st);
    drawDraft();
  }

  function drawPlan(st) {
    const a = worldToScreenPlan(0, 0);
    const c = worldToScreenPlan(st.widthIn, st.depthIn);
    ctx.beginPath();
    ctx.rect(Math.min(a.x, c.x), Math.min(a.y, c.y), Math.abs(c.x - a.x), Math.abs(c.y - a.y));
    ctx.fillStyle = "#efe6d4";
    ctx.fill();
    ctx.strokeStyle = "#3d2e1a";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (state.showGrid) {
      ctx.save();
      ctx.clip();
      for (let x = 0; x <= st.widthIn; x += 12) {
        const p0 = worldToScreenPlan(x, 0);
        const p1 = worldToScreenPlan(x, st.depthIn);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = x % 48 === 0 ? "rgba(61,46,26,0.25)" : "rgba(61,46,26,0.08)";
        ctx.stroke();
      }
      for (let y = 0; y <= st.depthIn; y += 12) {
        const p0 = worldToScreenPlan(0, y);
        const p1 = worldToScreenPlan(st.widthIn, y);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = y % 48 === 0 ? "rgba(61,46,26,0.25)" : "rgba(61,46,26,0.08)";
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const m of st.members) {
      if (m.kind === "opening") {
        drawOpeningPlan(st, m);
        continue;
      }
      if (m.role === "rafter" || m.role === "ridge" || m.role === "collar") continue;
      drawMemberPlan(m, m.id === state.selectedMemberId);
    }
  }

  function drawOpeningPlan(st, op) {
    const w = wallDefs(st)[op.wall];
    if (!w) return;
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    const ux = (w.x2 - w.x1) / len;
    const uy = (w.y2 - w.y1) / len;
    const p0 = worldToScreenPlan(w.x1 + ux * op.offset, w.y1 + uy * op.offset);
    const p1 = worldToScreenPlan(w.x1 + ux * (op.offset + op.width), w.y1 + uy * (op.offset + op.width));
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = op.type === "door" ? "#2a5a8a" : "#1f7a5c";
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  function drawMemberPlan(m, selected) {
    if (m.kind === "sheet") {
      // show as edge mark on wall
      return;
    }
    const p0 = worldToScreenPlan(m.ax, m.ay);
    const p1 = worldToScreenPlan(m.bx, m.by);
    const vertical = Math.hypot(m.bx - m.ax, m.by - m.ay) < 0.2;
    ctx.beginPath();
    if (vertical) {
      ctx.arc(p0.x, p0.y, selected ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#1a2a22" : PROFILES[m.profile]?.color || "#c4a35a";
      ctx.fill();
    } else {
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = selected ? "#1a2a22" : PROFILES[m.profile]?.color || "#c4a35a";
      ctx.lineWidth = selected ? 4 : m.role === "joist" || m.role === "rim" ? 2.5 : 3.2;
      ctx.stroke();
    }
  }

  function drawElev(st) {
    const wall = state.elevWall;
    const along = wall === "left" || wall === "right" ? st.depthIn : st.widthIn;
    const H = st.wallHeightIn + 3;
    const p0 = worldToScreenElev(...elevPoint(st, wall, 0, 0));
    const p1 = worldToScreenElev(...elevPoint(st, wall, along, 0));
    const p2 = worldToScreenElev(...elevPoint(st, wall, along, H));
    const p3 = worldToScreenElev(...elevPoint(st, wall, 0, H));
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fillStyle = "#f0e6d0";
    ctx.fill();
    ctx.strokeStyle = "#3d2e1a";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (state.showGrid) {
      for (let x = 0; x <= along; x += 12) {
        const q0 = worldToScreenElev(...elevPoint(st, wall, x, 0));
        const q1 = worldToScreenElev(...elevPoint(st, wall, x, H));
        ctx.beginPath();
        ctx.moveTo(q0.x, q0.y);
        ctx.lineTo(q1.x, q1.y);
        ctx.strokeStyle = "rgba(61,46,26,0.1)";
        ctx.stroke();
      }
      for (let z = 0; z <= H; z += 12) {
        const q0 = worldToScreenElev(...elevPoint(st, wall, 0, z));
        const q1 = worldToScreenElev(...elevPoint(st, wall, along, z));
        ctx.beginPath();
        ctx.moveTo(q0.x, q0.y);
        ctx.lineTo(q1.x, q1.y);
        ctx.strokeStyle = "rgba(61,46,26,0.1)";
        ctx.stroke();
      }
    }

    for (const m of st.members) {
      if (m.kind === "opening" && m.wall === wall) {
        drawOpeningElev(st, m);
        continue;
      }
      if (m.kind !== "lumber") continue;
      if (m.wall && m.wall !== wall) continue;
      if (!m.wall && !memberOnWall(st, m, wall)) continue;
      const a1 = projectElevMember(st, wall, m.ax, m.ay, m.az);
      const b1 = projectElevMember(st, wall, m.bx, m.by, m.bz);
      if (!a1 || !b1) continue;
      const s0 = worldToScreenElev(a1.x, a1.y, a1.z);
      const s1 = worldToScreenElev(b1.x, b1.y, b1.z);
      ctx.beginPath();
      ctx.moveTo(s0.x, s0.y);
      ctx.lineTo(s1.x, s1.y);
      ctx.strokeStyle = m.id === state.selectedMemberId ? "#1a2a22" : PROFILES[m.profile]?.color || "#c4a35a";
      ctx.lineWidth = m.id === state.selectedMemberId ? 4 : 2.5;
      ctx.stroke();
    }

    ctx.fillStyle = "#5c6f64";
    ctx.font = '600 12px "DM Sans", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(`Elevación · ${wallDefs(st)[wall].label}`, 16, 22);
  }

  function elevPoint(st, wall, along, z) {
    if (wall === "front") return [along, 0, z];
    if (wall === "back") return [along, st.depthIn, z];
    if (wall === "left") return [0, along, z];
    return [st.widthIn, along, z];
  }

  function projectElevMember(st, wall, x, y, z) {
    const tol = 4;
    if (wall === "front" && Math.abs(y) <= tol) return { x, y: 0, z };
    if (wall === "back" && Math.abs(y - st.depthIn) <= tol) return { x, y: st.depthIn, z };
    if (wall === "left" && Math.abs(x) <= tol) return { x: 0, y, z };
    if (wall === "right" && Math.abs(x - st.widthIn) <= tol) return { x: st.widthIn, y, z };
    return null;
  }

  function memberOnWall(st, m, wall) {
    return projectElevMember(st, wall, m.ax, m.ay, m.az) && projectElevMember(st, wall, m.bx, m.by, m.bz);
  }

  function drawOpeningElev(st, op) {
    const wall = op.wall;
    const sill = op.sill || 0;
    const p0 = worldToScreenElev(...elevPoint(st, wall, op.offset, sill));
    const p1 = worldToScreenElev(...elevPoint(st, wall, op.offset + op.width, sill));
    const p2 = worldToScreenElev(...elevPoint(st, wall, op.offset + op.width, sill + op.height));
    const p3 = worldToScreenElev(...elevPoint(st, wall, op.offset, sill + op.height));
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fillStyle = op.type === "door" ? "rgba(80,130,180,0.25)" : "rgba(80,180,140,0.25)";
    ctx.fill();
    ctx.strokeStyle = op.type === "door" ? "#2a5a8a" : "#1f7a5c";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function draw3d(st) {
    // ground
    const corners = [
      [0, 0, 0],
      [st.widthIn, 0, 0],
      [st.widthIn, st.depthIn, 0],
      [0, st.depthIn, 0],
    ].map(([x, y, z]) => project3d(x, y, z));
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(180,160,120,0.35)";
    ctx.fill();
    ctx.strokeStyle = "#5a4a32";
    ctx.stroke();

    // sort members by depth for painter's algorithm
    const items = st.members
      .filter((m) => m.kind === "lumber")
      .map((m) => {
        const mid = {
          x: (m.ax + m.bx) / 2,
          y: (m.ay + m.by) / 2,
          z: (m.az + m.bz) / 2,
        };
        const cos = Math.cos(state.rot3d);
        const sin = Math.sin(state.rot3d);
        const depth = (mid.x - st.widthIn / 2) * sin + (mid.y - st.depthIn / 2) * cos;
        return { m, depth };
      })
      .sort((a, b) => a.depth - b.depth);

    for (const { m } of items) {
      const p0 = project3d(m.ax, m.ay, m.az);
      const p1 = project3d(m.bx, m.by, m.bz);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      const selected = m.id === state.selectedMemberId;
      ctx.strokeStyle = selected ? "#122018" : PROFILES[m.profile]?.color || "#c4a35a";
      ctx.lineWidth = selected ? 3.5 : m.role === "rafter" || m.role === "ridge" ? 2.2 : 2.8;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // openings as translucent quads
    for (const op of st.members.filter((m) => m.kind === "opening")) {
      const w = wallDefs(st)[op.wall];
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      const ux = (w.x2 - w.x1) / len;
      const uy = (w.y2 - w.y1) / len;
      const sill = op.sill || 0;
      const pts = [
        [w.x1 + ux * op.offset, w.y1 + uy * op.offset, sill],
        [w.x1 + ux * (op.offset + op.width), w.y1 + uy * (op.offset + op.width), sill],
        [w.x1 + ux * (op.offset + op.width), w.y1 + uy * (op.offset + op.width), sill + op.height],
        [w.x1 + ux * op.offset, w.y1 + uy * op.offset, sill + op.height],
      ].map(([x, y, z]) => project3d(x, y, z));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = op.type === "door" ? "rgba(80,130,180,0.35)" : "rgba(80,180,140,0.35)";
      ctx.fill();
      ctx.strokeStyle = "#234";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = "#3d4a55";
    ctx.font = '600 12px "DM Sans", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText("Vista 3D · arrastra para orbitar (herramienta Sel)", 16, 22);
  }

  function drawDraft() {
    const d = state.drag;
    if (!d || (d.kind !== "lumber" && d.kind !== "wall")) return;
    if (state.view !== "plan") return;
    const p0 = worldToScreenPlan(d.x0, d.y0);
    const p1 = worldToScreenPlan(d.x1, d.y1);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#1f5c3f";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
  }

  // ——— Interaction ———
  function hitMember(wx, wy, wz) {
    const st = active();
    if (!st) return null;
    if (state.view === "plan") {
      let best = null;
      let bestD = 8;
      for (const m of st.members) {
        if (m.kind === "opening") continue;
        if (m.kind === "sheet") continue;
        if (m.role === "rafter" || m.role === "ridge" || m.role === "collar") continue;
        const vertical = Math.hypot(m.bx - m.ax, m.by - m.ay) < 0.2;
        const d = vertical
          ? Math.hypot(wx - m.ax, wy - m.ay)
          : distToSegment(wx, wy, m.ax, m.ay, m.bx, m.by);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      return best;
    }
    if (state.view === "elev") {
      let best = null;
      let bestD = 10;
      for (const m of st.members) {
        if (m.kind !== "lumber" || (m.wall && m.wall !== state.elevWall)) continue;
        if (!m.wall && !memberOnWall(st, m, state.elevWall)) continue;
        const a1 = projectElevMember(st, state.elevWall, m.ax, m.ay, m.az);
        const b1 = projectElevMember(st, state.elevWall, m.bx, m.by, m.bz);
        if (!a1 || !b1) continue;
        const alongA = state.elevWall === "left" || state.elevWall === "right" ? a1.y : a1.x;
        const alongB = state.elevWall === "left" || state.elevWall === "right" ? b1.y : b1.x;
        const d = distToSegment(wx, wz, alongA, a1.z, alongB, b1.z);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      return best;
    }
    return null;
  }

  function pointerPos(e) {
    const rect = els.canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (!active()) return;
    if (e.button === 1 || (e.button === 0 && (state.spaceDown || e.altKey))) {
      const { sx, sy } = pointerPos(e);
      state.drag = { kind: "pan", sx, sy, panX: state.panX, panY: state.panY, rot: state.rot3d };
      els.stage.classList.add("panning");
      els.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const { sx, sy } = pointerPos(e);

    if (state.view === "3d") {
      if (state.tool === "select") {
        state.drag = { kind: "orbit", sx, sy, rot: state.rot3d, elev: state.elev3d };
        els.canvas.setPointerCapture(e.pointerId);
      }
      return;
    }

    if (state.view === "plan") {
      let w = screenToWorldPlan(sx, sy);
      w = { x: snapIn(w.x), y: snapIn(w.y) };
      if (state.tool === "door" || state.tool === "window") {
        const nw = nearestWall(w.x, w.y);
        if (nw) addOpening(nw.key, state.tool, nw.t);
        else els.status.textContent = "Haz clic cerca de una pared";
        return;
      }
      if (state.tool === "lumber" || state.tool === "wall") {
        state.drag = { kind: state.tool, x0: w.x, y0: w.y, x1: w.x, y1: w.y };
        els.canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (state.tool === "sheet") {
        const st = active();
        st.members.push({
          id: uid(),
          kind: "sheet",
          profile: "sheet-4x8",
          role: "sheathing",
          ax: w.x,
          ay: w.y,
          az: 0,
          face: "floor",
          along: 48,
          tall: 96,
          rot: 0,
        });
        touch(st);
        refresh();
        return;
      }
      const hit = hitMember(w.x, w.y);
      state.selectedMemberId = hit?.id || null;
      syncSelection();
      draw();
      return;
    }

    if (state.view === "elev") {
      const w = screenToWorldElev(sx, sy);
      if (state.tool === "door" || state.tool === "window") {
        const along = state.elevWall === "left" || state.elevWall === "right" ? w.y : w.x;
        addOpening(state.elevWall, state.tool, along);
        return;
      }
      const along = state.elevWall === "left" || state.elevWall === "right" ? w.y : w.x;
      const hit = hitMember(along, 0, w.z);
      state.selectedMemberId = hit?.id || null;
      syncSelection();
      draw();
    }
  }

  function onPointerMove(e) {
    const { sx, sy } = pointerPos(e);
    const st = active();
    if (st) {
      if (state.view === "plan") {
        const w = screenToWorldPlan(sx, sy);
        els.cursor.textContent = `${(w.x / 12).toFixed(2)}′ , ${(w.y / 12).toFixed(2)}′ plan`;
      } else if (state.view === "elev") {
        const w = screenToWorldElev(sx, sy);
        els.cursor.textContent = `along ${(state.elevWall === "left" || state.elevWall === "right" ? w.y : w.x).toFixed(0)}″ · z ${w.z.toFixed(0)}″`;
      } else {
        els.cursor.textContent = `orbit ${(state.rot3d * 180) / Math.PI | 0}°`;
      }
    }

    if (!state.drag) return;
    const d = state.drag;
    if (d.kind === "pan") {
      if (state.view === "3d") {
        state.rot3d = d.rot + (sx - d.sx) * 0.01;
        draw();
        return;
      }
      const s = scale();
      state.panX = d.panX - (sx - d.sx) / s;
      state.panY = d.panY + (sy - d.sy) / s;
      draw();
      return;
    }
    if (d.kind === "orbit") {
      state.rot3d = d.rot + (sx - d.sx) * 0.01;
      state.elev3d = clamp(d.elev + (sy - d.sy) * 0.005, 0.15, 1.2);
      draw();
      return;
    }
    if (d.kind === "lumber" || d.kind === "wall") {
      const w = screenToWorldPlan(sx, sy);
      d.x1 = snapIn(w.x);
      d.y1 = snapIn(w.y);
      draw();
    }
  }

  function onPointerUp() {
    const d = state.drag;
    els.stage.classList.remove("dragging", "panning");
    if (!d) return;
    if (d.kind === "lumber") {
      const st = active();
      const len = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
      if (len >= 2) {
        st.members.push(
          lumber(lumberProfile(), "member", d.x0, d.y0, 0, d.x1, d.y1, 0)
        );
        touch(st);
        refresh();
      }
    } else if (d.kind === "wall") {
      // create a custom wall segment as plates+studs along line
      const st = active();
      const len = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
      if (len >= 12) {
        const profile = lumberProfile();
        const H = st.wallHeightIn;
        st.members.push(lumber(profile, "bottom-plate", d.x0, d.y0, 0, d.x1, d.y1, 0));
        st.members.push(lumber(profile, "top-plate", d.x0, d.y0, H, d.x1, d.y1, H));
        const ux = (d.x1 - d.x0) / len;
        const uy = (d.y1 - d.y0) / len;
        const n = Math.max(1, Math.round(len / state.oc));
        for (let i = 0; i <= n; i++) {
          const t = (i / n) * len;
          const x = d.x0 + ux * t;
          const y = d.y0 + uy * t;
          st.members.push(lumber(profile, "stud", x, y, 1.5, x, y, H));
        }
        touch(st);
        els.status.textContent = `Muro ${fmtLenIn(len)}`;
        refresh();
      }
    }
    state.drag = null;
    draw();
  }

  function onWheel(e) {
    if (!active()) return;
    e.preventDefault();
    if (state.view === "3d") {
      state.userZoom = clamp(state.userZoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.3, 5);
      draw();
      return;
    }
    const { sx, sy } = pointerPos(e);
    const before =
      state.view === "plan" ? screenToWorldPlan(sx, sy) : screenToWorldElev(sx, sy);
    state.userZoom = clamp(state.userZoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.3, 5);
    const after =
      state.view === "plan" ? screenToWorldPlan(sx, sy) : screenToWorldElev(sx, sy);
    if (state.view === "plan") {
      state.panX += before.x - after.x;
      state.panY += before.y - after.y;
    } else {
      state.panX += (state.elevWall === "left" || state.elevWall === "right" ? before.y : before.x) -
        (state.elevWall === "left" || state.elevWall === "right" ? after.y : after.x);
      state.panY += before.z - after.z;
    }
    draw();
  }

  // ——— UI ———
  function renderBom() {
    const st = active();
    if (!st) {
      els.bom.textContent = "—";
      return;
    }
    const groups = {};
    for (const m of st.members) {
      if (m.kind === "opening") continue;
      const p = PROFILES[m.profile] || { label: m.profile };
      const key = p.label;
      groups[key] = groups[key] || { count: 0, total: 0, roles: {} };
      groups[key].count += 1;
      if (m.kind === "lumber") {
        groups[key].total += memberLen(m);
        groups[key].roles[m.role || "member"] = (groups[key].roles[m.role || "member"] || 0) + 1;
      }
    }
    const openings = st.members.filter((m) => m.kind === "opening");
    const lines = Object.entries(groups).map(([label, g]) => {
      const roleBits = Object.entries(g.roles)
        .map(([r, c]) => `${c} ${r}`)
        .join(", ");
      return g.total
        ? `<div><strong>${g.count}× ${label}</strong><br/><span style="opacity:.75">Σ ${fmtLenIn(g.total)}${roleBits ? ` · ${roleBits}` : ""}</span></div>`
        : `<div><strong>${g.count}× ${label}</strong></div>`;
    });
    if (openings.length) {
      lines.push(
        `<div><strong>Aberturas:</strong> ${openings
          .map((o) => `${o.type} ${o.width}×${o.height}`)
          .join(", ")}</div>`
      );
    }
    els.bom.innerHTML = lines.length ? lines.join("") : '<div class="muted">Sin piezas — usa Generar</div>';
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
    if (m.kind === "opening") {
      els.selInfo.textContent = `${m.type} ${m.width}×${m.height}″ · ${m.wall}`;
    } else {
      const p = PROFILES[m.profile];
      els.selInfo.textContent = `${p?.label || m.profile} · ${m.role || ""} · ${fmtLenIn(memberLen(m))}`;
    }
  }

  function syncUI() {
    const st = active();
    const has = Boolean(st);
    els.emptyPanel.classList.toggle("hidden", has);
    els.toolsWrap.classList.toggle("hidden", !has);
    els.elevWallField.style.display = state.view === "elev" ? "" : "none";
    if (!st) {
      els.title.textContent = "Estructura";
      els.meta.textContent = "Abre un área desde Terreno";
      els.tabNote.textContent = "Sin estructura abierta";
      renderBom();
      draw();
      return;
    }
    els.title.textContent = st.name;
    els.meta.textContent = `${(st.widthIn / 12).toFixed(1)}×${(st.depthIn / 12).toFixed(1)}×${(st.wallHeightIn / 12).toFixed(1)} ft · ${st.members.filter((m) => m.kind === "lumber").length} piezas`;
    els.tabNote.textContent = st.name;
    els.wFt.value = (st.widthIn / 12).toFixed(2);
    els.dFt.value = (st.depthIn / 12).toFixed(2);
    els.wallH.value = (st.wallHeightIn / 12).toFixed(2);
    els.pitch.value = st.roofPitch ?? 6;
    els.overhang.value = st.overhangIn ?? 12;
    syncSelection();
    renderBom();
  }

  function refresh() {
    syncUI();
    draw();
  }

  function setTool(tool) {
    state.tool = tool;
    els.tools.forEach((b) => b.classList.toggle("active", b.dataset.ftool === tool));
    els.stage.classList.toggle("tool-rect", tool !== "select" && state.view !== "3d");
    const hints = {
      select: "Seleccionar",
      lumber: "Arrastra un palo en plan",
      sheet: "Clic para plancha",
      wall: "Traza un muro",
      door: "Clic en pared → puerta",
      window: "Clic en pared → ventana",
    };
    els.status.textContent = hints[tool] || tool;
  }

  function setView(view) {
    state.view = view;
    els.views.forEach((b) => b.classList.toggle("active", b.dataset.fview === view));
    els.elevWallField.style.display = view === "elev" ? "" : "none";
    fitView();
    els.status.textContent =
      view === "plan" ? "Vista plan" : view === "elev" ? "Vista elevación" : "Vista 3D";
  }

  function switchTab(tab) {
    els.tabs.forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    els.viewLot.classList.toggle("active", tab === "lot");
    els.viewFraming.classList.toggle("active", tab === "framing");
    if (tab === "framing") requestAnimationFrame(() => { resize(); draw(); });
    else window.SolarLot?.redraw?.();
  }

  function openFromArea(area) {
    const widthIn = area.shape === "circle" ? area.r * 2 * M_TO_IN : (area.w || 3) * M_TO_IN;
    const depthIn = area.shape === "circle" ? area.r * 2 * M_TO_IN : (area.h || 3) * M_TO_IN;
    ensureStructure(area.id, {
      name: area.label || "Estructura",
      widthIn: Math.max(48, widthIn),
      depthIn: Math.max(48, depthIn),
    });
    state.activeId = area.id;
    state.selectedMemberId = null;
    switchTab("framing");
    syncUI();
    requestAnimationFrame(() => { resize(); fitView(); });
    els.status.textContent = `Framing: ${area.label || area.id}`;
  }

  function openBlank() {
    const id = uid("blank");
    ensureStructure(id, { name: "Framing libre", widthIn: 120, depthIn: 144 });
    state.activeId = id;
    state.selectedMemberId = null;
    switchTab("framing");
    syncUI();
    requestAnimationFrame(() => { resize(); fitView(); });
  }

  // populate profiles
  els.profile.innerHTML = Object.values(PROFILES)
    .map((p) => `<option value="${p.id}">${p.label}${p.kind === "lumber" ? ` (${p.t}×${p.d}″)` : ""}</option>`)
    .join("");

  els.tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  els.tools.forEach((b) => b.addEventListener("click", () => setTool(b.dataset.ftool)));
  els.views.forEach((b) => b.addEventListener("click", () => setView(b.dataset.fview)));
  els.profile.addEventListener("change", () => { state.profile = els.profile.value; });
  els.oc.addEventListener("change", () => { state.oc = Number(els.oc.value) || 16; });
  els.snap.addEventListener("change", () => { state.snap = els.snap.checked; });
  els.grid.addEventListener("change", () => { state.showGrid = els.grid.checked; draw(); });
  els.elevWall.addEventListener("change", () => { state.elevWall = els.elevWall.value; fitView(); });
  els.btnFit.addEventListener("click", fitView);
  els.btnBlank.addEventListener("click", openBlank);
  els.btnShell.addEventListener("click", buildShell);
  els.btnJoists.addEventListener("click", buildJoists);
  els.btnRoof.addEventListener("click", buildRoof);
  els.btnSheathing.addEventListener("click", buildSheathing);
  els.btnDel.addEventListener("click", () => {
    const st = active();
    if (!st || !state.selectedMemberId) return;
    st.members = st.members.filter((m) => m.id !== state.selectedMemberId);
    state.selectedMemberId = null;
    touch(st);
    refresh();
  });
  els.btnClear.addEventListener("click", () => {
    const st = active();
    if (!st?.members.length) return;
    if (!confirm("¿Vaciar todo el framing de esta estructura?")) return;
    st.members = [];
    touch(st);
    state.selectedMemberId = null;
    refresh();
  });

  function bindDim(el, apply) {
    ["change", "input"].forEach((ev) => el.addEventListener(ev, () => {
      const st = active();
      if (!st) return;
      apply(st);
      touch(st);
      refresh();
    }));
  }
  bindDim(els.wFt, (st) => { st.widthIn = Math.max(48, (Number(els.wFt.value) || 10) * 12); });
  bindDim(els.dFt, (st) => { st.depthIn = Math.max(48, (Number(els.dFt.value) || 12) * 12); });
  bindDim(els.wallH, (st) => { st.wallHeightIn = Math.max(72, (Number(els.wallH.value) || 7.5) * 12); });
  bindDim(els.pitch, (st) => { st.roofPitch = Number(els.pitch.value) || 6; });
  bindDim(els.overhang, (st) => { st.overhangIn = Number(els.overhang.value) || 0; });

  els.canvas.addEventListener("pointerdown", onPointerDown);
  els.canvas.addEventListener("pointermove", onPointerMove);
  els.canvas.addEventListener("pointerup", onPointerUp);
  els.canvas.addEventListener("pointercancel", onPointerUp);
  els.canvas.addEventListener("wheel", onWheel, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (!els.viewFraming.classList.contains("active")) return;
    if (e.code === "Space") { state.spaceDown = true; e.preventDefault(); }
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "v" || e.key === "V") setTool("select");
    if (e.key === "1") setView("plan");
    if (e.key === "2") setView("elev");
    if (e.key === "3") setView("3d");
    if (e.key === "Delete" || e.key === "Backspace") els.btnDel.click();
  });
  window.addEventListener("keyup", (e) => { if (e.code === "Space") state.spaceDown = false; });
  window.addEventListener("resize", resize);

  window.SolarFraming = {
    openFromArea,
    openBlank,
    switchTab,
    getStructures: () => state.structures,
    setStructures(data, { merge = false } = {}) {
      if (!data || typeof data !== "object") return;
      const normalized = {};
      for (const [id, st] of Object.entries(data)) normalized[id] = migrateStructure(st);
      state.structures = merge ? { ...state.structures, ...normalized } : normalized;
      saveAll();
      if (state.activeId && !state.structures[state.activeId]) state.activeId = null;
      refresh();
    },
    hasStructure(areaId) {
      const st = state.structures[areaId];
      return Boolean(st?.members?.some((m) => m.kind === "lumber"));
    },
  };

  setTool("select");
  setView("plan");
  syncUI();
})();
