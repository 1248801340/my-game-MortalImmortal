// 去除 AI 图里的假透明棋盘格背景
export function removeCheckerBackground(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const T = 45;                       // ★ 阈值调小，减少误删青衫
  const corners = [0, W - 1, (H - 1) * W, (H - 1) * W + (W - 1)];
  let sr = 0, sg = 0, sb = 0, cn = 0;
  corners.forEach(i => {
    const p = i * 4;
    if (d[p + 3] >= 128) { sr += d[p]; sg += d[p + 1]; sb += d[p + 2]; cn++; }
  });
  const ref = cn ? [sr / cn, sg / cn, sb / cn] : [240, 240, 240];
  const visited = new Uint8Array(W * H);
  const stack = [];
  const maxd = (p, r) => Math.max(Math.abs(d[p]-r[0]), Math.abs(d[p+1]-r[1]), Math.abs(d[p+2]-r[2]));
  const enqueue = (x, y, r) => {
    const i = y * W + x; if (visited[i]) return; const p = i * 4;
    if (d[p + 3] < 128 || maxd(p, r) <= T) { visited[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < W; x++) { enqueue(x, 0, ref); enqueue(x, H - 1, ref); }
  for (let y = 0; y < H; y++) { enqueue(0, y, ref); enqueue(W - 1, y, ref); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i / W) | 0, p = i * 4;
    d[p + 3] = 0;
    const cur = [d[p], d[p + 1], d[p + 2]];
    const nb = [];
    if (x > 0) nb.push(i - 1); if (x < W - 1) nb.push(i + 1);
    if (y > 0) nb.push(i - W); if (y < H - 1) nb.push(i + W);
    for (const j of nb) {
      if (visited[j]) continue; const q = j * 4;
      if (d[q + 3] < 128 || maxd(q, cur) <= T) { visited[j] = 1; stack.push(j); }
    }
  }
  ctx.putImageData(img, 0, 0);
}

// 测量立绘里所有颜色的最小矩形 = 角色本体
export function measureAlphaBounds(source) {
  const w = source.width, h = source.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cx = c.getContext('2d');
  cx.drawImage(source, 0, 0);
  const data = cx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ★ 新增：把 canvas 裁剪到本体边界，让纹理只包含角色（修复"人物缩成蚂蚁"的关键）
export function trimToAlpha(canvas) {
  const b = measureAlphaBounds(canvas);
  if (b.w < 4 || b.h < 4) return canvas;
  const c = document.createElement('canvas');
  c.width = b.w; c.height = b.h;
  c.getContext('2d').drawImage(canvas, -b.x, -b.y);
  return c;
}