"use client";

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        @keyframes morph {
          0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
        }
        
        .blob {
          position: absolute;
          filter: blur(80px);
          mix-blend-mode: screen;
          animation: float 20s infinite ease-in-out;
        }
        
        .blob-1 {
          background: linear-gradient(45deg, #000000 0%, #1a1a1a 100%);
          width: 800px;
          height: 800px;
          left: -300px;
          top: -300px;
          animation-delay: 0s;
          animation: float 25s infinite ease-in-out, morph 15s infinite ease-in-out;
          opacity: 0.8;
        }
        
        .blob-2 {
          background: linear-gradient(135deg, #0f0f0f 0%, #2a2a2a 100%);
          width: 700px;
          height: 700px;
          right: -250px;
          top: 100px;
          animation-delay: 5s;
          animation: float 30s infinite ease-in-out, morph 20s infinite ease-in-out;
          opacity: 0.6;
        }
        
        .blob-3 {
          background: linear-gradient(225deg, #050505 0%, #1f1f1f 100%);
          width: 600px;
          height: 600px;
          left: 40%;
          bottom: -200px;
          animation-delay: 10s;
          animation: float 35s infinite ease-in-out, morph 25s infinite ease-in-out;
          opacity: 0.7;
        }
        
        .blob-4 {
          background: linear-gradient(315deg, #0a0a0a 0%, #252525 100%);
          width: 500px;
          height: 500px;
          left: 20%;
          top: 30%;
          animation-delay: 15s;
          animation: float 40s infinite ease-in-out, morph 30s infinite ease-in-out;
          opacity: 0.5;
        }
      `}</style>
      
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>
      <div className="blob blob-4"></div>
      
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/50"></div>
    </div>
  );
}