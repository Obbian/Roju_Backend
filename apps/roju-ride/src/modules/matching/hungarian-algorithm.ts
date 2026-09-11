// Classic O(n^2 * m) Kuhn-Munkres (Hungarian algorithm) — solves the assignment problem:
// given cost[row][col], find the one-to-one row->col assignment that minimizes total cost.
// This is the same technique Uber's Marketplace batch-matching uses to pick the globally
// cheapest set of rider-driver pairs in one pass, instead of greedily giving each ride
// whichever driver happens to be nearest at the moment it's considered (which can "steal"
// a driver from a ride that would have been a much better match a few requests later).
//
// Requires a square matrix internally — non-square inputs (unequal ride/driver counts) are
// padded with UNREACHABLE_COST by the caller before this runs.
export function solveAssignment(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  const m = cost[0].length;
  const INF = Number.MAX_SAFE_INTEGER / 2;

  // 1-indexed arrays — this is the standard/canonical form of the algorithm.
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0); // p[j] = row currently assigned to column j (0 = none)
  const way = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = -1;
      for (let j = 1; j <= m; j++) {
        if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  // assignment[rowIndex] = colIndex (0-based), or -1 if that row never got assigned (only
  // possible if m < n and this row landed on none of the real columns — doesn't happen once
  // the caller has padded to a square matrix, but kept defensive).
  const assignment = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) {
    if (p[j] > 0) {
      assignment[p[j] - 1] = j - 1;
    }
  }
  return assignment;
}

// Pads a possibly-rectangular cost matrix to square with `sentinelCost`, so callers with
// unequal ride/driver counts don't have to hand-roll the padding themselves.
export function padToSquare(cost: number[][], sentinelCost: number): number[][] {
  const rows = cost.length;
  const cols = rows === 0 ? 0 : cost[0].length;
  const size = Math.max(rows, cols);
  if (size === rows && size === cols) return cost;

  const padded: number[][] = [];
  for (let i = 0; i < size; i++) {
    const row = i < rows ? [...cost[i]] : new Array(cols).fill(sentinelCost);
    while (row.length < size) row.push(sentinelCost);
    padded.push(row);
  }
  return padded;
}
