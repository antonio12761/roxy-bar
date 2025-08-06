'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface HeartsAnimationProps {
  onComplete?: () => void;
  duration?: number;
  showText?: boolean;
}

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

export function HeartsAnimation({ onComplete, duration = 3000, showText = true }: HeartsAnimationProps) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    
    // Genera cuoricini casuali
    const colors = ['#FF1493', '#FF69B4', '#FFB6C1', '#FF6B9D', '#FF4757', '#FD79A8', '#FF1744', '#E91E63'];
    const newHearts: FloatingHeart[] = [];
    
    // Più cuoricini per l'effetto accompagnamento
    for (let i = 0; i < 40; i++) {
      newHearts.push({
        id: i,
        x: Math.random() * 100,
        y: 100 + Math.random() * 20,
        size: 15 + Math.random() * 35,
        delay: Math.random() * 2500,
        duration: 2500 + Math.random() * 2000,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    
    setHearts(newHearts);
    
    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);
    
    return () => {
      setMounted(false);
      clearTimeout(timer);
    };
  }, [duration, onComplete]);
  
  if (!mounted) return null;
  
  const content = (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{
        zIndex: 999999,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      {/* Tanti cuoricini che volano */}
      {hearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute"
          style={{
            left: `${heart.x}%`,
            bottom: `-${heart.size}px`,
            animation: `floatUp ${heart.duration}ms ease-out forwards`,
            animationDelay: `${heart.delay}ms`
          }}
        >
          <svg
            width={heart.size}
            height={heart.size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              filter: `drop-shadow(0 0 8px ${heart.color})`,
              opacity: 0.9
            }}
          >
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              fill={heart.color}
              stroke={heart.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ))}
      
      {/* Testo semplice "Grazie!" */}
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="text-5xl font-medium text-white"
            style={{
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              animation: `simpleFadeInOut 2000ms ease-out`
            }}
          >
            Grazie!
          </div>
        </div>
      )}
    </div>
  );
  
  return createPortal(content, document.body);
}