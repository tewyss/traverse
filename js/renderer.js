export const V = { EMPTY: 0, WALL: 1, FRONTIER: 2, VISITED: 3, VISITED_ALT: 4, PATH: 5 };

const CLASS = ['cell', 'cell wall', 'cell frontier', 'cell visited', 'cell visited-alt', 'cell path'];

function element(className) {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

export class Renderer {
  constructor(board) {
    this.board = board;
    this.gap = 1;
    this.headAt = -1;
  }

  build(grid, cell) {
    this.grid = grid;
    this.state = new Uint8Array(grid.size);
    this.weight = new Uint8Array(grid.size);
    this.cells = new Array(grid.size);

    const frag = document.createDocumentFragment();
    for (let i = 0; i < grid.size; i++) {
      this.cells[i] = element('cell');
      frag.appendChild(this.cells[i]);
    }
    this.head = element('head');
    this.startEl = element('marker marker-start');
    this.endEl = element('marker marker-end');
    this.cursor = element('cursor');
    frag.append(this.head, this.startEl, this.endEl, this.cursor);
    this.board.replaceChildren(frag);

    this.board.style.setProperty('--cols', grid.cols);
    this.board.style.setProperty('--rows', grid.rows);
    this.board.style.setProperty('--gap', `${this.gap}px`);
    this.headAt = -1;
    this.setCellSize(cell);
  }

  setCellSize(cell) {
    this.cell = cell;
    this.board.style.setProperty('--cell', `${cell}px`);
    this.placeMarkers();
    if (this.headAt >= 0) this.moveHead(this.headAt);
  }

  className(i, instant) {
    let name = CLASS[this.state[i]];
    if (this.weight[i]) name += ' weight';
    if (instant) name += ' still';
    return name;
  }

  setState(i, state, instant = false) {
    if (this.state[i] === state) return;
    this.state[i] = state;
    this.cells[i].className = this.className(i, instant);
  }

  setWeight(i, on, instant = false) {
    const value = on ? 1 : 0;
    if (this.weight[i] === value) return;
    this.weight[i] = value;
    this.cells[i].className = this.className(i, instant);
  }

  syncFromModel(animate = false) {
    const { walls, weights } = this.grid;
    for (let i = 0; i < this.cells.length; i++) {
      this.state[i] = walls[i] ? V.WALL : V.EMPTY;
      this.weight[i] = weights[i] > 1 ? 1 : 0;
      this.cells[i].className = this.className(i, !animate);
    }
  }

  clearSearch() {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.state[i] >= V.FRONTIER) {
        this.state[i] = V.EMPTY;
        this.cells[i].className = this.className(i, true);
      }
    }
  }

  translate(i) {
    const step = this.cell + this.gap;
    const x = this.gap + (i % this.grid.cols) * step;
    const y = this.gap + Math.floor(i / this.grid.cols) * step;
    return `translate(${x}px, ${y}px)`;
  }

  placeMarkers() {
    if (!this.grid) return;
    this.startEl.style.transform = this.translate(this.grid.start);
    this.endEl.style.transform = this.translate(this.grid.end);
  }

  setDragging(which, on) {
    (which === 'start' ? this.startEl : this.endEl).classList.toggle('dragging', on);
  }

  moveHead(i) {
    this.headAt = i;
    this.head.style.transform = this.translate(i);
    this.head.classList.add('on');
  }

  hideHead() {
    this.headAt = -1;
    this.head?.classList.remove('on');
  }

  showCursor(i, kind) {
    this.cursor.style.transform = this.translate(i);
    this.cursor.dataset.kind = kind;
    this.cursor.classList.add('on');
  }

  hideCursor() {
    this.cursor?.classList.remove('on');
  }

  setHeadDuration(ms) {
    this.board.style.setProperty('--head-dur', `${ms}ms`);
  }

  cellAt(clientX, clientY) {
    const rect = this.board.getBoundingClientRect();
    const step = this.cell + this.gap;
    const x = Math.floor((clientX - rect.left - this.gap) / step);
    const y = Math.floor((clientY - rect.top - this.gap) / step);
    if (x < 0 || y < 0 || x >= this.grid.cols || y >= this.grid.rows) return -1;
    return this.grid.index(x, y);
  }
}
