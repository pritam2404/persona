/**
 * Lightweight zero-dependency canvas confetti burst
 */
export function fireConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#eab308'];
  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    vRot: number;
    alpha: number;
  }> = [];

  const count = 70;
  for (let i = 0; i < count; i++) {
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 120,
      y: height * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 12 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
      alpha: 1,
    });
  }

  let animationId: number;
  const startTime = Date.now();
  const validCtx = ctx;

  function animate() {
    const elapsed = Date.now() - startTime;
    if (elapsed > 2000) {
      cancelAnimationFrame(animationId);
      canvas.remove();
      return;
    }

    validCtx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.98;
      p.rotation += p.vRot;
      p.alpha = Math.max(0, 1 - elapsed / 1900);

      validCtx.save();
      validCtx.globalAlpha = p.alpha;
      validCtx.translate(p.x, p.y);
      validCtx.rotate((p.rotation * Math.PI) / 180);
      validCtx.fillStyle = p.color;
      validCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      validCtx.restore();
    });

    animationId = requestAnimationFrame(animate);
  }

  animationId = requestAnimationFrame(animate);
}
