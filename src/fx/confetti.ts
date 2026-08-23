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
const GRAVITY = 0.15; // downward acceleration per frame
const DRAG = 0.98; // velocity decay per frame, slows particle motion
const LIFE_FRAMES = 90; // particle lifespan before fading out
const PARTICLE_PX = 6; // size of each confetti square in pixels
const SPEED_MIN = 4; // minimum initial speed
const SPEED_SPAN = 4; // random speed range added to minimum
const LAUNCH_BIAS = 4; // initial upward velocity to launch particles

export function createConfetti(
  canvas: HTMLCanvasElement,
  colors: [string, string, string],
  _now: () => number, // reserved; particle life is frame-count based, not wall-clock time
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
      ctx.fillRect(p.x, p.y, PARTICLE_PX, PARTICLE_PX);
    }
    if (particles.length > 0) raf(step);
    else running = false;
  };

  return {
    fire: () => {
      if (!ctx) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      for (let i = 0; i < COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = SPEED_MIN + Math.random() * SPEED_SPAN;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - LAUNCH_BIAS,
          color: colors[i % 3]!,
          life: LIFE_FRAMES,
        });
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!running) {
        running = true;
        raf(step);
      }
    },
  };
}
