export class MinHeap {
  constructor(less) {
    this.less = less;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(a[i], a[parent])) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let min = i;
        if (l < a.length && this.less(a[l], a[min])) min = l;
        if (r < a.length && this.less(a[r], a[min])) min = r;
        if (min === i) break;
        [a[i], a[min]] = [a[min], a[i]];
        i = min;
      }
    }
    return top;
  }
}

export class DisjointSet {
  constructor(size) {
    this.parent = Int32Array.from({ length: size }, (_, i) => i);
    this.rank = new Uint8Array(size);
  }

  find(x) {
    const p = this.parent;
    while (p[x] !== x) {
      p[x] = p[p[x]];
      x = p[x];
    }
    return x;
  }

  union(a, b) {
    a = this.find(a);
    b = this.find(b);
    if (a === b) return false;
    if (this.rank[a] < this.rank[b]) [a, b] = [b, a];
    this.parent[b] = a;
    if (this.rank[a] === this.rank[b]) this.rank[a]++;
    return true;
  }
}
