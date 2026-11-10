/* Glitch.TEC — relay del mando por WebSocket (de la guia "rectangulo_node").
   La app del celular manda JSON:  {"x":0.5,"y":-0.3}  (stick, de -1 a 1, y arriba = +)
                              o    {"button":"left","down":true}
   y este servidor lo reenvia a todos los clientes conectados (el juego, entre ellos).
   Uso:  npm install && npm start      (puerto 3000, o PORT=xxxx npm start)

   Ademas del reenvio, habla con el juego:
     al conectarse cada cliente recibe  {"lan":["192.168.0.5:3000"],"mandos":0}
        (las direcciones que el celular puede usar; el juego las dibuja como QR)
     la app avisa  {"hello":"mando"}  al abrir; el relay no lo reenvia y manda a todos
        {"mandos":N} cada vez que cambia la cantidad de celulares conectados.

   Escucha en toda la red local (el celular lo necesita). Sin autenticacion: cualquiera
   en la misma red podria mandarle movimientos al juego. Solo local:  HOST=127.0.0.1 npm start */
import os from 'node:os';
import WebSocket, { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
/* Modo público (VPS): PUBLIC_ADDR="dominio:80/mando". Cada partida usa una SALA (el último
   tramo de la URL: /mando/ABCD2345) y el relay solo reenvía dentro de la sala, así dos
   jugadores no se mueven entre sí. Sin PUBLIC_ADDR (uso local) hay una sola sala "". */
const PUBLIC_ADDR = process.env.PUBLIC_ADDR || '';
const SALA_OK = /^[A-Z0-9]{8,16}$/;
const salaDe = (req) => (req.url || '/').split('?')[0].split('/').filter(Boolean).pop() || '';

const wss = new WebSocketServer({ port: PORT, host: HOST });
console.log('Relay del mando escuchando en ws://' + HOST + ':' + PORT + (PUBLIC_ADDR ? ' (público: ' + PUBLIC_ADDR + ')' : ''));

/* Solo IPs de LAN: se saltan VPN (Radmin 26.x) y similares. Se calcula en cada conexion
   porque la IP de la PC cambia de red en red. En modo público la dirección es la del dominio. */
function lan(sala) {
  if (PUBLIC_ADDR) return [PUBLIC_ADDR + '/' + sala];
  if (HOST === '127.0.0.1') return [];
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i.family === 'IPv4' && !i.internal && /^(192\.168|10|172\.(1[6-9]|2\d|3[01]))\./.test(i.address))
    .map((i) => i.address + ':' + PORT);
}

const enviar = (c, obj) => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(obj)); };
const sala = (s) => [...wss.clients].filter((c) => c.sala === s);
const mandos = (s, salvo) => sala(s).filter((c) => c.esMando && c !== salvo).length;
const avisarMandos = (s, salvo) => sala(s).forEach((c) => enviar(c, { mandos: mandos(s, salvo) }));

wss.on('connection', (ws, req) => {
  ws.sala = salaDe(req);
  if (PUBLIC_ADDR && !SALA_OK.test(ws.sala)) return ws.close(1008, 'sala invalida');
  console.log('Cliente conectado:', req.socket.remoteAddress, ws.sala ? 'sala ' + ws.sala : '');
  enviar(ws, { lan: lan(ws.sala), mandos: mandos(ws.sala) });
  ws.on('message', (msg) => {
    const text = msg.toString();
    if (text.length > 512) return;   // los mensajes del mando son diminutos
    try {
      if (JSON.parse(text).hello === 'mando') { ws.esMando = true; return avisarMandos(ws.sala); }
    } catch { /* no era JSON: se reenvia igual, el juego lo ignora */ }
    sala(ws.sala).forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(text); });
  });
  ws.on('close', () => {
    console.log('Cliente desconectado');
    if (ws.esMando) avisarMandos(ws.sala, ws);
  });
});
