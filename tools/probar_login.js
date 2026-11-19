/* Glitch.TEC — prueba de login con una cuenta real (T11: ingreso, cookie, logout).
   La clave va por variable de entorno: no queda en el historial ni en el repo.
   Uso (PowerShell):
     $env:GT_LOGIN='cuenta_qa'; $env:GT_CLAVE='...'; node tools/probar_login.js [https://glitchtec.dpdns.org/api]
   No prueba el bloqueo por intentos: bloquearía la cuenta. */
const BASE = (process.argv[2] || 'https://glitchtec.dpdns.org/api').replace(/\/$/, '');
const { GT_LOGIN, GT_CLAVE } = process.env;
if (!GT_LOGIN || !GT_CLAVE) { console.log('Definí GT_LOGIN y GT_CLAVE.'); process.exit(1); }

let fallos = 0, cookie = '';
const jar = new Map();   // nombre → valor: si la API manda la misma cookie dos veces, gana la última
const check = (n, ok, x) => { console.log((ok ? 'OK    ' : 'FALLA ') + n + (ok || x === undefined ? '' : '  -> ' + x)); if (!ok) fallos++; };

async function call(path, body) {
  const t = Date.now();
  const r = await fetch(BASE + '/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie && { Cookie: cookie }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const sc = r.headers.getSetCookie();
  for (const c of sc) { const [k, ...v] = c.split(';')[0].split('='); jar.set(k, v.join('=')); }
  cookie = [...jar].filter(([, v]) => v && v !== 'deleted').map(([k, v]) => k + '=' + v).join('; ');
  return { r, sc, ms: Date.now() - t, j: await r.json().catch(() => null) };
}

(async () => {
  const mal = await call('login.php', { login: GT_LOGIN, password: GT_CLAVE + 'x' });
  check('clave incorrecta → 401', mal.r.status === 401, mal.r.status);

  const ok = await call('login.php', { login: GT_LOGIN, password: GT_CLAVE });
  check(`login correcto → 200 (${ok.ms} ms)`, ok.r.status === 200 && ok.j && ok.j.ok, ok.r.status);
  check('devuelve usuario sin password_hash', ok.j && ok.j.user && !('password_hash' in ok.j.user));
  const c = ok.sc.join(' | ').toLowerCase();
  check('cookie HttpOnly', c.includes('httponly'), c);
  check('cookie Secure', c.includes('secure'), c);
  check('cookie SameSite', c.includes('samesite'), c);

  const s = await call('sesion.php');
  check('sesión activa tras login', s.j && s.j.user, JSON.stringify(s.j));

  const may = await call('login.php', { login: GT_LOGIN.toUpperCase(), password: GT_CLAVE });
  check('login con mayúsculas → 200', may.r.status === 200, may.r.status);

  await call('logout.php', {});
  cookie = ''; jar.clear();
  const s2 = await call('sesion.php');
  check('sin sesión tras logout', s2.j && s2.j.user === null, JSON.stringify(s2.j));

  console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
  process.exit(fallos ? 1 : 0);
})();
