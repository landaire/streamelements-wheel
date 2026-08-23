interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

export interface Confetti {
  fire(): void;
}

const COUNT = 35; // burst size, matches the original's feel
const GRAVITY = 0.15;
const DRAG = 0.98;
const LIFE_FRAMES = 90;

export function createConfetti(
  canvas: HTMLCanvasElement,
  colors: [string, string, string],
  _now: () => number,
  raf: (cb: () => void) => void,
): Confetti {
  const ctx = canvas.getContext("2d");
  let particles: Particle[] = [];
  let running = false;

  const step = (): void => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.vx *= DRAG;
      p.vy = p.vy * DRAG + GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 6, 6);
    }
    if (particles.length > 0) raf(step);
    else running = false;
  };

  return {
    fire: () => {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      for (let i = 0; i < COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 4;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          color: colors[i % 3]!,
          life: LIFE_FRAMES,
        });
      }
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!running) {
        running = true;
        raf(step);
      }
    },
  };
}
