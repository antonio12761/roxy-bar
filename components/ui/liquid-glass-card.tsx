"use client";

import { motion } from "framer-motion";
import { ReactNode, useRef, useState } from "react";

interface LiquidGlassCardProps {
  children: ReactNode;
  className?: string;
}

export function LiquidGlassCard({ children, className = "" }: LiquidGlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePosition({ x, y });
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      onMouseMove={handleMouseMove}
      className={`relative ${className}`}
      style={{
        transformStyle: "preserve-3d",
        transform: `perspective(1000px) rotateY(${(mousePosition.x - 0.5) * 5}deg) rotateX(${-(mousePosition.y - 0.5) * 5}deg)`
      }}
    >
      {/* Main glass layer */}
      <div className="relative overflow-hidden rounded-2xl">
        {/* Background with subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-white/[0.01] to-transparent" />
        
        {/* Liquid distortion effect */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, rgba(255,255,255,0.05) 0%, transparent 50%)`,
          }}
        />
        
        {/* Animated liquid blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute w-96 h-96 -top-48 -left-48"
            animate={{
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <div className="w-full h-full bg-gradient-radial from-white/[0.03] to-transparent rounded-full blur-3xl" />
          </motion.div>
          
          <motion.div
            className="absolute w-80 h-80 -bottom-40 -right-40"
            animate={{
              x: [0, -40, 0],
              y: [0, 40, 0],
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 5
            }}
          >
            <div className="w-full h-full bg-gradient-radial from-white/[0.02] to-transparent rounded-full blur-3xl" />
          </motion.div>
        </div>
        
        {/* Glass content with backdrop blur */}
        <div 
          className="relative z-10 p-8"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.1)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "1rem",
            boxShadow: `
              0 8px 32px rgba(0, 0, 0, 0.2),
              inset 0 4px 20px rgba(255, 255, 255, 0.02),
              inset 0 0 0 1px rgba(255, 255, 255, 0.05)
            `
          }}
        >
          {/* Inner highlight effect */}
          <div 
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%, transparent 100%)",
              opacity: 0.6
            }}
          />
          
          {/* Edge highlights */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" />
          
          {children}
        </div>
      </div>
      
      {/* Pseudo-element style effects */}
      <div 
        className="absolute -inset-[1px] rounded-2xl -z-10"
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          backdropFilter: "blur(10px)",
          boxShadow: `
            inset -10px -8px 0px -11px rgba(255, 255, 255, 0.08),
            inset 0px -9px 0px -8px rgba(255, 255, 255, 0.05)
          `,
          opacity: 0.6,
          filter: "blur(1px) brightness(115%)"
        }}
      />
    </motion.div>
  );
}