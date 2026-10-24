# PHOTOBOOTH

Cabina de fotos vintage en el navegador. Toma 3 o 4 poses con tu cámara, las revela en blanco y negro o sepia, y saca la tira por una ranura de metal con estrellas. Al final eliges el fondo, escribes un texto en el borde y descargas la tira, una historia 9:16 o un video de la tira saliendo.

Todo pasa en el navegador: las fotos no se suben a ningún servidor.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Pantallas: inicio, cabina, revelado, resultado y compartir |
| `style.css` | Diseño: madera, metal con estrellas, papel hueso y los 8 fondos |
| `app.js` | Cámara, cuenta regresiva, flash, animación de la tira, sonido y descargas |
| `render.js` | Revelado con canvas: filtro, tira, historia 9:16 y video |
| `.nojekyll` | Le dice a GitHub Pages que publique los archivos tal cual |

## Probarlo en tu compu

La cámara solo funciona en `localhost` o con `https`, así que no basta con abrir el archivo con doble clic:

```bash
python3 -m http.server 8080
```

Abre http://localhost:8080

## Notas

- El video se graba en vivo (unos 4 segundos): deja la pantalla abierta mientras se prepara. Sale en MP4 en Safari y Chrome, y en WebM en Firefox.
- Si alguien abre el link desde Instagram o TikTok, la cámara puede no funcionar dentro de esa app: hay que usar «Abrir en el navegador».
- Tiempos del revelado: `T` en `render.js`.
- Fondos: `FONDOS` en `render.js` y las clases `.f-*` y `.m-*` en `style.css`.
