import { useEffect, useRef } from 'react';

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const particles: Particle[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      hue: number;
      opacity: number;
      growing: boolean;
      canvas: HTMLCanvasElement;

      constructor(canvasEl: HTMLCanvasElement) {
        this.canvas = canvasEl;
        this.x = Math.random() * canvasEl.width;
        this.y = Math.random() * canvasEl.height;
        this.size = Math.random() * 150 + 50;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.hue = Math.random() * 30 + 260; // Purple range 260-290
        this.opacity = Math.random() * 0.15 + 0.05;
        this.growing = Math.random() > 0.5;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Wrap around screen
        if (this.x < -this.size) this.x = this.canvas.width + this.size;
        if (this.x > this.canvas.width + this.size) this.x = -this.size;
        if (this.y < -this.size) this.y = this.canvas.height + this.size;
        if (this.y > this.canvas.height + this.size) this.y = -this.size;

        // Pulsing effect
        if (this.growing) {
          this.size += 0.1;
          if (this.size > 200) this.growing = false;
        } else {
          this.size -= 0.1;
          if (this.size < 50) this.growing = true;
        }
      }

      draw() {
        if (!ctx) return;
        
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        gradient.addColorStop(0, `hsla(${this.hue}, 80%, 65%, ${this.opacity})`);
        gradient.addColorStop(0.5, `hsla(${this.hue}, 70%, 55%, ${this.opacity * 0.5})`);
        gradient.addColorStop(1, `hsla(${this.hue}, 60%, 45%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Create particles
    for (let i = 0; i < 8; i++) {
      particles.push(new Particle(canvas));
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      animationId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
