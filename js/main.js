import { Grid, WEIGHT } from './grid.js';
import { Renderer, V } from './renderer.js';
import { Player } from './player.js';
import { OP, GenRecorder } from './ops.js';
import { generators, addLoops } from './generators.js';
import { solvers, pathCost } from './solvers.js';
import { debounce, line } from './utils.js';

const SPEEDS = [3, 8, 20, 45, 90, 180, 350, 700, 1500, 4000]; // steps per second

const $ = (selector) => document.querySelector(selector);
const ui = {
  board: $('#board'),
  wrap: $('#board-wrap'),
  genAlgo: $('#gen-algo'),
  genDesc: $('#gen-desc'),
  loops: $('#loops'),
  loopsOut: $('#loops-out'),
  loopsField: $('#loops-field'),
  solveAlgo: $('#solve-algo'),
  solveDesc: $('#solve-desc'),
  solveChips: $('#solve-chips'),
  tools: $('#tools'),
  btnGenerate: $('#btn-generate'),
  btnSolve: $('#btn-solve'),
  btnClearPath: $('#btn-clear-path'),
  btnClearBoard: $('#btn-clear-board'),
  btnPlay: $('#btn-play'),
  btnStep: $('#btn-step'),
  btnFinish: $('#btn-finish'),
  speed: $('#speed'),
  speedOut: $('#speed-out'),
  status: $('#status'),
  statusLabel: $('#status-label'),
  statusDetail: $('#status-detail'),
  progress: $('#progress-bar'),
  themeToggle: $('#theme-toggle'),
  toolHint: $('#tool-hint'),
  tipbar: $('#tipbar'),
  tipText: $('#tip-text'),
  tipClose: $('#tip-close'),
  views: { visualizer: $('#view-visualizer'), learn: $('#view-learn') },
  tabs: document.querySelectorAll('.tab'),
  solverTable: $('#solver-table'),
  genList: $('#gen-list'),
  stats: {
    visited: $('#stat-visited'),
    length: $('#stat-length'),
    cost: $('#stat-cost'),
    time: $('#stat-time'),
  },
};

const app = {
  grid: null,
  mode: null, 
  solved: false, 
  tool: 'wall',
  visited: 0,
  started: false,
};

const renderer = new Renderer(ui.board);
const player = new Player({ apply: applyOp, onProgress, onStateChange: syncPlayback });

const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
  },
};


function applyOp(op, i, instant) {
  switch (op) {
    case OP.CARVE: renderer.setState(i, V.EMPTY, instant); break;
    case OP.WALL: renderer.setState(i, V.WALL, instant); break;
    case OP.WEIGHT: renderer.setWeight(i, true, instant); break;
    case OP.FRONTIER: renderer.setState(i, V.FRONTIER, instant); break;
    case OP.VISIT: renderer.setState(i, V.VISITED, instant); app.visited++; break;
    case OP.VISIT_ALT: renderer.setState(i, V.VISITED_ALT, instant); app.visited++; break;
    case OP.PATH: renderer.setState(i, V.PATH, instant); break;
    case OP.HEAD: renderer.moveHead(i); break;
  }
}

function onProgress(done, total) {
  ui.progress.style.transform = `scaleX(${total ? done / total : 0})`;
  if (app.mode === 'solve') ui.stats.visited.textContent = app.visited.toLocaleString();
}

function syncPlayback() {
  const icon = ui.btnPlay.querySelector('i');
  icon.className = player.playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
  ui.btnPlay.setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
  ui.btnStep.disabled = !player.active;
  ui.btnFinish.disabled = !player.active;
  ui.status.dataset.paused = String(player.active && !player.playing);
}

function setStatus(state, label, detail = '') {
  ui.status.dataset.state = state;
  ui.statusLabel.textContent = label;
  ui.statusDetail.textContent = detail;
}

function setStat(key, value, bump = false) {
  const el = ui.stats[key];
  el.textContent = value;
  if (bump) {
    el.classList.remove('bump');
    void el.offsetWidth; // restart the animation
    el.classList.add('bump');
  }
}

function resetStats() {
  app.visited = 0;
  setStat('visited', '0');
  setStat('length', '—');
  setStat('cost', '—');
  setStat('time', '—');
}

const formatMs = (ms) => `${ms < 1 ? ms.toFixed(2) : ms.toFixed(1)} ms`;

function showResult(result, solver, animated) {
  setStat('visited', app.visited.toLocaleString());
  setStat('time', formatMs(result.time), animated);
  if (result.path) {
    const steps = result.path.length - 1;
    setStat('length', steps.toLocaleString(), animated);
    setStat('cost', result.cost.toLocaleString(), animated);
    setStatus('done', 'Path found', `${solver.name} · ${steps} steps, ${app.visited} cells explored`);
  } else {
    setStat('length', '—');
    setStat('cost', '—');
    setStatus('fail', 'No path', `The goal can't be reached · ${app.visited} cells explored`);
  }
}


function generate() {
  const gen = generators[ui.genAlgo.value];
  const grid = app.grid;
  player.cancel();
  renderer.hideHead();
  resetStats();
  app.mode = 'generate';
  app.solved = false;

  if (gen.perfect) grid.snapEndpoints();
  grid.fill(gen.initial);
  renderer.syncFromModel(true);
  renderer.placeMarkers();

  const rec = new GenRecorder(grid);
  gen.run(grid, rec);
  if (gen.perfect) addLoops(grid, rec, Number(ui.loops.value) / 100);

  setStatus('running', 'Generating', gen.name);
  player.load([{ ops: rec.ops }], () => {
    renderer.hideHead();
    app.mode = null;
    setStatus('idle', 'Maze ready', 'Pick an algorithm and press Find path');
  });
  player.play();
}

function solve({ animate = true } = {}) {
  if (app.mode === 'generate') player.finish();
  player.cancel();
  renderer.clearSearch();
  app.visited = 0;

  const solver = solvers[ui.solveAlgo.value];
  const t0 = performance.now();
  const result = solver.run(app.grid);
  result.time = performance.now() - t0;
  result.cost = result.path ? pathCost(app.grid, result.path) : null;

  const pathOps = [];
  for (const c of result.path ?? []) pathOps.push(OP.PATH, c);

  if (!animate) {
    for (const ops of [result.ops, pathOps]) {
      for (let k = 0; k < ops.length; k += 2) applyOp(ops[k], ops[k + 1], true);
    }
    app.mode = null;
    app.solved = true;
    showResult(result, solver, false);
    return;
  }

  app.mode = 'solve';
  app.solved = false;
  resetStats();
  setStatus('running', 'Searching', solver.name);
  player.load(
    [
      { ops: result.ops },
      { ops: pathOps, rate: Math.max(40, pathOps.length / 2 / 1.1), delay: 160 },
    ],
    () => {
      app.mode = null;
      app.solved = true;
      showResult(result, solver, true);
    },
  );
  player.play();
}

let liveQueued = false;
function requestLiveSolve() {
  if (!app.solved || liveQueued) return;
  liveQueued = true;
  requestAnimationFrame(() => {
    liveQueued = false;
    if (app.solved) solve({ animate: false });
  });
}

function clearPath() {
  if (app.mode === 'generate') return;
  player.cancel();
  app.mode = null;
  app.solved = false;
  renderer.clearSearch();
  resetStats();
  onProgress(0, 0);
  setStatus('idle', 'Ready', 'Press Find path to start the search');
}

function clearBoard() {
  player.cancel();
  renderer.hideHead();
  app.mode = null;
  app.solved = false;
  app.grid.fill('empty');
  renderer.syncFromModel(false);
  resetStats();
  onProgress(0, 0);
  setStatus('idle', 'Board cleared', 'Draw some walls or generate a maze');
}

function settle() {
  if (player.active) player.finish();
}

function actionFor(i) {
  const { walls, weights } = app.grid;
  if (app.tool === 'wall') return walls[i] ? 'unwall' : 'wall';
  if (app.tool === 'weight') return weights[i] > 1 && !walls[i] ? 'unweight' : 'weight';
  return 'erase';
}

function paint(i, action) {
  const grid = app.grid;
  if (i < 0 || grid.isEndpoint(i)) return false;
  const { walls, weights } = grid;
  const wasWall = walls[i] === 1;

  switch (action) {
    case 'wall':
      if (wasWall) return false;
      walls[i] = 1;
      weights[i] = 1;
      renderer.setWeight(i, false, true);
      renderer.setState(i, V.WALL);
      break;
    case 'unwall':
      if (!wasWall) return false;
      walls[i] = 0;
      renderer.setState(i, V.EMPTY);
      break;
    case 'weight':
      if (weights[i] > 1 && !wasWall) return false;
      walls[i] = 0;
      weights[i] = WEIGHT;
      if (wasWall) renderer.setState(i, V.EMPTY);
      renderer.setWeight(i, true);
      break;
    case 'unweight':
      if (weights[i] === 1) return false;
      weights[i] = 1;
      renderer.setWeight(i, false);
      break;
    case 'erase':
      if (!wasWall && weights[i] === 1) return false;
      walls[i] = 0;
      weights[i] = 1;
      renderer.setWeight(i, false);
      if (wasWall) renderer.setState(i, V.EMPTY);
      break;
  }
  return true;
}

let drag = null;
const isTouch = matchMedia('(hover: none)').matches;

const TOOL_HINTS = {
  wall: '<strong>Wall</strong> blocks movement completely. Click an existing wall to remove it.',
  weight: '<strong>Weight</strong> is passable but costs 5 to cross, like mud. Only Dijkstra and A* take it into account.',
  erase: '<strong>Erase</strong> removes walls and weights. On a computer you can also just right-drag with any tool.',
};

function previewKind(i) {
  if (drag?.type === 'paint') return drag.action === 'wall' || drag.action === 'weight' ? drag.action : 'erase';
  if (app.grid.isEndpoint(i)) return 'grab';
  const action = actionFor(i);
  return action === 'wall' || action === 'weight' ? action : 'erase';
}

function updateCursor(e, i) {
  if (e.pointerType !== 'mouse' || i < 0 || drag?.type === 'marker') renderer.hideCursor();
  else renderer.showCursor(i, previewKind(i));
}

ui.board.addEventListener('contextmenu', (e) => e.preventDefault());

ui.board.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.button !== 2) return;
  const i = renderer.cellAt(e.clientX, e.clientY);
  if (i < 0) return;
  settle();
  e.preventDefault();
  ui.board.setPointerCapture(e.pointerId);

  const grid = app.grid;
  if (grid.isEndpoint(i) && e.button === 0) {
    const which = i === grid.start ? 'start' : 'end';
    drag = { type: 'marker', which };
    renderer.setDragging(which, true);
    renderer.hideCursor();
    ui.board.style.cursor = 'grabbing';
  } else {
    drag = { type: 'paint', action: e.button === 2 ? 'erase' : actionFor(i), last: i };
    if (paint(i, drag.action)) requestLiveSolve();
    updateCursor(e, i);
  }
});

ui.board.addEventListener('pointermove', (e) => {
  const i = renderer.cellAt(e.clientX, e.clientY);
  const grid = app.grid;
  updateCursor(e, i);

  if (!drag) {
    ui.board.style.cursor = i >= 0 && grid.isEndpoint(i) ? 'grab' : '';
    return;
  }
  if (i < 0) return;

  if (drag.type === 'marker') {
    if (grid.walls[i] || grid.isEndpoint(i)) return;
    grid[drag.which] = i;
    renderer.placeMarkers();
    requestLiveSolve();
    return;
  }

  if (i === drag.last) return;
  let changed = false;
  for (const [x, y] of line(grid.xOf(drag.last), grid.yOf(drag.last), grid.xOf(i), grid.yOf(i))) {
    changed = paint(grid.index(x, y), drag.action) || changed;
  }
  drag.last = i;
  if (changed) requestLiveSolve();
});

function endDrag() {
  if (drag?.type === 'marker') renderer.setDragging(drag.which, false);
  drag = null;
  ui.board.style.cursor = '';
}
ui.board.addEventListener('pointerup', (e) => {
  endDrag();
  updateCursor(e, renderer.cellAt(e.clientX, e.clientY));
});
ui.board.addEventListener('pointercancel', endDrag);
ui.board.addEventListener('pointerleave', () => renderer.hideCursor());

function setTool(tool) {
  app.tool = tool;
  for (const btn of ui.tools.querySelectorAll('button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.tool === tool));
  }
  ui.toolHint.innerHTML = TOOL_HINTS[tool];
}

function showTip() {
  ui.tipText.innerHTML = isTouch
    ? '<strong>Drag</strong> on the grid to draw with the selected tool · <strong>drag</strong> the <span class="dot dot-start"></span> start or <span class="dot dot-end"></span> goal to move them'
    : '<strong>Left-drag</strong> to draw · <strong>right-drag</strong> to erase · <strong>drag</strong> the <span class="dot dot-start"></span> start or <span class="dot dot-end"></span> goal to move them';
  ui.tipbar.hidden = storage.get('traverse-tip-hidden') === '1';
}

function hideTip() {
  ui.tipbar.hidden = true;
  storage.set('traverse-tip-hidden', '1');
  layout();
}

ui.tipClose.addEventListener('click', hideTip);

ui.tools.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tool]');
  if (btn) setTool(btn.dataset.tool);
});

function describeGenerator() {
  const gen = generators[ui.genAlgo.value];
  ui.genDesc.textContent = gen.desc;
  ui.loopsField.classList.toggle('disabled', !gen.perfect);
  ui.loops.disabled = !gen.perfect;
}

function describeSolver() {
  const s = solvers[ui.solveAlgo.value];
  ui.solveDesc.textContent = s.desc;
  const chip = (ok, label) =>
    `<li class="chip ${ok ? 'yes' : 'no'}"><i class="fa-solid ${ok ? 'fa-check' : 'fa-xmark'}"></i>${label}</li>`;
  ui.solveChips.innerHTML =
    chip(s.shortest, 'Shortest path') +
    chip(s.weighted, 'Uses weights') +
    `<li class="chip"><i class="fa-solid fa-layer-group"></i>${s.structure}</li>`;
}

function setSpeed(level) {
  const sps = SPEEDS[level - 1];
  player.sps = sps;
  ui.speedOut.textContent = `${sps}/s`;
  renderer.setHeadDuration(sps > 400 ? 0 : Math.min(160, Math.round(2000 / sps)));
  storage.set('traverse-speed', level);
}

for (const [key, gen] of Object.entries(generators)) ui.genAlgo.add(new Option(gen.name, key));
for (const [key, s] of Object.entries(solvers)) ui.solveAlgo.add(new Option(s.name, key));

ui.genAlgo.addEventListener('change', () => {
  describeGenerator();
  ui.genAlgo.blur();
});
ui.solveAlgo.addEventListener('change', () => {
  describeSolver();
  ui.solveAlgo.blur();
  if (app.solved) solve({ animate: false });
});
ui.loops.addEventListener('input', () => (ui.loopsOut.textContent = `${ui.loops.value}%`));
ui.speed.addEventListener('input', () => setSpeed(Number(ui.speed.value)));

ui.btnGenerate.addEventListener('click', generate);
ui.btnSolve.addEventListener('click', () => solve());
ui.btnClearPath.addEventListener('click', clearPath);
ui.btnClearBoard.addEventListener('click', clearBoard);
ui.btnPlay.addEventListener('click', () => (player.active ? player.toggle() : solve()));
ui.btnStep.addEventListener('click', () => player.active && player.step());
ui.btnFinish.addEventListener('click', () => player.active && player.finish());

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (ui.views.visualizer.hidden) return;
  const target = e.target;
  if (target.matches('select, textarea')) return;
  if (target.matches('input') && e.key.startsWith('Arrow')) return;

  switch (e.key.toLowerCase()) {
    case ' ':
      if (target.matches('button')) return;
      e.preventDefault();
      ui.btnPlay.click();
      break;
    case 'arrowright': e.preventDefault(); ui.btnStep.click(); break;
    case 'f': ui.btnFinish.click(); break;
    case 'g': generate(); break;
    case 'v': solve(); break;
    case 'c': clearPath(); break;
    case '1': setTool('wall'); break;
    case '2': setTool('weight'); break;
    case '3': setTool('erase'); break;
  }
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  ui.themeToggle.querySelector('i').className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  ui.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

ui.themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  storage.set('traverse-theme', next);
});

function measure() {
  const style = getComputedStyle(ui.wrap);
  const width = ui.wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = ui.wrap.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const gap = renderer.gap;
  const target = width < 640 ? 17 : 23;

  let cols = Math.floor((width - gap) / (target + gap));
  if (cols % 2 === 0) cols--;
  cols = Math.max(cols, 11);
  const cell = Math.max(8, Math.floor((width - gap) / cols - gap));
  let rows = Math.floor((height - gap) / (cell + gap));
  if (rows % 2 === 0) rows--;
  rows = Math.max(rows, 11);
  return { cols, rows, cell };
}

function layout() {
  if (!ui.wrap.clientWidth) return; 
  const { cols, rows, cell } = measure();
  const grid = app.grid;
  if (grid && grid.cols === cols && grid.rows === rows) {
    renderer.setCellSize(cell);
    return;
  }
  settle();
  app.grid = grid ? grid.resized(cols, rows) : new Grid(cols, rows);
  renderer.build(app.grid, cell);
  renderer.syncFromModel(false);
  if (app.solved) solve({ animate: false });
}


function renderLearn() {
  const mark = (ok) =>
    ok ? '<span class="yes"><i class="fa-solid fa-check"></i> Yes</span>' : '<span class="no"><i class="fa-solid fa-xmark"></i> No</span>';
  ui.solverTable.innerHTML = Object.values(solvers)
    .map(
      (s) => `<tr>
        <th scope="row">${s.name}</th>
        <td>${mark(s.shortest)}</td>
        <td>${mark(s.weighted)}</td>
        <td>${s.structure}</td>
        <td><code>${s.complexity}</code></td>
        <td>${s.goodFor}</td>
      </tr>`,
    )
    .join('');

  ui.genList.innerHTML = Object.values(generators)
    .map(
      (g) => `<div class="info-card compact">
        <h3>${g.name}${g.perfect ? '<span class="tag">perfect maze</span>' : ''}</h3>
        <p>${g.desc}</p>
      </div>`,
    )
    .join('');
}


function route() {
  const hash = location.hash.slice(1);
  const target = hash ? document.getElementById(hash) : null;
  const view = hash === 'learn' || target?.closest('#view-learn') ? 'learn' : 'visualizer';

  for (const [name, el] of Object.entries(ui.views)) el.hidden = name !== view;
  for (const tab of ui.tabs) {
    if (tab.dataset.view === view) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }

  if (view === 'visualizer') {
    window.scrollTo(0, 0);
    layout();
    if (!app.started && app.grid) {
      app.started = true;
      generate();
    }
  } else if (target && hash !== 'learn') {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo(0, 0);
  }
}

window.addEventListener('hashchange', route);

applyTheme(document.documentElement.dataset.theme || 'dark');
const savedSpeed = Number(storage.get('traverse-speed'));
ui.speed.value = savedSpeed >= 1 && savedSpeed <= SPEEDS.length ? savedSpeed : 7;
setSpeed(Number(ui.speed.value));
ui.solveAlgo.value = 'astar';
describeGenerator();
describeSolver();
setTool('wall');
showTip();
renderLearn();
syncPlayback();

new ResizeObserver(debounce(layout, 120)).observe(ui.wrap);
route();
