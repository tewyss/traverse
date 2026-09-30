import { DisjointSet } from './structures.js';
import { randInt, pick, shuffle } from './utils.js';

const STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function roomNeighbors(grid, i) {
  const x = grid.xOf(i);
  const y = grid.yOf(i);
  const out = [];
  for (const [dx, dy] of STEPS) {
    const nx = x + 2 * dx;
    const ny = y + 2 * dy;
    if (nx > 0 && ny > 0 && nx < grid.cols - 1 && ny < grid.rows - 1) out.push(grid.index(nx, ny));
  }
  return out;
}

function allRooms(grid) {
  const rooms = [];
  for (let y = 1; y < grid.rows - 1; y += 2) {
    for (let x = 1; x < grid.cols - 1; x += 2) rooms.push(grid.index(x, y));
  }
  return rooms;
}

const between = (a, b) => (a + b) / 2;

function backtracker(grid, rec) {
  const visited = new Uint8Array(grid.size);
  const stack = [grid.start];
  visited[grid.start] = 1;
  rec.carve(grid.start);
  rec.head(grid.start);

  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = roomNeighbors(grid, current).filter((n) => !visited[n]);
    if (!options.length) {
      stack.pop();
      if (stack.length) rec.head(stack[stack.length - 1]);
      continue;
    }
    const next = pick(options);
    visited[next] = 1;
    rec.carve(between(current, next));
    rec.carve(next);
    rec.head(next);
    stack.push(next);
  }
}

function kruskal(grid, rec) {
  const edges = [];
  for (const room of allRooms(grid)) {
    const x = grid.xOf(room);
    const y = grid.yOf(room);
    if (x + 2 < grid.cols - 1) edges.push([room, room + 2]);
    if (y + 2 < grid.rows - 1) edges.push([room, room + 2 * grid.cols]);
  }
  const sets = new DisjointSet(grid.size);
  for (const [a, b] of shuffle(edges)) {
    if (sets.union(a, b)) rec.carve(between(a, b));
  }
}

function prim(grid, rec) {
  const inMaze = new Uint8Array(grid.size);
  const queued = new Uint8Array(grid.size);
  const frontier = [];

  const grow = (cell) => {
    inMaze[cell] = 1;
    for (const n of roomNeighbors(grid, cell)) {
      if (inMaze[n] || queued[n]) continue;
      queued[n] = 1;
      frontier.push(n);
      rec.mark(n);
    }
  };

  rec.carve(grid.start);
  grow(grid.start);

  while (frontier.length) {
    const k = randInt(frontier.length);
    const cell = frontier[k];
    frontier[k] = frontier[frontier.length - 1];
    frontier.pop();
    const anchor = pick(roomNeighbors(grid, cell).filter((n) => inMaze[n]));
    rec.carve(between(cell, anchor));
    rec.carve(cell);
    grow(cell);
  }
}

function wilson(grid, rec) {
  const rooms = allRooms(grid);
  const inMaze = new Uint8Array(grid.size);
  const onPath = new Int32Array(grid.size).fill(-1);

  const first = pick(rooms);
  inMaze[first] = 1;
  rec.carve(first);

  for (const origin of shuffle(rooms.slice())) {
    if (inMaze[origin]) continue;

    const path = [origin];
    onPath[origin] = 0;
    rec.mark(origin);
    rec.head(origin);
    let current = origin;

    for (;;) {
      const next = pick(roomNeighbors(grid, current));
      if (inMaze[next]) {
        path.push(next);
        break;
      }
      if (onPath[next] !== -1) {
        const keep = onPath[next];
        for (let j = path.length - 1; j > keep; j--) {
          rec.unmark(between(path[j - 1], path[j]));
          rec.unmark(path[j]);
          onPath[path[j]] = -1;
        }
        path.length = keep + 1;
      } else {
        rec.mark(between(current, next));
        rec.mark(next);
        onPath[next] = path.length;
        path.push(next);
      }
      current = next;
      rec.head(current);
    }

    for (let j = 0; j < path.length; j++) {
      const cell = path[j];
      if (j > 0) rec.carve(between(path[j - 1], cell));
      if (!inMaze[cell]) rec.carve(cell);
      inMaze[cell] = 1;
      onPath[cell] = -1;
    }
  }
}

function division(grid, rec) {
  const stack = [[1, 1, grid.cols - 2, grid.rows - 2]];
  while (stack.length) {
    const [x1, y1, x2, y2] = stack.pop();
    const w = x2 - x1;
    const h = y2 - y1;
    const canSplitH = h >= 2;
    const canSplitV = w >= 2;
    if (!canSplitH && !canSplitV) continue;

    const horizontal = canSplitH && (!canSplitV || h > w || (h === w && Math.random() < 0.5));
    if (horizontal) {
      const wy = y1 + 1 + 2 * randInt(h / 2);
      const gap = x1 + 2 * randInt(w / 2 + 1);
      for (let x = x1; x <= x2; x++) if (x !== gap) rec.wall(grid.index(x, wy));
      stack.push([x1, wy + 1, x2, y2], [x1, y1, x2, wy - 1]);
    } else {
      const wx = x1 + 1 + 2 * randInt(w / 2);
      const gap = y1 + 2 * randInt(h / 2 + 1);
      for (let y = y1; y <= y2; y++) if (y !== gap) rec.wall(grid.index(wx, y));
      stack.push([wx + 1, y1, x2, y2], [x1, y1, wx - 1, y2]);
    }
  }
}

function interiorCells(grid) {
  const cells = [];
  for (let y = 1; y < grid.rows - 1; y++) {
    for (let x = 1; x < grid.cols - 1; x++) {
      const i = grid.index(x, y);
      if (!grid.isEndpoint(i)) cells.push(i);
    }
  }
  return shuffle(cells);
}

function scatter(grid, rec) {
  for (const i of interiorCells(grid)) if (Math.random() < 0.28) rec.wall(i);
}

function terrain(grid, rec) {
  for (const i of interiorCells(grid)) {
    const roll = Math.random();
    if (roll < 0.18) rec.wall(i);
    else if (roll < 0.42) rec.weight(i);
  }
}

export function addLoops(grid, rec, probability) {
  if (probability <= 0) return;
  const { cols, rows, walls } = grid;
  const candidates = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const i = grid.index(x, y);
      if (!walls[i]) continue;
      const linksH = x % 2 === 0 && y % 2 === 1 && !walls[i - 1] && !walls[i + 1];
      const linksV = x % 2 === 1 && y % 2 === 0 && !walls[i - cols] && !walls[i + cols];
      if (linksH || linksV) candidates.push(i);
    }
  }
  for (const i of shuffle(candidates)) if (Math.random() < probability) rec.carve(i);
}

export const generators = {
  backtracker: {
    name: 'Recursive backtracker',
    desc: 'Randomized depth-first search. Long, winding corridors with few branches.',
    initial: 'walls',
    perfect: true,
    run: backtracker,
  },
  kruskal: {
    name: "Kruskal's algorithm",
    desc: 'Joins random neighbouring rooms using a disjoint-set union. Lots of short dead ends.',
    initial: 'rooms',
    perfect: true,
    run: kruskal,
  },
  prim: {
    name: "Prim's algorithm",
    desc: 'Grows outward from the start, adding a random frontier cell each step.',
    initial: 'walls',
    perfect: true,
    run: prim,
  },
  wilson: {
    name: "Wilson's algorithm",
    desc: 'Loop-erased random walks. Slow to start, but every possible maze is equally likely.',
    initial: 'walls',
    perfect: true,
    run: wilson,
  },
  division: {
    name: 'Recursive division',
    desc: 'Splits the space with walls, leaving one gap in each. Long, straight corridors.',
    initial: 'border',
    perfect: true,
    run: division,
  },
  scatter: {
    name: 'Random walls',
    desc: 'Scatters walls across an open field. Good for comparing A* with greedy search.',
    initial: 'border',
    perfect: false,
    run: scatter,
  },
  terrain: {
    name: 'Weighted terrain',
    desc: 'Walls plus weighted cells that cost 5 to cross. Shows why Dijkstra and A* exist.',
    initial: 'border',
    perfect: false,
    run: terrain,
  },
};
