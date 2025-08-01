"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
}

interface ParticleEffectProps {
  trigger: boolean;
  x: number;
  y: number;
  particleCount?: number;
  duration?: number;
  colors?: string[];
}

export function ParticleEffect({ 
  trigger, 
  x, 
  y, 
  particleCount = 12,
  duration = 1000,
  colors
}: ParticleEffectProps) {
  const { currentTheme, themeMode } = useTheme();
  const themeColors = currentTheme.colors[themeMode as keyof typeof currentTheme.colors];
  const [particles, setParticles] = useState<Particle[]>([]);
  
  useEffect(() => {
    // Define colors inside effect to avoid dependency issues
    const particleColors = colors || [
      themeColors.text.accent,
      themeColors.button.primary,
      themeColors.button.success,
      '#FFD700', // Gold
      '#FF69B4', // Pink
      '#00CED1'  // Turquoise
    ];
    
    // Create particles when component mounts
    const newParticles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const velocity = 0.5 + Math.random() * 1.5; // Much slower velocity
      newParticles.push({
        id: Date.now() + i,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 1, // Slight upward bias
        size: 6 + Math.random() * 6, // Larger particles
        opacity: 1,
        color: particleColors[Math.floor(Math.random() * particleColors.length)]
      });
    }
    setParticles(newParticles);

    // Animate particles
    let animationFrameId: number;
    let isCancelled = false;
    const startTime = Date.now();
    
    const animate = () => {
      if (isCancelled) return;
      
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      setParticles(prev => {
        // Avoid updating if component is unmounted
        if (isCancelled) return prev;
        
        return prev.map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vy: particle.vy + 0.05, // Even slower gravity
          opacity: 1 - progress,
          size: particle.size * (1 - progress * 0.5)
        }));
      });

      if (progress < 1 && !isCancelled) {
        animationFrameId = requestAnimationFrame(animate);
      } else if (!isCancelled) {
        setParticles([]);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    
    // Cleanup
    return () => {
      isCancelled = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []); // Empty deps - only run on mount since we use key-based re-rendering

  if (particles.length === 0) return null;

  return (
    <div 
      className="fixed pointer-events-none" 
      style={{ 
        left: x + 'px', 
        top: y + 'px',
        zIndex: 9999 
      }}
    >
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            transform: `translate(${particle.x}px, ${particle.y}px)`,
            width: particle.size + 'px',
            height: particle.size + 'px',
            backgroundColor: particle.color,
            opacity: particle.opacity,
            boxShadow: `0 0 ${particle.size}px ${particle.color}`,
            transition: 'none'
          }}
        />
      ))}
    </div>
  );
}