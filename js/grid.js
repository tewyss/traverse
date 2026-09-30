export const WEIGHT = 5; 

export class Grid {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.size = cols * rows;
    this.walls = new Uint8Array(this.size);
    this.weights = new Uint8Array(this.size).fill(1);
    this.start = this.index(1, 1);
    this.end = this.index(cols - 2, rows - 2);
  }

  index(x, y) {
    return y * this.cols + x;
  }

  xOf(i) {
    return i % this.cols;
  }

  yOf(i) {
    return (i / this.cols) | 0;
  }

  isEndpoint(i) {
    return i === this.start || i === this.end;
  }

  neighbors(i) {
    const { cols, rows, walls } = this;
    const x = i % cols;
    const y = (i / cols) | 0;
    const out = [];
    if (y > 0 && !walls[i - cols]) out.push(i - cols);
    if (x < cols - 1 && !walls[i + 1]) out.push(i + 1);
    if (y < rows - 1 && !walls[i + cols]) out.push(i + cols);
    if (x > 0 && !walls[i - 1]) out.push(i - 1);
    return out;
  }

  distance(a, b) {
    return Math.abs(this.xOf(a) - this.xOf(b)) + Math.abs(this.yOf(a) - this.yOf(b));
  }

  fill(mode) {
    const { cols, rows, walls } = this;
    this.weights.fill(1);
    walls.fill(mode === 'walls' ? 1 : 0);

    if (mode === 'rooms' || mode === 'border') {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const border = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
          const room = x % 2 === 1 && y % 2 === 1;
          walls[this.index(x, y)] = mode === 'rooms' ? +!room : +border;
        }
      }
    }
    walls[this.start] = 0;
    walls[this.end] = 0;
  }

  snapEndpoints() {
    const snap = (i) => {
      let x = this.xOf(i);
      let y = this.yOf(i);
      if (x % 2 === 0) x = Math.max(1, x - 1);
      if (y % 2 === 0) y = Math.max(1, y - 1);
      return this.index(Math.min(x, this.cols - 2), Math.min(y, this.rows - 2));
    };
    this.start = snap(this.start);
    this.end = snap(this.end);
    if (this.start === this.end) {
      const corner = this.index(this.cols - 2, this.rows - 2);
      this.end = this.start === corner ? this.index(1, 1) : corner;
    }
  }

  resized(cols, rows) {
    const g = new Grid(cols, rows);
    const w = Math.min(cols, this.cols);
    const h = Math.min(rows, this.rows);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        g.walls[g.index(x, y)] = this.walls[this.index(x, y)];
        g.weights[g.index(x, y)] = this.weights[this.index(x, y)];
      }
    }
    const keep = (i, fallback) => {
      const x = this.xOf(i);
      const y = this.yOf(i);
      return x < cols && y < rows ? g.index(x, y) : fallback;
    };
    g.start = keep(this.start, g.start);
    g.end = keep(this.end, g.end);
    if (g.start === g.end) g.start = g.index(1, 1);
    for (const i of [g.start, g.end]) {
      g.walls[i] = 0;
      g.weights[i] = 1;
    }
    return g;
  }
}
