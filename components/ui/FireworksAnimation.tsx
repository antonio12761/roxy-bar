"use client";

import { useEffect, useRef } from 'react';

interface FireworksAnimationProps {
  onComplete?: () => void;
  duration?: number;
}

export function FireworksAnimation({ onComplete, duration = 1500 }: FireworksAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number | null>(null);
  const particlesRef = useRef<any[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
      w: number;
      h: number;
      gravity = 0.05;

      constructor(x: number, y: number, color: string) {
        this.w = this.h = Math.random() * 4 + 1;
        this.x = x - this.w / 2;
        this.y = y - this.h / 2;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.alpha = Math.random() * 0.5 + 0.5;
        this.color = color;
      }

      move(): boolean {
        this.x += this.vx;
        this.vy += this.gravity;
        this.y += this.vy;
        this.alpha -= 0.01;
        
        if (this.x <= -this.w || this.x >= canvas!.width ||
            this.y >= canvas!.height ||
            this.alpha <= 0) {
          return false;
        }
        return true;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.beginPath();
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
        ctx.arc(0, 0, this.w, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.alpha;
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    const createFirework = () => {
      const xPoint = Math.random() * (canvas.width - 200) + 100;
      const yPoint = Math.random() * (canvas.height - 200) + 100;
      const nFire = Math.random() * 50 + 100;
      const c = `rgb(${~~(Math.random() * 200 + 55)},${~~(Math.random() * 200 + 55)},${~~(Math.random() * 200 + 55)})`;
      
      for (let i = 0; i < nFire; i++) {
        const particle = new Particle(xPoint, yPoint, c);
        particlesRef.current.push(particle);
      }
    };

    const probability = 0.04;

    const update = () => {
      if (particlesRef.current.length < 500 && Math.random() < probability) {
        createFirework();
      }
      const alive: any[] = [];
      for (let i = 0; i < particlesRef.current.length; i++) {
        if (particlesRef.current[i].move()) {
          alive.push(particlesRef.current[i]);
        }
      }
      particlesRef.current = alive;
    };

    const paint = () => {
      // Clear canvas with transparency instead of black
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particlesRef.current.length; i++) {
        particlesRef.current[i].draw(ctx);
      }
    };

    const animate = () => {
      update();
      paint();
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Auto-complete after duration
    const timeout = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, duration);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      clearTimeout(timeout);
      particlesRef.current = [];
    };
  }, [duration, onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      />
    </div>
  );
}