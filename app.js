/* PHOTOBOOTH — lógica del navegador (versión estática para GitHub Pages) */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));

  const FONDOS = ["malva", "lunares", "cereza", "olivo", "vino", "fresa", "limonada", "cielo"];
  const NOMBRE = { malva: "Malva", lunares: "Lunares", cereza: "Cereza", olivo: "Olivo", vino: "Vino", fresa: "Fresa", limonada: "Limonada", cielo: "Cielo" };
  const IMPRESION = { inicio: PB.T.inicio, fin: PB.T.fin, caida: PB.T.caida, rebote: 0.18 };

  const st = {
    n: 4, tono: "bw", fotos: [], imgs: [], id: null, fecha: "", texto: "", conFecha: true,
    fondo: "lunares", formato: "video", stream: null, facing: "user", cancelada: false, cache: {},
  };

  // ---------------------------------------------------------- pantallas
  function mostrar(id, fondo = "madera") {
    $$("[data-pantalla]").forEach(s => (s.hidden = s.id !== id));
    document.body.className = fondo === "madera" ? "madera" : "f-" + fondo;
    window.scrollTo(0, 0);
  }
  function aviso(msg) {
    const a = $("#aviso");
    a.textContent = msg;
    a.classList.add("ver");
    clearTimeout(a._t);
    a._t = setTimeout(() => a.classList.remove("ver"), 2800);
  }

  $$("[data-ranura]").forEach(slot => {
    const r = $("#tpl-ranura").content.firstElementChild.cloneNode(true);
    r.style.setProperty("--h", slot.dataset.h + "px");
    slot.appendChild(r);
  });

  // ---------------------------------------------------------- sonido
  let actx = null;
  const ctx = () => (actx ||= new (window.AudioContext || window.webkitAudioContext)());
  function bip(f = 880, d = 0.09, v = 0.07) {
    try {
      const c = ctx(), o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.value = v;
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + d);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + d);
    } catch {}
  }
  function ruido(dur, vol, filtro) {
    const c = ctx(), len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    s.buffer = b; f.type = "bandpass"; f.frequency.value = filtro; f.Q.value = 0.9; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination);
    return { s, g, c };
  }
  function obturador() {
    try { const { s, g, c } = ruido(0.14, 0.5, 2500); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14); s.start(); } catch {}
  }
  function motor(dur) {
    if (!$("#t-sonido").checked) return;
    try {
      const { s, g, c } = ruido(dur, 0.0, 900);
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 22; lg.gain.value = 0.12; lfo.connect(lg).connect(g.gain);
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.15);
      g.gain.setValueAtTime(0.22, c.currentTime + dur - 0.3);
      g.gain.linearRampToValueAtTime(0, c.currentTime + dur);
      const hum = c.createOscillator(), hg = c.createGain();
      hum.type = "sawtooth"; hum.frequency.value = 68; hg.gain.value = 0.015;
      hum.connect(hg).connect(c.destination);
      s.start(); lfo.start(); hum.start();
      s.stop(c.currentTime + dur); lfo.stop(c.currentTime + dur); hum.stop(c.currentTime + dur);
    } catch {}
  }
  function clac() {
    if ($("#t-sonido").checked) { try { const { s, g, c } = ruido(0.08, 0.6, 600); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08); s.start(); } catch {} }
    try { navigator.vibrate && navigator.vibrate(40); } catch {}
  }

  // ---------------------------------------------------------- inicio
  $$("[data-n]").forEach(b => b.addEventListener("click", () => {
    st.n = +b.dataset.n;
    $$("[data-n]").forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  $$("[data-tono]").forEach(b => b.addEventListener("click", () => {
    st.tono = b.dataset.tono;
    $$("[data-tono]").forEach(x => x.setAttribute("aria-pressed", x === b));
  }));
  $("#b-tomar").addEventListener("click", () => { ctx(); abrirCabina(); });

  // ---------------------------------------------------------- cabina
  const ven = $("#ventanilla"), video = $("#video");
  function modoCabina(modo) {
    $$("#cab-debajo > [data-modo]").forEach(d => (d.hidden = d.dataset.modo !== modo));
    $("#b-girar").style.visibility = modo === "captura" ? "visible" : "hidden";
  }
  function pintarSegmentos(hechas, parcial = 0) {
    $("#segmentos").innerHTML = Array.from({ length: st.n }, (_, i) =>
      `<span><i style="width:${i < hechas ? 100 : i === hechas ? parcial * 100 : 0}%"></i></span>`).join("");
  }
  function pintarMiniaturas(actual) {
    const m = $("#miniaturas");
    m.className = "miniaturas " + st.tono;
    m.innerHTML = Array.from({ length: st.n }, (_, i) =>
      st.fotos[i] ? `<img src="${st.fotos[i]}" alt="Foto ${i + 1}">` : `<div class="${i === actual ? "actual" : ""}"></div>`).join("");
  }
  function apagarCamara() {
    st.stream?.getTracks().forEach(t => t.stop());
    st.stream = null;
    video.srcObject = null;
  }

  async function abrirCabina() {
    st.cancelada = false;
    st.fotos = [];
    mostrar("p-cabina");
    ven.classList.toggle("sepia", st.tono === "sepia");
    $("#v-tono").textContent = st.tono === "sepia" ? "SEPIA" : "B/N";
    $("#v-pie").textContent = `${st.n} POSES · 3 SEG CADA UNA`;
    ven.dataset.estado = "cargando";
    $("#cab-titulo").textContent = "Un momento";
    $("#cab-estado").textContent = "PREPARANDO";
    pintarSegmentos(0);
    modoCabina("cargando");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("sin api"), { name: "NotSupportedError" });
      st.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: st.facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false,
      });
      video.srcObject = st.stream;
      video.classList.toggle("espejo", st.facing === "user");
      await video.play();
      await wait(500);
      if (st.cancelada) return apagarCamara();
      sesion();
    } catch (e) {
      apagarCamara();
      permisoDenegado(e);
    }
  }

  function permisoDenegado(e) {
    ven.dataset.estado = "denegado";
    $("#cab-titulo").textContent = "La cámara está apagada";
    $("#cab-estado").textContent = "";
    const t = $("#perm-texto");
    if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") {
      $("#perm-titulo").textContent = "No encontré una cámara";
      t.textContent = "Conecta una cámara o sube fotos desde tu galería.";
    } else if (e?.name === "NotReadableError") {
      $("#perm-titulo").textContent = "Otra app está usando la cámara";
      t.textContent = "Cierra Zoom, FaceTime u otra app que la tenga abierta y vuelve a intentar.";
    } else if (e?.name === "NotSupportedError" || !window.isSecureContext) {
      $("#perm-titulo").textContent = "Este navegador no deja usar la cámara aquí";
      t.textContent = "Abre la página en Safari o Chrome desde su dirección https://. Si la abriste desde Instagram o TikTok, usa «Abrir en el navegador».";
    } else {
      $("#perm-titulo").textContent = "Para activarla";
      t.textContent = "Toca el ícono de cámara o «aA» junto a la dirección › Permitir cámara, y vuelve a intentar. En Mac revisa también Ajustes › Privacidad › Cámara.";
    }
    modoCabina("permiso");
  }

  $("#b-reintentar").addEventListener("click", abrirCabina);
  $("#b-cerrar").addEventListener("click", () => { st.cancelada = true; apagarCamara(); mostrar("p-inicio"); });
  $("#b-girar").addEventListener("click", async () => {
    st.facing = st.facing === "user" ? "environment" : "user";
    try {
      const nuevo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: st.facing, width: { ideal: 1280 }, height: { ideal: 960 } } });
      st.stream?.getTracks().forEach(t => t.stop());
      st.stream = nuevo; video.srcObject = nuevo; video.classList.toggle("espejo", st.facing === "user");
      await video.play();
    } catch { aviso("Solo hay una cámara disponible."); st.facing = "user"; }
  });

  function capturar() {
    const vw = video.videoWidth, vh = video.videoHeight;
    const esc = Math.min(1, 1280 / vw);
    const c = document.createElement("canvas");
    c.width = Math.round(vw * esc); c.height = Math.round(vh * esc);
    const x = c.getContext("2d");
    if (st.facing === "user") { x.translate(c.width, 0); x.scale(-1, 1); }
    x.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  }

  async function sesion() {
    ven.dataset.estado = "vivo";
    modoCabina("captura");
    const arco = $("#c-arco"), num = $("#c-numero"), cont = $("#v-contador");
    for (let i = 0; i < st.n; i++) {
      if (st.cancelada) return;
      $("#cab-titulo").textContent = `Foto ${i + 1} de ${st.n}`;
      $("#cab-estado").textContent = st.tono === "sepia" ? "SEPIA" : "B/N";
      $("#cab-ayuda").textContent = "Mira a la lente. El flash sale al llegar a cero.";
      $("#pastilla").hidden = true;
      pintarMiniaturas(i);
      cont.hidden = false;
      arco.style.transition = "none"; arco.style.strokeDashoffset = 578;
      await wait(30);
      arco.style.transition = "stroke-dashoffset 2.4s linear"; arco.style.strokeDashoffset = 0;
      for (let k = 3; k >= 1; k--) {
        if (st.cancelada) return;
        num.textContent = k; num.classList.remove("cambia"); void num.offsetWidth; num.classList.add("cambia");
        pintarSegmentos(i, (3 - k) / 3);
        bip(k === 1 ? 1320 : 880);
        await wait(800);
      }
      cont.hidden = true;
      ["#v-flash", "#destello"].forEach(s => { const f = $(s); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); });
      obturador();
      st.fotos[i] = capturar();
      pintarSegmentos(i + 1);
      pintarMiniaturas(i + 1);
      $("#cab-estado").textContent = "LISTA";
      if (i < st.n - 1) {
        $("#pastilla").hidden = false;
        $("#cab-ayuda").textContent = "";
        for (let s = 2; s >= 1; s--) { $("#pastilla-s").textContent = `${s} s`; await wait(1000); if (st.cancelada) return; }
      } else {
        await wait(700);
      }
    }
    apagarCamara();
    revelar();
  }

  $("#f-subir").addEventListener("change", async e => {
    const files = [...e.target.files].filter(f => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    const leer = f => new Promise((ok, err) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = err; r.readAsDataURL(f); });
    const urls = await Promise.all(files.slice(0, st.n).map(leer));
    st.fotos = Array.from({ length: st.n }, (_, i) => urls[i % urls.length]);
    revelar();
  });

  // ---------------------------------------------------------- revelado (todo en el navegador)
  const cargarImg = (img, url) => new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
  const cargarFoto = url => { const im = new Image(); return cargarImg(im, url).then(() => im); };
  const pie = () => [st.texto, st.conFecha ? st.fecha : ""].filter(Boolean).join(" · ");
  const fechaHoy = () => { const d = new Date(), p = v => String(v).padStart(2, "0"); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`; };

  function tiraCanvas() {
    const k = "tira|" + st.tono + "|" + pie();
    return (st.cache[k] ||= PB.tira(st.imgs, st.tono, pie()));
  }
  async function tiraURL() {
    const k = "url|" + st.tono + "|" + pie();
    if (!st.cache[k]) st.cache[k] = URL.createObjectURL(await PB.aBlob(tiraCanvas()));
    return st.cache[k];
  }
  async function historiaBlob() {
    const k = "hist|" + st.tono + "|" + pie() + "|" + st.fondo;
    if (!st.cache[k]) st.cache[k] = await PB.aBlob(PB.historia(tiraCanvas(), st.n, Boolean(pie()), st.fondo));
    return st.cache[k];
  }

  async function revelar() {
    mostrar("p-imprimiendo", "cereza");
    const r = $("#imp-ranura .ranura"), tira = $(".r-tira", r), img = $("img", tira), velos = $(".r-velos", tira);
    tira.style.transform = "translateY(-110%)";
    $("#imp-barra").style.width = "0%";
    $("#imp-tiempo").textContent = "Revelando…";
    Object.values(st.cache).forEach(v => typeof v === "string" && URL.revokeObjectURL(v));
    st.cache = {};
    st.id = Date.now().toString(36);
    st.fecha = fechaHoy();
    try {
      await PB.fuentes();
      st.imgs = await Promise.all(st.fotos.map(cargarFoto));
      await wait(30);
      await cargarImg(img, await tiraURL());
    } catch (err) {
      console.error(err);
      aviso("No se pudo revelar. Intenta de nuevo.");
      mostrar("p-inicio");
      return;
    }
    await animarTira(r, tira, img, velos);
    await wait(900);
    abrirResultado();
  }

  function animarTira(r, tira, img, velos) {
    const W = 150, L = img.getBoundingClientRect().height || img.naturalHeight * W / img.naturalWidth;
    const g = PB.geometria(st.n, 600, Boolean(pie())), f = W / 600;
    velos.innerHTML = g.ys.map(y => `<i style="left:${g.pad * f}px;top:${y * f}px;width:${g.pw * f}px;height:${g.ph * f}px;opacity:1"></i>`).join("");
    const capas = [...velos.children], vistas = capas.map(() => null);
    const { inicio, fin, caida, rebote } = IMPRESION;
    const drop = 26, total = fin + caida + rebote;
    let sonoMotor = false, sonoClac = false;
    return new Promise(listo => {
      const t0 = performance.now();
      const paso = ahora => {
        const t = (ahora - t0) / 1000;
        if (!sonoMotor && t >= inicio) { sonoMotor = true; motor(fin - inicio); r.classList.add("girando"); }
        if (t >= fin) r.classList.remove("girando");
        const p = t <= inicio ? 0 : ease((t - inicio) / (fin - inicio));
        let y = -(1 - p) * L;
        if (t > fin) {
          const u = (t - fin) / caida;
          if (u <= 1) y += drop * u * u;
          else { const v = Math.min(1, (t - fin - caida) / rebote); y += drop - drop * 0.2 * Math.sin(Math.PI * v); if (!sonoClac) { sonoClac = true; clac(); } }
        }
        tira.style.transform = `translateY(${y}px)`;
        capas.forEach((c, i) => {
          const centro = y + (g.ys[i] + g.ph / 2) * f;
          if (vistas[i] === null && centro >= 0) vistas[i] = t;
          if (vistas[i] !== null) c.style.opacity = Math.max(0, 1 - (t - vistas[i]) / 0.35);
        });
        const prog = Math.min(1, Math.max(0, (t - inicio) / (fin - inicio)));
        $("#imp-barra").style.width = prog * 100 + "%";
        $("#imp-tiempo").textContent = `${Math.min(t, fin).toFixed(1)} / ${fin.toFixed(1)} s`;
        if (t < total) requestAnimationFrame(paso); else listo();
      };
      requestAnimationFrame(paso);
    });
  }
  function ease(u) {
    u = Math.min(1, Math.max(0, u));
    let lo = 0, hi = 1, t = u;
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      const x = 3 * (1 - t) ** 2 * t * 0.42 + 3 * (1 - t) * t * t * 0.25 + t ** 3;
      if (x < u) lo = t; else hi = t;
    }
    return 3 * (1 - t) * t * t + t ** 3;
  }

  // ---------------------------------------------------------- resultado
  const muestras = $("#muestras");
  muestras.innerHTML = FONDOS.map(f => `<button type="button" class="m-${f}" data-fondo="${f}" aria-label="Fondo ${NOMBRE[f]}" aria-pressed="${f === st.fondo}"></button>`).join("");
  muestras.addEventListener("click", e => {
    const b = e.target.closest("[data-fondo]");
    if (!b) return;
    st.fondo = b.dataset.fondo;
    $$("[data-fondo]").forEach(x => x.setAttribute("aria-pressed", x === b));
    $("#fondo-nombre").textContent = NOMBRE[st.fondo].toUpperCase();
    document.body.className = "f-" + st.fondo;
  });

  function abrirResultado() {
    mostrar("p-resultado", st.fondo);
    $("#res-fecha").textContent = st.fecha.replaceAll(".", " · ");
    $("#fondo-nombre").textContent = NOMBRE[st.fondo].toUpperCase();
    actualizarTira();
  }
  async function actualizarTira() {
    const img = $("#res-img"), a = $("#b-descargar");
    img.classList.add("cargando");
    await wait(20);
    const url = await tiraURL();
    await cargarImg(img, url).catch(() => {});
    img.classList.remove("cargando");
    a.href = url;
    a.download = `photobooth-tira-${st.id}.png`;
  }
  let tTexto;
  $("#i-texto").addEventListener("input", e => {
    st.texto = e.target.value.trim();
    clearTimeout(tTexto);
    tTexto = setTimeout(actualizarTira, 450);
  });
  $("#i-fecha").addEventListener("change", e => { st.conFecha = e.target.checked; actualizarTira(); });
  $("#b-repetir").addEventListener("click", () => { st.fotos = []; st.imgs = []; mostrar("p-inicio"); });

  // ---------------------------------------------------------- compartir
  const hoja = $("#hoja");
  let urlVista = null;
  $("#b-compartir").addEventListener("click", async () => {
    hoja.hidden = false;
    $("#b-hoja-cerrar").focus();
    const puede = navigator.canShare && navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] });
    $("#b-hoja-compartir").hidden = !puede;
    const carga = $("#hoja-cargando");
    carga.textContent = "Preparando vista…"; carga.hidden = false;
    await wait(30);
    if (urlVista) URL.revokeObjectURL(urlVista);
    urlVista = URL.createObjectURL(await historiaBlob());
    $("#hoja-img").src = urlVista;
    carga.hidden = true;
  });
  $("#b-hoja-cerrar").addEventListener("click", () => (hoja.hidden = true));
  hoja.addEventListener("click", e => { if (e.target === hoja) hoja.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !hoja.hidden) hoja.hidden = true; });
  $$("[data-formato]").forEach(b => b.addEventListener("click", () => {
    st.formato = b.dataset.formato;
    $$("[data-formato]").forEach(x => x.setAttribute("aria-pressed", x === b));
    $("#hoja-ayuda").textContent = st.formato === "video"
      ? "El video dura unos 4 segundos y está listo para historias o reels. Se graba en vivo, deja la pantalla abierta."
      : "Imagen vertical de 1080 × 1920 con tu tira y el fondo que elegiste.";
  }));

  let ocupado = false;
  async function archivo() {
    const carga = $("#hoja-cargando");
    if (st.formato === "video") {
      const k = "vid|" + st.tono + "|" + pie() + "|" + st.fondo;
      if (st.cache[k]) return st.cache[k];
      carga.textContent = "Grabando video…"; carga.hidden = false;
      try {
        const { blob, ext } = await PB.video(tiraCanvas(), st.n, Boolean(pie()), st.fondo);
        return (st.cache[k] = new File([blob], `photobooth-${st.id}.${ext}`, { type: blob.type }));
      } finally { carga.hidden = true; }
    }
    const blob = await historiaBlob();
    return new File([blob], `photobooth-historia-${st.id}.png`, { type: "image/png" });
  }
  $("#b-hoja-guardar").addEventListener("click", async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      const f = await archivo();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f); a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      aviso("Guardado en tus descargas");
    } catch (e) {
      aviso(e?.message === "sin-video" ? "Este navegador no puede grabar video. Usa «Solo imagen»." : "No se pudo preparar el archivo.");
    } finally { ocupado = false; }
  });
  $("#b-hoja-compartir").addEventListener("click", async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      const f = await archivo();
      await navigator.share({ files: [f], title: "PHOTOBOOTH" });
    } catch (e) {
      if (e?.name === "NotAllowedError") aviso("Toca «Compartir…» otra vez: el archivo ya está listo.");
      else if (e?.name !== "AbortError") aviso("Tu navegador no pudo compartir el archivo.");
    } finally { ocupado = false; }
  });

  mostrar("p-inicio");
})();
