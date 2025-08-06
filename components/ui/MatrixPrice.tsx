'use client';

import React, { useState, useEffect } from 'react';

interface MatrixPriceProps {
  price: number;
  className?: string;
}

export function MatrixPrice({ price, className = '' }: MatrixPriceProps) {
  const [displayText, setDisplayText] = useState(`€${price.toFixed(2)}`);
  const [isGlitching, setIsGlitching] = useState(false);
  
  const matrixChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+-=[]{}|;:,.<>?€₹¥£¢§¶†‡';
  const originalText = `€${price.toFixed(2)}`;
  
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setIsGlitching(true);
      
      // Create glitch effect
      let glitchDuration = 0;
      const glitchTimer = setInterval(() => {
        if (glitchDuration < 500) {
          // Generate random glitched text
          let newText = '';
          for (let i = 0; i < originalText.length; i++) {
            if (originalText[i] === '€' || originalText[i] === '.' || Math.random() > 0.5) {
              newText += originalText[i];
            } else {
              newText += matrixChars[Math.floor(Math.random() * matrixChars.length)];
            }
          }
          setDisplayText(newText);
          glitchDuration += 50;
        } else {
          // Reset to original
          setDisplayText(originalText);
          setIsGlitching(false);
          clearInterval(glitchTimer);
        }
      }, 50);
      
    }, 3000); // Glitch every 3 seconds
    
    return () => clearInterval(glitchInterval);
  }, [price]);
  
  return (
    <span 
      className={`matrix-text ${className}`}
      data-text={displayText}
      style={{
        display: 'inline-block',
        position: 'relative',
      }}
    >
      {displayText}
    </span>
  );
}