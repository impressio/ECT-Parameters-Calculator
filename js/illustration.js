/* =====================================================================
 * illustration.js - shared drawing helpers for the simulations, so the
 * cells, membranes and labels look the same everywhere:
 *  - smooth (Catmull-Rom) paths and tapered tubes, collected into one
 *    Path2D and drawn as a single silhouette (outline, fill, then a
 *    lighter core), so branches join the cell body without seams;
 *  - shaded spheres (ions, vesicles), phospholipids and channel proteins;
 *  - callout labels with a leader line and an anchor dot.
 * All functions take the 2D context as their first argument.
 * ===================================================================== */
window.ECTDraw = (function () {
  // Small seeded generator (mulberry32): shapes are the same on every draw
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let r = Math.imul(a ^ (a >>> 15), 1 | a);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Catmull-Rom spline through points, sampled `steps` times per segment
  function smooth(points, steps = 6) {
    if (points.length < 3) return points.slice();
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    out.push(points[points.length - 1].slice());
    return out;
  }

  // Add a tapered tube along a smooth path to a Path2D (width w0 at the start, w1 at the end, round tip)
  function tube(path, points, w0, w1) {
    const pts = smooth(points, 5), n = pts.length;
    if (n < 2) return;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const half = (w0 + (w1 - w0) * i / (n - 1)) / 2;
      left.push([pts[i][0] - dy / len * half, pts[i][1] + dx / len * half]);
      right.push([pts[i][0] + dy / len * half, pts[i][1] - dx / len * half]);
    }
    path.moveTo(left[0][0], left[0][1]);
    for (const p of left) path.lineTo(p[0], p[1]);
    const end = pts[n - 1], prev = pts[n - 2], ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
    path.arc(end[0], end[1], w1 / 2, ang + Math.PI / 2, ang - Math.PI / 2, true);
    for (let i = n - 1; i >= 0; i--) path.lineTo(right[i][0], right[i][1]);
    path.closePath();
  }

  // Closed smooth outline through points (cell bodies, terminals)
  function blob(path, points, steps = 8) {
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const [px, py] = [0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
        if (i === 0 && s === 0) path.moveTo(px, py); else path.lineTo(px, py);
      }
    }
    path.closePath();
  }

  // Draw a silhouette from overlapping pieces (Path2D or an array of them): all outlines first,
  // then all fills, so the pieces merge into one shape without seams. Pieces are filled one by
  // one, so overlaps never cancel out, whatever direction each piece was traced in.
  function silhouette(g, pieces, { outline, outlineWidth = 1.6, fill }) {
    const list = Array.isArray(pieces) ? pieces : [pieces];
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = outline; g.lineWidth = outlineWidth * 2;
    for (const p of list) g.stroke(p);
    g.fillStyle = fill;
    for (const p of list) g.fill(p);
    g.restore();
  }
  // A new Path2D holding one tapered tube (a silhouette piece)
  function tubePiece(points, w0, w1) { const p = new Path2D(); tube(p, points, w0, w1); return p; }
  function cores(g, branches, color, scale = 0.38) {
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
    for (const b of branches) {
      const pts = smooth(b.points, 5);
      for (let i = 1; i < pts.length; i++) {
        const w = (b.w0 + (b.w1 - b.w0) * i / (pts.length - 1)) * scale;
        g.lineWidth = Math.max(0.6, w);
        g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke();
      }
    }
    g.restore();
  }

  // Shaded sphere: ions, vesicles
  function sphere(g, x, y, r, color, edge) {
    const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.35, color); grad.addColorStop(1, edge || color);
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // Phospholipid: head (shaded sphere) and two tails; up = head on top
  function phospholipid(g, x, y, up, size) {
    const dir = up ? 1 : -1, tail = size * 2.6;
    g.strokeStyle = '#c9b38c'; g.lineWidth = Math.max(0.8, size * 0.28); g.lineCap = 'round';
    for (const dx of [-size * 0.35, size * 0.35]) {
      g.beginPath(); g.moveTo(x + dx, y + dir * size * 0.6);
      g.bezierCurveTo(x + dx * 1.6, y + dir * tail * 0.4, x + dx * 0.4, y + dir * tail * 0.7, x + dx, y + dir * tail);
      g.stroke();
    }
    sphere(g, x, y, size, '#e8cfa0', '#b89763');
  }

  // A row of phospholipids forming the bilayer between x0 and x1, skipping gaps [[from, to], ...]
  function bilayer(g, x0, x1, midY, size, gaps = []) {
    const step = size * 2.15, tail = size * 2.6, outerY = midY - tail - size * 0.2, innerY = midY + tail + size * 0.2;
    g.fillStyle = 'rgba(240, 225, 190, 0.45)'; g.fillRect(x0, outerY, x1 - x0, innerY - outerY);
    for (let x = x0 + size; x < x1 - size * 0.5; x += step) {
      if (gaps.some(([a, b]) => x > a - size && x < b + size)) continue;
      phospholipid(g, x, outerY, true, size);
      phospholipid(g, x, innerY, false, size);
    }
    return { outerY: outerY - size, innerY: innerY + size };
  }

  // Transmembrane channel protein: subunits around a pore that widens with `open` (0-1)
  function channel(g, cx, midY, height, open, colors) {
    const sub = height * 0.26, gap = 2 + open * height * 0.22;
    for (const side of [-1, 1]) {
      for (const k of [0, 1]) {   // two subunits per side, the outer one behind
        const x = cx + side * (gap / 2 + sub / 2 + k * sub * 0.55);
        const grad = g.createLinearGradient(x - sub / 2, 0, x + sub / 2, 0);
        grad.addColorStop(0, colors.light); grad.addColorStop(0.5, colors.mid); grad.addColorStop(1, colors.dark);
        g.fillStyle = grad; g.strokeStyle = colors.edge; g.lineWidth = 1;
        g.globalAlpha = k ? 0.75 : 1;
        g.beginPath(); g.roundRect(x - sub / 2, midY - height / 2, sub, height, sub * 0.45); g.fill(); g.stroke();
        g.globalAlpha = 1;
      }
    }
  }

  // Callout: label with a thin leader line to an anchor dot on the structure
  function callout(g, text, anchor, at, { font, color = '#5c5c5c', align = 'center' } = {}) {
    g.save();
    g.strokeStyle = 'rgba(80, 80, 80, 0.7)'; g.fillStyle = 'rgba(80, 80, 80, 0.85)'; g.lineWidth = 0.9;
    g.font = font;
    const tw = g.measureText(text).width;
    const textX = align === 'center' ? at[0] : align === 'right' ? at[0] - tw / 2 : at[0] + tw / 2;
    const above = at[1] < anchor[1];
    const ly = above ? at[1] + 5 : at[1] - 15;   // leader starts just below or above the text
    g.beginPath(); g.moveTo(textX, ly); g.lineTo(anchor[0], anchor[1]); g.stroke();
    g.beginPath(); g.arc(anchor[0], anchor[1], 2, 0, Math.PI * 2); g.fill();
    // light backdrop keeps the label readable where it lies over the drawing
    const x0 = align === 'center' ? at[0] - tw / 2 : align === 'right' ? at[0] - tw : at[0];
    g.fillStyle = 'rgba(255, 255, 255, 0.8)'; g.beginPath(); g.roundRect(x0 - 3, at[1] - 13, tw + 6, 17, 4); g.fill();
    g.fillStyle = color; g.textAlign = align; g.fillText(text, at[0], at[1]);
    g.restore();
  }

  return { random, smooth, tube, tubePiece, blob, silhouette, cores, sphere, phospholipid, bilayer, channel, callout };
})();
