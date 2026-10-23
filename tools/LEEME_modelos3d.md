# Modelos 3D del Servicio Técnico

Salen de `js/bench3d.js` con `node tools/exportar_modelos.js`. Esta guía vive en
`tools/LEEME_modelos3d.md` y el exportador la copia acá.

| Archivo | Qué es |
|---|---|
| `escena_completa.obj` | Todo el banco armado, en su lugar (para ver el conjunto) |
| `piezas/<nombre>.obj` | Cada pieza sola, con el origen donde el juego la ubica |
| `materiales.mtl` y `piezas/materiales.mtl` | Los colores (el segundo es el que lee el juego) |
| `piezas.json` | Dónde va cada pieza en la escena (posición y tamaño, en metros) |

- Unidades: metros (1 unidad del juego = 1 mm). Eje Y hacia arriba.
- Cada caja/forma es un objeto aparte dentro del `.obj` (`fuente.001`,
  `fuente.002`...), así se puede seleccionar, borrar o unir con Ctrl+J.
- Abrir en Blender: *Archivo > Importar > Wavefront (.obj)*. Al exportar de vuelta:
  *Wavefront (.obj)*, **Y arriba**, escala 1, con materiales, y pisar el archivo de `piezas/`.

## Piezas

Equipo: `gabinete_chasis`, `tapa_lateral`, `panel_frontal`, `fuente`,
`fuente_trasera`, `entrada_corriente`, `puertos_video`, `placa_madre`,
`cpu_disipador`, `ram`, `placa_video`, `disco`, `ventilador_fuente`, `ventilador_cpu`.
Monitor: `monitor`, `monitor_soporte`, `toma_pared`.
Herramientas: `herr_destornillador`, `herr_aire`, `herr_alcohol`, `herr_pasta`,
`herr_tester`, `herr_respaldo`, `herr_crimpeadora`, `herr_lantester`.
Ambiente: `escritorio`, `alfombrilla`, `sala_pared`.

## Cómo vuelve al juego

`js/bench3d.js` carga solo los `.obj` de `piezas/` al abrir el taller y los usa en
lugar de las cajas. Para ver un cambio: guardá el OBJ (misma carpeta, mismo
nombre, **metros, Y arriba, el mismo origen**) y recargá la página.

- Si falta un archivo, esa pieza se dibuja con cajas como antes. Con doble
  click en `index.html` (sin servidor) el navegador no deja leer los OBJ y todo
  queda con cajas: hace falta abrirlo por `http://` (XAMPP, `php -S`...).
- Los colores salen de `materiales.mtl` (`Kd`) o del nombre `mat_RRGGBB`.
  Una pieza puede tener varios materiales. El estado de la orden (roto, reparado,
  polvo) tiñe todos los colores de la pieza.
- Los ventiladores (`ventilador_*`) giran: modelalos con el centro del aspa en el
  origen y el eje hacia Z.
- **No usa el OBJ** (los dibuja el código porque cambian en vivo): `monitor_pantalla`
  (textura), `conector_video_*` (cambian de color según el puerto), `led_encendido`
  y los `cable_*` (siguen al equipo). Están exportados sólo como referencia.
- Desde la consola: `GlitchTec.bench.setModelos(false)` vuelve a las cajas;
  `GlitchTec.bench.modelosCargados()` lista lo que cargó.
- Las cajas de selección (clicks y carteles) siguen siendo las de `PARTS` en
  `bench3d.js`; si una pieza cambia mucho de tamaño, hay que ajustarlas ahí.

## Ojo al re-exportar

`node tools/exportar_modelos.js` **pisa** la carpeta y se pierden las ediciones.
Por eso se niega a correr si ya existe `EntidadesGraficas/diseños3d/piezas/`; para forzarlo:
`node tools/exportar_modelos.js --forzar` (hacé copia de lo editado antes).
