/* Glitch.TEC — relay del mando por WebSocket (de la guia "rectangulo_node").
   La app del celular manda JSON:  {"x":0.5,"y":-0.3}  (stick, de -1 a 1, y arriba = +)
                              o    {"action":"UP|DOWN|LEFT|RIGHT"}
   y este servidor lo reenvia a todos los clientes conectados (el juego, entre ellos).
   Uso:  npm install && npm start      (puerto 3000, o PORT=xxxx npm start)

   Escucha SOLO en esta PC (127.0.0.1): sin autenticacion, cualquiera en la red
   podria mandarle movimientos al juego. El emulador de Android llega igual,
   por 10.0.2.2. Para un celular real, en la misma red:  HOST=0.0.0.0 npm start */
import WebSocket, { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const wss = new WebSocketServer({ port: PORT, host: HOST });
console.log('Relay del mando escuchando en ws://' + HOST + ':' + PORT);

wss.on('connection', (ws, req) => {
  console.log('Cliente conectado:', req.socket.remoteAddress);
  ws.on('message', (msg) => {
    const text = msg.toString();
    console.log('Mensaje:', text);
    wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(text); });
  });
  ws.on('close', () => console.log('Cliente desconectado'));
});
