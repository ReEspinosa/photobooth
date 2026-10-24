/* PHOTOBOOTH — revelado en el navegador (canvas).
   Hace lo mismo que el render.py de la versión con Python:
   filtro de cabina, tira, historia 9:16 y video de la tira saliendo de la ranura. */
const PB = (() => {
  const SERIF = '"Bodoni Moda", "Bodoni 72", Didot, Georgia, serif';
  const MONO = '"DM Mono", ui-monospace, Menlo, monospace';

  const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const rng = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

  function fuentes() {
    if (!document.fonts) return Promise.resolve();
    return Promise.all([
      `700 92px ${SERIF}`, `italic 500 40px ${SERIF}`, `italic 700 30px ${SERIF}`, `20px ${MONO}`,
    ].map(f => document.fonts.load(f).catch(() => {})));
  }

  // degradado lineal con ángulo estilo CSS (180 = de arriba a abajo)
  function lin(x, X, Y, w, h, stops, ang = 180) {
    const a = ang * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
    const half = Math.abs(w / 2 * dx) + Math.abs(h / 2 * dy), cx = X + w / 2, cy = Y + h / 2;
    const g = x.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, r); }

  // vetas de metal cepillado (el que llama recorta con clip)
  function cepillado(x, X, Y, w, h, fuerza, seed) {
    const r = rng(seed);
    for (let y = 0; y < h; y++) {
      const a = (r() - 0.5) * fuerza;
      x.fillStyle = a > 0 ? `rgba(255,248,235,${a})` : `rgba(30,22,14,${-a})`;
      x.fillRect(X, Y + y, w, 1);
    }
    for (let i = 0; i < h * 1.4; i++) {
      const a = r() * fuerza * 0.9;
      x.fillStyle = r() < 0.5 ? `rgba(255,248,235,${a})` : `rgba(30,22,14,${a})`;
      x.fillRect(X + r() * w - 40, Y + r() * h, 40 + r() * w * 0.5, 1);
    }
  }

  // ------------------------------------------------------------ filtro de cabina
  function filtrar(img, w, h, tono, seed) {
    const c = cv(w, h), x = c.getContext("2d", { willReadFrequently: true });
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
    x.filter = `blur(${(0.55 * w / 500).toFixed(2)}px)`;
    x.drawImage(img, (w - dw) / 2, (h - dh) * 0.42, dw, dh);
    x.filter = "none";
    const d = x.getImageData(0, 0, w, h), p = d.data, r = rng(seed + 11);
    const lo = tono === "sepia" ? [38, 24, 14] : [14, 14, 15];
    const hi = tono === "sepia" ? [246, 226, 192] : [246, 245, 242];
    const cx = w / 2, cy = h * 0.45;
    for (let y = 0, i = 0; y < h; y++) {
      const dy = (y - cy) / (h / 2);
      for (let X = 0; X < w; X++, i += 4) {
        let l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
        l = l * 1.06 + 0.05;                                   // flash
        const sc = l < 0.5 ? 2 * l * l : 1 - 2 * (1 - l) * (1 - l);
        l = 0.35 * l + 0.65 * sc;                              // contraste en S
        const dx = (X - cx) / (w / 2);
        l *= 1 - 0.42 * (dx * dx + dy * dy) / 2;               // viñeta
        l += (r() + r() - 1) * 0.07;                           // grano
        l = clamp(l);
        p[i] = lo[0] + (hi[0] - lo[0]) * l;
        p[i + 1] = lo[1] + (hi[1] - lo[1]) * l;
        p[i + 2] = lo[2] + (hi[2] - lo[2]) * l;
      }
    }
    x.putImageData(d, 0, 0);
    return c;
  }

  // ------------------------------------------------------------ tira
  function geometria(n, w, conTexto) {
    const pad = Math.round(w * 0.08), pw = w - 2 * pad, ph = Math.round(pw * 0.86), gap = Math.round(w * 0.055);
    const cap = conTexto ? Math.round(w * 0.22) : pad;
    return { pad, pw, ph, gap, cap, L: pad + n * ph + (n - 1) * gap + cap, ys: Array.from({ length: n }, (_, i) => pad + i * (ph + gap)) };
  }

  function tira(imgs, tono, texto, w = 600) {
    const g = geometria(imgs.length, w, Boolean(texto));
    const c = cv(w, g.L), x = c.getContext("2d");
    x.fillStyle = lin(x, 0, 0, w, g.L, [[0, "#ece4d6"], [0.45, "#f5efe4"], [1, "#e9e1d2"]], 90);
    x.fillRect(0, 0, w, g.L);
    cepillado(x, 0, 0, w, g.L, 0.02, 3);
    imgs.forEach((im, i) => x.drawImage(filtrar(im, g.pw, g.ph, tono, i + 1), g.pad, g.ys[i]));
    if (texto) {
      let size = Math.round(w * 0.072);
      do { x.font = `italic 500 ${size}px ${SERIF}`; size--; } while (x.measureText(texto).width > g.pw && size > 10);
      x.fillStyle = "#4a4036"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillText(texto, w / 2, g.L - g.cap / 2);
    }
    return c;
  }

  // ------------------------------------------------------------ fondos
  const FONDOS = {
    malva: ["#7e6066", "#e2c4cb"], lunares: null, cereza: ["#6b0000", "#fcc9cc"], olivo: ["#81894f", "#bfd5e8"],
    vino: ["#721525", "#8baed2"], fresa: ["#860a0e", "#df7a96"], limonada: ["#f4b9cc", "#fdf0c4"], cielo: ["#b9ccd6", "#efedd8"],
  };
  function fondo(x, nombre, w, h, banda = 44) {
    const f = FONDOS[nombre];
    if (!f) {
      x.fillStyle = "#f5dfe5"; x.fillRect(0, 0, w, h); x.fillStyle = "#3a2622";
      const s = 84, r = 8;
      for (let row = 0, y = 0; y < h + s; row++, y += s / 2) {
        const off = row % 2 ? s / 2 : 0;
        for (let X = -s; X < w + s; X += s) { x.beginPath(); x.arc(X + off, y, r, 0, Math.PI * 2); x.fill(); }
      }
      return;
    }
    x.fillStyle = f[1]; x.fillRect(0, 0, w, h); x.fillStyle = f[0];
    for (let X = 0; X < w; X += banda * 2) x.fillRect(X, 0, banda, h);
  }

  // ------------------------------------------------------------ máquina con estrellas
  const STAR_TILE = [[18, 20, 1.5, 12], [64, 14, 0.8, -8], [100, 36, 1.8, 20], [42, 62, 1, -20],
    [86, 86, 1.3, 5], [22, 98, 1.7, -12], [110, 108, 0.7, 30], [60, 108, 0.6, 0]];
  function estrella(x, cx, cy, R, r, rot) {
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (-90 + rot + i * 36) * Math.PI / 180, rr_ = i % 2 ? r : R;
      i ? x.lineTo(cx + rr_ * Math.cos(a), cy + rr_ * Math.sin(a)) : x.moveTo(cx + rr_ * Math.cos(a), cy + rr_ * Math.sin(a));
    }
    x.closePath(); x.fill();
  }
  function patronEstrellas(x, k) {
    const t = Math.round(120 * k), c = cv(t, t), p = c.getContext("2d");
    p.fillStyle = "#15110e";
    STAR_TILE.forEach(([sx, sy, s, rot]) => {
      for (const ox of [-t, 0, t]) for (const oy of [-t, 0, t]) estrella(p, sx * k + ox, sy * k + oy, 10 * s * k, 4.5 * s * k, rot);
    });
    return x.createPattern(c, "repeat");
  }

  const cacheMaquina = {};
  function maquina(k, H = 560) {
    const clave = k + "|" + H;
    if (cacheMaquina[clave]) return cacheMaquina[clave];
    const K = v => Math.round(v * k), W = K(342), Hp = K(H), lip = H - 92;

    const panel = cv(W, Hp), x = panel.getContext("2d");
    x.save(); rr(x, 0, 0, W, Hp, K(22)); x.clip();
    x.fillStyle = lin(x, 0, 0, W, Hp, [[0, "#d4c7b1"], [0.38, "#b4a58c"], [0.58, "#c8baa2"], [1, "#93846d"]], 165);
    x.fillRect(0, 0, W, Hp);
    cepillado(x, 0, 0, W, Hp, 0.09, 1);
    x.globalAlpha = 0.92; x.fillStyle = patronEstrellas(x, k); x.fillRect(0, 0, W, Hp); x.globalAlpha = 1;
    x.restore();
    x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = Math.max(1, K(1)); rr(x, 0.5, 0.5, W - 1, Hp - 1, K(22)); x.stroke();

    const sx = K(34), sy = K(30), sw = K(274), sh = K(92);
    x.fillStyle = "rgba(255,250,240,.45)"; rr(x, sx, sy + K(1.5), sw, sh, K(12)); x.fill();
    x.fillStyle = lin(x, sx, sy, sw, sh, [[0, "#050404"], [1, "#1c1714"]]); rr(x, sx, sy, sw, sh, K(12)); x.fill();

    const rx = K(66), ry = K(122), rw = K(210), rh = K(lip - 6 - 122);
    x.save(); rr(x, rx, ry, rw, rh, [0, 0, K(8), K(8)]); x.clip();
    x.fillStyle = lin(x, rx, ry, rw, rh, [[0, "#867862"], [0.22, "#a8997f"], [1, "#9d8e75"]]); x.fillRect(rx, ry, rw, rh);
    cepillado(x, rx, ry, rw, rh, 0.06, 9);
    const sg = x.createLinearGradient(0, ry, 0, ry + K(16));
    sg.addColorStop(0, "rgba(0,0,0,.35)"); sg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = sg; x.fillRect(rx, ry, rw, K(16));
    x.restore();

    const bx = K(40), by = K(lip - 24), bw = K(262), bh = K(30);
    x.fillStyle = lin(x, bx, by, bw, bh, [[0, "#43392f"], [1, "#7a6b58"]]); rr(x, bx, by, bw, bh, [K(6), K(6), 0, 0]); x.fill();

    // capa frontal: rodillos y labio de la bandeja, van encima de la tira
    const front = cv(W, Hp), f = front.getContext("2d");
    const pieza = (X, Y, w, h, stops, ang, r, blur, op, dy) => {
      f.save(); f.shadowColor = `rgba(0,0,0,${op})`; f.shadowBlur = blur; f.shadowOffsetY = dy;
      f.fillStyle = lin(f, X, Y, w, h, stops, ang); rr(f, X, Y, w, h, r); f.fill(); f.restore();
    };
    const acero = [[0, "#6f665a"], [0.45, "#d8cfbf"], [1, "#7d7467"]];
    pieza(K(64), K(44), K(16), K(66), acero, 90, K(3), K(6), 0.5, K(2));
    pieza(K(262), K(44), K(16), K(66), acero, 90, K(3), K(6), 0.5, K(2));
    const hule = [[0, "#0a0908"], [0.28, "#45403a"], [0.55, "#26231f"], [1, "#070606"]];
    pieza(K(80), K(50), K(32), K(56), hule, 180, K(8), K(8), 0.6, K(3));
    pieza(K(230), K(50), K(32), K(56), hule, 180, K(8), K(8), 0.6, K(3));
    pieza(K(112), K(66), K(118), K(15), [[0, "#5d564c"], [0.35, "#ddd5c7"], [0.62, "#8d857a"], [1, "#3b3631"]], 180, K(3), K(8), 0.55, K(3));

    const lx = K(22), ly = K(lip), lw = K(298), lh = K(76), lr = [K(4), K(4), K(16), K(16)];
    f.save(); f.shadowColor = "rgba(0,0,0,.45)"; f.shadowBlur = K(22); f.shadowOffsetY = K(14);
    f.fillStyle = lin(f, lx, ly, lw, lh, [[0, "#e3d8c5"], [0.18, "#b9aa91"], [0.7, "#a59479"], [1, "#7f705b"]]);
    rr(f, lx, ly, lw, lh, lr); f.fill(); f.restore();
    f.save(); rr(f, lx, ly, lw, lh, lr); f.clip(); cepillado(f, lx, ly, lw, lh, 0.06, 4); f.restore();
    f.strokeStyle = "rgba(255,255,255,.7)"; f.lineWidth = Math.max(1, K(1.5));
    f.beginPath(); f.moveTo(lx + K(4), ly + 1); f.lineTo(lx + lw - K(4), ly + 1); f.stroke();
    f.font = `${K(8.5)}px ${MONO}`; f.textAlign = "center"; f.textBaseline = "middle";
    const txt = [..."RECOJA SU FOTO AQUÍ"].join(" ");
    f.fillStyle = "rgba(255,255,255,.45)"; f.fillText(txt, lx + lw / 2, ly + lh / 2 + 1);
    f.fillStyle = "rgba(42,35,28,.62)"; f.fillText(txt, lx + lw / 2, ly + lh / 2);

    const geo = { W, H: Hp, strip_x: K(96), strip_w: K(150), clip_top: K(78), clip_bottom: K(lip + 14), drop: K(26) };
    return (cacheMaquina[clave] = { panel, front, geo });
  }

  // ------------------------------------------------------------ letrero
  function letrero() {
    const f1 = `700 92px ${SERIF}`, f2 = `700 30px ${SERIF}`, f2i = `italic 700 30px ${SERIF}`;
    const m = cv(10, 10).getContext("2d");
    const ancho = (txt, font, esp) => { m.font = font; return [...txt].reduce((s, ch) => s + m.measureText(ch).width + esp, 0); };
    const w1 = ancho("PHOTOBOOTH", f1, 6) - 6, w = Math.ceil(w1 + 140), h = 200;
    const c = cv(w, h), x = c.getContext("2d");
    x.fillStyle = "#efe6d6"; x.fillRect(0, 0, w, h);
    x.fillStyle = "#2b2420"; x.textBaseline = "middle";
    const escribir = (txt, font, esp, X, Y) => { x.font = font; for (const ch of txt) { x.fillText(ch, X, Y); X += x.measureText(ch).width + esp; } return X; };
    escribir("PHOTOBOOTH", f1, 6, (w - w1) / 2, 70);
    const wa = ancho("FOTOS EN 3 ", f2, 4), wb = ancho("SEGUNDOS", f2i, 2);
    const X = escribir("FOTOS EN 3 ", f2, 4, (w - wa - wb) / 2, 150);
    escribir("SEGUNDOS", f2i, 2, X, 150);
    return c;
  }

  // ------------------------------------------------------------ escena 9:16
  const SW = 1080, SH = 1920, K_ESCENA = 2.4;
  const T = { inicio: 0.35, fin: 3.05, caida: 0.22, total: 4.6 };

  // curva (.42, 0, .25, 1): arranca suave, avanza parejo, frena al final
  function ease(u) {
    u = clamp(u);
    let lo = 0, hi = 1, t = u;
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      const X = 3 * (1 - t) ** 2 * t * 0.42 + 3 * (1 - t) * t * t * 0.25 + t ** 3;
      if (X < u) lo = t; else hi = t;
    }
    return 3 * (1 - t) * t * t + t ** 3;
  }
  function posicion(t, L, drop) {
    const p = t <= T.inicio ? 0 : ease((t - T.inicio) / (T.fin - T.inicio));
    let y = -(1 - p) * L;
    if (t > T.fin) {
      const u = (t - T.fin) / T.caida;
      if (u <= 1) y += drop * u * u;
      else { const v = Math.min(1, (t - T.fin - T.caida) / 0.18); y += drop - drop * 0.2 * Math.sin(Math.PI * v); }
    }
    return y;
  }

  class Escena {
    constructor(tiraCanvas, n, conTexto, nombreFondo) {
      const { panel, front, geo } = maquina(K_ESCENA);
      this.front = front; this.g = geo;
      const sw = geo.strip_w, sh = Math.round(tiraCanvas.height * sw / tiraCanvas.width);
      this.strip = cv(sw, sh);
      const sx = this.strip.getContext("2d");
      sx.imageSmoothingQuality = "high";
      sx.drawImage(tiraCanvas, 0, 0, sw, sh);
      this.L = sh;
      const g = geometria(n, 600, conTexto), f = sw / 600;
      this.fotos = g.ys.map(y => [g.pad * f, y * f, g.pw * f, g.ph * f]);
      this.revelada = this.fotos.map(() => null);

      this.bg = cv(SW, SH);
      const x = this.bg.getContext("2d");
      fondo(x, nombreFondo, SW, SH);
      const card = letrero(), cx = Math.round((SW - card.width) / 2);
      x.save(); x.shadowColor = "rgba(0,0,0,.4)"; x.shadowBlur = 28; x.shadowOffsetY = 14; x.drawImage(card, cx, 110); x.restore();
      this.px = Math.round((SW - geo.W) / 2); this.py = 400;
      x.save(); x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = 60; x.shadowOffsetY = 30; x.drawImage(panel, this.px, this.py); x.restore();
    }
    cuadro(t, x) {
      const g = this.g, top = this.py + g.clip_top, bottom = this.py + g.clip_bottom;
      const sy = top + posicion(t, this.L, g.drop), stripX = this.px + g.strip_x;
      x.drawImage(this.bg, 0, 0);
      x.save();
      x.beginPath(); x.rect(0, top, SW, bottom - top); x.clip();
      x.shadowColor = "rgba(0,0,0,.4)"; x.shadowBlur = 18; x.shadowOffsetY = 12;
      x.drawImage(this.strip, stripX, sy);
      x.shadowColor = "transparent";
      this.fotos.forEach(([fx, fy, fw, fh], i) => {
        if (this.revelada[i] === null && sy + fy + fh * 0.5 >= top) this.revelada[i] = t;
        const r = this.revelada[i], a = r === null ? 1 : Math.max(0, 1 - (t - r) / 0.35);
        if (a > 0) { x.fillStyle = `rgba(248,244,236,${(0.92 * a).toFixed(3)})`; x.fillRect(stripX + fx, sy + fy, fw, fh); }
      });
      x.restore();
      x.drawImage(this.front, this.px, this.py);
    }
  }

  function historia(tiraCanvas, n, conTexto, nombreFondo) {
    const e = new Escena(tiraCanvas, n, conTexto, nombreFondo);
    e.revelada = e.revelada.map(() => -10);
    const c = cv(SW, SH);
    e.cuadro(T.total, c.getContext("2d"));
    return c;
  }

  // graba la animación en tiempo real (unos 4.6 s); MP4 donde el navegador lo permite, si no WebM
  function video(tiraCanvas, n, conTexto, nombreFondo) {
    const tipos = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    const mime = window.MediaRecorder && tipos.find(t => MediaRecorder.isTypeSupported(t));
    if (!mime) return Promise.reject(new Error("sin-video"));
    const e = new Escena(tiraCanvas, n, conTexto, nombreFondo);
    const c = cv(SW, SH), x = c.getContext("2d");
    e.cuadro(0, x);
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8e6 });
    const partes = [];
    rec.ondataavailable = ev => ev.data.size && partes.push(ev.data);
    return new Promise((ok, mal) => {
      rec.onstop = () => ok({ blob: new Blob(partes, { type: mime.split(";")[0] }), ext: mime.startsWith("video/mp4") ? "mp4" : "webm" });
      rec.onerror = mal;
      rec.start(250);
      const t0 = performance.now();
      const paso = ahora => {
        const t = (ahora - t0) / 1000;
        e.cuadro(t, x);
        if (t < T.total) requestAnimationFrame(paso); else setTimeout(() => rec.stop(), 120);
      };
      requestAnimationFrame(paso);
    });
  }

  const aBlob = c => new Promise(ok => c.toBlob(ok, "image/png"));

  return { fuentes, geometria, tira, historia, video, aBlob, FONDOS, T };
})();
