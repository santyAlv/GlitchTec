/* ============================================================
   Glitch.TEC — modelos 3D detallados del Servicio Técnico
   ------------------------------------------------------------
   Modela con más geometría (tornos, extrusiones, cables, biseles)
   cada pieza y herramienta del banco, con las MISMAS medidas, el
   mismo origen y la misma orientación que las cajas de
   js/bench3d.js, así el juego las ubica sin tocar nada más.

   Uso (desde la carpeta del proyecto):
       node tools/modelar_piezas.js            -> EntidadesGraficas/diseños3d/propuesta/
       node tools/modelar_piezas.js --aplicar  -> EntidadesGraficas/diseños3d/piezas/ (lo que lee el juego)

   Unidades al modelar: milímetros, eje Y hacia arriba (como el OBJ).
   El OBJ sale en metros, con normales (vn) para que lo curvo se vea liso.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const BASE3D = path.join(RAIZ, 'EntidadesGraficas', 'diseños3d');
const APLICAR = process.argv.includes('--aplicar');
const SALIDA = path.join(BASE3D, APLICAR ? 'piezas' : 'propuesta');
const ESC = 0.001;
const PI = Math.PI;

/* ---------------- vectores y matrices (por columnas) ---------------- */
const resta = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const suma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const por = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const largo = a => Math.sqrt(punto(a, a));
const unit = a => { const l = largo(a); return l > 1e-12 ? por(a, 1 / l) : [0, 0, 0]; };

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
const ap = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
];
const ID = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

let M = ID();
const pila = [];
const push = () => pila.push(M.slice());
const pop = () => { M = pila.pop(); };
const mover = (x, y, z) => { M = mul(M, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); };
const girarX = a => { const c = Math.cos(a), s = Math.sin(a); M = mul(M, [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const girarY = a => { const c = Math.cos(a), s = Math.sin(a); M = mul(M, [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
const girarZ = a => { const c = Math.cos(a), s = Math.sin(a); M = mul(M, [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };
const escalar = (x, y, z) => { M = mul(M, [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]); };
/** El eje Y local pasa a apuntar hacia d. */
function alinearY(d) {
  const y = unit(d);
  const x = unit(cruz(Math.abs(y[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], y));
  const z = cruz(x, y);
  M = mul(M, [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]);
}
const en = (x, y, z, fn) => { push(); mover(x, y, z); fn(); pop(); };

/* ---------------- formas ---------------- */
let FORMAS = [];
let MAT = 'mat_808080';
const color = hex => { MAT = 'mat_' + hex.toLowerCase(); };

/** Agrega una malla cerrada (en coordenadas locales). Las caras se
    orientan solas hacia afuera: si el volumen sale negativo, se dan vuelta. */
function agregar(v, f) {
  const w = v.map(q => ap(M, q));
  let vol = 0;
  for (const c of f) for (let k = 1; k < c.i.length - 1; k++) vol += punto(w[c.i[0]], cruz(w[c.i[k]], w[c.i[k + 1]]));
  if (vol < 0) f.forEach(c => c.i.reverse());
  FORMAS.push({ mat: MAT, v: w, f });
}

function caja(w, h, d) {
  const v = [];
  for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) for (const z of [-d / 2, d / 2]) v.push([x, y, z]);
  agregar(v, [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]].map(i => ({ i, s: false })));
}

/** Sólido de revolución alrededor de Y. perfil: [[radio, y], ...] de abajo hacia arriba.
    liso: suaviza también a lo largo del perfil. cerrado: el perfil es un lazo (aros, arandelas). */
function torno(perfil, n = 16, liso = false, cerrado = false) {
  const v = [], f = [];
  const anillo = ([r, y]) => {
    const b = v.length;
    for (let i = 0; i < n; i++) { const t = 2 * PI * i / n; v.push([r * Math.cos(t), y, -r * Math.sin(t)]); }
    return b;
  };
  const P = cerrado ? perfil.concat([perfil[0]]) : perfil;
  const primero = anillo(P[0]);
  let prev = primero;
  for (let j = 1; j < P.length; j++) {
    const a0 = (liso || j === 1) ? prev : anillo(P[j - 1]);
    const a1 = (cerrado && liso && j === P.length - 1) ? primero : anillo(P[j]);
    for (let i = 0; i < n; i++) { const k = (i + 1) % n; f.push({ i: [a0 + i, a0 + k, a1 + k, a1 + i], s: true }); }
    prev = a1;
  }
  const tapa = ([r, y], arriba) => {
    if (r <= 1e-4) return;
    const c = v.length;
    v.push([0, y, 0]);
    for (let i = 0; i < n; i++) { const t = 2 * PI * i / n; v.push([r * Math.cos(t), y, -r * Math.sin(t)]); }
    for (let i = 0; i < n; i++) { const a = c + 1 + i, b = c + 1 + (i + 1) % n; f.push({ i: arriba ? [c, a, b] : [c, b, a], s: false }); }
  };
  if (!cerrado) { tapa(P[0], false); tapa(P[P.length - 1], true); }
  agregar(v, f);
}
const cilindro = (r, h, n = 16, r2 = r) => torno([[r, -h / 2], [r2, h / 2]], n);
const aro = (ri, re, h, n = 24) => torno([[ri, -h / 2], [re, -h / 2], [re, h / 2], [ri, h / 2]], n, false, true);
function capsula(r, L, n = 12) {
  const P = [];
  for (let j = 0; j <= 3; j++) { const a = (PI / 2) * j / 3; P.push([r * Math.sin(a), -L / 2 + r - r * Math.cos(a)]); }
  for (let j = 0; j <= 3; j++) { const a = (PI / 2) * j / 3; P.push([r * Math.cos(a), L / 2 - r + r * Math.sin(a)]); }
  torno(P, n, true);
}
function capsulaEntre(a, b, r, aplanar = 1, n = 12) {
  push(); mover((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  alinearY(resta(b, a)); if (aplanar !== 1) escalar(1, 1, aplanar);
  capsula(r, largo(resta(b, a)), n);
  pop();
}

/* polígonos 2D */
const area = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
const giro2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function orejas(poly) {           // triangulación por orejas (polígono antihorario, sin agujeros)
  const idx = poly.map((_, i) => i), tris = [];
  let vueltas = 0;
  while (idx.length > 3 && vueltas++ < 2000) {
    let corto = false;
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length];
      const a = poly[i0], b = poly[i1], c = poly[i2];
      if (giro2(a, b, c) <= 1e-9) continue;
      if (idx.some(j => j !== i0 && j !== i1 && j !== i2 &&
          giro2(a, b, poly[j]) >= 0 && giro2(b, c, poly[j]) >= 0 && giro2(c, a, poly[j]) >= 0)) continue;
      tris.push([i0, i1, i2]); idx.splice(k, 1); corto = true; break;
    }
    if (!corto) break;
  }
  if (idx.length === 3) tris.push(idx.slice());
  return tris;
}
/** Rectángulo con esquinas redondeadas (seg = 1 da un chaflán). */
function redondeado(w, h, r, seg = 4) {
  const pts = [];
  const cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, PI / 2], [-w / 2 + r, -h / 2 + r, PI], [w / 2 - r, -h / 2 + r, 3 * PI / 2]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= seg; i++) {
    const a = a0 + (PI / 2) * i / seg;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
/** Extruye un polígono del plano XY a lo largo de Z (centrado). */
function extruir(poly, d, liso = false) {
  if (area(poly) < 0) poly = poly.slice().reverse();
  const n = poly.length, v = [], f = [], z0 = -d / 2, z1 = d / 2;
  if (liso) {
    poly.forEach(p => v.push([p[0], p[1], z0], [p[0], p[1], z1]));
    for (let i = 0; i < n; i++) { const k = (i + 1) % n; f.push({ i: [2 * i, 2 * k, 2 * k + 1, 2 * i + 1], s: true }); }
  } else {
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n], q = v.length;
      v.push([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]);
      f.push({ i: [q, q + 1, q + 2, q + 3], s: false });
    }
  }
  const tris = orejas(poly);
  let q = v.length; poly.forEach(p => v.push([p[0], p[1], z1])); tris.forEach(t => f.push({ i: t.map(i => q + i), s: false }));
  q = v.length; poly.forEach(p => v.push([p[0], p[1], z0])); tris.forEach(t => f.push({ i: t.map(i => q + i).reverse(), s: false }));
  agregar(v, f);
}
/** Placa horizontal: polígono en el plano XZ (del mundo), de y0 a y1. */
function placa(pts, y0, y1, liso = false) {
  push(); mover(0, (y0 + y1) / 2, 0); girarX(-PI / 2);
  extruir(pts.map(([x, z]) => [x, -z]), y1 - y0, liso);
  pop();
}
/** Placa vertical mirando a X: polígono en el plano ZY, de x0 a x1. */
function placaX(pts, x0, x1, liso = false) {
  push(); mover((x0 + x1) / 2, 0, 0); girarY(PI / 2);
  extruir(pts.map(([z, y]) => [-z, y]), x1 - x0, liso);
  pop();
}

/** Tubo que sigue una curva suave por los puntos dados (cables, heatpipes). */
function cable(pts, r, n = 8, pasos = 4) {
  const P = [];
  for (let i = 0; i < pts.length - 1; i++) {          // Catmull-Rom
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let s = 0; s < pasos; s++) {
      const t = s / pasos, t2 = t * t, t3 = t2 * t;
      P.push([0, 1, 2].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  P.push(pts[pts.length - 1]);
  const v = [], f = [];
  let nrm = null;
  P.forEach((p, j) => {
    const t = unit(resta(P[Math.min(j + 1, P.length - 1)], P[Math.max(j - 1, 0)]));
    nrm = nrm ? unit(resta(nrm, por(t, punto(nrm, t)))) : unit(cruz(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const b = cruz(t, nrm);
    for (let i = 0; i < n; i++) { const a = 2 * PI * i / n; v.push(suma(p, suma(por(nrm, r * Math.cos(a)), por(b, r * Math.sin(a))))); }
  });
  for (let j = 0; j < P.length - 1; j++)
    for (let i = 0; i < n; i++) { const k = (i + 1) % n; f.push({ i: [j * n + i, j * n + k, (j + 1) * n + k, (j + 1) * n + i], s: true }); }
  const ult = (P.length - 1) * n;
  f.push({ i: [...Array(n).keys()].reverse(), s: false });
  f.push({ i: [...Array(n).keys()].map(i => ult + i), s: false });
  agregar(v, f);
}

/* ---------------- piezas compartidas ---------------- */
/** Ventilador en el plano XY, eje hacia +Z, centro en el origen. */
function ventilador(R, palas, colPala, colCubo, paso = 0.38) {
  color('1b1f23'); en(0, 0, 0, () => { girarX(PI / 2); cilindro(R * 0.32, 5, 20); });
  color(colCubo); en(0, 0, 2.6, () => { girarX(PI / 2); cilindro(R * 0.24, 0.4, 20); });
  color(colPala);
  const r0 = R * 0.28;
  /* Aspa en forma de hoz: angosta en el cubo, ancha y curvada en la punta. */
  const pala = [[r0, -0.08 * R], [0.5 * R, -0.2 * R], [0.82 * R, -0.34 * R], [0.98 * R, -0.24 * R], [R, -0.02 * R],
                [0.9 * R, 0.14 * R], [0.62 * R, 0.12 * R], [r0, 0.1 * R]];
  for (let k = 0; k < palas; k++) { push(); girarZ(k * 2 * PI / palas); girarX(paso); extruir(pala, 1.2); pop(); }
}
/** Display de 7 segmentos acostado (arriba = -Z), para el tester. */
const SEG = { 0: 'abcdef', 1: 'bc', 3: 'abcdg', 8: 'abcdefg' };
function digito(ch, cx, y, cz, w = 4.2, h = 7, g = 0.8) {
  const s = SEG[ch], m = h / 2;
  if (s.includes('a')) en(cx, y, cz - m, () => caja(w, 0.3, g));
  if (s.includes('g')) en(cx, y, cz, () => caja(w, 0.3, g));
  if (s.includes('d')) en(cx, y, cz + m, () => caja(w, 0.3, g));
  if (s.includes('b')) en(cx + w / 2, y, cz - m / 2, () => caja(g, 0.3, m));
  if (s.includes('c')) en(cx + w / 2, y, cz + m / 2, () => caja(g, 0.3, m));
  if (s.includes('e')) en(cx - w / 2, y, cz + m / 2, () => caja(g, 0.3, m));
  if (s.includes('f')) en(cx - w / 2, y, cz - m / 2, () => caja(g, 0.3, m));
}

/* ============================================================
   Los modelos. Cada uno con el origen donde el juego ubica la pieza.
   Herramientas: acostadas sobre la mesa (la mesa queda en y = -8),
   la punta o el frente hacia -Z (lejos del jugador).
   ============================================================ */
const MODELOS = {};
const modelo = (nombre, fn) => { MODELOS[nombre] = fn; };

modelo('herr_destornillador', () => {
  push(); girarX(PI / 2);                       // el eje del torno (Y) pasa a ser Z
  color('c45434');
  torno([[5.4, -16], [7, -11], [7.6, -4], [7.6, 30], [7.3, 38], [6.2, 43.5], [3.5, 45.6], [0, 46]], 20, true);
  color('1d2125');                              // goma del grip
  for (let k = 0; k < 6; k++) { push(); girarY(k * PI / 3 + PI / 6); mover(7.4, 13, 0); caja(1.8, 30, 3.6); pop(); }
  aro(7.1, 7.9, 3, 20); en(0, 34.5, 0, () => aro(7.0, 7.6, 2.4, 20));
  color('dfe3e7');                              // virola
  torno([[2.4, -23], [4.6, -20], [5.6, -17], [5.6, -15.5]], 16);
  color('b9bfc6');                              // vástago y punta
  torno([[0.35, -75], [1.6, -71], [2.3, -66], [2.3, -22]], 12);
  color('8e959c');                              // cruz Phillips
  for (const a of [0, PI / 2]) {
    push(); girarY(a); extruir([[-2.3, -69], [2.3, -69], [0.5, -75], [-0.5, -75]], 1); pop();
  }
  pop();
});

modelo('herr_aire', () => {
  color('4696be');                              // lata
  torno([[11.5, -8], [13, -6.6], [13, 30], [12.4, 32]], 22, true);
  color('cfd6db');
  torno([[12.4, 32], [10.5, 35.5], [7, 38], [5.5, 38.8]], 22, true);
  torno([[5.8, 38.6], [6.2, 40.2], [4.2, 40.8]], 16);
  color('eef3f5'); en(0, 14, 0, () => aro(12.8, 13.3, 20, 22));          // etiqueta
  color('2b4f66'); en(0, 10, 0, () => aro(12.9, 13.45, 3, 22));
  en(0, 20, 0, () => aro(12.9, 13.45, 1.2, 22));
  color('1f2428');                              // pulsador y boquilla
  en(0, 44, 0, () => cilindro(4.8, 7, 16));
  en(0, 47.9, 0, () => cilindro(3.6, 1, 16));
  en(6.5, 45, 0, () => { girarZ(-PI / 2); cilindro(1.9, 5, 10); });
  color('d23b32');                              // pajita roja
  en(24, 45, 0, () => { girarZ(-PI / 2); cilindro(0.9, 32, 8); });
});

modelo('herr_alcohol', () => {
  push(); mover(-9, 0, 0);
  color('96c4d2');
  torno([[10.5, -8], [12, -6.6], [12, 24], [11.2, 28.5], [7, 33], [5.2, 34.5]], 22, true);
  color('f2f5f6'); en(0, 10, 0, () => aro(11.8, 12.3, 20, 22));            // etiqueta
  color('2c6e8f'); en(0, 6, 0, () => aro(12, 12.5, 4, 22));
  en(0, 14, 0, () => aro(12, 12.45, 1.2, 22));
  color('5a6e78'); torno([[5.6, 34], [5.6, 40.5], [4.8, 41.5], [0, 41.6]], 16, true);
  color('e8ecee'); en(0, 43, 0, () => cilindro(1.4, 3, 10));
  pop();
  push(); mover(19, -4.8, 2); girarX(PI / 2);   // pincel antiestático acostado, cerdas hacia -Z
  color('aa9664'); torno([[2.6, -5], [2.4, 22], [1.8, 30], [0, 31]], 12, true);
  color('c9ced3'); torno([[3, -14], [3, -5], [2.4, -3]], 12);
  color('2a2c2e'); torno([[2.4, -27], [3.2, -21], [3, -14]], 10);
  pop();
});

modelo('herr_pasta', () => {
  push(); mover(0, -1.8, 0); girarX(PI / 2);    // jeringa acostada, pico hacia -Z
  const R = 6.2;
  color('8f969c'); torno([[R, -24], [R, 18]], 18);
  color('eef1f3'); en(0, -3, 0, () => aro(R - 0.3, R + 0.35, 22, 18));
  color('2b2f33'); en(0, -8, 0, () => aro(R + 0.1, R + 0.45, 4, 18));
  color('c3c8cd'); torno([[1.6, -36], [1.6, -33], [4, -28], [R, -24]], 14);
  color('3a4148'); torno([[2.4, -42], [2.8, -41], [2.8, -35]], 12);
  color('dfe3e6'); en(0, 19, 0, () => { girarX(PI / 2); extruir(redondeado(24, 12, 5), 2.2, true); });
  color('e9ecef'); en(0, 27, 0, () => { caja(1.4, 16, 8); caja(8, 16, 1.4); });
  en(0, 35.5, 0, () => cilindro(5.5, 1.6, 16));
  pop();
});

modelo('herr_tester', () => {
  color('dcaa28'); en(0, 0, 0, () => { girarX(-PI / 2); extruir(redondeado(54, 78, 8), 16, true); });
  color('2b2f33'); en(0, 8.6, -1, () => { girarX(-PI / 2); extruir(redondeado(44, 66, 5), 1.2, true); });
  color('16191c'); en(0, 9.4, -20, () => caja(36, 0.8, 17));             // marco del display
  color('a9c08f'); en(0, 9.9, -20, () => caja(32, 0.4, 13));             // LCD
  color('1f2a1c'); digito(3, -9, 10.2, -20); digito(3, -1.5, 10.2, -20); digito(0, 6, 10.2, -20);
  en(-5, 10.2, -16.2, () => caja(0.9, 0.3, 0.9));                         // coma: "3.30"
  color('3d7fd6'); en(-9, 9.6, -6, () => caja(9, 1.4, 4));                // botones
  color('e8c13a'); en(9, 9.6, -6, () => caja(9, 1.4, 4));
  color('16191c'); en(0, 9.4, 9, () => cilindro(12, 1.6, 24));           // perilla
  color('3a4046'); en(0, 10.8, 9, () => cilindro(9.5, 2.4, 22));
  color('e7ebee'); en(0, 12.4, 9, () => { girarY(0.6); caja(17, 2, 3.2); });
  for (let k = 0; k < 9; k++) { push(); mover(0, 9.5, 9); girarY(-2.2 + k * 0.55); mover(13.6, 0, 0); caja(2.6, 0.5, 0.8); pop(); }
  [[-13, '3a4046'], [0, '16191c'], [13, 'c8322c']].forEach(([x, c]) => {   // bornes 10A / COM / VΩ
    color(c); en(x, 9.4, 28, () => cilindro(3.6, 2, 14));
    color('0b0d0f'); en(x, 10.5, 28, () => cilindro(1.6, 0.4, 10));
  });
  const sonda = (x, c) => {
    push(); mover(x, -5.4, 0); girarX(PI / 2);
    color('c9ced3'); torno([[0.2, -44], [0.7, -41], [0.7, -30]], 8);
    color(c); torno([[1.6, -30], [2.4, -27], [3.6, -25.5], [3.6, -24], [2.6, -23], [2.8, 6], [2.2, 12], [1.4, 15]], 12, true);
    pop();
  };
  sonda(-36, '1d2125'); sonda(36, 'c8322c');
  color('1d2125'); cable([[0, 10.5, 28], [-6, 16, 36], [-24, 10, 42], [-36, -4, 30], [-36, -5.4, 15]], 1.2, 6);
  color('c8322c'); cable([[13, 10.5, 28], [17, 16, 36], [28, 10, 42], [36, -4, 30], [36, -5.4, 15]], 1.2, 6);
});

modelo('herr_respaldo', () => {
  color('78be82'); en(0, -2, 0, () => { girarX(-PI / 2); extruir(redondeado(60, 80, 9), 12, true); });
  color('2c3236'); en(0, 4.4, 0, () => { girarX(-PI / 2); extruir(redondeado(52, 72, 6), 1.2, true); });
  color('9aa3ab'); en(0, 5.1, -18, () => caja(30, 0.3, 1.2));
  color('78be82'); en(0, 5.1, -26, () => caja(14, 0.3, 4));
  color('7ee8ff'); en(20, 5.1, 32, () => cilindro(1.3, 0.5, 10));        // luz de actividad
  color('121518'); en(-10, -2, 40.2, () => caja(9, 3.4, 0.8));           // puerto USB
  color('202427');
  cable([[-10, -2, 40.5], [-10, -2, 45], [-16, -4.5, 47], [-34, -6.6, 42], [-37, -6.6, 20], [-37, -6.6, 8]], 1.4, 6);
  en(-37, -5, 0, () => caja(11, 6, 16));                                   // ficha USB-A
  color('c9ced3'); en(-37, -5, -12, () => caja(12, 4.6, 9));
});

modelo('herr_crimpeadora', () => {
  color('8e959c');                              // cabezal
  placa([[-15, -47], [15, -47], [17, -36], [14, -18], [7, -10], [-7, -10], [-14, -18], [-17, -36]], -8, 2);
  color('1b1f22');                              // matrices 8P / 6P y cuchilla
  en(-6, 2.2, -38, () => caja(9, 0.6, 6)); en(6, 2.2, -38, () => caja(7, 0.6, 5));
  en(0, 2.2, -27, () => caja(22, 0.6, 1.2));
  color('d4af37'); for (let k = 0; k < 4; k++) en(-8.4 + k * 1.6, 2.6, -38, () => caja(0.6, 0.3, 4));
  color('d5dade'); en(0, 2.8, -14, () => cilindro(4.2, 1.6, 16));          // perno
  color('6b7279'); en(0, 3.7, -14, () => caja(4.5, 0.4, 1));
  placa([[-9, -12], [-3, -12], [-8, 20], [-14, 20]], -6.5, 0);             // brazos
  placa([[3, -12], [9, -12], [14, 20], [8, 20]], -6.5, 0);
  en(0, -2.5, -4, () => caja(6, 4, 8));                                    // trinquete
  color('be3c46');                              // mangos de goma
  capsulaEntre([-11, -3, 16], [-15.5, -3, 47], 5, 0.75);
  capsulaEntre([11, -3, 16], [15.5, -3, 47], 5, 0.75);
});

modelo('herr_lantester', () => {
  color('5078c8'); en(-10, -0.5, 4, () => { girarX(-PI / 2); extruir(redondeado(36, 64, 7), 15, true); });
  color('22272c'); en(-10, 7.6, 6, () => { girarX(-PI / 2); extruir(redondeado(28, 50, 4), 1.2, true); });
  for (let k = 0; k < 9; k++) {                 // luces 1..8 y G
    color(k === 8 ? 'e8c13a' : '46dc6e'); en(-16, 8.4, -16 + k * 5, () => cilindro(1.5, 1.2, 8));
    color('cfd6db'); en(-11.5, 8.3, -16 + k * 5, () => caja(2.6, 0.3, 0.7));
  }
  color('16191c'); en(-3, 8.3, 20, () => caja(6, 0.6, 12));               // llave de encendido
  color('e7ebee'); en(-3, 9, 17, () => caja(5, 1.4, 4));
  color('d23b32'); en(-3, 8.5, 2, () => cilindro(1.2, 0.8, 8));
  color('3f63aa'); en(22, -1, 5, () => { girarX(-PI / 2); extruir(redondeado(20, 46, 5), 14, true); });   // unidad remota
  color('22272c'); en(22, 6.4, 6, () => { girarX(-PI / 2); extruir(redondeado(14, 36, 3), 1, true); });
  color('46dc6e'); for (let k = 0; k < 8; k++) en(22, 7.2, -10 + k * 4, () => cilindro(1.2, 1, 8));
  color('0b0d0f'); en(-10, -1, -28.6, () => caja(12, 9, 1.4)); en(22, -2, -18.6, () => caja(11, 8, 1.4));   // bocas RJ45
  color('e8c53a');                              // cable de prueba
  cable([[-10, -1, -32], [-10, -1, -37], [-4, 0, -44], [16, 0, -41], [22, -2, -29], [22, -2, -23]], 1.6, 8);
  color('dfe9ee'); en(-10, -1, -32.5, () => caja(7, 6, 8)); en(22, -2, -22, () => caja(7, 6, 7));
});

modelo('herr_pila', () => {
  color('e7e3d6'); en(0, -7.2, 0, () => caja(32, 1.6, 48));              // cartón del blíster
  color('c8322c'); en(0, -6.3, -17, () => caja(32, 0.2, 14));
  color('16191c'); en(0, -6.15, -20, () => cilindro(3.2, 0.3, 14));
  color('e7ebee'); en(-4, -6.15, -13.5, () => caja(14, 0.2, 1.6));
  color('cfd8de'); en(0, -5.2, 8, () => aro(11.6, 12.6, 2.4, 28));        // borde de la burbuja
  color('c4c8ce'); en(0, -6.4, 8, () => torno([[9.2, 0], [10, 0.4], [10, 2.8], [9.6, 3.2], [0, 3.2]], 28));
  color('e3e6e9'); en(0, -3.1, 8, () => { caja(5, 0.3, 1.2); caja(1.2, 0.3, 5); });
  color('8d949b'); en(0, -3.15, 12.5, () => caja(9, 0.15, 0.8));
});

modelo('herr_pinza', () => {
  color('8e959c');                              // mordazas
  placa([[-0.3, -52], [-0.3, -10], [-6, -10], [-5.4, -22], [-1.4, -51]], -7, -2);
  placa([[0.3, -52], [1.4, -51], [5.4, -22], [6, -10], [0.3, -10]], -7, -2);
  color('2a2f33'); en(0, -1.9, -30, () => caja(0.5, 0.3, 40));
  color('6b7279'); en(0, -4.5, -6, () => cilindro(7, 6, 18));              // articulación
  color('d5dade'); en(0, -1.2, -6, () => cilindro(3, 1, 12));
  color('6b7279');
  placa([[-6, -2], [-1.5, -2], [-8, 22], [-12.5, 22]], -7, -3);
  placa([[1.5, -2], [6, -2], [12.5, 22], [8, 22]], -7, -3);
  color('c8962a');                              // mangos
  capsulaEntre([-11, -4.6, 18], [-15.5, -4.6, 47], 3.4, 0.85);
  capsulaEntre([11, -4.6, 18], [15.5, -4.6, 47], 3.4, 0.85);
  color('a8322c'); en(-15.3, -4.6, 45, () => { alinearY([-0.15, 0, 1]); aro(3.2, 3.6, 2, 12); });
  en(15.3, -4.6, 45, () => { alinearY([0.15, 0, 1]); aro(3.2, 3.6, 2, 12); });
});

/* ---------------- equipo ---------------- */
modelo('fuente', () => {
  color('3e4a56'); extruir(redondeado(120, 86, 3, 1), 126);               // cuerpo con aristas en chaflán
  color('151a1e'); en(0, 0, 63.4, () => { girarX(PI / 2); cilindro(36, 1, 28); });
  color('c9ced3');                              // rejilla de alambre (el ventilador queda detrás, en z = 70)
  for (const r of [8, 16, 24, 32]) en(0, 0, 76, () => { girarX(PI / 2); aro(r - 0.7, r + 0.7, 1.2, 28); });
  for (const a of [PI / 4, -PI / 4]) en(0, 0, 76, () => { girarZ(a); caja(66, 1.2, 1.2); });
  for (const a of [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4])
    en(Math.cos(a) * 32, Math.sin(a) * 32, 69.5, () => { girarX(PI / 2); cilindro(0.8, 13, 6); });
  color('aeb5bb'); for (const x of [-48, 48]) for (const y of [-34, 34]) en(x, y, 64, () => { girarX(PI / 2); cilindro(2.2, 1.4, 10); });
  color('ece6cf'); en(-6, 43.3, -4, () => caja(78, 0.6, 72));             // etiqueta de arriba
  color('2a2f33'); for (let i = 0; i < 6; i++) en(-14, 43.7, -30 + i * 8, () => caja(46, 0.3, 1.4));
  color('e8c13a'); en(24, 43.7, 18, () => caja(20, 0.3, 20));
  color('16191c'); placa([[18, 25], [30, 25], [24, 13]], 43.8, 44.1);
  en(61.5, -18, 28, () => { girarZ(PI / 2); cilindro(9, 3, 16); });       // pasacables
  ['e8c13a', '16191c', 'c8322c', 'e8c13a', '16191c', 'f08a2c'].forEach((c, k) => {
    const dy = -22 + (k % 3) * 4, dz = 25 + Math.floor(k / 3) * 5;
    color(c); cable([[61, dy, dz], [72, dy, dz], [79, dy - 8, dz], [81, dy - 26, dz]], 1.5, 6);
  });
  color('1d2124'); en(81, -50, 27.5, () => caja(10, 12, 18));             // ficha de 24 pines
});

modelo('ventilador_fuente', () => ventilador(32, 7, '6d7b86', 'e8c13a', 0.34));
modelo('ventilador_cpu', () => ventilador(29, 9, '5d6a75', '4fd2ff', 0.4));

modelo('cpu_disipador', () => {
  color('b87333'); en(0, 0, -31, () => caja(40, 40, 6));                  // base de cobre
  color('b4bec6'); en(0, 0, -26, () => caja(84, 84, 4));
  for (let i = 0; i < 15; i++) en(-42 + i * 6, 0, 1, () => caja(1.6, 88, 50));   // aletas
  color('c47a45');                              // heatpipes
  for (const s of [-1, 1]) for (const y of [-22, 0, 22])
    cable([[s * 14, y, -29], [s * 40, y, -29], [s * 47, y, -22], [s * 47, y, 8], [s * 42, y, 20]], 2.6, 8, 3);
  color('202428');                              // marco del ventilador (cuatro cuartos)
  const cuarto = [[34, 0], [46, 0], [46, 46], [0, 46], [0, 34]];
  for (let j = 1; j < 6; j++) { const a = PI / 2 * j / 6; cuarto.push([34 * Math.sin(a), 34 * Math.cos(a)]); }
  for (let k = 0; k < 4; k++) en(0, 0, 32, () => { girarZ(k * PI / 2); extruir(cuarto, 12); });
  for (const a of [PI / 6, 5 * PI / 6, 3 * PI / 2]) en(0, 0, 28.5, () => { girarZ(a); mover(17, 0, 0); caja(34, 2.4, 2); });
  en(0, 0, 29.5, () => { girarX(PI / 2); cilindro(10, 3, 16); });
  color('c9ced3'); for (const x of [-39, 39]) for (const y of [-39, 39]) en(x, y, 38.4, () => { girarX(PI / 2); cilindro(2.6, 0.8, 10); });
  color('9aa1a8');                              // clip de retención
  for (const s of [-1, 1]) {
    en(0, s * 46.5, -18, () => caja(70, 2, 4));
    for (const x of [-36, 36]) en(x, s * 46.5, -26, () => caja(4, 2, 12));
  }
});

modelo('placa_madre', () => {
  const S = 5;                                  // cara de arriba de la placa
  color('1d4e3a'); en(0, 0, 2, () => caja(260, 240, 6));
  color('2f6e52');                              // pistas serigrafiadas
  for (const [x, y, w, h] of [[-20, -40, 150, 1], [60, -20, 1, 80], [-100, -60, 1, 90], [40, 110, 120, 1], [-70, -115, 90, 1]])
    en(x, y, S + 0.1, () => caja(w, h, 0.2));
  color('c9ced3');                              // agujeros de montaje
  for (const [x, y] of [[-122, 112], [122, 112], [-122, -112], [122, -112], [-122, -10], [122, -10]])
    en(x, y, S + 0.2, () => { girarX(PI / 2); aro(2, 4, 0.6, 14); });
  color('b9bfc6'); en(-35, 42, S + 2, () => caja(64, 64, 4));             // zócalo (queda bajo el disipador)
  color('8e959c'); en(15, 42, S + 3.5, () => caja(2.4, 56, 2.4)); en(15, 71, S + 3.5, () => caja(6, 3, 3));
  color('3a434b');                              // disipadores de VRM
  en(-35, 104, S + 5, () => caja(96, 14, 10));
  en(-92, 40, S + 5, () => caja(14, 96, 10));
  color('4a545e');
  for (let i = 0; i < 12; i++) en(-80 + i * 8, 104, S + 11, () => caja(2.4, 14, 2));
  for (let i = 0; i < 12; i++) en(-92, -4 + i * 8, S + 11, () => caja(14, 2.4, 2));
  color('4fd2ff'); en(-35, 96.6, S + 8, () => caja(90, 0.6, 3)); en(-84.6, 40, S + 8, () => caja(0.6, 90, 3));
  color('2a3036'); en(-115, 78, S + 9, () => extruir(redondeado(28, 76, 3, 1), 18));   // tapa del panel trasero
  color('4fd2ff'); en(-100.8, 78, S + 12, () => caja(0.6, 60, 2));
  color('1a1c1f'); for (const x of [52, 84]) en(x, 40, S + 3, () => caja(7, 124, 6));  // ranuras de RAM
  color('d8d8d8'); for (const x of [52, 84]) for (const y of [-23.5, 103.5]) en(x, y, S + 4, () => caja(6, 4, 8));
  color('e9e6dc'); en(122, 30, S + 5, () => caja(10, 56, 10));            // ATX 24 pines
  color('2a2f33'); for (let k = 0; k < 12; k++) for (const x of [119.5, 124.5]) en(x, 5 + k * 4.5, S + 10.2, () => caja(2.6, 2.6, 0.4));
  color('1a1c1f'); en(-48, -62, S + 4, () => caja(92, 7, 8));            // PCIe x16 (la de la placa de video)
  color('d8d8d8'); en(0, -62, S + 4.5, () => caja(4, 8, 9));
  color('7d858c'); en(-48, -100, S + 4, () => caja(92, 7, 8));           // PCIe x16 libre
  color('1a1c1f'); en(-78, -28, S + 3.5, () => caja(32, 6, 7));          // PCIe x1
  color('2c3238'); en(20, -100, S + 3.5, () => caja(30, 30, 7));         // chipset
  color('4fd2ff'); en(20, -100, S + 7.2, () => caja(16, 3, 0.6));
  for (let k = 0; k < 4; k++) {                                            // condensadores
    color('202428'); en(28, 50 + k * 13, S + 5, () => { girarX(PI / 2); cilindro(3.6, 10, 12); });
    color('aeb5bb'); en(28, 50 + k * 13, S + 10.2, () => { girarX(PI / 2); cilindro(3.2, 0.4, 12); });
  }
  color('16191c');                              // chips, SATA y cabezales
  en(-60, -30, S + 1, () => caja(14, 14, 2)); en(70, -40, S + 1, () => caja(10, 10, 2)); en(-20, -28, S + 1, () => caja(8, 8, 2));
  en(124, -40, S + 4, () => caja(8, 8, 8)); en(124, -52, S + 4, () => caja(8, 8, 8));
  color('e9e6dc'); en(-60, 116, S + 3, () => caja(10, 4, 5)); en(50, -114, S + 3, () => caja(12, 5, 5));
});

modelo('pila_cmos', () => {
  push(); girarX(PI / 2);                       // el torno mira al jugador (+Z)
  color('202428'); torno([[0, -3], [13, -3], [13, 1.8], [11.6, 1.8], [11.6, 0.2], [0, 0.2]], 28);   // portapila
  color('c4c8ce'); torno([[9.6, 0.2], [10.2, 0.6], [10.2, 3.4], [9.8, 3.8], [0, 3.8]], 28);
  pop();
  color('e3e6e9'); en(0, 0, 3.95, () => { caja(5, 1.2, 0.3); caja(1.2, 5, 0.3); });
  color('8d949b'); en(0, -5, 3.95, () => caja(9, 0.8, 0.2));
  color('aeb5bb'); en(0, 14, 0.6, () => caja(9, 1.2, 7)); en(0, 12, 4.4, () => caja(9, 4, 1));   // traba
});

modelo('ram', () => {
  for (const sx of [-16, 16]) {
    push(); mover(sx, 0, 0);
    color('1e4d3a'); en(0, -1, -8.5, () => caja(19, 114, 2));
    color('5c4284'); en(0, 6, -5, () => extruir(redondeado(19.5, 100, 2.5, 2), 5));   // disipador
    color('7a5aa8'); for (const x of [-6.5, 6.5]) en(x, 6, -2.2, () => caja(1.6, 92, 1));
    color('e9ecef'); en(0, 6, -2.2, () => caja(9, 30, 0.6));                // etiqueta
    color('a07ed6'); en(0, 54, -2.2, () => caja(17, 3, 1));
    color('d4af37'); for (let i = 0; i < 6; i++) en(-7.5 + i * 3, -52, -7.3, () => caja(2, 8, 0.4));
    pop();
  }
});

modelo('placa_video', () => {
  color('1f3b2c'); en(0, 4.6, 0, () => caja(200, 1.6, 62));
  color('d4af37'); en(-30, 4.6, -32.5, () => caja(76, 1.6, 3));           // dedos PCIe
  color('1f2226'); en(2, 6.6, 0, () => caja(196, 2, 60));                 // placa trasera
  color('0e1012'); for (let i = 0; i < 10; i++) en(-62 + i * 10, 7.7, 10, () => caja(5, 0.3, 30));
  color('9c4a72'); en(62, 7.75, -16, () => caja(50, 0.3, 4));
  color('3a3f47'); placa(redondeado(196, 62, 6, 1).map(([x, z]) => [x + 4, z]), -11, 3.8);   // carcasa
  color('9c4a72'); en(4, -3.6, 31.3, () => caja(150, 2, 0.6));
  color('121519'); for (const x of [-48, 48]) en(x, -11.3, 0, () => cilindro(26, 0.6, 28));
  color('2a2e34'); for (const x of [-48, 48]) en(x, -11.6, 0, () => aro(25, 27.5, 1, 28));
  for (const x of [-48, 48]) en(x, -9, 0, () => { girarX(PI / 2); ventilador(24, 9, '2e343a', '9c4a72', 0.32); });
  color('c47a45'); for (const y of [-2, -7]) cable([[56, y, 31.6], [88, y, 31.6], [97, y, 24], [97, y, -10]], 2.2, 8, 3);
  color('b8bfc6'); en(-103, -2, 0, () => caja(1.4, 26, 66));              // bracket
  color('16191c'); en(-104.2, -2, -18, () => caja(1, 6, 10)); en(-104.2, -2, -4, () => caja(1, 6, 10)); en(-104.2, -2, 11, () => caja(1, 5, 12));
  color('6e767e'); en(-104.2, 7, 0, () => caja(0.6, 3, 50));
  color('16191c'); en(80, 10.5, 18, () => caja(16, 6, 9));                // conector de alimentación
});

modelo('disco', () => {
  color('9aa1a8'); for (const s of [-1, 1]) en(0, s * 31, -16, () => caja(72, 2, 34));   // jaula
  color('7d858c'); en(-35, 0, -16, () => caja(2, 60, 34));
  color('8f969c'); en(0, 0, 10, () => extruir(redondeado(70, 58, 3, 2), 20));
  color('c3c9cf'); en(0, 0, 20.6, () => extruir(redondeado(66, 54, 4, 3), 1.2));
  color('d3d8dc'); en(-6, 2, 21.6, () => { girarX(PI / 2); cilindro(22, 0.8, 32); });
  color('f0eee6'); en(8, -12, 22.2, () => caja(40, 22, 0.4));            // etiqueta
  color('9c8a3c'); en(8, -4, 22.45, () => caja(40, 5, 0.3));
  color('2a2f33'); for (let i = 0; i < 10; i++) en(-6 + i * 2.2, -17, 22.45, () => caja(i % 3 ? 0.8 : 1.4, 7, 0.3));
  color('5d646b'); for (const [x, y] of [[-31, -25], [31, -25], [-31, 25], [31, 25], [31, 0]]) en(x, y, 21.4, () => { girarX(PI / 2); cilindro(1.6, 0.8, 10); });
  color('16191c'); en(-36, -8, 6, () => caja(3, 8, 6)); en(-36, 10, 6, () => caja(3, 14, 6));   // SATA
  color('c8322c'); cable([[-37, -8, 6], [-44, -8, 6], [-48, -14, 6], [-48, -28, 6]], 1.6, 6);
});

modelo('panel_frontal', () => {
  color('485662'); placaX(redondeado(76, 66, 5, 3), 9, 11, true);
  color('4fd2ff'); en(11, 14, 0, () => { girarZ(-PI / 2); aro(10.6, 12, 1.4, 24); });   // aro del botón
  color('38444f'); en(11, 14, 0, () => { girarZ(-PI / 2); torno([[10.5, 0], [10.5, 1.6], [9.6, 2.6], [0, 2.8]], 24, true); });
  color('e7ebee');                              // símbolo de encendido
  for (let k = 0; k < 9; k++) { const a = 0.75 + k * (2 * PI - 1.5) / 8; push(); mover(13.9, 14, 0); girarX(a); mover(0, 5, 0); caja(0.5, 1.1, 2); pop(); }
  en(13.9, 17.4, 0, () => caja(0.5, 5.5, 1.3));
  color('16191c'); en(11, -18, 0, () => { girarZ(-PI / 2); aro(5.2, 6.6, 1, 16); });     // aro de la luz
  for (const z of [-11, 11]) { color('0e1012'); en(11.2, -28, z, () => caja(0.6, 5, 13)); color('3d7fd6'); en(11.4, -27.2, z, () => caja(0.4, 1.4, 10)); }
  [[-24, '4caf50'], [24, 'e06fa0']].forEach(([z, c]) => { color(c); en(11, 27, z, () => { girarZ(-PI / 2); aro(1.4, 2.8, 1.4, 12); }); });
});

/* Placa trasera que comparten la fuente y la entrada de corriente. */
const chapaTrasera = (w, h) => { color('3a4552'); placaX(redondeado(w, h, 2, 1), -5.6, -3); };

modelo('fuente_trasera', () => {
  chapaTrasera(68, 72);
  color('101418');                              // panal de ventilación
  for (let r = 0; r < 7; r++) for (let c = 0; c < 6; c++) {
    const z = -28 + c * 8 + (r % 2) * 4, y = -30 + r * 7;
    if (z <= 14) en(-5.7, y, z, () => { girarZ(-PI / 2); cilindro(3.3, 0.6, 6); });
  }
  color('16191c'); en(-6, 18, 24, () => caja(3, 16, 11));                // interruptor 0 / I
  color('2a2f33'); en(-8, 18, 24, () => { girarZ(0.25); caja(2.4, 14, 9); });
  color('e7ebee'); en(-9.4, 22, 24, () => caja(0.3, 3, 1)); en(-8.6, 14, 24, () => caja(0.3, 2.4, 2.4));
  color('aeb5bb'); for (const y of [-31, 31]) for (const z of [-29, 29]) en(-5.8, y, z, () => { girarZ(-PI / 2); cilindro(2.2, 1.2, 10); });
});

modelo('entrada_corriente', () => {
  chapaTrasera(70, 72);
  const trap = (k) => [[-12, 10], [12, 10], [12, -4], [7, -10], [-7, -10], [-12, -4]].map(([a, b]) => [a * k, b * k]);
  color('16191c'); push(); mover(0, 4, 0); placaX(trap(1), -9, -5); pop();            // zócalo IEC
  color('202428'); push(); mover(0, 4, 0); placaX(trap(0.9), -27, -9, true); pop();   // ficha enchufada
  color('2c3136'); for (let k = 0; k < 4; k++) en(-18, 13.4, -6 + k * 4, () => caja(14, 0.8, 1.4));
  color('202428'); en(-27, 4, 0, () => { girarZ(PI / 2); torno([[6.5, 0], [4.5, 6], [3.4, 10]], 12, true); });
});

modelo('puertos_video', () => {
  color('384450'); placaX(redondeado(90, 92, 2, 1), -4.2, -3);
  color('9aa3ab'); en(-4.6, 26, 0, () => caja(0.8, 38, 88));             // escudo de la placa madre
  for (const y of [14, 22, 32, 40]) {
    color('16191c'); en(-5.4, y, -31, () => caja(1.2, 5.6, 13));
    color(y < 26 ? '3d7fd6' : 'e7ebee'); en(-6.1, y + 0.8, -31, () => caja(0.4, 1.6, 10));
  }
  color('16191c'); en(-5.6, 36, 33, () => caja(1.6, 12, 14));            // RJ45
  color('e8c13a'); en(-6.5, 40, 29.5, () => caja(0.3, 1.4, 2)); color('46dc6e'); en(-6.5, 40, 36.5, () => caja(0.3, 1.4, 2));
  [[10, '3d7fd6'], [16, '4caf50'], [22, 'e06fa0']].forEach(([y, c]) => { color(c); en(-5.2, y, 36, () => { girarZ(-PI / 2); aro(1.2, 2.4, 1.4, 12); }); });
  for (const y of [-10, -38]) {                 // tapas de ranuras
    color('aab2ba'); en(-4.8, y, 0, () => caja(0.8, 10, 86));
    color('2a3036'); for (let k = 0; k < 6; k++) en(-5.3, y, -30 + k * 12, () => caja(0.3, 5, 6));
  }
  color('7d858c'); en(-4.8, -26, 0, () => caja(0.8, 12, 86));            // bracket de la placa de video
  color('16191c'); for (const z of [-32, 32]) en(-5.4, -26, z, () => caja(1.2, 5, 10));
});

modelo('gabinete_chasis', () => {
  color('2c3842'); en(0, 0, -92, () => caja(300, 360, 10));
  color('242e38'); en(-152, 0, 0, () => caja(10, 360, 184));
  color('3a4650'); en(152, 0, 0, () => caja(10, 360, 184));
  color('28343e'); en(0, 182, 0, () => caja(300, 10, 184));
  color('222c36'); en(0, -182, 0, () => caja(300, 10, 184));
  color('323d47'); placaX(redondeado(190, 372, 8, 3), 157, 161, true);   // frente: bisel
  for (const y of [86, 58]) {                   // bahías de 5,25"
    color('1e262d'); en(161.6, y, 4, () => caja(1.2, 24, 120));
    color('4a5560'); en(162.4, y - 6, 50, () => caja(0.8, 3, 10));
  }
  color('161c21'); en(161.4, -95, 4, () => caja(1, 150, 150));           // rejilla frontal
  color('3a4650'); for (let i = 0; i < 10; i++) en(162.2, -164 + i * 15, 4, () => caja(1.2, 4, 148));
  color('1a2026'); for (const x of [-115, 115]) for (const z of [-62, 62]) en(x, -190, z, () => cilindro(13, 8, 12));
  color('161c21'); en(-157.6, 70, -10, () => { girarZ(PI / 2); cilindro(32, 0.8, 28); });   // extractor trasero
  color('7d858c');
  for (const r of [12, 22, 31]) en(-158.2, 70, -10, () => { girarZ(PI / 2); aro(r - 0.8, r + 0.8, 1, 28); });
  for (const a of [PI / 4, -PI / 4]) en(-158.2, 70, -10, () => { girarX(a); caja(1, 64, 1.4); });
  color('161c21'); for (let i = 0; i < 6; i++) en(-120 + i * 14, 187.3, 0, () => caja(6, 0.6, 120));
});

modelo('tapa_lateral', () => {
  color('3e4e5a'); caja(300, 360, 6);
  color('465865');
  en(0, 177, 3.6, () => caja(300, 6, 1.2)); en(0, -177, 3.6, () => caja(300, 6, 1.2));
  en(147, 0, 3.6, () => caja(6, 360, 1.2)); en(-147, 0, 3.6, () => caja(6, 360, 1.2));
  color('2b3842'); en(-15, -40, 3.3, () => caja(160, 190, 0.8));         // rejilla sobre CPU y video
  color('121a20'); for (let r = 0; r < 12; r++) for (const c of [-1, 1]) en(-15 + c * 38, -125 + r * 15.5, 3.9, () => caja(66, 5, 0.6));
  color('28323a'); en(-128, 0, 3.6, () => caja(10, 150, 1.6));          // tirador
  color('5d6a75'); en(-128, 0, 4.6, () => caja(4, 140, 0.8));
  for (const y of [150, -150]) {                // tornillos de mano
    color('c9ced3'); en(-140, y, 3, () => { girarX(PI / 2); torno([[5.5, 0], [5.5, 4.5], [4.6, 5.4], [0, 5.6]], 16); });
    color('7d858c'); en(-140, y, 8.7, () => caja(7, 1.2, 0.4));
  }
  color('4fd2ff'); en(118, 150, 3.4, () => caja(28, 4, 0.8)); en(113, 143, 3.4, () => caja(18, 2, 0.8));
});

modelo('monitor', () => {
  color('424e5a'); en(0, 0, -6, () => extruir(redondeado(326, 256, 10, 3), 24, true));
  color('3a4550'); en(0, 6, -24, () => extruir(redondeado(220, 170, 22, 3), 12, true));
  color('1c2228');                              // marco
  en(0, 120.5, 16.5, () => caja(330, 19, 21));
  en(0, -114, 16.5, () => caja(330, 32, 21));
  en(154, 6, 16.5, () => caja(22, 210, 21)); en(-154, 6, 16.5, () => caja(22, 210, 21));
  color('0a1014'); en(0, 6, 22, () => caja(288, 210, 2));                // fondo de la pantalla (la imagen la pone el juego en z = 25)
  color('aeb5bb'); en(0, -114, 27.3, () => caja(26, 3, 0.6));
  color('4fd2ff'); en(132, -114, 27.3, () => caja(3, 3, 0.6));
  color('3a4550'); for (let k = 0; k < 3; k++) en(100 + k * 8, -114, 27.2, () => caja(4, 2, 0.6));
  color('2b343d'); for (let i = 0; i < 8; i++) en(-70 + i * 20, 60, -30.4, () => caja(10, 40, 0.6));
  color('5d6a75'); en(0, -20, -30.4, () => caja(80, 80, 0.8));
  color('aeb5bb'); for (const x of [-30, 30]) for (const y of [-50, 10]) en(x, y, -31, () => { girarX(PI / 2); cilindro(2, 0.8, 8); });
});

modelo('monitor_soporte', () => {
  color('303a44'); en(0, 10, -8, () => { escalar(1, 1, 0.72); torno([[84, 0], [88, 2], [88, 5], [80, 8]], 36); });
  color('424e5a'); en(0, 70, -44, () => extruir(redondeado(44, 104, 8, 3), 12, true));   // cuello
  color('aeb5bb'); en(0, 18.8, -44, () => aro(10, 26, 1.6, 20));
  color('2b343d'); en(0, 128, -40, () => caja(50, 30, 10));             // bisagra al VESA
});

modelo('toma_pared', () => {
  color('c9c6bd'); en(0, 0, -8, () => extruir(redondeado(52, 78, 4, 3), 4, true));
  color('b5b2a9'); for (const y of [20, -14]) en(0, y, -5.2, () => extruir(redondeado(34, 30, 6, 3), 1.6, true));
  color('2a2f33');                              // tomacorriente tipo I (Argentina): dos patas en V y la de tierra
  for (const s of [-1, 1]) en(s * 6, 24, -4.3, () => { girarZ(s * 0.52); caja(2, 8, 0.4); });
  en(0, 12, -4.3, () => caja(2, 6, 0.4));
  color('8d949b'); for (const y of [34, -33]) en(0, y, -5.8, () => { girarX(PI / 2); cilindro(1.8, 0.6, 10); });
  color('202428'); en(0, -14, 2, () => extruir(redondeado(22, 24, 5, 3), 12, true));   // ficha enchufada
  en(0, -29, 4, () => { girarZ(PI); torno([[4, 0], [3, 5], [2.4, 8]], 10, true); });
});

/* ============================================================
   Salida
   ============================================================ */
function normales(fz) {
  const fn = fz.f.map(c => {                    // Newell: sirve para cualquier polígono
    const n = [0, 0, 0];
    c.i.forEach((a, k) => { const p = fz.v[a], q = fz.v[c.i[(k + 1) % c.i.length]];
      n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]); });
    return n;
  });
  const vn = fz.v.map(() => [0, 0, 0]);
  fz.f.forEach((c, k) => { if (c.s) c.i.forEach(i => { vn[i] = suma(vn[i], fn[k]); }); });
  return { fn: fn.map(unit), vn: vn.map(unit) };
}

function escribirObj(nombre, formas) {
  const vnIdx = new Map(), vnLin = [], cuerpo = [];
  const idxN = n => {
    const k = n.map(c => (Math.round(c * 1000) / 1000 || 0).toFixed(3)).join(' ');
    if (!vnIdx.has(k)) { vnIdx.set(k, vnIdx.size + 1); vnLin.push('vn ' + k); }
    return vnIdx.get(k);
  };
  let base = 1, tris = 0;
  formas.forEach((fz, k) => {
    const { fn, vn } = normales(fz);
    cuerpo.push('o ' + nombre + '.' + String(k + 1).padStart(3, '0'));
    fz.v.forEach(q => cuerpo.push('v ' + q.map(c => +(c * ESC).toFixed(5)).join(' ')));
    cuerpo.push('usemtl ' + fz.mat);
    fz.f.forEach((c, j) => {
      const n = c.i.map(i => (c.s && largo(vn[i]) > 0.5) ? vn[i] : fn[j]);
      if (largo(fn[j]) < 0.5) return;                       // cara degenerada (punta de un cono)
      cuerpo.push('f ' + c.i.map((i, q) => (base + i) + '//' + idxN(n[q])).join(' '));
      tris += c.i.length - 2;
    });
    base += fz.v.length;
    cuerpo.push('');
  });
  const out = ['# Glitch.TEC — ' + nombre + ' (tools/modelar_piezas.js)', '# Unidades: metros. Eje Y hacia arriba.',
               'mtllib materiales.mtl', ''].concat(vnLin, [''], cuerpo);
  fs.writeFileSync(path.join(SALIDA, nombre + '.obj'), out.join('\n'));
  return tris;
}

function hexA(mat) { return [1, 3, 5].map(i => parseInt(mat.slice(4).slice(i - 1, i + 1), 16)); }

/* ---------------- correr ---------------- */
fs.mkdirSync(SALIDA, { recursive: true });
const usados = new Set(), resumen = {};
for (const [nombre, fn] of Object.entries(MODELOS)) {
  FORMAS = []; M = ID();
  fn();
  if (pila.length) throw new Error(nombre + ': push/pop desparejos');
  FORMAS.forEach(fz => usados.add(fz.mat));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  FORMAS.forEach(fz => fz.v.forEach(q => q.forEach((c, i) => { min[i] = Math.min(min[i], c); max[i] = Math.max(max[i], c); })));
  const tris = escribirObj(nombre, FORMAS);
  resumen[nombre] = { tris, materiales: new Set(FORMAS.map(f => f.mat)).size,
                      tamano_mm: max.map((c, i) => Math.round(c - min[i])) };
}

/* materiales.mtl: los de antes (escritorio, sala...) más los nuevos */
const mtlPath = path.join(SALIDA, 'materiales.mtl');
const previo = fs.existsSync(path.join(BASE3D, 'piezas', 'materiales.mtl')) ? fs.readFileSync(path.join(BASE3D, 'piezas', 'materiales.mtl'), 'utf8') : '';
const yaEstan = new Set((previo.match(/^newmtl\s+(\S+)/gm) || []).map(l => l.split(/\s+/)[1]));
const nuevos = [...usados].filter(m => !yaEstan.has(m)).sort().map(m =>
  ['newmtl ' + m, 'Kd ' + hexA(m).map(c => (c / 255).toFixed(4)).join(' '), 'Ka 0 0 0', 'Ks 0.05 0.05 0.05', 'Ns 10', 'd 1', 'illum 1', ''].join('\n'));
fs.writeFileSync(mtlPath, (previo || '# Colores de Glitch.TEC\n\n') + (nuevos.length ? '\n' + nuevos.join('\n') : ''));

fs.writeFileSync(path.join(SALIDA, 'resumen.json'), JSON.stringify(resumen, null, 2));
let total = 0;
for (const [n, r] of Object.entries(resumen)) { total += r.tris; console.log(n.padEnd(22), String(r.tris).padStart(5), 'tris', r.materiales + ' mat', r.tamano_mm.join('×') + ' mm'); }
console.log('Total:', total, 'triángulos en', Object.keys(resumen).length, 'modelos ->', SALIDA);
