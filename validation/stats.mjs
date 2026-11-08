/** Agreement and reliability statistics. No dependencies, verified in stats.test.mjs. */

function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5, ser = 1.000000000190015;
  tmp -= (x + 0.5) * Math.log(tmp);
  for (const cj of c) ser += cj / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function betacf(x, a, b) {
  const FPMIN = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
export function ibeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(x, a, b) / a : 1 - bt * betacf(1 - x, b, a) / b;
}

export const fCdf = (f, d1, d2) => (f <= 0 ? 0 : ibeta(d1 * f / (d1 * f + d2), d1 / 2, d2 / 2));

/** Two-sided p value for a t statistic. */
export const tP = (t, df) => ibeta(df / (df + t * t), df / 2, 0.5);

/** Upper-tail F quantile by bisection: fInv(0.975, d1, d2). */
export function fInv(p, d1, d2) {
  let lo = 0, hi = 1;
  while (fCdf(hi, d1, d2) < p && hi < 1e12) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (fCdf(mid, d1, d2) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Two-sided critical t, for example tInv(0.975, 10) = 2.228. */
export const tInv = (p, df) => Math.sqrt(fInv(2 * p - 1, 1, df));

const sum = xs => xs.reduce((a, b) => a + b, 0);
export const mean = xs => sum(xs) / xs.length;
export const sd = xs => {
  const m = mean(xs);
  return Math.sqrt(sum(xs.map(x => (x - m) ** 2)) / (xs.length - 1));
};

/**
 * ICC(2,1): two-way random effects, absolute agreement, single measurement,
 * with the Shrout-Fleiss / McGraw-Wong 95% CI. rows = subjects, columns = raters.
 * SEM is the agreement form, which includes systematic differences between columns.
 */
export function icc21(rows) {
  const n = rows.length, k = rows[0]?.length ?? 0;
  if (n < 3 || k < 2) return null;
  const grand = mean(rows.flat());
  const rowM = rows.map(mean);
  const colM = Array.from({ length: k }, (_, j) => mean(rows.map(r => r[j])));
  const ssR = k * sum(rowM.map(m => (m - grand) ** 2));
  const ssC = n * sum(colM.map(m => (m - grand) ** 2));
  const ssT = sum(rows.flat().map(x => (x - grand) ** 2));
  const ssE = ssT - ssR - ssC;
  const msR = ssR / (n - 1), msC = ssC / (k - 1), msE = ssE / ((n - 1) * (k - 1));
  const denom = msR + (k - 1) * msE + k * (msC - msE) / n;
  if (!(denom > 0)) return null;
  const icc = (msR - msE) / denom;
  const sem = Math.sqrt(Math.max(0, (msC - msE) / n) + msE);
  const out = { icc, lower: null, upper: null, n, k, msR, msC, msE, sem, mdc95: 1.96 * Math.SQRT2 * sem };
  if (msE <= 0 || icc >= 1) return { ...out, lower: icc, upper: icc };
  const a = k * icc / (n * (1 - icc));
  const b = 1 + k * icc * (n - 1) / (n * (1 - icc));
  const v = (a * msC + b * msE) ** 2 / ((a * msC) ** 2 / (k - 1) + (b * msE) ** 2 / ((n - 1) * (k - 1)));
  const fc = fInv(0.975, n - 1, v), fd = fInv(0.975, v, n - 1);
  const term = k * msC + (k * n - k - n) * msE;
  out.lower = n * (msR - fc * msE) / (fc * term + n * msR);
  out.upper = n * (fd * msR - msE) / (term + n * fd * msR);
  return out;
}

/**
 * ICC(3,1): two-way mixed effects, consistency, with its exact F-based 95% CI.
 *
 * Used for the validity criterion. With two methods the method effect has one
 * degree of freedom, so the ICC(2,1) confidence bound stays low for any non-zero
 * bias however large the sample. Bias is judged by the limits of agreement, and
 * this criterion answers the separate question of whether the two methods rank
 * subjects alike.
 */
export function icc31(rows) {
  const base = icc21(rows);
  if (!base) return null;
  const { n, k, msR, msE } = base;
  const icc = (msR - msE) / (msR + (k - 1) * msE);
  if (msE <= 0) return { icc, lower: icc, upper: icc };
  const F = msR / msE, df1 = n - 1, df2 = (n - 1) * (k - 1);
  const FL = F / fInv(0.975, df1, df2), FU = F * fInv(0.975, df2, df1);
  return { icc, lower: (FL - 1) / (FL + k - 1), upper: (FU - 1) / (FU + k - 1) };
}

/** Bland-Altman agreement of test minus reference, with exact-formula CIs (1999). */
export function blandAltman(test, ref) {
  const n = test.length;
  if (n < 3) return null;
  const diffs = test.map((x, i) => x - ref[i]);
  const avgs = test.map((x, i) => (x + ref[i]) / 2);
  const bias = mean(diffs), s = sd(diffs);
  const t = tInv(0.975, n - 1);
  const seBias = s / Math.sqrt(n), seLoa = Math.sqrt(3 * s * s / n);
  const loaLower = bias - 1.96 * s, loaUpper = bias + 1.96 * s;
  // Proportional bias: slope of the differences on the means.
  const ma = mean(avgs);
  const sxx = sum(avgs.map(a => (a - ma) ** 2));
  const slope = sxx > 0 ? sum(avgs.map((a, i) => (a - ma) * (diffs[i] - bias))) / sxx : 0;
  const resid = diffs.map((d, i) => d - bias - slope * (avgs[i] - ma));
  const se = n > 2 && sxx > 0 ? Math.sqrt(sum(resid.map(r => r * r)) / (n - 2) / sxx) : 0;
  const slopeP = se > 0 ? tP(slope / se, n - 2) : null;
  return {
    n, bias, sdDiff: s,
    biasLower: bias - t * seBias, biasUpper: bias + t * seBias,
    loaLower, loaUpper,
    loaLowerCiLow: loaLower - t * seLoa, loaLowerCiHigh: loaLower + t * seLoa,
    loaUpperCiLow: loaUpper - t * seLoa, loaUpperCiHigh: loaUpper + t * seLoa,
    maxAbsError: Math.max(Math.abs(loaLower), Math.abs(loaUpper)),
    mae: mean(diffs.map(Math.abs)),
    slope, slopeP,
    points: avgs.map((a, i) => ({ mean: a, diff: diffs[i] })),
  };
}

/** Subjects for ICC reliability testing (Walter, Eliasziw and Donner 1998). */
export function walterN(rho0, rho1, k, zAlpha, zBeta) {
  const th0 = rho0 / (1 - rho0), th1 = rho1 / (1 - rho1);
  const c0 = (1 + k * th0) / (1 + k * th1);
  return Math.ceil(1 + 2 * (zAlpha + zBeta) ** 2 * k / (Math.log(c0) ** 2 * (k - 1)));
}
