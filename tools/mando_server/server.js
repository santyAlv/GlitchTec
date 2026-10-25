/* Glitch.TEC — relay del mando por WebSocket (de la guia "rectangulo_node").
   La app del celular manda JSON:  {"x":0.5,"y":-0.3}  (stick, de -1 a 1, y arriba = +)
                              o    {"action":"UP|DOWN|LEFT|RIGHT"}
   y este servidor lo reenvia a todos los clientes conectados (el juego, entre ellos).
   Uso:  npm install && npm start      (puerto 3000, o PORT=xxxx npm start) */
import WebSocket, { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 3000;
const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });
console.log('Relay del mando escuchando en ws://0.0.0.0:' + PORT);

wss.on('connection', (ws, req) => {
  console.log('Cliente conectado:', req.socket.remoteAddress);
  ws.on('message', (msg) => {
    const text = msg.toString();
    console.log('Mensaje:', text);
    wss.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(text); });
  });
  ws.on('close', () => console.log('Cliente desconectado'));
});
