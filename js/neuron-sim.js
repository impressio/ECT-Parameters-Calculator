/* =====================================================================
 * neuron-sim.js - simulation of how the stimulus parameters act on
 * cortical neurons under the two scalp electrodes, in slow motion.
 *
 * Scene: a cross-section through scalp, skull, cerebrospinal fluid and
 * cortex, with the electrodes on the scalp. Most of the current is shunted
 * through the scalp; a smaller part reaches the cortex, where pyramidal
 * neurons stand perpendicular to the surface.
 *
 * Stimulus: the same biphasic train as the current chart - one pulse per
 * half period (1000 / (2 x frequency) ms), centered in it, alternating
 * positive and negative. In a positive pulse E1 is the anode (+) and E2
 * the cathode (-); a negative pulse swaps them. Current entering the
 * cortex under the anode flows inward along the pyramidal cell and leaves
 * at the soma, depolarizing it; under the cathode the soma is
 * hyperpolarized. The two sides therefore take turns.
 *
 * Neurons: leaky integrate-and-fire with membrane time constant TAU_MS,
 * which gives the strength-duration relation (chronaxie = TAU_MS x ln 2):
 * short pulses need more current to reach threshold. Coupling falls with
 * distance from the electrode. After a spike the neuron is absolutely
 * refractory, then its threshold relaxes back, so pulses at high frequency
 * can fall in the refractory period. The model is normalized (rest 0,
 * threshold 1) and shown in mV (rest -70 mV, threshold -55 mV) with an
 * action potential waveform and after-hyperpolarization added for display.
 * ===================================================================== */
document.addEventListener('DOMContentLoaded', function () {
  const canvas = document.getElementById('neuronCanvas');
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const sliders = {
    pulseWidth: document.getElementById('pulseWidth'),
    frequency: document.getElementById('pulseFrequency'),
    duration: document.getElementById('duration'),
    current: document.getElementById('current')
  };
  const playButton = document.getElementById('simPlay');
  const restartButton = document.getElementById('simRestart');
  const speedButtons = [...document.querySelectorAll('.sim-seg [data-speed]')];
  const progressBar = document.getElementById('simProgressBar');
  const timeLabel = document.getElementById('simTime');
  const out = {
    pulses: document.getElementById('simPulses'),
    recruited: document.getElementById('simRecruited'),
    spikes: document.getElementById('simSpikes'),
    charge: document.getElementById('simCharge')
  };

  // ───────── Model (illustrative constants) ─────────
  const TAU_MS = 0.35;            // membrane time constant
  const DT_MS = 0.01;             // integration step
  const ABS_REFRACTORY_MS = 2;    // absolute refractory period
  const REL_REFRACTORY_MS = 4;    // time constant of the threshold's return after it
  const RESET_V = -0.4;           // reset after a spike (normalized)
  const REST_MV = -70, THRESHOLD_MV = -55;
  const MV_PER_UNIT = THRESHOLD_MV - REST_MV;
  const WINDOW_MS = 100;          // width of the rolling traces
  const BIN_MS = 0.05;            // trace resolution
  const BINS = Math.round(WINDOW_MS / BIN_MS);
  const STEPS_PER_BIN = Math.round(BIN_MS / DT_MS);
  const END_PAUSE_MS = 1500;      // real time shown at the end of a train before it restarts
  // Six pyramidal neurons, numbered left to right, three under each electrode. side -1: under E1, +1: under E2.
  // x: fraction of the width; depth: fraction of the cortex thickness. Coupling falls with
  // distance, so with 0.3 ms pulses they reach threshold at about 450, 650 and 850 mA.
  const NEURONS = [
    { side: -1, x: 0.15, depth: 0.30, k: 3.86, seed: 11 },
    { side: -1, x: 0.29, depth: 0.52, k: 2.67, seed: 23 },
    { side: -1, x: 0.42, depth: 0.74, k: 2.04, seed: 37 },
    { side: 1, x: 0.58, depth: 0.74, k: 2.04, seed: 67 },
    { side: 1, x: 0.71, depth: 0.52, k: 2.67, seed: 53 },
    { side: 1, x: 0.85, depth: 0.30, k: 3.86, seed: 41 }
  ];
  const ELECTRODE_X = [0.15, 0.85];
  // Presentation colors
  const C = {
    ink: '#1e1e1e', muted: '#757575', line: '#e6e6e6',
    positive: '#0d99ff', negative: '#9747ff', spike: '#ffa629',
    scalp: ['#f3d9c9', '#ecc9b5'], skull: ['#f1ebdd', '#e4dac5'], csf: ['#e3f1fb', '#d4e9f7'],
    gray: ['#efe3e1', '#e6d5d3'], white: '#f6f1ef',
    membrane: [96, 96, 104], depolarized: [255, 140, 26], hyperpolarized: [13, 120, 230],
    myelin: '#fbfbfb', myelinEdge: '#b9b9c0'
  };

  const t = window.ectT;   // i18n.js
  const D = window.ECTDraw;   // illustration.js
  const rootStyle = getComputedStyle(document.documentElement);
  const fontFamily = rootStyle.getPropertyValue('--font').trim();
  const fontSmall = parseFloat(rootStyle.getPropertyValue('--fs-small'));

  let speed = 0.05;               // simulated ms per real ms
  let playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true;
  let selected = 0;
  let params, state;

  function readParams() {
    const frequency = parseFloat(sliders.frequency.value);
    return {
      pulseWidth: parseFloat(sliders.pulseWidth.value),
      halfPeriod: 1000 / (2 * frequency),
      trainMs: parseFloat(sliders.duration.value) * 1000,
      current: parseFloat(sliders.current.value)
    };
  }

  function reset() {
    params = readParams();
    state = {
      time: 0, steps: 0, done: false, doneAt: 0,
      pulses: [0, 0], charge: 0, spikes: 0,
      lastPulse: -1, pulseFlash: { sign: 0, at: -Infinity },
      neurons: NEURONS.map(() => ({ v: 0, lastSpike: -Infinity, spikes: 0, flashAt: -Infinity })),
      bins: { current: new Float32Array(BINS), mv: NEURONS.map(() => new Float32Array(BINS).fill(REST_MV)) },
      binIndex: 0, binCurrent: 0, binMv: NEURONS.map(() => null)
    };
  }

  // Stimulus current (mA, signed) at simulated time ms
  function stimulus(ms) {
    if (ms >= params.trainMs) return 0;
    const k = Math.floor(ms / params.halfPeriod);
    const start = k * params.halfPeriod + (params.halfPeriod - params.pulseWidth) / 2;
    if (ms < start || ms >= start + params.pulseWidth) return 0;
    return k % 2 === 0 ? params.current : -params.current;
  }

  function threshold(n, ms) {
    const since = ms - n.lastSpike;
    if (since < ABS_REFRACTORY_MS) return Infinity;
    return 1 + Math.exp(-(since - ABS_REFRACTORY_MS) / REL_REFRACTORY_MS);
  }

  // Displayed membrane potential (mV): the model's potential, with an action potential
  // (upstroke to +30 mV, repolarization) and a slow after-hyperpolarization after a spike
  function membraneMv(n, ms) {
    const since = ms - n.lastSpike;
    if (since < 0.25) return THRESHOLD_MV + (30 - THRESHOLD_MV) * Math.sin((since / 0.25) * Math.PI / 2);
    if (since < 1.1) {
      const f = (since - 0.25) / 0.85;
      return 30 - (30 + 78) * (1 - Math.pow(1 - f, 2));
    }
    const ahp = since < 40 ? -8 * Math.exp(-(since - 1.1) / 4) : 0;
    return REST_MV + n.v * MV_PER_UNIT + ahp;
  }

  function step(realNow) {
    const ms = state.time;
    const current = stimulus(ms);
    const pulseIndex = current !== 0 ? Math.floor(ms / params.halfPeriod) : -1;
    if (pulseIndex >= 0 && pulseIndex !== state.lastPulse) {
      state.lastPulse = pulseIndex;
      state.pulses[current > 0 ? 0 : 1]++;
    }
    if (current !== 0) {
      state.charge += Math.abs(current) * DT_MS / 1000;   // mA x ms = µC; / 1000 -> mC
      state.pulseFlash = { sign: Math.sign(current), at: realNow };
    }
    const decay = Math.exp(-DT_MS / TAU_MS);
    NEURONS.forEach((def, i) => {
      const n = state.neurons[i];
      // positive current: E1 anode, so neurons under E1 (side -1) are depolarized
      const input = -def.side * (current / 1000) * def.k;
      n.v = input + (n.v - input) * decay;
      if (n.v >= threshold(n, ms)) {
        n.v = RESET_V; n.lastSpike = ms; n.spikes++; n.flashAt = realNow;
        state.spikes++;
      }
      const mv = membraneMv(n, ms);
      const prev = state.binMv[i];
      if (prev === null || Math.abs(mv - REST_MV) > Math.abs(prev - REST_MV)) state.binMv[i] = mv;
    });
    if (Math.abs(current) > Math.abs(state.binCurrent)) state.binCurrent = current;
    // Time from an integer step count, so the bins stay aligned
    state.steps++; state.time = state.steps * DT_MS;
    if (state.steps % STEPS_PER_BIN === 0) {
      state.bins.current[state.binIndex] = state.binCurrent;
      state.bins.mv.forEach((arr, i) => { arr[state.binIndex] = state.binMv[i]; });
      state.binIndex = (state.binIndex + 1) % BINS;
      state.binCurrent = 0; state.binMv = NEURONS.map(() => null);
    }
  }

  function advance(realDelta, realNow) {
    if (state.done) {
      if (realNow - state.doneAt > END_PAUSE_MS) reset();
      return;
    }
    const steps = Math.min(5000, Math.round(realDelta * speed / DT_MS));
    for (let s = 0; s < steps; s++) step(realNow);
    if (state.time >= params.trainMs + 40) { state.done = true; state.doneAt = realNow; }
  }

  // ───────── Neuron morphology (generated once per neuron, seeded) ─────────
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let r = Math.imul(a ^ (a >>> 15), 1 | a);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Branch list in units of the soma height; y grows downward. apicalLength is the
  // distance (same units) from the soma to just below the pia.
  function buildPyramidal(seed, apicalLength) {
    const rnd = random(seed);
    const branches = [];
    const grow = (x, y, angle, length, width, depth) => {
      const segments = 3, path = [[x, y]];
      let a = angle, px = x, py = y;
      for (let s = 0; s < segments; s++) {
        a += (rnd() - 0.5) * 0.35;
        px += Math.cos(a) * length / segments; py += Math.sin(a) * length / segments;
        path.push([px, py]);
      }
      branches.push({ path, width, depth });
      if (depth < 2 && length > 4) {
        const spread = 0.45 + rnd() * 0.3;
        grow(px, py, a - spread, length * (0.55 + rnd() * 0.2), width * 0.65, depth + 1);
        grow(px, py, a + spread, length * (0.55 + rnd() * 0.2), width * 0.65, depth + 1);
      }
    };
    // apical trunk with oblique branches and a tuft near the surface
    const trunk = [[0, -0.6]];
    let tx = 0;
    const n = 6;
    for (let s = 1; s <= n; s++) {
      tx += (rnd() - 0.5) * 0.5;
      const y = -0.6 - (apicalLength - 0.6) * s / n;
      trunk.push([tx, y]);
      if (s < n && s > 1 && rnd() < 0.8) {
        const dir = rnd() < 0.5 ? -1 : 1;
        grow(tx, y, -Math.PI / 2 + dir * (0.7 + rnd() * 0.5), 2.2 + rnd() * 1.8, 0.35, 1);
      }
    }
    branches.push({ path: trunk, width: 0.9, depth: 0, trunk: true });
    for (const a of [-0.9, -0.3, 0.3, 0.9]) grow(tx, trunk[n][1], -Math.PI / 2 + a + (rnd() - 0.5) * 0.3, 2 + rnd() * 1.5, 0.4, 1);
    // basal dendrites
    const basal = 4 + Math.floor(rnd() * 2);
    for (let b = 0; b < basal; b++) {
      const a = Math.PI * (0.05 + 0.9 * (b + 0.5) / basal) + (rnd() - 0.5) * 0.3;
      grow(Math.cos(a) * 0.6, 0.35, a, 3 + rnd() * 2.5, 0.55, 1);
    }
    // axon: initial segment, then myelin sheaths separated by nodes of Ranvier
    const axon = [[0, 0.55]];
    let ax = 0;
    for (let s = 1; s <= 8; s++) { ax += (rnd() - 0.5) * 0.6; axon.push([ax, 0.55 + s * 2.2]); }
    return { branches, axon };
  }
  // cached per neuron and apical length (in soma heights), which follows the layout
  const morphologyCache = new Map();
  function morphology(i, apical) {
    const key = `${i}:${Math.round(apical * 4)}`;
    if (!morphologyCache.has(key)) morphologyCache.set(key, buildPyramidal(NEURONS[i].seed, Math.round(apical * 4) / 4));
    return morphologyCache.get(key);
  }

  // ───────── Drawing ─────────
  let width = 0, height = 0;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = canvas.clientWidth; height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const font = (weight) => `${weight || 400} ${fontSmall}px ${fontFamily}`;
  const rgba = (rgb, a) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
  const mixRgb = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f));

  // The figure has a fixed height; the canvas grows below it to fit the figure caption
  const figureHeight = () => (width < 700 ? 560 : 520);
  function layout() {
    const fh = figureHeight(), stimH = 64, vmH = Math.max(90, fh * 0.2);
    const sceneTop = stimH + 44, sceneBottom = fh - vmH - 62;
    const sceneH = sceneBottom - sceneTop;
    const scalp = sceneTop + sceneH * 0.1, skull = scalp + sceneH * 0.07, bone = skull + sceneH * 0.08;
    const csf = bone + sceneH * 0.05;
    return {
      left: 8, right: width - 8, axisLeft: 52,
      stim: { top: 24, height: stimH },
      scene: { top: sceneTop, height: sceneH, bottom: sceneBottom, scalp, skull, bone, csf },
      vm: { top: fh - vmH - 4, height: vmH }
    };
  }
  // Layers: [sceneTop..scalp] air with electrodes, [scalp..skull] scalp, [skull..bone] skull,
  // [bone..csf] CSF, [csf..bottom] cortex (gray matter, white matter at the bottom)
  function somaPosition(def, L) {
    const cortexTop = L.scene.csf, cortexH = L.scene.bottom - cortexTop;
    return { x: L.left + (L.right - L.left) * def.x, y: cortexTop + cortexH * (0.2 + 0.62 * def.depth) };
  }

  function drawTissue(L) {
    const S = L.scene, x0 = L.left, x1 = L.right;
    const band = (top, bottom, colors) => {
      const grad = g.createLinearGradient(0, top, 0, bottom);
      grad.addColorStop(0, colors[0]); grad.addColorStop(1, colors[1]);
      g.fillStyle = grad; g.fillRect(x0, top, x1 - x0, bottom - top);
    };
    band(S.scalp, S.skull, C.scalp);
    band(S.skull, S.bone, C.skull);
    // diploë: spongy bone texture
    const rnd = random(5);
    g.fillStyle = 'rgba(190, 170, 140, 0.35)';
    for (let i = 0; i < (x1 - x0) / 5; i++) {
      g.beginPath();
      g.ellipse(x0 + rnd() * (x1 - x0), S.skull + (0.3 + rnd() * 0.4) * (S.bone - S.skull), 1 + rnd() * 2, 0.8 + rnd(), 0, 0, Math.PI * 2);
      g.fill();
    }
    band(S.bone, S.csf, C.csf);
    const cortex = g.createLinearGradient(0, S.csf, 0, S.bottom);
    cortex.addColorStop(0, C.gray[0]); cortex.addColorStop(0.88, C.gray[1]); cortex.addColorStop(1, C.white);
    g.fillStyle = cortex; g.fillRect(x0, S.csf, x1 - x0, S.bottom - S.csf);
    // pia and faint background cells for texture
    g.strokeStyle = 'rgba(200, 120, 120, 0.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, S.csf + 0.5); g.lineTo(x1, S.csf + 0.5); g.stroke();
    const cells = random(9);
    g.fillStyle = 'rgba(150, 110, 110, 0.18)';
    for (let i = 0; i < (x1 - x0) / 7; i++) {
      g.beginPath();
      g.arc(x0 + cells() * (x1 - x0), S.csf + 6 + cells() * (S.bottom - S.csf - 12), 0.8 + cells() * 1.4, 0, Math.PI * 2);
      g.fill();
    }
    // layer labels
    g.font = font(400); g.fillStyle = 'rgba(117, 117, 117, 0.9)'; g.textAlign = 'right';
    const mid = (a, b) => (a + b) / 2 + 4;
    const labels = [['simScalp', S.scalp, S.skull], ['simSkull', S.skull, S.bone], ['simCortex', S.csf, S.csf + 26]];
    for (const [key, a, b] of labels) g.fillText(t(key), x1 - 6, mid(a, b));
    g.textAlign = 'left';
  }

  function drawCurrentPaths(L, flash, sign, now) {
    if (flash <= 0) return;
    const S = L.scene;
    const ex = ELECTRODE_X.map(f => L.left + (L.right - L.left) * f);
    const [from, to] = sign > 0 ? ex : [ex[1], ex[0]];   // conventional current: anode to cathode
    const color = sign > 0 ? C.positive : C.negative;
    // most current is shunted through the scalp, less through the skull, little reaches the cortex
    const paths = [
      [S.scalp + (S.skull - S.scalp) * 0.35, 2.4], [S.scalp + (S.skull - S.scalp) * 0.75, 2],
      [S.skull + (S.bone - S.skull) * 0.5, 1.2], [S.csf + (S.bottom - S.csf) * 0.25, 0.8],
      [S.csf + (S.bottom - S.csf) * 0.6, 0.6]
    ];
    g.save(); g.setLineDash([7, 7]); g.lineDashOffset = -now / 15;
    for (const [depth, w] of paths) {
      g.globalAlpha = Math.min(1, 0.3 + 0.25 * w) * flash; g.strokeStyle = color; g.lineWidth = w;
      g.beginPath(); g.moveTo(from, S.scalp);
      const dip = depth - S.scalp;
      g.bezierCurveTo(from + (to - from) * 0.12, S.scalp + dip * 1.3, from + (to - from) * 0.88, S.scalp + dip * 1.3, to, S.scalp);
      g.stroke();
    }
    g.restore();
  }

  function drawElectrodes(L, flash, sign) {
    const S = L.scene;
    ELECTRODE_X.forEach((f, i) => {
      const x = L.left + (L.right - L.left) * f, w = Math.min(56, (L.right - L.left) * 0.11), h = 10;
      const y = S.scalp - h - 3;
      // conductive gel
      g.fillStyle = 'rgba(160, 205, 235, 0.7)';
      g.beginPath(); g.ellipse(x, S.scalp - 1, w / 2 + 4, 4, 0, 0, Math.PI * 2); g.fill();
      // cable
      g.strokeStyle = '#4a4a4a'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x, y - 14, x + (i ? 14 : -14), S.top - 4, x + (i ? 20 : -20), S.top - 10); g.stroke();
      // metal disc
      const metal = g.createLinearGradient(0, y, 0, y + h);
      metal.addColorStop(0, '#f0f0f0'); metal.addColorStop(0.5, '#b8b8bc'); metal.addColorStop(1, '#8c8c92');
      g.fillStyle = metal; g.strokeStyle = '#6e6e74'; g.lineWidth = 1;
      g.beginPath(); g.roundRect(x - w / 2, y, w, h, 4); g.fill(); g.stroke();
      // name and present polarity
      const active = flash > 0 && sign !== 0;
      const anode = active && (i === 0 ? sign > 0 : sign < 0);
      g.font = font(600); g.textAlign = 'center'; g.fillStyle = C.ink;
      g.fillText(`E${i + 1}`, x + (i ? -w / 2 - 18 : w / 2 + 18), y + 9);
      if (active) {
        const bx = x + (i ? w / 2 + 14 : -w / 2 - 14), by = y + 5;
        g.globalAlpha = 0.35 + 0.65 * flash;
        g.fillStyle = anode ? rgba(C.depolarized, 1) : rgba(C.hyperpolarized, 1);
        g.beginPath(); g.arc(bx, by, 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff'; g.fillText(anode ? '+' : '−', bx, by + 5);
        g.globalAlpha = 1;
      }
      g.textAlign = 'left';
    });
  }

  function strokePath(path, ox, oy, s) {
    g.beginPath();
    path.forEach(([px, py], j) => { if (j === 0) g.moveTo(ox + px * s, oy + py * s); else g.lineTo(ox + px * s, oy + py * s); });
    g.stroke();
  }

  function drawNeuron(def, i, L, now) {
    const n = state.neurons[i];
    const { x, y } = somaPosition(def, L);
    const s = Math.max(4, Math.min(9, (L.scene.bottom - L.scene.csf) / 22));   // soma height in px
    const m = morphology(i, Math.max(2, (y - L.scene.csf - 10) / s));        // apical tuft just below the pia
    const v = Math.max(-1, Math.min(1, n.v));
    const tint = v >= 0 ? mixRgb(C.membrane, C.depolarized, Math.min(1, v)) : mixRgb(C.membrane, C.hyperpolarized, Math.min(1, -v * 1.3));
    const spikeAge = now - n.flashAt;
    const spikeGlow = Math.max(0, 1 - spikeAge / 450);
    const color = spikeGlow > 0 ? mixRgb(tint, [255, 120, 0], spikeGlow) : tint;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // dendrites and cell body as one silhouette: tapered tubes joined to the soma without seams (illustration.js)
    const somaPath = new Path2D();
    somaPath.moveTo(x, y - s * 0.95);
    somaPath.quadraticCurveTo(x + s * 0.35, y - s * 0.2, x + s * 0.75, y + s * 0.45);
    somaPath.quadraticCurveTo(x, y + s * 0.75, x - s * 0.75, y + s * 0.45);
    somaPath.quadraticCurveTo(x - s * 0.35, y - s * 0.2, x, y - s * 0.95);
    const cell = [], tubes = [];
    for (const b of m.branches) {
      const w0 = Math.max(1, b.width * s * 0.5), tb = { points: b.path.map(([px, py]) => [x + px * s, y + py * s]), w0, w1: Math.max(0.7, w0 * 0.55) };
      cell.push(D.tubePiece(tb.points, tb.w0, tb.w1)); tubes.push(tb);
    }
    cell.push(somaPath);
    D.silhouette(g, cell, { outline: rgba(mixRgb(color, [70, 45, 45], 0.45), 1), outlineWidth: 0.8, fill: rgba(color, 1) });
    D.cores(g, tubes.filter(tb => tb.w0 > 2.2), rgba(mixRgb(color, [255, 255, 255], 0.5), 0.6), 0.3);
    // axon with myelin sheaths and nodes of Ranvier; the action potential jumps node to node
    g.strokeStyle = rgba(C.membrane, 0.9); g.lineWidth = Math.max(0.8, s * 0.18);
    strokePath(m.axon, x, y, s);
    const nodes = m.axon.length - 1;
    const front = spikeGlow > 0 ? (1 - spikeGlow) * (nodes + 2) : -1;
    for (let j = 1; j < m.axon.length; j++) {
      const [ax0, ay0] = m.axon[j - 1], [ax1, ay1] = m.axon[j];
      const cx = x + (ax0 + ax1) / 2 * s, cy = y + (ay0 + ay1) / 2 * s;
      const len = Math.hypot(ax1 - ax0, ay1 - ay0) * s * 0.78, ang = Math.atan2(ay1 - ay0, ax1 - ax0);
      if (j > 1) {   // initial segment is unmyelinated
        g.save(); g.translate(cx, cy); g.rotate(ang);
        g.fillStyle = C.myelin; g.strokeStyle = C.myelinEdge; g.lineWidth = 0.8;
        g.beginPath(); g.roundRect(-len / 2, -s * 0.28, len, s * 0.56, s * 0.28); g.fill(); g.stroke();
        g.restore();
      }
      const nx = x + ax1 * s, ny = y + ay1 * s;
      const lit = front >= 0 && Math.abs(front - j) < 0.9;
      g.fillStyle = lit ? C.spike : rgba(color, 0.9);
      g.beginPath(); g.arc(nx, ny, lit ? Math.max(2.5, s * 0.35) : Math.max(1, s * 0.16), 0, Math.PI * 2); g.fill();
    }
    // soma: pyramid-shaped cell body with shading
    if (spikeGlow > 0) { g.save(); g.shadowColor = rgba([255, 150, 30], spikeGlow); g.shadowBlur = 18 * spikeGlow; }
    const body = g.createRadialGradient(x - s * 0.2, y - s * 0.1, s * 0.1, x, y, s * 1.1);
    body.addColorStop(0, rgba(mixRgb(color, [255, 255, 255], 0.55), 1));
    body.addColorStop(1, rgba(color, 1));
    g.fillStyle = body; g.fill(somaPath);
    if (spikeGlow > 0) g.restore();
    // nucleus
    g.fillStyle = 'rgba(255, 255, 255, 0.45)';
    g.beginPath(); g.arc(x, y + s * 0.12, s * 0.22, 0, Math.PI * 2); g.fill();
    // number, selection and refractory state
    g.font = font(500); g.textAlign = 'center'; g.fillStyle = C.ink;
    g.fillText(String(i + 1), x + s * 1.5 * (def.side < 0 ? -1 : 1), y + 5);
    if (i === selected) {
      g.save(); g.setLineDash([3, 3]); g.strokeStyle = C.ink; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, s * 1.35, 0, Math.PI * 2); g.stroke(); g.restore();
    }
    if (threshold(n, state.time) === Infinity && width >= 600) {   // too crowded on narrow screens
      g.font = font(400); g.fillStyle = C.muted;
      g.fillText(t('simRefractory'), x, y + s * 1.25 + 14);
    }
    g.textAlign = 'left';
  }

  // Rolling trace with a y-axis; values: ring buffer; ticks: [[value, label]]
  function drawTraceFrame(box, label, ticks, toY, L) {
    g.font = font(500); g.fillStyle = C.muted; g.textAlign = 'left';
    g.fillText(label, L.left, box.top - 8);
    g.font = font(400); g.textAlign = 'right';
    for (const [value, text] of ticks) {
      const y = toY(value);
      g.strokeStyle = C.line; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L.axisLeft, y); g.lineTo(L.right, y); g.stroke();
      g.fillStyle = C.muted; g.fillText(text, L.axisLeft - 6, y + 4);
    }
    g.textAlign = 'left';
  }
  const xOfBin = (j, L) => L.axisLeft + (j / (BINS - 1)) * (L.right - L.axisLeft);

  function drawStimulus(L) {
    const box = L.stim, mid = box.top + box.height / 2, I = params.current;
    const toY = (mA) => mid - (mA / 1000) * box.height / 2;
    drawTraceFrame(box, t('simCurrentTrace'), [[I, `+${I}`], [0, '0'], [-I, `−${I}`]], toY, L);
    g.lineWidth = 1.5; g.lineJoin = 'miter';
    let prev = 0;
    g.beginPath(); g.moveTo(xOfBin(0, L), mid);
    for (let j = 0; j < BINS; j++) {
      const value = state.bins.current[(state.binIndex + j) % BINS];
      const x = xOfBin(j, L);
      if (value !== prev) { g.lineTo(x, toY(prev)); g.lineTo(x, toY(value)); prev = value; }
    }
    g.lineTo(L.right, toY(prev));
    g.strokeStyle = C.ink; g.stroke();
    // color the pulses by phase
    for (let j = 0; j < BINS; j++) {
      const value = state.bins.current[(state.binIndex + j) % BINS];
      if (!value) continue;
      g.fillStyle = value > 0 ? rgba([13, 153, 255], 0.35) : rgba([151, 71, 255], 0.35);
      const y0 = toY(value);
      g.fillRect(xOfBin(j, L), Math.min(y0, mid), Math.max(1.5, (L.right - L.axisLeft) / BINS), Math.abs(mid - y0));
    }
    // time scale bar, above the trace on the right
    const px10 = 10 / WINDOW_MS * (L.right - L.axisLeft), barY = box.top - 12;
    g.strokeStyle = C.muted; g.lineWidth = 2;
    g.beginPath(); g.moveTo(L.right - px10, barY); g.lineTo(L.right, barY); g.stroke();
    g.font = font(400); g.fillStyle = C.muted; g.textAlign = 'right';
    g.fillText('10 ms', L.right - px10 - 6, barY + 4); g.textAlign = 'left';
  }

  function drawMembrane(L) {
    const box = L.vm, n = state.neurons[selected];
    const top = 40, bottom = -90;
    const toY = (mv) => box.top + (top - mv) / (top - bottom) * box.height;
    drawTraceFrame(box, t('simMembrane', { n: selected + 1 }), [[30, '+30'], [0, '0'], [REST_MV, String(REST_MV)]], toY, L);
    // present threshold (raised during the relative refractory period)
    const th = threshold(n, state.time);
    if (th !== Infinity) {
      const y = toY(REST_MV + Math.min(th, 3) * MV_PER_UNIT);
      g.save(); g.setLineDash([4, 4]); g.strokeStyle = C.spike; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L.axisLeft, y); g.lineTo(L.right, y); g.stroke(); g.restore();
      g.font = font(400); g.fillStyle = C.muted; g.textAlign = 'right';
      g.fillText(`${t('simThreshold')} ${Math.round(REST_MV + Math.min(th, 3) * MV_PER_UNIT)} mV`, L.right, y - 4); g.textAlign = 'left';
    }
    const values = state.bins.mv[selected];
    g.strokeStyle = C.ink; g.lineWidth = 1.5; g.lineJoin = 'round';
    g.beginPath();
    for (let j = 0; j < BINS; j++) {
      const y = toY(Math.max(bottom, Math.min(top, values[(state.binIndex + j) % BINS])));
      if (j === 0) g.moveTo(xOfBin(j, L), y); else g.lineTo(xOfBin(j, L), y);
    }
    g.stroke();
  }

  function draw(now) {
    if (!width) return;
    const L = layout();
    g.clearRect(0, 0, width, height);
    drawStimulus(L);

    const flash = Math.max(0, 1 - (now - state.pulseFlash.at) / 250);
    const sign = state.pulseFlash.sign;
    drawTissue(L);
    drawCurrentPaths(L, flash, sign, now);
    g.save(); g.beginPath(); g.rect(L.left, L.scene.csf, L.right - L.left, L.scene.bottom - L.scene.csf); g.clip();
    NEURONS.forEach((def, i) => drawNeuron(def, i, L, now));
    g.restore();
    drawElectrodes(L, flash, sign);
    g.font = font(400); g.fillStyle = C.muted; g.textAlign = 'center';
    const caption = state.done ? t('simDone') : flash > 0.6 ? t(sign > 0 ? 'simPhasePos' : 'simPhaseNeg') : t('simPhaseRest');
    g.fillText(caption, (L.left + L.right) / 2, L.scene.bottom + 20);
    g.textAlign = 'left';

    drawMembrane(L);
    // figure caption, and the canvas height fitted to it (no empty space at the end of the card)
    g.font = font(400); g.fillStyle = C.ink;
    let yy = figureHeight() + 34, line = '';
    for (const word of t('neuronSimFigure').split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > width - 16 && line) { g.fillText(line, 8, yy); line = word; yy += 18; } else line = test;
    }
    if (line) g.fillText(line, 8, yy);
    const needed = Math.ceil(yy + 10);
    if (Math.abs(needed - height) > 2) canvas.style.setProperty('height', `${needed}px`, 'important');
  }

  function updateReadouts() {
    const elapsed = Math.min(state.time, params.trainMs);
    progressBar.style.width = `${(100 * elapsed / params.trainMs).toFixed(1)}%`;
    const dec = (v) => (document.documentElement.lang === 'sv' ? v.replace('.', ',') : v);   // decimal comma in Swedish
    timeLabel.textContent = `${dec((elapsed / 1000).toFixed(2))} / ${dec((params.trainMs / 1000).toFixed(2))} s`;
    out.pulses.textContent = `${state.pulses[0] + state.pulses[1]} (${state.pulses[0]}/${state.pulses[1]})`;
    // neurons that fired during the last stimulus cycle (one positive and one negative pulse)
    const cycle = 2 * params.halfPeriod;
    const firing = state.neurons.filter(n => state.time - n.lastSpike <= cycle).length;
    const label = t('simOf', { a: firing, b: NEURONS.length });
    if (label) out.recruited.textContent = label;
    out.spikes.textContent = state.spikes;
    out.charge.textContent = dec(state.charge.toFixed(2));
    const playLabel = t(playing ? 'simPause' : 'simPlay');
    if (playLabel) playButton.textContent = playLabel;
  }

  // ───────── Loop and controls ─────────
  let last = performance.now();
  function frame(now) {
    const delta = Math.min(100, now - last); last = now;
    if (playing && visible) advance(delta, now);
    if (visible) { draw(now); updateReadouts(); }
    requestAnimationFrame(frame);
  }

  Object.values(sliders).forEach(slider => slider.addEventListener('input', reset));
  playButton.addEventListener('click', () => { playing = !playing; });
  restartButton.addEventListener('click', () => { reset(); playing = true; });
  speedButtons.forEach(button => button.addEventListener('click', () => {
    speed = parseFloat(button.dataset.speed);
    speedButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  }));
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect(), L = layout();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    let best = -1, bestDist = 36;
    NEURONS.forEach((def, i) => {
      const { x, y } = somaPosition(def, L);
      const d = Math.hypot(px - x, py - y);
      if (d < bestDist) { best = i; bestDist = d; }
    });
    if (best >= 0) selectNeuron(best);
  });
  // Paired with the shared menu below (Neuron near/middle/far, Axon under E1/E2): neurons 1-3 lie under E1
  // and 4-6 under E2, 1 and 6 near the electrode, 2 and 5 in the middle, 3 and 4 far from it
  const distanceMenu = [...document.querySelectorAll('#singleDistance [data-k]')];
  const sideMenu = [...document.querySelectorAll('#axonSide [data-side]')];
  function selectNeuron(i) {
    selected = i;
    const def = NEURONS[i], k = distanceMenu.find(b => Math.abs(parseFloat(b.dataset.k) - def.k) < 1e-6);
    const sideButton = sideMenu.find(b => parseFloat(b.dataset.side) === (def.side < 0 ? 1 : -1));
    if (k && k.getAttribute('aria-pressed') !== 'true') k.click();
    if (sideButton && sideButton.getAttribute('aria-pressed') !== 'true') sideButton.click();
  }
  function followMenu() {
    const k = parseFloat(distanceMenu.find(b => b.getAttribute('aria-pressed') === 'true')?.dataset.k);
    const side = parseFloat(sideMenu.find(b => b.getAttribute('aria-pressed') === 'true')?.dataset.side);
    const i = NEURONS.findIndex(def => Math.abs(def.k - k) < 1e-6 && (def.side < 0 ? 1 : -1) === side);
    if (i >= 0) selected = i;
  }
  [...distanceMenu, ...sideMenu].forEach(b => b.addEventListener('click', () => setTimeout(followMenu)));
  new ResizeObserver(resize).observe(canvas);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(canvas);
  }

  reset(); resize();
  requestAnimationFrame(frame);
});
