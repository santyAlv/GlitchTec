/* Prueba del filtro de nombres ofensivos (js/filtro.js con api/filtro_palabras.json).
   Uso: node tools/probar_filtro.js */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const lista = JSON.parse(fs.readFileSync(path.join(root, 'api/filtro_palabras.json'), 'utf8'));
const window = { GlitchTec: {} };
global.fetch = () => Promise.resolve({ json: () => lista });
new Function('window', fs.readFileSync(path.join(root, 'js/filtro.js'), 'utf8'))(window);

setTimeout(() => {
  const malo = window.GlitchTec.filtro.esOfensivo;
  const bloquear = ['nigger', 'NIGGER', 'n1gg3r', 'n.i.g.g.e.r', 'niiiigger', 'xX_nigga_Xx', 'Hitler88', 'nazi_power',
    'puta', 'hijodeputa', 'Pu7a', 'puuuto', 'boludo123', 'mierda', 'imbécil', 'maricón', 'fuck.you', 'b1tch',
    'negrata', 'sudaca', 'kkk', 'user1488', 'nigger@gmail.com', 'putito@hotmail.com', 'ana@mierda.com', 'retarded'];
  const permitir = ['santiago', 'juan.perez', 'computadora', 'reputacion', 'disputa', 'calculo', 'pijama',
    'maricarmen', 'vergara', 'therapist', 'Niger', 'nigeria', 'america', 'estudiante', 'gatonegro',
    'input@gmail.com', 'ana.lopez@hotmail.com', 'profe.ibanez@escuela.edu.ar', 'control', 'controlo', 'retardo'];
  let fallas = 0;
  bloquear.forEach(t => { if (!malo(t)) { fallas++; console.log('NO bloqueó:', t); } });
  permitir.forEach(t => { if (malo(t)) { fallas++; console.log('Bloqueó de más:', t); } });
  console.log(fallas ? fallas + ' fallas' : 'OK: ' + bloquear.length + ' bloqueados, ' + permitir.length + ' permitidos');
  process.exitCode = fallas ? 1 : 0;
}, 0);
