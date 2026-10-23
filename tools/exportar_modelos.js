/* ============================================================
   Glitch.TEC — exportador de modelos 3D del Servicio Técnico
   ------------------------------------------------------------
   El banco de trabajo (js/bench3d.js) arma el equipo con cajas de
   p5. Este script corre ESE MISMO código de dibujo con un "p" falso
   que, en vez de pintar, anota cada caja y cada esfera con su
   posición ya transformada, y las escribe como OBJ + MTL, que abre
   cualquier programa 3D (Blender, Maya, 3ds Max, Wings3D...).

   Uso (desde la carpeta del proyecto):
       node tools/exportar_modelos.js

   Genera EntidadesGraficas/diseños3d/:
       escena_completa.obj   todo el banco, en su lugar
       piezas/<pieza>.obj    cada pieza sola, con el origen donde el juego la ubica
       piezas/materiales.mtl los colores
       piezas.json           dónde va cada pieza dentro de la escena
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'EntidadesGraficas', 'diseños3d');
const ESCALA = 0.001;          // 1 unidad del juego = 1 mm  ->  metros

/* ---------------- 1. Cargar bench3d.js sin navegador ---------------- */
const ventana = { GlitchTec: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(RAIZ, 'js', 'bench3d.js'), 'utf8'),
  { window: ventana, document: {}, Math, console },
  { filename: 'bench3d.js' }
);
const bench = ventana.GlitchTec.bench;
if (!bench || !bench.dibujarEscena) throw new Error('bench3d.js no expone dibujarEscena()');

/* ---------------- 2. Un "p5" que anota en vez de dibujar ---------------- */
function identidad() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }   // por columnas

function multiplicar(a, b) {               // a * b
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function aplicar(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8]  * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9]  * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
  ];
}

/* Inversa de una matriz rígida (sólo giros y traslados). */
function inversaRigida(m) {
  const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];   // R^T
  const t = [-(r[0] * m[12] + r[4] * m[13] + r[8] * m[14]),
             -(r[1] * m[12] + r[5] * m[13] + r[9] * m[14]),
             -(r[2] * m[12] + r[6] * m[13] + r[10] * m[14])];
  r[12] = t[0]; r[13] = t[1]; r[14] = t[2];
  return r;
}

function crearGrabador() {
  let m = identidad();
  const pila = [];
  let color = [200, 200, 200];
  let relleno = true;
  let esPantalla = false;
  let grupo = 'sin_grupo';
  const piezas = [];                         // primitivas anotadas
  const pivotes = {};                        // grupo -> matriz donde el juego "ubica" la pieza

  const p = {
    push() { pila.push({ m: m.slice(), color: color.slice(), relleno, esPantalla }); },
    pop() { const s = pila.pop(); m = s.m; color = s.color; relleno = s.relleno; esPantalla = s.esPantalla; },
    translate(x, y, z) { m = multiplicar(m, [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); },
    rotateX(a) { const c = Math.cos(a), s = Math.sin(a); m = multiplicar(m, [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); },
    rotateY(a) { const c = Math.cos(a), s = Math.sin(a); m = multiplicar(m, [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); },
    rotateZ(a) { const c = Math.cos(a), s = Math.sin(a); m = multiplicar(m, [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); },
    noStroke() {}, stroke() {}, strokeWeight() {},
    noFill() { relleno = false; },
    fill(r, g, b) { relleno = true; color = [r, g, b]; esPantalla = false; },
    ambientMaterial() {}, emissiveMaterial() {},
    texture() { esPantalla = true; },
    group(nombre) { grupo = nombre; if (!pivotes[nombre]) pivotes[nombre] = m.slice(); },

    box(w, h, d) {
      if (!relleno) return;                  // los marcos de selección no son geometría
      const hx = w / 2, hy = h / 2, hz = d / 2;
      const v = [];
      for (const x of [-hx, hx]) for (const y of [-hy, hy]) for (const z of [-hz, hz]) v.push(aplicar(m, [x, y, z]));
      /* índices de v: bit2 = x, bit1 = y, bit0 = z */
      const caras = [[0,1,3,2], [4,6,7,5], [0,4,5,1], [2,3,7,6], [0,2,6,4], [1,5,7,3]];
      piezas.push({ grupo, tipo: 'caja', mat: matDe(), v, vl: local(v), f: caras });
    },

    plane(w, h) {
      const v = [[-w/2, -h/2, 0], [w/2, -h/2, 0], [w/2, h/2, 0], [-w/2, h/2, 0]].map(q => aplicar(m, q));
      piezas.push({ grupo, tipo: 'plano', mat: 'pantalla', v, vl: local(v), f: [[0,1,2,3]] });
    },

    sphere(r, dx, dy) {
      dx = dx || 24; dy = dy || 16;
      const v = [], f = [];
      v.push(aplicar(m, [0, -r, 0]));                              // polo norte
      for (let j = 1; j < dy; j++) {
        const fi = Math.PI * j / dy;
        for (let i = 0; i < dx; i++) {
          const th = 2 * Math.PI * i / dx;
          v.push(aplicar(m, [r * Math.sin(fi) * Math.cos(th), -r * Math.cos(fi), r * Math.sin(fi) * Math.sin(th)]));
        }
      }
      v.push(aplicar(m, [0, r, 0]));                               // polo sur
      const sur = v.length - 1;
      for (let i = 0; i < dx; i++) f.push([0, 1 + i, 1 + (i + 1) % dx]);
      for (let j = 0; j < dy - 2; j++)
        for (let i = 0; i < dx; i++) {
          const a = 1 + j * dx + i, b = 1 + j * dx + (i + 1) % dx;
          f.push([a, a + dx, b + dx, b]);
        }
      for (let i = 0; i < dx; i++) f.push([sur, sur - dx + (i + 1) % dx, sur - dx + i]);
      piezas.push({ grupo, tipo: 'esfera', mat: matDe(), v, vl: local(v), f });
    }
  };

  function local(v) {
    const inv = inversaRigida(pivotes[grupo]);
    return v.map(q => aplicar(inv, q));
  }

  function matDe() {
    return 'mat_' + color.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
  }
  return { p, piezas, pivotes };
}

/* ---------------- 3. Escribir OBJ / MTL ---------------- */
/* p5 usa y hacia abajo; los programas 3D, y hacia arriba. Con (x, -y, z)
   queda un sistema derecho con z hacia el observador, sin espejar nada. */
function convertir(q, centro) {
  return [(q[0] - centro[0]) * ESCALA, -(q[1] - centro[1]) * ESCALA, (q[2] - centro[2]) * ESCALA];
}

function resta(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function cruz(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function punto(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

/* Ordena cada cara para que mire hacia afuera de su pieza (antihorario). */
function caraHaciaAfuera(pieza, cara, vs) {
  const c = [0, 0, 0];
  vs.forEach(q => { c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; });
  c[0] /= vs.length; c[1] /= vs.length; c[2] /= vs.length;
  const pts = cara.map(i => vs[i]);
  const n = cruz(resta(pts[1], pts[0]), resta(pts[2], pts[0]));
  const mid = [0, 0, 0];
  pts.forEach(q => { mid[0] += q[0] / pts.length; mid[1] += q[1] / pts.length; mid[2] += q[2] / pts.length; });
  if (pieza.tipo === 'plano') return n[2] >= 0 ? cara : cara.slice().reverse();   // el plano mira a +z
  return punto(n, resta(mid, c)) >= 0 ? cara : cara.slice().reverse();
}

function escribirOBJ(piezas, campo, archivo, nombreMtl) {
  const out = ['# Glitch.TEC — modelos del Servicio Técnico', '# Unidades: metros. Eje Y hacia arriba.',
               'mtllib ' + nombreMtl, ''];
  let base = 1, baseVt = 1;
  const contador = {};
  for (const pz of piezas) {
    const vs = pz[campo].map(q => convertir(q, [0, 0, 0]));
    contador[pz.grupo] = (contador[pz.grupo] || 0) + 1;
    out.push('o ' + pz.grupo + '.' + String(contador[pz.grupo]).padStart(3, '0'));
    vs.forEach(q => out.push('v ' + q.map(n => +n.toFixed(5)).join(' ')));
    if (pz.tipo === 'plano') out.push('vt 0 0', 'vt 1 0', 'vt 1 1', 'vt 0 1');
    out.push('usemtl ' + pz.mat, 's off');
    for (const cara of pz.f) {
      const orden = caraHaciaAfuera(pz, cara, vs);
      if (pz.tipo === 'plano') {
        out.push('f ' + orden.map(i => (base + i) + '/' + (baseVt + i)).join(' '));
      } else {
        out.push('f ' + orden.map(i => base + i).join(' '));
      }
    }
    base += vs.length;
    if (pz.tipo === 'plano') baseVt += 4;
    out.push('');
  }
  fs.writeFileSync(archivo, out.join('\n'));
}

function escribirMTL(piezas, archivo) {
  const vistos = new Set();
  const out = ['# Colores de Glitch.TEC (un material por color usado en el juego)', ''];
  for (const pz of piezas) {
    if (vistos.has(pz.mat)) continue;
    vistos.add(pz.mat);
    let rgb;
    if (pz.mat === 'pantalla') rgb = [10, 16, 20];       // en el juego es una textura que se redibuja
    else rgb = [1, 3, 5].map(i => parseInt(pz.mat.slice(4).slice(i - 1, i + 1), 16));
    out.push('newmtl ' + pz.mat,
             'Kd ' + rgb.map(c => (c / 255).toFixed(4)).join(' '),
             'Ka 0 0 0', 'Ks 0.05 0.05 0.05', 'Ns 10', 'd 1', 'illum 1', '');
  }
  fs.writeFileSync(archivo, out.join('\n'));
}

/* ---------------- 4. Correr ---------------- */
const { p, piezas, pivotes } = crearGrabador();
bench.dibujarEscena(p);

/* Las piezas se editan a mano: no se pisan sin permiso expreso. */
if (fs.existsSync(path.join(SALIDA, 'piezas')) && !process.argv.includes('--forzar')) {
  console.error('EntidadesGraficas/diseños3d/piezas/ ya existe y puede tener ediciones.');
  console.error('Si querés regenerarlo igual (se pierde lo editado): node tools/exportar_modelos.js --forzar');
  process.exit(1);
}
fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(path.join(SALIDA, 'piezas'), { recursive: true });

escribirMTL(piezas, path.join(SALIDA, 'materiales.mtl'));
escribirMTL(piezas, path.join(SALIDA, 'piezas', 'materiales.mtl'));
escribirOBJ(piezas, 'v', path.join(SALIDA, 'escena_completa.obj'), 'materiales.mtl');

const grupos = {};
for (const pz of piezas) (grupos[pz.grupo] = grupos[pz.grupo] || []).push(pz);

const indice = {};
for (const nombre of Object.keys(grupos)) {
  const lista = grupos[nombre];
  escribirOBJ(lista, 'vl', path.join(SALIDA, 'piezas', nombre + '.obj'), 'materiales.mtl');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  lista.forEach(pz => pz.vl.forEach(q => q.forEach((n, i) => { min[i] = Math.min(min[i], n); max[i] = Math.max(max[i], n); })));
  const piv = pivotes[nombre];
  indice[nombre] = {
    formas: lista.length,
    origen_en_escena_m: convertir([piv[12], piv[13], piv[14]], [0, 0, 0]).map(n => +n.toFixed(4)),
    tamano_m: [max[0]-min[0], max[1]-min[1], max[2]-min[2]].map(n => +(n * ESCALA).toFixed(4)),
    en_juego: !/^(cable_|conector_|led_|monitor_pantalla)/.test(nombre)
  };
}
fs.writeFileSync(path.join(SALIDA, 'piezas.json'), JSON.stringify(indice, null, 2));

fs.copyFileSync(path.join(__dirname, 'LEEME_modelos3d.md'), path.join(SALIDA, 'LEEME.md'));
console.log('Exportado en ' + SALIDA);
console.log(Object.keys(indice).length + ' piezas, ' + piezas.length + ' formas en total');
