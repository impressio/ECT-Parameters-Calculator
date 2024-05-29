/* =====================================================================
 * single-neuron.js - the action potential of one neuron during one
 * stimulus pulse, in slow motion, after the Hodgkin-Huxley model:
 *  - membrane close-up: voltage-gated Na+ channels (activation gate m,
 *    inactivation gate h) and K+ channels (gate n) drawn from the model's
 *    gate states, ion flow, membrane charge and the Na+/K+ pump;
 *  - membrane potential with the phases numbered (depolarization,
 *    threshold, rising phase, peak, falling phase, undershoot), the
 *    equilibrium potentials and the absolute and relative refractory
 *    periods; the matching list under the canvas follows the animation;
 *  - current flow along a myelinated axon with the device's pulse train
 *    (after Purves et al., Neuroscience, 6th ed., figure 2.3);
 *  - the synapse: the ten steps of chemical transmission and the EPSP
 *    (after Purves et al., Neuroscience, fig. 5.3);
 *  - the strength-duration curve (rheobase, chronaxie) of the model.
 *
 * Model: Hodgkin-Huxley (1952) squid axon parameters at 6.3 °C, rest
 * -65 mV. Time is compressed by TIME_SCALE so that the chronaxie is
 * CHRONAXIE_MS (cortex: about 0.1-0.3 ms); the shape is unchanged. The
 * device current I (mA) drives a stimulus current density
 * J = I/1000 x k x J0, where k falls with distance from the electrode and
 * J0 is set so that the neuron nearest the electrode reaches threshold at
 * 450 mA with 0.3 ms pulses, as in the tissue simulation.
 * ===================================================================== */
document.addEventListener('DOMContentLoaded', function () {
  const canvas = document.getElementById('singleCanvas');
  if (!canvas) return;
  // Two canvases share one simulation: the single neuron (top card) and the axon, strength-duration curve
  // and whole neuron (card below). Drawing functions use `g`, `width` and `height` of the canvas in use.
  const axonCanvas = document.getElementById('axonCanvas');
  const sdCanvas = document.getElementById('sdCanvas');   // strength-duration curve, in the Neuron stimulation card
  const synCanvas = document.getElementById('synCanvas');   // synaptic transmission and EPSP, its own card
  const surfaces = [canvas, axonCanvas, sdCanvas, synCanvas].map(el => ({ el, ctx: el.getContext('2d'), w: 0, h: 0 }));
  let g = surfaces[0].ctx;
  const t = window.ectT;   // i18n.js
  // Numbers as displayed: decimal comma in Swedish
  const num = (v, digits) => { const s = digits === undefined ? String(v) : v.toFixed(digits); return document.documentElement.lang === 'sv' ? s.replace('.', ',') : s; };
  const D = window.ECTDraw;   // illustration.js
  const pwSlider = document.getElementById('pulseWidth');
  const currentSlider = document.getElementById('current');
  const frequencySlider = document.getElementById('pulseFrequency');
  // Play/pause and restart of the tissue simulation (Neuron stimulation card) also control these figures
  const playButton = document.getElementById('simPlay'), restartButton = document.getElementById('simRestart');
  const distanceButtons = [...document.querySelectorAll('#singleDistance [data-k]')];
  const allDistanceButtons = [...document.querySelectorAll('.sim-distance [data-k]')];
  const out = {
    rheobase: document.getElementById('singleRheobase'),
    chronaxie: document.getElementById('singleChronaxie'),
    threshold: document.getElementById('singleThreshold')
  };

  // ───────── Hodgkin-Huxley model (model time: ms at 6.3 °C) ─────────
  const G_NA = 120, G_K = 36, G_L = 0.3;               // mS/cm²
  const E_NA = 50, E_K = -77, E_L = -54.387;           // mV
  const REST_MV = -65;
  const CHRONAXIE_MS = 0.25;
  const NEAR_K = 3.86, NEAR_THRESHOLD_MA = 450, CALIBRATION_PW_MS = 0.3;
  const K_VALUES = distanceButtons.map(b => parseFloat(b.dataset.k));

  function rates(V) {
    const x = V + 40, y = V + 55;
    return [
      Math.abs(x) < 1e-6 ? 1 : 0.1 * x / (1 - Math.exp(-x / 10)), 4 * Math.exp(-(V + 65) / 18),
      0.07 * Math.exp(-(V + 65) / 20), 1 / (1 + Math.exp(-(V + 35) / 10)),
      Math.abs(y) < 1e-6 ? 0.1 : 0.01 * y / (1 - Math.exp(-y / 10)), 0.125 * Math.exp(-(V + 65) / 80)
    ];
  }
  // One step: gates by exponential Euler, voltage semi-implicit (stable at the spike's peak)
  function step(s, J, dt) {
    const [am, bm, ah, bh, an, bn] = rates(s.V);
    const gate = (x, a, b) => { const inf = a / (a + b); return inf + (x - inf) * Math.exp(-dt * (a + b)); };
    const m = gate(s.m, am, bm), h = gate(s.h, ah, bh), n = gate(s.n, an, bn);
    const gNa = G_NA * m * m * m * h, gK = G_K * n * n * n * n;
    const V = (s.V + dt * (gNa * E_NA + gK * E_K + G_L * E_L + J)) / (1 + dt * (gNa + gK + G_L));
    return { V, m, h, n, gNa, gK };
  }
  const REST_STATE = (() => {
    const r = rates(REST_MV);
    let s = { V: REST_MV, m: r[0] / (r[0] + r[1]), h: r[2] / (r[2] + r[3]), n: r[4] / (r[4] + r[5]) };
    for (let i = 0; i < 5000; i++) s = step(s, 0, 0.02);
    return s;
  })();

  // Does a pulse of density J and model width pw give an action potential?
  function fires(J, pw) {
    const dt = 0.02;
    let s = REST_STATE, prev = s.V;
    for (let time = 0; time < pw + 30; time += dt) {
      s = step(s, time < pw ? J : 0, dt);
      if (s.V > 0) return true;
      if (time > pw + 1 && s.V < prev && s.V < -50) return false;   // falling back without a spike
      prev = s.V;
    }
    return false;
  }
  function thresholdDensity(pw, guess) {
    let lo = 0, hi = guess || 50;
    while (!fires(hi, pw)) { lo = hi; hi *= 2; if (hi > 1e5) return Infinity; }
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fires(mid, pw)) hi = mid; else lo = mid; }
    return hi;
  }
  // Strength-duration curve in model time, from long to short pulses; chronaxie sets the time scale
  const SD = (() => {
    const widths = [];
    for (let j = 0; j <= 28; j++) widths.push(Math.pow(10, Math.log10(100) - j * (Math.log10(100) - Math.log10(0.2)) / 28));
    const densities = [];
    let guess = 3;
    for (const w of widths) { guess = thresholdDensity(w, guess); densities.push(guess); }
    widths.reverse(); densities.reverse();
    const rheobase = densities[densities.length - 1];
    const at = (target) => {   // model width where the threshold density equals target (log interpolation)
      for (let j = 1; j < widths.length; j++) {
        if (densities[j] <= target) {
          const f = (Math.log(densities[j - 1]) - Math.log(target)) / (Math.log(densities[j - 1]) - Math.log(densities[j]));
          return Math.exp(Math.log(widths[j - 1]) + f * (Math.log(widths[j]) - Math.log(widths[j - 1])));
        }
      }
      return Infinity;
    };
    return { widths, densities, rheobase, chronaxieModel: at(2 * rheobase), widthFor: at };
  })();
  const TIME_SCALE = SD.chronaxieModel / CHRONAXIE_MS;            // model ms per real ms
  const densityAt = (pwReal) => {                                  // threshold density for a real pulse width
    const w = pwReal * TIME_SCALE, W = SD.widths, D = SD.densities;
    if (w <= W[0]) return D[0] * W[0] / w;
    for (let j = 1; j < W.length; j++) {
      if (w <= W[j]) {
        const f = (Math.log(w) - Math.log(W[j - 1])) / (Math.log(W[j]) - Math.log(W[j - 1]));
        return Math.exp(Math.log(D[j - 1]) + f * (Math.log(D[j]) - Math.log(D[j - 1])));
      }
    }
    return SD.rheobase;
  };
  const J0 = densityAt(CALIBRATION_PW_MS) / (NEAR_THRESHOLD_MA / 1000 * NEAR_K);
  const thresholdCurrent = (pwReal, kk) => densityAt(pwReal) / (kk * J0) * 1000;   // mA
  const rheobaseCurrent = (kk) => SD.rheobase / (kk * J0) * 1000;

  // ───────── One pulse with the present settings (real time, ms) ─────────
  const PULSE_START_MS = 0.4;
  const DT_MODEL = 0.01;
  let k = K_VALUES[0];
  let trace;

  function compute() {
    const pw = parseFloat(pwSlider.value), current = parseFloat(currentSlider.value);
    const J = current / 1000 * k * J0;
    // simulate long enough for the action potential to reach the terminal and the synapse to act
    let end = PULSE_START_MS + pw + 6;
    const samples = [];
    let s = REST_STATE;
    for (let model = 0; model <= end * TIME_SCALE; model += DT_MODEL) {
      const real = model / TIME_SCALE;
      const on = real >= PULSE_START_MS && real < PULSE_START_MS + pw;
      s = step(s, on ? J : 0, DT_MODEL);
      const iIon = s.gNa * (s.V - E_NA) + s.gK * (s.V - E_K) + G_L * (s.V - E_L);
      samples.push({ time: real, V: s.V, m: s.m, h: s.h, n: s.n, gNa: s.gNa, gK: s.gK, iIon, on });
    }
    // phases of the action potential
    let peak = 0;
    samples.forEach((p, i) => { if (p.V > samples[peak].V) peak = i; });
    const spike = samples[peak].V > 0;
    const phases = { spike, peak: samples[peak].time };
    if (spike) {
      // threshold: the net ionic current turns inward (Na+ influx exceeds K+ and leak outflow)
      let thr = samples.findIndex((p, i) => i < peak && p.time > PULSE_START_MS && p.iIon < 0 && p.V > REST_MV + 2);
      if (thr < 0) thr = Math.max(0, peak - Math.round(0.1 * TIME_SCALE / DT_MODEL));
      let fallEnd = samples.findIndex((p, i) => i > peak && p.V < REST_MV);
      if (fallEnd < 0) fallEnd = samples.length - 1;
      let minIndex = fallEnd;
      for (let i = fallEnd; i < samples.length; i++) if (samples[i].V < samples[minIndex].V) minIndex = i;
      const recover = samples.findIndex((p, i) => i > minIndex && p.V > REST_MV - 0.5);
      Object.assign(phases, {
        threshold: samples[thr].time, thresholdV: samples[thr].V,
        fallEnd: samples[fallEnd].time, undershoot: samples[minIndex].time,
        recover: recover > 0 ? samples[recover].time : end
      });
    }
    const arrival = spike ? phases.peak + ARRIVAL_DELAY_MS : null;
    end = spike ? Math.max(PULSE_START_MS + pw + 4, arrival + 3.2) : PULSE_START_MS + pw + 4;
    while (samples.length && samples[samples.length - 1].time > end) samples.pop();
    if (spike) phases.recover = Math.min(phases.recover, end);
    trace = { pw, current, J, end, samples, phases, arrival };
  }
  const sampleAt = (time) => trace.samples[Math.max(0, Math.min(trace.samples.length - 1, Math.round(time * TIME_SCALE / DT_MODEL)))];

  // Phase number (1-6) at a time, 0 at rest, 7 below threshold
  function phaseAt(time) {
    const P = trace.phases, p0 = PULSE_START_MS, p1 = PULSE_START_MS + trace.pw;
    if (!P.spike) return time >= p0 ? 7 : 0;
    if (time < p0) return 0;
    if (time < P.threshold - 0.02) return 1;
    if (time < P.threshold + 0.03) return 2;
    if (time < P.peak - 0.03) return 3;
    if (time < P.peak + 0.05) return 4;
    if (time < P.fallEnd) return 5;
    if (time < P.recover) return 6;
    return time > p1 ? 0 : 1;
  }

  // ───────── Drawing helpers ─────────
  const C = {
    ink: '#1e1e1e', muted: '#757575', line: '#e6e6e6', ok: '#14ae5c', bad: '#f24822',
    accent: '#0d99ff', spike: '#ffa629', na: '#ff9f43', naDark: '#d9771f', k: '#9b7bff', kDark: '#6f4fd8',
    outside: '#eef6fc', inside: '#fbf0ec', head: '#e2cfa8', headEdge: '#bfa77a', tail: '#d8c7a4',
    absolute: 'rgba(242, 72, 34, 0.10)', relative: 'rgba(255, 166, 41, 0.12)',
    myelin: '#fbfbfb', myelinEdge: '#b9b9c0', axon: '#f3e6e2'
  };
  const rootStyle = getComputedStyle(document.documentElement);
  const fontFamily = rootStyle.getPropertyValue('--font').trim();
  const fontSmall = parseFloat(rootStyle.getPropertyValue('--fs-small'));
  const font = (weight) => `${weight || 400} ${fontSmall}px ${fontFamily}`;
  const rgba = (hex, a) => { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16}, ${(v >> 8) & 255}, ${v & 255}, ${a})`; };

  let width = 0, height = 0;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    for (const sf of surfaces) {
      sf.w = sf.el.clientWidth; sf.h = sf.el.clientHeight;
      sf.el.width = Math.round(sf.w * dpr); sf.el.height = Math.round(sf.h * dpr);
      sf.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  function use(sf) { g = sf.ctx; width = sf.w; height = sf.h; }
  // Layout of the canvas in use: the single neuron (top card) or the axon card
  function layout() {
    const wide = width >= 760, w = width - 60;
    if (g === surfaces[0].ctx) {
      if (wide) {
        const split = Math.round(width * 0.45), rx = split + 56, rw = width - split - 64;
        return { membrane: { x: 0, y: 0, w: split - 16, h: 430 }, vm: { x: rx, y: 30, w: rw, h: 300 }, phases: { x: 0, y: 410, w: width } };
      }
      return { membrane: { x: 0, y: 0, w: width, h: 380 }, vm: { x: 52, y: 400, w, h: 240 }, phases: { x: 0, y: 735, w: width } };
    }
    if (g === surfaces[2].ctx) return { sd: { x: wide ? 56 : 52, y: 30, w: wide ? width - 64 : w, h: height - 80 } };
    if (g === surfaces[3].ctx) {
      // same grid as the single-neuron card: drawing on the left, potential plot on the right, caption under both
      if (wide) {
        const split = Math.round(width * 0.45);
        return { syn: { x: 0, y: 6, w: split - 16, h: 364 }, epsp: { x: split + 56, y: 30, w: width - split - 64, h: 300 }, caption: { x: 0, y: 410, w: width } };
      }
      return { syn: { x: 0, y: 0, w: width, h: 380 }, epsp: { x: 52, y: 430, w, h: 240 }, caption: { x: 0, y: 735, w: width } };
    }
    return { cond: { x: 0, y: 18, w: width, h: height - 18 } };
  }
  function label(text, x, y, opts = {}) {
    g.font = font(opts.weight || 400); g.textAlign = opts.align || 'left';
    if (opts.bg) {   // light backdrop so the label stays readable over the drawing
      const tw = g.measureText(text).width, x0 = opts.align === 'center' ? x - tw / 2 : opts.align === 'right' ? x - tw : x;
      g.fillStyle = 'rgba(255, 255, 255, 0.85)'; g.beginPath(); g.roundRect(x0 - 4, y - fontSmall, tw + 8, fontSmall + 6, 4); g.fill();
    }
    g.fillStyle = opts.color || C.muted; g.fillText(text, x, y); g.textAlign = 'left';
  }
  function wrapText(text, x, y, maxWidth, lineHeight) {
    let line = '';
    for (const word of text.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > maxWidth && line) { g.fillText(line, x, y); line = word; y += lineHeight; }
      else line = test;
    }
    if (line) g.fillText(line, x, y);
    return y + 6;   // bottom of the text
  }
  // Fit a canvas to its content so the card ends right after the figure caption
  function fit(sf, bottom) {
    const needed = Math.ceil(bottom + 6);
    if (bottom > 0 && Math.abs(needed - sf.h) > 2) sf.el.style.setProperty('height', `${needed}px`, 'important');
  }
  const wobble = (i, time, speed) => Math.sin(i * 12.9898 + time * speed) * 0.5 + Math.sin(i * 4.1 + time * speed * 0.7) * 0.5;

  // ───────── Membrane close-up ─────────
  const NA_COLORS = { light: '#ffe2c2', mid: '#ffb36b', dark: '#e48a3a', edge: '#b9661f' };
  const K_COLORS = { light: '#e6dcff', mid: '#b9a3ff', dark: '#8d72e8', edge: '#6347c4' };
  const PUMP_COLORS = { light: '#e1f2e3', mid: '#a9d6b0', dark: '#78b383', edge: '#4c8a58' };
  function drawMembrane(box, time, now) {
    const { x, y, w, h } = box;
    const top = y + 30, bottom = y + h - 62, mid = (top + bottom) / 2;
    const p = sampleAt(time);
    const naX = x + w * 0.3, kX = x + w * 0.55, pumpX = x + w * 0.8, lipid = Math.max(3.2, Math.min(5, w / 90));
    // compartments
    const out = g.createLinearGradient(0, top, 0, mid); out.addColorStop(0, '#f4f9fd'); out.addColorStop(1, '#e4f0fa');
    const ins = g.createLinearGradient(0, mid, 0, bottom); ins.addColorStop(0, '#fbeee9'); ins.addColorStop(1, '#fdf6f3');
    g.fillStyle = out; g.fillRect(x, top, w, mid - top);
    g.fillStyle = ins; g.fillRect(x, mid, w, bottom - mid);
    // bilayer with gaps for the proteins
    const gapHalf = lipid * 5.5;
    const layer = D.bilayer(g, x, x + w, mid, lipid, [[naX - gapHalf, naX + gapHalf], [kX - gapHalf, kX + gapHalf], [pumpX - gapHalf * 1.3, pumpX + gapHalf * 1.3]]);
    const memH = layer.innerY - layer.outerY + 10;
    label(t('singleOutside'), x + 8, top + 16, { weight: 500 });
    label(t('singleInside'), x + 8, bottom - 8, { weight: 500 });
    label(`${p.V >= 0 ? '+' : ''}${Math.round(p.V)} mV`, x + w - 8, top + 16, { weight: 600, color: p.V > -55 ? C.naDark : C.ink, align: 'right' });
    // ions as spheres: Na+ mostly outside, K+ mostly inside
    const ions = (count, colors, yTop, yBottom, seed) => {
      for (let i = 0; i < count; i++) {
        const px = x + 12 + ((i * 47 + seed * 13) % 100) / 100 * (w - 24) + wobble(i + seed, now / 1000, 1.3) * 4;
        const py = yTop + ((i * 61 + seed * 29) % 100) / 100 * (yBottom - yTop) + wobble(i * 3 + seed, now / 1000, 1.1) * 3;
        D.sphere(g, px, py, 3.4, colors.mid, colors.edge);
      }
    };
    ions(16, NA_COLORS, top + 28, layer.outerY - 22, 1);
    ions(4, NA_COLORS, layer.innerY + 22, bottom - 26, 2);
    ions(4, K_COLORS, top + 28, layer.outerY - 22, 3);
    ions(16, K_COLORS, layer.innerY + 22, bottom - 26, 4);
    // membrane charge (a capacitor): sign and amount follow the potential
    const pairs = Math.min(10, Math.round(Math.abs(p.V) / 65 * 8));
    g.font = font(600); g.textAlign = 'center';
    for (let i = 0; i < pairs; i++) {
      const px = x + w * (0.06 + 0.88 * (i + 0.5) / 10);
      if ([naX, kX, pumpX].some(cx => Math.abs(px - cx) < gapHalf + 6)) continue;
      g.fillStyle = p.V < 0 ? C.bad : C.accent; g.fillText(p.V < 0 ? '+' : '−', px, layer.outerY - 6);
      g.fillStyle = p.V < 0 ? C.accent : C.bad; g.fillText(p.V < 0 ? '−' : '+', px, layer.innerY + 16);
    }
    g.textAlign = 'left';
    // channels: the Na+ activation gate (m³) widens the pore, the inactivation gate (1 - h) plugs it from inside
    const naOpen = Math.min(1, p.m * p.m * p.m * 1.6), plugged = 1 - p.h, kOpen = Math.min(1, Math.pow(p.n, 4) * 1.6);
    D.channel(g, naX, mid, memH, naOpen, NA_COLORS);
    D.channel(g, kX, mid, memH, kOpen, K_COLORS);
    // ball and chain
    const ballX = naX + (1 - plugged) * 12, ballY = mid + memH / 2 + 14 - plugged * 12;
    g.strokeStyle = NA_COLORS.edge; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(naX + memH * 0.3, mid + memH / 2); g.bezierCurveTo(naX + memH * 0.45, ballY + 10, ballX + 10, ballY + 8, ballX, ballY); g.stroke();
    D.sphere(g, ballX, ballY, 5.5, NA_COLORS.dark, NA_COLORS.edge);
    // Na+/K+ pump: a larger protein moving 3 Na+ out and 2 K+ in
    const pw = memH * 0.9;
    const pg = g.createLinearGradient(pumpX - pw / 2, 0, pumpX + pw / 2, 0);
    pg.addColorStop(0, PUMP_COLORS.light); pg.addColorStop(0.5, PUMP_COLORS.mid); pg.addColorStop(1, PUMP_COLORS.dark);
    g.fillStyle = pg; g.strokeStyle = PUMP_COLORS.edge; g.lineWidth = 1.1;
    g.beginPath(); g.roundRect(pumpX - pw / 2, mid - memH / 2 - 4, pw, memH + 8, pw * 0.3); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(76, 138, 88, 0.5)'; g.beginPath(); g.moveTo(pumpX, mid - memH / 2); g.lineTo(pumpX, mid + memH / 2); g.stroke();
    const cycle = (now / 1800) % 1;
    for (let i = 0; i < 3; i++) D.sphere(g, pumpX - 7 + i * 7, mid + memH / 2 - cycle * (memH + 30), 2.8, NA_COLORS.mid, NA_COLORS.edge);
    for (let i = 0; i < 2; i++) D.sphere(g, pumpX - 4 + i * 8, mid - memH / 2 + cycle * (memH + 30), 2.8, K_COLORS.mid, K_COLORS.edge);
    // ion flow through the open channels, in proportion to the current through them
    const flow = (cx, colors, amount, inward) => {
      const count = Math.min(8, Math.round(amount));
      for (let i = 0; i < count; i++) {
        const f = ((now / 500) + i / count) % 1, span = memH + 60;
        const py = inward ? mid - span / 2 + f * span : mid + span / 2 - f * span;
        D.sphere(g, cx + Math.sin(i * 2 + now / 200) * 1.5, py, 3.4, colors.mid, colors.edge);
      }
    };
    flow(naX, NA_COLORS, p.gNa * Math.abs(p.V - E_NA) / 300, true);
    flow(kX, K_COLORS, p.gK * Math.abs(p.V - E_K) / 300, false);
    // stimulus current while the pulse is on
    if (p.on) {
      const ax = x + w * 0.1, grad = g.createLinearGradient(0, top + 30, 0, bottom - 30);
      grad.addColorStop(0, 'rgba(13, 153, 255, 0.2)'); grad.addColorStop(1, C.accent);
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(ax - 4, top + 34); g.lineTo(ax + 4, top + 34); g.lineTo(ax + 4, bottom - 46); g.lineTo(ax + 10, bottom - 46);
      g.lineTo(ax, bottom - 30); g.lineTo(ax - 10, bottom - 46); g.lineTo(ax - 4, bottom - 46); g.closePath(); g.fill();
      label(t('singleStimulus'), ax + 12, top + 46, { weight: 500, color: C.accent });
    }
    // callouts for the proteins
    const call = (key, cx) => D.callout(g, t(key), [cx, mid - memH / 2 - 2], [cx, top + 38], { font: font(500) });
    call('memNaChannel', naX); call('memKChannel', kX); call('singlePump', pumpX);
    // legend
    const ly = bottom + 4, lx = x + w - 8;
    g.font = font(400); const kw = g.measureText('K⁺').width, nw = g.measureText('Na⁺').width;
    D.sphere(g, lx - kw - 10, ly - 4, 4, K_COLORS.mid, K_COLORS.edge); label('K⁺', lx, ly, { align: 'right', color: C.ink });
    D.sphere(g, lx - kw - 24 - nw - 10, ly - 4, 4, NA_COLORS.mid, NA_COLORS.edge); label('Na⁺', lx - kw - 24, ly, { align: 'right', color: C.ink });
  }

  // ───────── Figure caption: all phases of the action potential (static text) ─────────
  function drawPhaseList(box) {
    g.font = font(400); g.fillStyle = C.ink;
    return wrapText(t('apFigureCaption'), box.x + 8, box.y, box.w - 16, 18);
  }


  // ───────── Current flow along a myelinated axon with the device's pulse train ─────────
  // After Purves et al., Neuroscience, 6th ed., figure 2.3 (after Hodgkin and Rushton 1946), drawn on a
  // myelinated axon and driven by the calculator: the biphasic pulse train (pulse width, frequency,
  // current) is applied by an electrode at 0 mm, and the Hodgkin-Huxley model decides at every site,
  // pulse by pulse, whether it reaches threshold (including refractoriness and the hyperpolarizing
  // negative pulses). An action potential is regenerated at every node of Ranvier with the same
  // amplitude, only later farther away. Each node shows one recording: the sum of what reaches it.
  const COND_NODES_MM = [0, 0.5, 1.0, 1.5, 2.0];
  const COND_RANGE_MM = [0, 2];   // the axon, field and distance plot run from the first to the last node
  const SPEED_MM_PER_MS = 1;   // slowed for display; myelinated axons conduct many times faster
  const COND_SAMPLES = 600, AP_LEN_MS = 2.6, COND_V = [-90, 65];
  const REC_BEFORE_MS = 0.1, REC_AFTER_MS = 6;   // node recordings: from 0.1 ms before to 6 ms after the first pulse
  // Action potential shape from the model: a strong 0.3 ms pulse from rest, from the start of the upstroke
  const AP_SHAPE = (() => {
    const out = [], dt = 0.01, J = 40 * SD.rheobase;
    let s = REST_STATE, started = -1;
    for (let model = 0; model < 4 * TIME_SCALE; model += dt) {
      s = step(s, model < 0.3 * TIME_SCALE ? J : 0, dt);
      if (started < 0 && s.V > -50) started = model;
      if (started >= 0) out.push([(model - started) / TIME_SCALE, s.V]);
    }
    return out;
  })();
  const apAt = (since) => {   // membrane potential (mV) `since` ms after the upstroke started (samples are evenly spaced)
    const i = Math.round(since * TIME_SCALE / 0.01);
    return i >= 0 && i < AP_SHAPE.length ? AP_SHAPE[i][1] : REST_MV;
  };
  // The stimulus is a field along the axon, strongest at the electrode and fading with distance
  // (relative strength 1 / (1 + (d / FIELD_MM)²)). Every node gets its own share: where it reaches
  // threshold the node is excited directly, elsewhere it is only depolarized (or hyperpolarized) in
  // part, and the action potential reaches it by propagation instead.
  const FIELD_MM = 0.5;
  const fieldAt = (d) => 1 / (1 + (d / FIELD_MM) ** 2);
  const SIM_MM = COND_NODES_MM;   // the nodes of Ranvier are the simulated sites
  let cond;
  let side = 1;   // 1: axon under electrode E1, -1: under E2

  // Hodgkin-Huxley integration for one site without allocations (the axon panel runs several sites on every
  // slider change): same equations and rest state as step(), with the gate updates tabulated against the
  // membrane potential for the fixed step COND_DT (linear interpolation, 0.05 mV spacing).
  // drive[i] is the stimulus sign at model step i.
  const COND_DT = 0.025, TABLE_MIN = -150, TABLE_STEP = 0.05, TABLE_N = 5001;
  const GATES = (() => {
    const t = { mInf: new Float64Array(TABLE_N), mK: new Float64Array(TABLE_N), hInf: new Float64Array(TABLE_N), hK: new Float64Array(TABLE_N), nInf: new Float64Array(TABLE_N), nK: new Float64Array(TABLE_N) };
    for (let i = 0; i < TABLE_N; i++) {
      const [am, bm, ah, bh, an, bn] = rates(TABLE_MIN + i * TABLE_STEP);
      t.mInf[i] = am / (am + bm); t.mK[i] = Math.exp(-COND_DT * (am + bm));
      t.hInf[i] = ah / (ah + bh); t.hK[i] = Math.exp(-COND_DT * (ah + bh));
      t.nInf[i] = an / (an + bn); t.nK[i] = Math.exp(-COND_DT * (an + bn));
    }
    return t;
  })();
  function simulateSite(J, drive, sampleEvery) {
    const out = new Float32Array(COND_SAMPLES + 1), dt = COND_DT, last = drive.length - 1;
    const { mInf, mK, hInf, hK, nInf, nK } = GATES;
    let V = REST_STATE.V, m = REST_STATE.m, h = REST_STATE.h, n = REST_STATE.n, next = 0;
    for (let i = 0, sample = 0; sample <= COND_SAMPLES; i++) {
      if (i * dt >= next) { out[sample++] = V; next = sample * sampleEvery; }
      let u = (V - TABLE_MIN) / TABLE_STEP; u = u < 0 ? 0 : u > TABLE_N - 2 ? TABLE_N - 2 : u;
      const j = u | 0, f = u - j;
      let inf = mInf[j] + (mInf[j + 1] - mInf[j]) * f; m = inf + (m - inf) * (mK[j] + (mK[j + 1] - mK[j]) * f);
      inf = hInf[j] + (hInf[j + 1] - hInf[j]) * f; h = inf + (h - inf) * (hK[j] + (hK[j + 1] - hK[j]) * f);
      inf = nInf[j] + (nInf[j + 1] - nInf[j]) * f; n = inf + (n - inf) * (nK[j] + (nK[j + 1] - nK[j]) * f);
      const gNa = G_NA * m * m * m * h, n2 = n * n, gK = G_K * n2 * n2;
      V = (V + dt * (gNa * E_NA + gK * E_K + G_L * E_L + drive[i < last ? i : last] * J)) / (1 + dt * (gNa + gK + G_L));
    }
    return out;
  }

  function computeConduction() {
    const pw = parseFloat(pwSlider.value), f = parseFloat(frequencySlider.value), current = parseFloat(currentSlider.value);
    const half = 1000 / (2 * f), window = Math.min(60, Math.max(12, 3.2 * half));
    const pulses = [];
    for (let i = 0; 1 + i * half < window; i++) pulses.push({ start: 1 + i * half, sign: i % 2 ? -1 : 1 });
    const J = current / 1000 * k * J0, dtReal = window / COND_SAMPLES, dt = COND_DT;
    // stimulus sign at each model step (shared by all sites)
    const steps = Math.ceil(window * TIME_SCALE / dt) + 4, drive = new Int8Array(steps);
    for (const p of pulses) for (let i = Math.floor(p.start * TIME_SCALE / dt); i < Math.min(steps, (p.start + pw) * TIME_SCALE / dt); i++) drive[i] = p.sign * side;
    // each site along the axon simulated with its share of the stimulus, sampled in real time
    const sites = SIM_MM.map(d => {
      const v = simulateSite(J * fieldAt(d), drive, dtReal * TIME_SCALE);

      const direct = [];   // directly evoked action potentials: upstrokes through -50 mV that go on above 0 mV
      for (let i = 1; i <= COND_SAMPLES; i++) {
        if (v[i - 1] < -50 && v[i] >= -50) {
          let peak = -100; for (let j = i; j < Math.min(COND_SAMPLES, i + Math.round(1 / dtReal)); j++) peak = Math.max(peak, v[j]);
          if (peak > 0) direct.push(i * dtReal);
        }
      }
      const passive = Array.from(v, (val, i) => (direct.some(o => i * dtReal >= o - 0.05 && i * dtReal < o + AP_LEN_MS) ? REST_MV : val));
      return { d, direct, passive };
    });
    // one action potential per pulse that excites any site directly; it reaches every other site by propagation
    const events = [];
    for (const p of pulses) {
      const sources = sites.flatMap(site => site.direct.filter(o => o >= p.start && o < p.start + pw + 1.5).map(o => ({ d: site.d, o })));
      if (sources.length) events.push({ pulse: p, sources });
    }
    for (const site of sites) site.arrivals = events.map(e => Math.min(...e.sources.map(s => s.o + Math.abs(site.d - s.d) / SPEED_MM_PER_MS)));
    // pulses that depolarize this axon: the positive ones under E1, the negative ones under E2 (the electrodes swap roles)
    const positive = pulses.filter(p => p.sign * side > 0);
    // stretch of axon the stimulus excites directly (field at or above threshold for this pulse width)
    const fTh = thresholdCurrent(pw, k) / current;
    const zone = fTh < 1 ? FIELD_MM * Math.sqrt(1 / fTh - 1) : 0;
    cond = { pw, f, current, window, pulses, dtReal, recStart: positive[0].start - REC_BEFORE_MS, side, sites: new Map(sites.map(s => [s.d, s])), events, zone, fTh,
      evoked: events.filter(e => e.pulse.sign * side > 0).length, positive: positive.length, firstExcitatory: positive[0] };
    // highest and lowest potential at each site over the window
    const apMax = Math.max(...AP_SHAPE.map(([, v]) => v)), apMin = Math.min(...AP_SHAPE.map(([, v]) => v));
    cond.extremes = sites.map(site => {
      const reached = site.arrivals.some(a => a + 0.5 < window);
      let hi = reached ? apMax : -200, lo = reached ? apMin : 200;
      for (const v of site.passive) { hi = Math.max(hi, v); lo = Math.min(lo, v); }
      return [site.d, hi, lo];
    });
    // each node's recording, finely sampled so no spike is missed when drawn
    cond.fine = Math.max(COND_SAMPLES, Math.round(window / 0.02));
    cond.records = new Map(COND_NODES_MM.map(d => [d, Float32Array.from({ length: cond.fine + 1 }, (_, i) => condV(d, i * window / cond.fine))]));
  }
  // Membrane potential (mV) at site d (mm) and time ms: an action potential while one passes,
  // otherwise the site's own response to its share of the stimulus
  function condV(d, ms) {
    const site = cond.sites.get(d);
    for (const a of site.arrivals) if (ms >= a && ms < a + AP_LEN_MS) return apAt(ms - a);
    return site.passive[Math.max(0, Math.min(COND_SAMPLES, Math.round(ms / cond.dtReal)))];
  }

  function drawConduction(box, ms, now) {
    const { x, y, w, h } = box, NEG = '#9747ff';
    const toX = (mm) => x + 50 + (mm - COND_RANGE_MM[0]) / (COND_RANGE_MM[1] - COND_RANGE_MM[0]) * (w - 60);
    const narrow = w < 600, nodes = narrow ? [0, 1, 2] : COND_NODES_MM;   // fewer recordings on narrow screens
    // ── axon with myelin sheaths; nodes of Ranvier at the recording sites
    const ay = y + 110, ra = 8, mr = 17;
    const ax0 = toX(COND_RANGE_MM[0]), ax1 = toX(COND_RANGE_MM[1]);
    const axon = new Path2D(); axon.rect(ax0, ay - ra, ax1 - ax0, 2 * ra);
    const shaft = g.createLinearGradient(0, ay - ra, 0, ay + ra);
    shaft.addColorStop(0, MEMBRANE.light); shaft.addColorStop(1, MEMBRANE.mid);
    D.silhouette(g, axon, { outline: MEMBRANE.edge, outlineWidth: 1.2, fill: shaft });
    const edges = [ax0, ...COND_NODES_MM.map(toX), ax1];
    for (let j = 0; j < edges.length - 1; j++) {
      const sx = edges[j] + (j ? 6 : 0), ex = edges[j + 1] - (j < edges.length - 2 ? 6 : 0);
      if (ex - sx < 4) continue;
      const sheath = g.createLinearGradient(0, ay - mr, 0, ay + mr);
      sheath.addColorStop(0, '#ffffff'); sheath.addColorStop(0.3, '#fbf7ef'); sheath.addColorStop(0.75, '#e9e0d0'); sheath.addColorStop(1, '#cfc2ac');
      g.fillStyle = sheath; g.strokeStyle = '#a99a80'; g.lineWidth = 1.1;
      g.beginPath(); g.roundRect(sx, ay - mr, ex - sx, 2 * mr, mr); g.fill(); g.stroke();
    }
    // ── stimulus field along the axon: current reaching each point (mA), threshold for this pulse width and the zone above it
    const fBase = ay - mr - 6, fH = 64, fMax = 900;
    const fY = (mA) => fBase - Math.min(1.08, mA / fMax) * fH;
    const curve = new Path2D(); curve.moveTo(ax0, fBase);
    for (let px = ax0; px <= ax1; px += 2) {
      const mm = COND_RANGE_MM[0] + (px - toX(COND_RANGE_MM[0])) / (toX(COND_RANGE_MM[1]) - toX(COND_RANGE_MM[0])) * (COND_RANGE_MM[1] - COND_RANGE_MM[0]);
      curve.lineTo(px, fY(cond.current * fieldAt(mm)));
    }
    curve.lineTo(ax1, fBase); curve.closePath();
    const fieldFill = g.createLinearGradient(0, fBase - fH, 0, fBase);
    fieldFill.addColorStop(0, 'rgba(255, 210, 60, 0.75)'); fieldFill.addColorStop(1, 'rgba(255, 230, 140, 0.15)');
    g.fillStyle = fieldFill; g.fill(curve);
    const thY = fY(cond.fTh * cond.current);
    if (cond.zone > 0) {   // directly excited stretch: the part of the field above threshold
      g.save(); g.beginPath(); g.rect(x, fBase - fH - 10, w, thY - (fBase - fH - 10)); g.clip();
      g.fillStyle = 'rgba(255, 140, 26, 0.75)'; g.fill(curve); g.restore();
      label(t('condDirect', { mm: num(cond.zone, 2) }), Math.max(x + 8, toX(0) - 10), fBase - fH - 10, { color: '#b85c00', weight: 500, bg: true });
    }
    g.strokeStyle = '#c9a227'; g.lineWidth = 1.2; g.stroke(curve);
    if (thY > fBase - fH - 6) {
      g.save(); g.setLineDash([4, 4]); g.strokeStyle = C.bad; g.beginPath(); g.moveTo(ax0, thY); g.lineTo(ax1, thY); g.stroke(); g.restore();
      label(`${t('condThreshold')} ${Math.round(cond.fTh * cond.current)} mA`, x + w - 10, thY - 4, { color: C.bad, align: 'right', bg: true });
    } else label(t('condBelow', { mA: Math.round(cond.fTh * cond.current) }), x + w - 10, fBase - fH + 2, { color: C.bad, align: 'right', bg: true });
    label(t('condField'), x + w - 10, fBase - 6, { color: '#8a6d00', weight: 500, bg: true, align: 'right' });
    // ── stimulus current during a pulse: spreads inside the axon and leaves at the nodes (reversed for negative pulses)
    const pulse = cond.pulses.find(p => ms >= p.start && ms < p.start + Math.max(cond.pw, 0.4));
    const x0 = toX(0);
    if (pulse) {
      const color = pulse.sign > 0 ? C.accent : NEG;
      for (const d of COND_NODES_MM) {
        if (d === 0) continue;
        const nx = toX(d), a = fieldAt(d), dir = Math.sign(d);
        g.save(); g.globalAlpha = 0.25 + 0.75 * a; g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 1 + 1.5 * a;
        g.beginPath(); g.moveTo(x0 + dir * 8, ay); g.lineTo(nx - dir * 4, ay); g.quadraticCurveTo(nx, ay, nx, ay - mr - 8); g.stroke();
        g.beginPath();
        if (pulse.sign > 0) { g.moveTo(nx - 4, ay - mr - 6); g.lineTo(nx + 4, ay - mr - 6); g.lineTo(nx, ay - mr - 13); }
        else { g.moveTo(x0 + dir * 8, ay - 4); g.lineTo(x0 + dir * 8, ay + 4); g.lineTo(x0 + dir * 2, ay); }
        g.fill(); g.restore();
      }
    }
    // ── each node: glows while an action potential passes, Na+ enters
    for (const d of COND_NODES_MM) {
      const nx = toX(d), V = condV(d, ms), fA = activity(V);
      g.fillStyle = 'rgba(120, 60, 50, 0.45)';
      for (const s of [-1, 1]) for (let q = -1; q <= 1; q++) { g.beginPath(); g.arc(nx + q * 2.4, ay + s * ra, 0.9, 0, Math.PI * 2); g.fill(); }
      if (fA > 0.05) {
        g.save(); g.shadowColor = glow(fA); g.shadowBlur = 18 * fA; g.fillStyle = glow(fA, 0.95);
        g.beginPath(); g.roundRect(nx - 5, ay - ra - 0.5, 10, 2 * ra + 1, 3); g.fill(); g.restore();
      }
      if (V > -30) for (const s of [-1, 1]) D.sphere(g, nx + (s > 0 ? 4 : -4), ay + s * (mr + 24 - ((now / 8) % 16)), 3.2, C.na, C.naDark);
    }
    // ── electrodes: stimulation at 0 mm (above), recording at the nodes (below)
    const pipette = (px, tipY, up) => {
      const len = 34, dir = up ? -1 : 1;
      const grad = g.createLinearGradient(px - 5, 0, px + 5, 0);
      grad.addColorStop(0, '#d9dde2'); grad.addColorStop(0.5, '#f7f9fb'); grad.addColorStop(1, '#a9b1ba');
      g.fillStyle = grad; g.strokeStyle = '#6d7680'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(px - 0.8, tipY); g.lineTo(px - 5, tipY + dir * len); g.lineTo(px + 5, tipY + dir * len); g.lineTo(px + 0.8, tipY); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#444b52'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, tipY + dir * 6); g.lineTo(px, tipY + dir * (len - 2)); g.stroke();
    };
    pipette(x0, ay - ra + 2, true);
    if (pulse) { g.save(); g.shadowColor = '#ffd84a'; g.shadowBlur = 16; g.fillStyle = 'rgba(255, 216, 74, 0.6)'; g.beginPath(); g.arc(x0, ay, 13, 0, Math.PI * 2); g.fill(); g.restore(); }
    const pill = (text, px, py, dark) => {
      g.font = font(600); const tw = g.measureText(text).width;
      px = Math.max(x + tw / 2 + 9, Math.min(x + w - tw / 2 - 9, px));   // keep the pill inside the panel
      g.fillStyle = dark ? '#2b2b2b' : '#ffe58a'; g.strokeStyle = dark ? '#2b2b2b' : '#b79a2a'; g.lineWidth = 1;
      g.beginPath(); g.roundRect(px - tw / 2 - 7, py - 13, tw + 14, 18, 9); g.fill(); g.stroke();
      g.fillStyle = dark ? '#ffffff' : '#3b3200'; g.textAlign = 'center'; g.fillText(text, px, py); g.textAlign = 'left';
    };
    pill(`${t('condStimulate')} E${side > 0 ? 1 : 2}` + (pulse ? (pulse.sign > 0 ? ' +' : ' −') : ''), x0 + 80, ay - ra - 18, false);
    const recY = ay + 40;
    for (const d of nodes) { pipette(toX(d), ay + ra - 2, false); pill(t('condRecord'), toX(d), recY, true); }
    // ── one recording per node: everything that reaches it, with the stimulus pulses marked
    const gap = 12, rw = (w - 60 - gap * (nodes.length - 1)) / nodes.length, rH = 150, rTop = recY + 36;   // panels fill the width of the axon
    const tY = (mv) => rTop + (COND_V[1] - mv) / (COND_V[1] - COND_V[0]) * rH;
    const panelX = (d) => x + 50 + nodes.indexOf(d) * (rw + gap);   // left edge of the panel for node d
    const r0 = cond.recStart, r1 = cond.recStart + REC_BEFORE_MS + REC_AFTER_MS;   // time span shown (ms in the window)
    label(t('condRecordRow', { a: `−${num(REC_BEFORE_MS)}`, b: REC_AFTER_MS }), x + 8, rTop - 8, { weight: 500 });
    for (const d of nodes) {
      const rx = panelX(d), tx = (tm) => rx + (tm - r0) / (r1 - r0) * rw;
      g.fillStyle = '#f4f4f2'; g.fillRect(rx, rTop, rw, rH);
      for (const p of cond.pulses) {   // only pulses inside the panel's time span, clipped to the panel
        if (p.start > r1 || p.start + cond.pw < r0) continue;
        const a0 = Math.max(rx, tx(p.start)), a1 = Math.min(rx + rw, tx(p.start + cond.pw));
        g.fillStyle = p.sign > 0 ? 'rgba(13, 153, 255, 0.35)' : 'rgba(151, 71, 255, 0.35)';
        g.fillRect(a0, rTop, Math.max(1.5, a1 - a0), rH);
      }
      g.save(); g.setLineDash([3, 3]); g.lineWidth = 1;
      g.strokeStyle = C.bad; g.beginPath(); g.moveTo(rx, tY(-55)); g.lineTo(rx + rw, tY(-55)); g.stroke();
      g.strokeStyle = C.muted; g.beginPath(); g.moveTo(rx, tY(REST_MV)); g.lineTo(rx + rw, tY(REST_MV)); g.stroke();
      g.restore();
      // drawn column by column (lowest to highest value per pixel), so narrow spikes always show
      const rec = cond.records.get(d), toIdx = (tm) => Math.max(0, Math.min(cond.fine, Math.round(tm / cond.window * cond.fine)));
      const first = toIdx(r0), last = toIdx(r1), perPx = (last - first) / rw, shown = Math.min(last, toIdx(ms));
      // how the node responds to the first pulse: excited directly by the stimulus, reached by propagation, or not at all
      const ev0 = cond.events.find(e => e.pulse === cond.firstExcitatory);
      const status = !ev0 ? 'condNodeNone' : ev0.sources.some(src => src.d === d) ? 'condNodeDirect' : 'condNodePropagated';
      const traceColor = status === 'condNodeDirect' ? '#d9771f' : C.ink;
      g.strokeStyle = traceColor; g.lineWidth = 1.5; g.lineJoin = 'round'; g.beginPath();
      g.moveTo(rx, tY(rec[first]));
      for (let c = 0; first + c * perPx <= shown; c++) {
        const i0 = first + Math.floor(c * perPx), i1 = Math.min(shown, first + Math.floor((c + 1) * perPx));
        let lo = Infinity, hi = -Infinity;
        for (let i = i0; i <= i1; i++) { lo = Math.min(lo, rec[i]); hi = Math.max(hi, rec[i]); }
        // visit the column's extremes in the order the trace passes them (rising: low then high)
        const [a, b] = rec[i0] <= rec[i1] ? [lo, hi] : [hi, lo];
        g.lineTo(rx + c, tY(a)); g.lineTo(rx + c + 0.5, tY(b));
      }
      g.stroke();
      label(`${num(d)} mm`, rx + rw / 2, rTop + rH + 15, { align: 'center' });
      label(t(status), rx + rw - 4, rTop + 16, { align: 'right', bg: true, weight: 500, color: status === 'condNodeDirect' ? '#b85c00' : status === 'condNodeNone' ? C.muted : C.ink });
      if (!narrow || d === nodes[0]) {   // time at the panel's edges (only under the first panel on narrow screens)
        const ty = rTop + rH + (narrow ? 32 : 15);
        g.font = font(400); g.fillStyle = C.muted;
        g.textAlign = 'left'; g.fillText(`−${num(REC_BEFORE_MS)}`, rx, ty);
        g.textAlign = 'right'; g.fillText(`${REC_AFTER_MS} ms`, rx + rw, ty); g.textAlign = 'left';
      }
    }
    const lx = panelX(nodes[0]) - 5;
    for (const mv of [60, 0, REST_MV]) label(mv > 0 ? `+${mv}` : String(mv), lx, tY(mv) + 4, { align: 'right' });
    // pulse legend
    const legY = narrow ? rTop + rH + 50 : rTop - 8; g.font = font(400);   // own line under the recordings on narrow screens
    const posText = t('condPulsePos'), negText = t('condPulseNeg'), nw = g.measureText(negText).width, pw2 = g.measureText(posText).width;
    g.fillStyle = 'rgba(151, 71, 255, 0.5)'; g.fillRect(x + w - 8 - nw - 16, legY - 10, 10, 10); label(negText, x + w - 8, legY, { align: 'right', color: C.ink });
    g.fillStyle = 'rgba(13, 153, 255, 0.5)'; g.fillRect(x + w - 8 - nw - 30 - pw2 - 16, legY - 10, 10, 10); label(posText, x + w - 8 - nw - 30, legY, { align: 'right', color: C.ink });
    // ── highest and lowest potential along the axon, aligned with the axon above
    const pTop = rTop + rH + (narrow ? 78 : 46), pH = 150;
    const px0 = toX(COND_RANGE_MM[0]), px1 = toX(COND_RANGE_MM[1]);
    const pY = (mv) => pTop + (COND_V[1] - mv) / (COND_V[1] - COND_V[0]) * pH;
    g.fillStyle = '#f4f4f2'; g.fillRect(px0, pTop, px1 - px0, pH);
    for (const mm of COND_NODES_MM) { g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.moveTo(toX(mm), pTop); g.lineTo(toX(mm), pTop + pH); g.stroke(); }
    for (const [mv, color, key, below] of [[-55, C.bad, 'condThreshold', false], [REST_MV, C.muted, 'singleRestLabel', true]]) {
      g.save(); g.setLineDash([4, 4]); g.strokeStyle = color; g.beginPath(); g.moveTo(px0, pY(mv)); g.lineTo(px1, pY(mv)); g.stroke(); g.restore();
      label(`${t(key)} ${mv} mV`, px1 - 4, pY(mv) + (below ? 15 : -4), { align: 'right', color, bg: true });
    }
    for (const mv of [60, 20, -20, -60]) label(mv > 0 ? `+${mv}` : String(mv), px0 - 6, pY(mv) + 4, { align: 'right' });
    for (const [idx, color, dash] of [[1, C.ink, []], [2, NEG, [5, 4]]]) {
      g.save(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
      D.smooth(cond.extremes.map(e => [toX(e[0]), pY(e[idx])]), 6).forEach(([px, py], j) => (j ? g.lineTo : g.moveTo).call(g, px, py));
      g.stroke(); g.restore();
    }
    const peakY = pY(cond.extremes[0][1]) - 8, troughY = pY(cond.extremes[0][2]) - 6;
    label(t('condPeak'), px0 + 8, peakY, { color: C.ink, weight: 500, bg: true });
    g.font = font(500);
    const close = Math.abs(peakY - troughY) < 20, shift = close ? g.measureText(t('condPeak')).width + 20 : 0;   // side by side when the curves are close
    label(t('condTrough'), px0 + 8 + shift, troughY, { color: NEG, weight: 500, bg: true });
    for (const mm of COND_NODES_MM) label(num(mm), toX(mm), pTop + pH + 16, { align: 'center' });
    label(t('condDistance'), (px0 + px1) / 2, pTop + pH + 34, { align: 'center' });
    g.font = font(400); g.fillStyle = C.ink;   // figure caption
    return wrapText(captionText(), x + 8, pTop + pH + 64, w - 16, 18);
  }

  // ───────── Shared timing and colors for the axon and synapse figures ─────────
  const NODES = 6, NODE_DELAY_MS = 0.12;                 // per internode (slowed for visibility)
  const ARRIVAL_DELAY_MS = (NODES + 2) * NODE_DELAY_MS;  // action potential peak from cell body to terminal
  const activity = (V) => Math.max(0, Math.min(1, (V - REST_MV) / 100));
  const MEMBRANE = { light: '#fbe6dc', fill: '#f2c3b0', mid: '#e3a993', edge: '#a8644f', core: 'rgba(255, 240, 232, 0.75)' };
  const glow = (f, a = 1) => `rgba(255, ${Math.round(150 - 50 * f)}, 30, ${f * a})`;



  // ───────── Synapse: the ten steps of chemical transmission (after Purves et al., Neuroscience, fig. 5.3) ─────────
  // Step (1-10) at a time relative to the arrival of the action potential at the terminal; 0 before
  const SYN_STEPS = [-1.0, 0, 0.25, 0.45, 0.7, 0.95, 1.25, 1.55, 1.9, 3.4];   // start of steps 1-10, ms after arrival
  function synapseStep(time) {
    if (!trace.phases.spike) return 0;
    const since = time - trace.arrival;
    let step = 0;
    SYN_STEPS.forEach((start, i) => { if (since >= start) step = i + 1; });
    return step;
  }
  // The terminal seen from the side, as in the textbook figure: a myelinated axon comes down from the top and
  // ends in a bouton above a postsynaptic dendrite that runs across the bottom.
  function drawSynapse(box, time, now) {
    const { x, y, w, h } = box, step = synapseStep(time), since = time - (trace.arrival ?? 0);
    const after = (i) => step >= i, during = (i) => step === i;
    const progress = (i) => Math.max(0, Math.min(1, (since - SYN_STEPS[i - 1]) / ((SYN_STEPS[i] ?? SYN_STEPS[i - 1] + 1) - SYN_STEPS[i - 1])));
    const cx = x + w * 0.46, a = Math.max(13, w * 0.035), bw = Math.min(w * 0.3, 190);
    const yM = y + h * 0.17, cleftY = y + h * 0.66, base = y + h;
    const yP = (xx) => cleftY + 14 + 22 * ((xx - cx) / (w * 0.5)) ** 2;   // top of the postsynaptic membrane

    // ── postsynaptic dendrite across the bottom
    const post = new Path2D(); post.moveTo(x, yP(x));
    for (let xx = x; xx <= x + w; xx += 4) post.lineTo(xx, yP(xx));
    post.lineTo(x + w, base); post.lineTo(x, base); post.closePath();
    const postFill = g.createLinearGradient(0, cleftY, 0, base);
    postFill.addColorStop(0, '#f6e2c3'); postFill.addColorStop(1, '#e9c99a');
    D.silhouette(g, post, { outline: '#b08a52', outlineWidth: 1.3, fill: postFill });
    // postsynaptic density
    g.strokeStyle = 'rgba(110, 70, 30, 0.45)'; g.lineWidth = 4; g.beginPath();
    for (let xx = cx - bw * 0.62; xx <= cx + bw * 0.62; xx += 3) (xx === cx - bw * 0.62 ? g.moveTo : g.lineTo).call(g, xx, yP(xx) + 4);
    g.stroke();

    // ── presynaptic terminal: neck below the myelin widening into the bouton (one silhouette)
    const bouton = new Path2D();
    D.blob(bouton, [[cx - a, yM - 6], [cx - a - 4, y + h * 0.26], [cx - bw * 0.95, y + h * 0.42], [cx - bw, y + h * 0.54],
      [cx - bw * 0.82, cleftY - 4], [cx - bw * 0.3, cleftY], [cx + bw * 0.3, cleftY], [cx + bw * 0.82, cleftY - 4],
      [cx + bw, y + h * 0.54], [cx + bw * 0.95, y + h * 0.42], [cx + a + 4, y + h * 0.26], [cx + a, yM - 6]], 10);
    const axon = new Path2D(); axon.rect(cx - a, y - 4, 2 * a, yM - y + 10);
    const termFill = g.createRadialGradient(cx - bw * 0.3, y + h * 0.4, 10, cx, y + h * 0.48, bw * 1.1);
    termFill.addColorStop(0, '#fbe9e0'); termFill.addColorStop(0.7, MEMBRANE.fill); termFill.addColorStop(1, MEMBRANE.mid);
    D.silhouette(g, [axon, bouton], { outline: MEMBRANE.edge, outlineWidth: 1.3, fill: termFill });
    // myelin around the axon at the top
    for (let l = 3; l >= 0; l--) {
      const mw = a + 6 + l * 4, sheath = g.createLinearGradient(cx - mw, 0, cx + mw, 0);
      sheath.addColorStop(0, '#5f7fa8'); sheath.addColorStop(0.5, l % 2 ? '#a9bfdc' : '#8fa9cc'); sheath.addColorStop(1, '#4f6d96');
      g.fillStyle = sheath; g.strokeStyle = '#3f5a80'; g.lineWidth = 0.8;
      g.beginPath(); g.roundRect(cx - mw, y - 10, 2 * mw, yM - y + 6 - l * 3, [0, 0, mw * 0.7, mw * 0.7]); g.fill(); g.stroke();
    }
    g.fillStyle = termFill; g.fillRect(cx - a + 1, y - 4, 2 * a - 2, 2);
    // microtubules carrying new vesicles down from the cell body (step 1, continuous)
    g.strokeStyle = 'rgba(110, 80, 160, 0.55)'; g.lineWidth = 1.2;
    for (const dx of [-0.45, 0, 0.45]) {
      g.beginPath(); g.moveTo(cx + dx * a, yM + 2);
      g.bezierCurveTo(cx + dx * a, y + h * 0.3, cx + dx * bw * 0.6, y + h * 0.36, cx + dx * bw * 0.7, y + h * 0.44); g.stroke();
    }
    const vesicle = (vx, vy, r, open, filled = true) => {
      const vg = g.createRadialGradient(vx - r * 0.3, vy - r * 0.3, 1, vx, vy, r);
      vg.addColorStop(0, '#ffffff'); vg.addColorStop(1, '#f0e2d4');
      g.fillStyle = vg; g.strokeStyle = '#a0705a'; g.lineWidth = 1.3;
      g.beginPath(); open ? g.arc(vx, vy, r, -Math.PI / 2 + open, Math.PI / 2 - open, true) : g.arc(vx, vy, r, 0, Math.PI * 2); g.fill(); g.stroke();
      if (filled) for (const [dx, dy] of [[-0.35, -0.2], [0.35, 0], [0, 0.4], [-0.1, -0.5]]) D.sphere(g, vx + dx * r, vy + dy * r, Math.max(1.8, r * 0.18), '#3fb092', '#1f7d65');
    };
    const vr = Math.max(8, Math.min(11, w * 0.022));
    for (let i = 0; i < 2; i++) {   // vesicles travelling down the neck
      const f = ((now / 3000) + i / 2) % 1;
      vesicle(cx + (i ? 0.25 : -0.25) * a, yM + f * (y + h * 0.36 - yM), vr * 0.75, 0);
    }
    // mitochondrion
    g.save(); g.translate(cx - bw * 0.52, y + h * 0.46); g.rotate(-0.5);
    const ml = Math.min(64, bw * 0.42), mg = g.createLinearGradient(0, -9, 0, 9);
    mg.addColorStop(0, '#f8d7b4'); mg.addColorStop(1, '#e2a979');
    g.fillStyle = mg; g.strokeStyle = '#a9693d'; g.lineWidth = 1.2;
    g.beginPath(); g.roundRect(-ml / 2, -9, ml, 18, 9); g.fill(); g.stroke();
    g.strokeStyle = '#c17f4f'; g.lineWidth = 1;
    g.beginPath(); for (let i = -ml / 2 + 8; i < ml / 2 - 6; i += 7) { g.moveTo(i, -6); g.quadraticCurveTo(i + 3, 0, i, 6); } g.stroke();
    g.restore();
    // vesicle pool and docked vesicles at the active zone
    for (const [fx, fy] of [[-0.15, 0.4], [0.2, 0.43], [0.45, 0.5], [-0.05, 0.52], [0.3, 0.57], [-0.35, 0.57], [0.6, 0.6]]) vesicle(cx + fx * bw, y + fy * h, vr, 0);
    g.fillStyle = 'rgba(110, 60, 50, 0.45)'; g.fillRect(cx - bw * 0.62, cleftY - 2.5, bw * 1.24, 2.5);   // active zone
    vesicle(cx - bw * 0.22, cleftY - vr - 2, vr, 0);
    // the fusing vesicle: moves to the membrane (5), opens and empties (6)
    const fx = cx + bw * 0.22;
    if (!after(5)) vesicle(fx, cleftY - vr - 2, vr, 0);
    else if (during(5)) vesicle(fx, cleftY - vr + 2 * progress(5), vr, 0.6 * progress(5));
    else vesicle(fx, cleftY - vr + 2, vr, 1.3, false);
    // transmitter: released into the cleft (6), bound to receptors (7 on), cleared (10)
    const receptors = [-0.48, -0.16, 0.16, 0.48].map(f => cx + f * bw);
    if (after(6)) {
      for (let i = 0; i < 18; i++) {
        const target = receptors[i % 4] + ((i * 7) % 9 - 4);
        const f = during(6) ? progress(6) : 1;
        const sx = fx + ((i * 5) % 9 - 4), sy = cleftY + 2;
        let tx = sx + f * (target - sx), ty = sy + f * (yP(target) - 2 - sy);
        if (i >= 8) { tx = sx + f * ((i * 37) % 60 - 30); ty = sy + f * (4 + (i * 13) % 8); }   // the rest diffuses in the cleft
        g.globalAlpha = after(10) ? Math.max(0.15, 1 - progress(10)) : 1;
        D.sphere(g, tx, ty, 2.6, '#3fb092', '#1f7d65'); g.globalAlpha = 1;
      }
    }
    // voltage-gated Ca2+ channels at the edges of the active zone (3), Ca2+ influx (4)
    const caColors = { light: '#e3eaef', mid: '#b4c2cc', dark: '#8a9aa6', edge: '#5f6f7b' };
    const caX = [cx - bw * 0.72, cx + bw * 0.72];
    for (const px of caX) D.channel(g, px, cleftY - 4, 18, after(3) && !after(7) ? 1 : 0, caColors);
    if (after(4) && !after(8)) {
      const f = during(4) ? progress(4) : 1;
      for (let i = 0; i < 10; i++) {
        const px = caX[i % 2] + ((i * 7) % 10 - 5), py = cleftY + 12 - f * (22 + (i * 11) % 30);
        D.sphere(g, px, py, 2.6, '#a7b0b7', '#6c757c');
      }
    }
    // postsynaptic receptor channels: open while transmitter is bound (8), ions flow in (8-9)
    const recColors = { light: '#dcebf4', mid: '#9fc1d5', dark: '#6f97ae', edge: '#456f86' };
    for (const rx of receptors) {
      D.channel(g, rx, yP(rx) + 6, 22, after(8) && !after(10) ? 1 : 0, recColors);
      if (after(8) && !after(10)) for (let i = 0; i < 2; i++) {
        const f = ((now / 700) + i / 2) % 1;
        D.sphere(g, rx + (i ? 3 : -3), yP(rx) - 6 + f * 34, 2.8, '#ff7a59', '#c94a2c');
      }
    }
    // postsynaptic current spreading along the dendrite (9)
    if (after(9)) {
      const f = during(9) ? progress(9) : 1;
      g.save(); g.strokeStyle = 'rgba(240, 170, 20, 0.9)'; g.fillStyle = 'rgba(240, 170, 20, 0.9)'; g.lineWidth = 3;
      for (const dir of [-1, 1]) {
        const x0 = cx + dir * bw * 0.4, x1 = cx + dir * (bw * 0.4 + f * w * 0.36), yy = base - (base - cleftY) * 0.35;
        g.beginPath(); g.moveTo(x0, yy - 10); g.quadraticCurveTo((x0 + x1) / 2, yy + 6, x1, yy); g.stroke();
        g.beginPath(); g.moveTo(x1 + dir * 8, yy); g.lineTo(x1 - dir * 2, yy - 6); g.lineTo(x1 - dir * 2, yy + 6); g.fill();
      }
      g.restore();
    }
    // action potential invading the terminal (2): glow and arrows down both sides
    if (after(2) && !after(5)) {
      const f = Math.max(0.35, activity(sampleAt(time - ARRIVAL_DELAY_MS).V));
      g.save(); g.shadowColor = glow(f); g.shadowBlur = 18;
      g.strokeStyle = glow(Math.max(0.5, f)); g.fillStyle = glow(Math.max(0.5, f)); g.lineWidth = 4;
      for (const dir of [-1, 1]) {
        const x0 = cx + dir * (a + 12), y0 = yM + 6, x1 = cx + dir * (bw * 0.86), y1 = y + h * 0.42;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + dir * 6, (y0 + y1) / 2, x1, y1); g.stroke();
        g.beginPath(); g.moveTo(x1 + dir * 2, y1 + 9); g.lineTo(x1 - dir * 9, y1 - 2); g.lineTo(x1 + dir * 6, y1 - 6); g.fill();
      }
      g.restore();
    }
    // retrieval of vesicle membrane: a clathrin-coated vesicle pinches off and moves back (10)
    if (after(10)) {
      const f = progress(10), vx = cx - bw * 0.5, vy = cleftY - vr - 4 - f * h * 0.12;
      vesicle(vx, vy, vr, 0, false);
      g.strokeStyle = '#7a5a40'; g.lineWidth = 1;
      for (let k = 0; k < 14; k++) {
        const ang = k / 14 * Math.PI * 2;
        g.beginPath(); g.moveTo(vx + Math.cos(ang) * vr, vy + Math.sin(ang) * vr); g.lineTo(vx + Math.cos(ang + 0.2) * (vr + 4), vy + Math.sin(ang + 0.2) * (vr + 4)); g.stroke();
      }
    }
    // numbered steps
    const badge = (n, bx, by) => {
      g.fillStyle = n === step ? C.spike : '#ffffff'; g.strokeStyle = C.ink; g.lineWidth = 1;
      g.beginPath(); g.arc(bx, by, 9, 0, Math.PI * 2); g.fill(); g.stroke();
      label(String(n), bx, by + 4, { weight: 600, color: C.ink, align: 'center' });
    };
    badge(1, cx - a - 34, y + h * 0.27); badge(2, cx + a + 36, yM + 18); badge(3, caX[1] + 24, cleftY - 22);
    badge(4, caX[1] + 26, cleftY + 6); badge(5, fx + vr + 16, cleftY - vr - 14); badge(6, fx + 2, cleftY + 26);
    badge(7, receptors[3] + 22, yP(receptors[3]) + 4); badge(8, receptors[1] - 4, yP(receptors[1]) + 34);
    badge(9, cx - bw * 0.4 - 30, base - (base - cleftY) * 0.35 - 18); badge(10, cx - bw * 0.5 - 30, cleftY - vr - 30);
    // callouts
    const call = (key, anchor, lx, ly, align) => D.callout(g, t(key), anchor, [lx, ly], { font: font(400), align: align || 'center' });
    call('singleMyelin', [cx - a - 8, y + 12], x + 40, y + 14, 'left');
    call('synVesicle', [cx + bw * 0.45 + vr, y + h * 0.5], x + w - 4, y + h * 0.3, 'right');
    call('synMito', [cx - bw * 0.52, y + h * 0.46 - 8], x + 4, y + h * 0.36, 'left');
    call('synCa', [caX[1] + 6, cleftY - 6], x + w - 4, cleftY - 44, 'right');
    call('synReceptor', [receptors[3] + 6, yP(receptors[3]) + 12], x + w - 4, base - 22, 'right');
    call('synCleft', [cx - bw * 0.85, cleftY + 8], x + 4, cleftY + 6, 'left');
    label(t('synPost'), x + 10, base - 10, { color: '#8a6a3a' });
  }

  // ───────── Excitatory postsynaptic potential (EPSP) ─────────
  // A glutamate-gated cation current gives a small, graded depolarization (alpha-like shape, onset at
  // receptor opening). One synapse alone stays below threshold; many synapses active together sum to
  // threshold, and an action potential starts at the axon hillock of the postsynaptic cell.
  const EPSP_ONSET = () => SYN_STEPS[7];   // postsynaptic channels open (step 8)
  const epspShape = (u) => (u <= 0 ? 0 : (Math.exp(-u / 1.2) - Math.exp(-u / 0.25)) / 0.524);   // peak 1 at about 0.5 ms
  const EPSP_SINGLE_MV = 3, EPSP_SUM_MV = 16;
  function summedV(s) {
    let cross = null;
    for (let q = EPSP_ONSET(); q <= s; q += 0.01) if (REST_MV + EPSP_SUM_MV * epspShape(q - EPSP_ONSET()) >= -55) { cross = q; break; }
    if (cross !== null && s - cross < AP_LEN_MS) return apAt(s - cross);
    if (cross !== null) {   // after the action potential: recover smoothly from where it ended
      const end = apAt(AP_LEN_MS - 0.01);
      return REST_MV + (end - REST_MV) * Math.exp(-(s - cross - AP_LEN_MS) / 1.5);
    }
    return REST_MV + EPSP_SUM_MV * epspShape(s - EPSP_ONSET());
  }
  function drawEpsp(box, time) {
    const { x, y, w, h } = box, top = 50, bottom = -85, span = 6;
    const toX = (s) => x + (s + 0.3) / (span + 0.3) * w, toY = (mv) => y + (top - mv) / (top - bottom) * h;
    label(t('synEpspTitle'), x - 48, y - 14, { weight: 500 });
    for (const mv of [40, 0, -40, -80]) {
      g.strokeStyle = C.line; g.lineWidth = 1; g.beginPath(); g.moveTo(x, toY(mv)); g.lineTo(x + w, toY(mv)); g.stroke();
      label(mv > 0 ? `+${mv}` : String(mv), x - 6, toY(mv) + 4, { align: 'right' });
    }
    for (const [mv, color, key] of [[-55, C.bad, 'condThreshold'], [REST_MV, C.muted, 'singleRestLabel']]) {
      g.save(); g.setLineDash([4, 4]); g.strokeStyle = color; g.beginPath(); g.moveTo(x, toY(mv)); g.lineTo(x + w, toY(mv)); g.stroke(); g.restore();
      label(`${t(key)} ${mv} mV`, x + w - 4, toY(mv) - 4, { align: 'right', color, bg: true });
    }
    for (let ms = 0; ms <= span; ms += 2) label(String(ms), toX(ms), y + h + 16, { align: 'center' });
    label(t('synEpspAxis'), x + w / 2, y + h + 34, { align: 'center' });
    if (!trace.phases.spike) { label(t('synNoRelease'), x + w / 2, y + 30, { align: 'center', color: C.bad, bg: true }); return; }
    const since = time - trace.arrival;
    const curve = (fn, color, dash) => {
      g.save(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
      for (let j = 0; j <= 240; j++) {
        const s = -0.3 + (span + 0.3) * j / 240; if (s > since) break;
        const yy = toY(Math.max(bottom, Math.min(top, fn(s))));
        j ? g.lineTo(toX(s), yy) : g.moveTo(toX(s), yy);
      }
      g.stroke(); g.restore();
    };
    curve(s => REST_MV + EPSP_SINGLE_MV * epspShape(s - EPSP_ONSET()), C.accent, [5, 4]);
    curve(summedV, C.ink, []);
    label(t('synEpspSingle'), toX(EPSP_ONSET()) + 30, toY(REST_MV) + 22, { color: C.accent, weight: 500, bg: true });
    label(t('synEpspSum'), x + w - 6, toY(25), { color: C.ink, weight: 500, bg: true, align: 'right' });
  }
  function drawSynapseCard(L, time, now) {
    drawSynapse(L.syn, time, now);
    drawEpsp(L.epsp, time);
    g.font = font(400); g.fillStyle = C.ink;
    return wrapText(t('synFigureCaption'), L.caption.x + 8, L.caption.y, L.caption.w - 16, 18);
  }

  // ───────── Membrane potential with phases ─────────
  function drawPotential(box, time) {
    const { x, y, w, h } = box, P = trace.phases;
    const top = 60, bottom = -90;
    const toX = (ms) => x + ms / trace.end * w;
    const toY = (mv) => y + (top - mv) / (top - bottom) * h;
    label(t('singleVm'), x - 48, y - 14, { weight: 500 });
    // stimulus pulse and refractory periods
    const p0 = PULSE_START_MS, p1 = PULSE_START_MS + trace.pw;
    g.fillStyle = 'rgba(13, 153, 255, 0.16)'; g.fillRect(toX(p0), y, toX(p1) - toX(p0), h);
    label(t('singleStimulus'), toX(p0) + 3, y + h - 6, { color: C.accent });
    if (P.spike) {
      g.fillStyle = C.absolute; g.fillRect(toX(P.threshold), y, toX(P.fallEnd) - toX(P.threshold), h);
      g.fillStyle = C.relative; g.fillRect(toX(P.fallEnd), y, toX(P.recover) - toX(P.fallEnd), h);
      // refractory periods also as bars under the time axis, with their names
      const barY = y + h + 24;
      g.fillStyle = rgba(C.bad, 0.55); g.fillRect(toX(P.threshold), barY, toX(P.fallEnd) - toX(P.threshold), 6);
      g.fillStyle = rgba(C.spike, 0.7); g.fillRect(toX(P.fallEnd), barY, toX(P.recover) - toX(P.fallEnd), 6);
      label(t('singleAbsolute'), toX(P.fallEnd) - 4, barY + 22, { color: C.bad, align: 'right' });
      label(t('singleRelative'), toX(P.fallEnd) + 4, barY + 22, { color: '#b86f00' });
    }
    // grid, rest and equilibrium potentials
    g.lineWidth = 1;
    for (const mv of [40, 0, -40, -80]) {
      g.strokeStyle = C.line; g.beginPath(); g.moveTo(x, toY(mv)); g.lineTo(x + w, toY(mv)); g.stroke();
      label(String(mv > 0 ? `+${mv}` : mv), x - 6, toY(mv) + 4, { align: 'right' });
    }
    const dashed = (mv, color, text) => {
      g.save(); g.setLineDash([4, 4]); g.strokeStyle = color; g.beginPath(); g.moveTo(x, toY(mv)); g.lineTo(x + w, toY(mv)); g.stroke(); g.restore();
      label(text, x + w - 4, toY(mv) - 4, { color, align: 'right' });
    };
    dashed(E_NA, C.naDark, `E(Na⁺) +${E_NA} mV`);
    dashed(E_K, C.kDark, `E(K⁺) ${E_K} mV`);
    dashed(REST_MV, C.muted, `${t('singleRestLabel')} ${REST_MV} mV`);
    for (let ms = 0; toX(ms) < x + w - 70; ms += 1) label(String(ms), toX(ms), y + h + 16, { align: 'center' });   // leave room for the axis name
    label(t('timeLabel'), x + w, y + h + 16, { align: 'right' });
    // trace: faint in full, solid up to the cursor
    const path = (until, color, lw) => {
      g.beginPath();
      for (let i = 0; i < trace.samples.length; i++) {
        const p = trace.samples[i]; if (p.time > until) break;
        const yy = toY(Math.max(bottom, Math.min(top, p.V)));
        if (i === 0) g.moveTo(toX(p.time), yy); else g.lineTo(toX(p.time), yy);
      }
      g.strokeStyle = color; g.lineWidth = lw; g.stroke();
    };
    path(trace.end, '#d0d0d0', 1.5);
    path(time, C.ink, 2);
    // numbered phase markers
    const current = phaseAt(time);
    const marker = (n, ms, mv, dx, dy) => {
      const px = toX(ms), py = toY(mv);
      g.fillStyle = n === current ? C.spike : '#ffffff'; g.strokeStyle = C.ink; g.lineWidth = 1;
      g.beginPath(); g.arc(px + dx, py + dy, 9, 0, Math.PI * 2); g.fill(); g.stroke();
      label(String(n), px + dx, py + dy + 4, { weight: 600, color: C.ink, align: 'center' });
    };
    if (P.spike) {
      const v = (ms) => sampleAt(ms).V;
      // rising and falling phase marked halfway in voltage between threshold and peak
      const halfway = (from, to) => {
        const target = (P.thresholdV + v(P.peak)) / 2;
        for (const p of trace.samples) if (p.time > from && p.time < to && Math.abs(p.V - target) < 4) return p.time;
        return (from + to) / 2;
      };
      const rise = halfway(P.threshold, P.peak), fall = halfway(P.peak, P.fallEnd);
      marker(1, p0 + trace.pw / 2, v(p0 + trace.pw / 2), -4, 20);
      marker(2, P.threshold, P.thresholdV, -18, -10);
      marker(3, rise, v(rise), -16, 0);
      marker(4, P.peak, v(P.peak), 0, -16);
      marker(5, fall, v(fall), 16, 0);
      marker(6, P.undershoot, v(P.undershoot), 0, 18);
    } else {
      label(t('singleNoSpikeTrace'), x + w / 2, y + 48, { align: 'center', color: C.bad });
    }
    g.strokeStyle = C.muted; g.lineWidth = 1;
    g.beginPath(); g.moveTo(toX(time), y); g.lineTo(toX(time), y + h); g.stroke();
  }

  // ───────── Strength-duration curve ─────────
  function drawStrengthDuration(box) {
    const { x, y, w, h } = box;
    const xMin = Math.log10(0.05), xMax = Math.log10(10), yMax = 2000;
    const toX = (ms) => x + (Math.log10(ms) - xMin) / (xMax - xMin) * w;
    const toY = (mA) => y + h - Math.min(1.05, mA / yMax) * h;
    label(t('singleSD'), x - 48, y - 12, { weight: 500 });
    g.lineWidth = 1;
    for (const mA of [0, 500, 1000, 1500, 2000]) {
      g.strokeStyle = C.line; g.beginPath(); g.moveTo(x, toY(mA)); g.lineTo(x + w, toY(mA)); g.stroke();
      label(String(mA), x - 6, toY(mA) + 4, { align: 'right' });
    }
    for (const ms of [0.1, 0.3, 1, 3, 10]) {
      g.strokeStyle = C.line; g.beginPath(); g.moveTo(toX(ms), y); g.lineTo(toX(ms), y + h); g.stroke();
      label(num(ms), toX(ms), y + h + 16, { align: 'center' });
    }
    label(t('singleWidthAxis'), x + w / 2, y + h + 34, { align: 'center' });
    g.fillStyle = 'rgba(13, 153, 255, 0.08)';
    g.fillRect(toX(0.3), toY(900), toX(1) - toX(0.3), toY(500) - toY(900));
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (const kk of K_VALUES) {
      g.beginPath();
      for (let j = 0; j <= 100; j++) {
        const ms = Math.pow(10, xMin + (xMax - xMin) * j / 100), yy = toY(thresholdCurrent(ms, kk));
        if (j === 0) g.moveTo(toX(ms), yy); else g.lineTo(toX(ms), yy);
      }
      g.setLineDash(kk === k ? [] : [4, 4]); g.strokeStyle = kk === k ? C.ink : C.muted; g.lineWidth = kk === k ? 2 : 1; g.stroke();
    }
    g.restore(); g.setLineDash([]);
    const rheobase = rheobaseCurrent(k);
    g.save(); g.setLineDash([3, 3]); g.strokeStyle = C.accent; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, toY(rheobase)); g.lineTo(x + w, toY(rheobase)); g.stroke();
    g.beginPath(); g.moveTo(toX(CHRONAXIE_MS), toY(2 * rheobase)); g.lineTo(toX(CHRONAXIE_MS), y + h); g.stroke();
    g.restore();
    g.fillStyle = C.accent; g.beginPath(); g.arc(toX(CHRONAXIE_MS), toY(2 * rheobase), 4, 0, Math.PI * 2); g.fill();
    label(t('singleRheobase'), x + w, toY(rheobase) - 5, { color: C.accent, align: 'right' });
    label(t('singleChronaxie'), toX(CHRONAXIE_MS) + 6, toY(2 * rheobase) - 6, { color: C.accent });
    for (const [ms, tag] of [[0.3, 'UBP'], [0.5, ''], [1.0, ''], [8.3, 'sine']]) {
      g.strokeStyle = C.muted; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(toX(ms), y + h - 6); g.lineTo(toX(ms), y + h); g.stroke();
      if (tag) label(tag === 'sine' ? t('singleSine') : tag, tag === 'sine' ? toX(ms) + 6 : toX(ms), y + h - 10, { align: tag === 'sine' ? 'right' : 'center' });
    }
    const fires = trace.phases.spike;
    g.fillStyle = fires ? C.ok : C.bad; g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    g.beginPath(); g.arc(toX(trace.pw), toY(trace.current), 6, 0, Math.PI * 2); g.fill(); g.stroke();
    label(t('singleSetting'), toX(trace.pw) + 10, toY(trace.current) + 4, { weight: 500, color: C.ink });
    // the three neurons at the present setting: threshold at this pulse width and whether it is reached
    const rows = K_VALUES.map((kk, i) => {
      const th = thresholdCurrent(trace.pw, kk), ok = trace.current >= th;
      return { text: `${t(['singleNear', 'singleMiddle', 'singleFar'][i])} (${['1, 6', '2, 5', '3, 4'][i]}): ${Math.round(th)} mA, ${t(ok ? 'sdFires' : 'sdBelow')}`, ok, sel: kk === k };
    });
    g.font = font(500);
    const bw = Math.max(...rows.map(r => g.measureText(r.text).width)) + 34, bx = x + w - bw - 6, by = y + 8;
    g.fillStyle = 'rgba(255, 255, 255, 0.92)'; g.strokeStyle = C.line; g.lineWidth = 1;
    g.beginPath(); g.roundRect(bx, by, bw, rows.length * 20 + 10, 6); g.fill(); g.stroke();
    rows.forEach((r, i) => {
      const ry = by + 20 + i * 20;
      g.fillStyle = r.ok ? C.ok : C.bad; g.beginPath(); g.arc(bx + 12, ry - 4, 5, 0, Math.PI * 2); g.fill();
      label(r.text, bx + 24, ry, { weight: r.sel ? 600 : 400, color: C.ink });
    });
  }

  // ───────── Loop, readouts and controls ─────────
  const LOOP_REAL_MS = 10000, PAUSE_REAL_MS = 1000;
  let playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const visibleCards = [true, true, true, true];
  let loopStart = performance.now(), pausedAt = playing ? null : performance.now();

  // Figure caption with the values for the present settings (drawn under the distance plot)
  function captionText() {
    return t('condSummary', {
      pw: num(cond.pw, 2), i: cond.current, f: cond.f, w: Math.round(cond.window), n: cond.pulses.length,
      aps: cond.events.length, pos: cond.positive, ok: cond.evoked,
      where: t(['condNear', 'condMiddle', 'condFar'][Math.max(0, K_VALUES.indexOf(k))]), el: side > 0 ? 'E1' : 'E2', other: side > 0 ? 'E2' : 'E1', sign: t(side > 0 ? 'condSignPos' : 'condSignNeg'),
      direct: new Set(cond.events.flatMap(e => e.sources.map(src => src.d))).size, nodes: COND_NODES_MM.length
    });
  }
  function updateReadouts() {
    out.rheobase.textContent = Math.round(rheobaseCurrent(k));
    out.chronaxie.textContent = num(CHRONAXIE_MS, 2);
    out.threshold.textContent = Math.round(thresholdCurrent(trace.pw, k));
  }

  function draw(realNow) {
    const now = pausedAt ?? realNow;   // paused: every movement stops, including the ions' drift
    const elapsed = now - loopStart, loop = LOOP_REAL_MS + PAUSE_REAL_MS;
    const fraction = Math.min(1, (elapsed % loop) / LOOP_REAL_MS), time = fraction * trace.end;
    if (visibleCards[0] && surfaces[0].w) {
      use(surfaces[0]); const L = layout();
      g.clearRect(0, 0, width, height);
      drawMembrane(L.membrane, time, now);
      drawPotential(L.vm, time);
      fit(surfaces[0], drawPhaseList(L.phases));
    }
    if (visibleCards[1] && surfaces[1].w) {
      use(surfaces[1]); const L = layout();
      g.clearRect(0, 0, width, height);
      fit(surfaces[1], drawConduction(L.cond, cond.recStart + fraction * (REC_BEFORE_MS + REC_AFTER_MS), now));
    }
    if (visibleCards[3] && surfaces[3].w) {
      use(surfaces[3]); const L = layout();
      g.clearRect(0, 0, width, height);
      // its own time base: from 1.2 ms before the action potential reaches the terminal to 6 ms after
      fit(surfaces[3], drawSynapseCard(L, (trace.arrival ?? 0) - 1.2 + fraction * 7.2, now));
    }
    if (visibleCards[2] && surfaces[2].w) {
      use(surfaces[2]); const L = layout();
      g.clearRect(0, 0, width, height);
      drawStrengthDuration(L.sd);
    }
  }
  function frame(now) { draw(now); requestAnimationFrame(frame); }

  function refresh() { compute(); computeConduction(); updateReadouts(); }
  pwSlider.addEventListener('input', refresh);
  currentSlider.addEventListener('input', refresh);
  frequencySlider.addEventListener('input', refresh);
  document.addEventListener('translations-loaded', updateReadouts);
  const sideButtons = [...document.querySelectorAll('#axonSide [data-side]')];
  sideButtons.forEach(button => button.addEventListener('click', () => {
    side = parseFloat(button.dataset.side);
    sideButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    computeConduction();
  }));
  allDistanceButtons.forEach(button => button.addEventListener('click', () => {
    k = parseFloat(button.dataset.k);
    allDistanceButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === button.dataset.k)));
    refresh();
  }));
  const setPlaying = (on) => {
    const now = performance.now();
    if (on === playing) return;
    if (playing) pausedAt = now; else { loopStart += now - pausedAt; pausedAt = null; }
    playing = on;
  };
  playButton.addEventListener('click', () => setPlaying(!playing));   // the tissue simulation updates the button's label
  restartButton.addEventListener('click', () => setPlaying(true));
  const sizes = new ResizeObserver(resize);
  surfaces.forEach(sf => sizes.observe(sf.el));
  if ('IntersectionObserver' in window) {
    surfaces.forEach((sf, i) => new IntersectionObserver(e => { visibleCards[i] = e[0].isIntersecting; }).observe(sf.el));
  }

  refresh(); resize();
  requestAnimationFrame(frame);
});
