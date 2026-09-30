import { WEIGHT } from './grid.js';

export const OP = {
  CARVE: 0,
  WALL: 1,
  WEIGHT: 2,
  FRONTIER: 3,
  VISIT: 4,
  VISIT_ALT: 5,
  PATH: 6,
  HEAD: 7,
};

export class GenRecorder {
  constructor(grid) {
    this.grid = grid;
    this.ops = [];
  }

  carve(i) {
    this.grid.walls[i] = 0;
    this.ops.push(OP.CARVE, i);
  }

  wall(i) {
    this.grid.walls[i] = 1;
    this.grid.weights[i] = 1;
    this.ops.push(OP.WALL, i);
  }

  weight(i) {
    this.grid.weights[i] = WEIGHT;
    this.ops.push(OP.WEIGHT, i);
  }

  mark(i) {
    this.ops.push(OP.FRONTIER, i);
  }

  unmark(i) {
    this.ops.push(OP.WALL, i);
  }

  head(i) {
    this.ops.push(OP.HEAD, i);
  }
}
