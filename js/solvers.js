import { MinHeap } from './structures.js';
import { OP } from './ops.js';

function trace(prev, start, end) {
  if (end !== start && prev[end] === -1) return null;
  const path = [];
  for (let c = end; c !== -1; c = prev[c]) path.push(c);
  return path.reverse();
}

function bfs(grid) {
  const { size, start, end } = grid;
  const ops = [];
  const prev = new Int32Array(size).fill(-1);
  const seen = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;

  while (head < tail) {
    const c = queue[head++];
    ops.push(OP.VISIT, c);
    if (c === end) break;
    for (const n of grid.neighbors(c)) {
      if (seen[n]) continue;
      seen[n] = 1;
      prev[n] = c;
      queue[tail++] = n;
      ops.push(OP.FRONTIER, n);
    }
  }
  return { ops, path: trace(prev, start, end) };
}

function dfs(grid) {
  const { size, start, end } = grid;
  const ops = [];
  const prev = new Int32Array(size).fill(-1);
  const visited = new Uint8Array(size);
  const stack = [start];

  while (stack.length) {
    const c = stack.pop();
    if (visited[c]) continue;
    visited[c] = 1;
    ops.push(OP.VISIT, c);
    if (c === end) break;
    const next = grid.neighbors(c);
    for (let k = next.length - 1; k >= 0; k--) {
      const n = next[k];
      if (visited[n]) continue;
      prev[n] = c;
      stack.push(n);
      ops.push(OP.FRONTIER, n);
    }
  }
  return { ops, path: trace(prev, start, end) };
}

function bestFirst(grid, { priority, relax }) {
  const { size, start, end, weights } = grid;
  const ops = [];
  const prev = new Int32Array(size).fill(-1);
  const cost = new Float64Array(size).fill(Infinity);
  const closed = new Uint8Array(size);
  let seq = 0;
  const heap = new MinHeap((a, b) => a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2]))));

  cost[start] = 0;
  heap.push([...priority(0, start), seq++, start]);

  while (heap.size) {
    const c = heap.pop()[3];
    if (closed[c]) continue;
    closed[c] = 1;
    ops.push(OP.VISIT, c);
    if (c === end) break;
    for (const n of grid.neighbors(c)) {
      if (closed[n]) continue;
      const g = cost[c] + weights[n];
      if (relax ? g >= cost[n] : cost[n] !== Infinity) continue;
      cost[n] = g;
      prev[n] = c;
      heap.push([...priority(g, n), seq++, n]);
      ops.push(OP.FRONTIER, n);
    }
  }
  return { ops, path: trace(prev, start, end) };
}

const dijkstra = (grid) => bestFirst(grid, { priority: (g) => [g, 0], relax: true });

const astar = (grid) =>
  bestFirst(grid, {
    priority: (g, n) => {
      const h = grid.distance(n, grid.end);
      return [g + h, h];
    },
    relax: true,
  });

const greedy = (grid) =>
  bestFirst(grid, { priority: (g, n) => [grid.distance(n, grid.end), 0], relax: false });

function bidirectional(grid) {
  const { size, start, end } = grid;
  const ops = [];
  const side = (origin, visitOp) => {
    const prev = new Int32Array(size).fill(-1);
    const dist = new Int32Array(size).fill(-1);
    dist[origin] = 0;
    return { prev, dist, front: [origin], visitOp };
  };
  const a = side(start, OP.VISIT);
  const b = side(end, OP.VISIT_ALT);

  if (start === end) return { ops, path: [start] };

  let best = Infinity;
  let meet = null;
  let turn = a;

  while (a.front.length && b.front.length && !meet) {
    const other = turn === a ? b : a;
    const next = [];
    for (const c of turn.front) {
      ops.push(turn.visitOp, c);
      for (const n of grid.neighbors(c)) {
        if (other.dist[n] !== -1) {
          const total = turn.dist[c] + 1 + other.dist[n];
          if (total < best) {
            best = total;
            meet = turn === a ? [c, n] : [n, c];
          }
        }
        if (turn.dist[n] !== -1) continue;
        turn.dist[n] = turn.dist[c] + 1;
        turn.prev[n] = c;
        next.push(n);
        if (other.dist[n] === -1) ops.push(OP.FRONTIER, n);
      }
    }
    turn.front = next;
    turn = other;
  }

  if (!meet) return { ops, path: null };
  const [fromStart, fromEnd] = meet;
  const head = trace(a.prev, start, fromStart);
  const tail = trace(b.prev, end, fromEnd).reverse();
  return { ops, path: head.concat(tail) };
}

export const solvers = {
  astar: {
    name: 'A* search',
    desc: 'Dijkstra guided by a Manhattan-distance heuristic. Same optimal route, far fewer cells explored.',
    shortest: true,
    weighted: true,
    structure: 'Min-heap',
    complexity: 'O((V + E) log V)',
    goodFor: 'Games, maps and robots: any search with a known goal',
    run: astar,
  },
  dijkstra: {
    name: "Dijkstra's algorithm",
    desc: 'Always expands the cheapest known cell next, so it respects weights and finds the cheapest route.',
    shortest: true,
    weighted: true,
    structure: 'Min-heap',
    complexity: 'O((V + E) log V)',
    goodFor: 'Weighted graphs, or finding distances to every cell',
    run: dijkstra,
  },
  bfs: {
    name: 'Breadth-first search',
    desc: 'Explores in rings outward from the start. Shortest path when every step costs the same.',
    shortest: true,
    weighted: false,
    structure: 'Queue',
    complexity: 'O(V + E)',
    goodFor: 'Unweighted grids and graphs',
    run: bfs,
  },
  bidirectional: {
    name: 'Bidirectional BFS',
    desc: 'Two BFS waves, one from each end, meet in the middle. Explores roughly half the area.',
    shortest: true,
    weighted: false,
    structure: '2 queues',
    complexity: 'O(V + E)',
    goodFor: 'Large unweighted graphs where both ends are known',
    run: bidirectional,
  },
  greedy: {
    name: 'Greedy best-first',
    desc: 'Chases the heuristic alone. Very fast on open ground, easily fooled by walls and weights.',
    shortest: false,
    weighted: false,
    structure: 'Min-heap',
    complexity: 'O((V + E) log V)',
    goodFor: 'Quick, good-enough routes in open space',
    run: greedy,
  },
  dfs: {
    name: 'Depth-first search',
    desc: 'Follows one corridor to a dead end, then backtracks. Finds a path, rarely the shortest.',
    shortest: false,
    weighted: false,
    structure: 'Stack',
    complexity: 'O(V + E)',
    goodFor: 'Exploring everything, detecting cycles, carving mazes',
    run: dfs,
  },
};

export function pathCost(grid, path) {
  let total = 0;
  for (let k = 1; k < path.length; k++) total += grid.weights[path[k]];
  return total;
}
