'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ThankYouHeartProps {
  onComplete?: () => void;
  duration?: number;
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

export function ThankYouHeart({ onComplete, duration = 3000 }: ThankYouHeartProps) {
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    console.log('[ThankYouHeart] Component mounted with duration:', duration);
    console.log('[ThankYouHeart] Creating heart animation in prepara page');
    
    // Genera cuoricini casuali
    const colors = ['#FF1493', '#FF69B4', '#FFB6C1', '#FF6B9D', '#FF4757', '#FD79A8', '#FF1744', '#E91E63'];
    const newHearts: FloatingHeart[] = [];
    
    for (let i = 0; i < 30; i++) {
      newHearts.push({
        id: i,
        x: Math.random() * 100,
        y: 100 + Math.random() * 20,
        size: 30 + Math.random() * 50,
        delay: Math.random() * 2000,
        duration: 3000 + Math.random() * 2000,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    
    setHearts(newHearts);
    
    const timer = setTimeout(() => {
      console.log('[ThankYouHeart] Animation complete, calling onComplete');
      onComplete?.();
    }, duration);
    
    return () => {
      console.log('[ThankYouHeart] Component unmounting');
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
              filter: `drop-shadow(0 0 10px ${heart.color})`
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
      
      {/* Background semi-trasparente */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(2px)'
        }}
      />
      
      {/* Testo "Grazie!" al centro */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="text-7xl font-bold text-white px-8 py-4 rounded-2xl"
          style={{
            backgroundColor: 'rgba(255, 20, 147, 0.2)',
            textShadow: '0 0 40px rgba(255, 20, 147, 1), 0 0 80px rgba(255, 20, 147, 0.8), 0 0 120px rgba(255, 20, 147, 0.6)',
            animation: `scaleIn 1000ms ease-out`,
            border: '2px solid rgba(255, 20, 147, 0.5)'
          }}
        >
          GRAZIE! 💖
        </div>
      </div>
    </div>
  );
  
  return createPortal(content, document.body);
}