import React from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
}

export function QRCode({ value, size = 200 }: QRCodeProps) {
  // Per ora usiamo un placeholder SVG
  // In produzione potresti usare una libreria QR o un servizio API
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
  
  return (
    <div className="inline-block">
      <img 
        src={qrApiUrl} 
        alt="QR Code" 
        width={size} 
        height={size}
        className="border-2 border-gray-200"
      />
    </div>
  );
}