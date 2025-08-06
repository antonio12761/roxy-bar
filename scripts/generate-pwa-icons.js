const fs = require('fs');
const path = require('path');

// Simple SVG icon template
const createSvgIcon = (size) => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#000000"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="#ffffff"/>
  <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="${size/4}" font-weight="bold" fill="#000000">S</text>
</svg>`;
};

// Sizes needed for PWA
const iconSizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

// Generate icons
iconSizes.forEach(size => {
  const svg = createSvgIcon(size);
  const filename = path.join(__dirname, '..', 'public', `icon-${size}.png`);
  
  // For now, we'll create SVG files that can be converted to PNG
  const svgFilename = path.join(__dirname, '..', 'public', `icon-${size}.svg`);
  fs.writeFileSync(svgFilename, svg);
  console.log(`Created ${svgFilename}`);
});

// Create maskable versions for 192 and 512
[192, 512].forEach(size => {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#000000"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size/2.5}" fill="#ffffff"/>
  <text x="${size/2}" y="${size/2}" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="${size/4}" font-weight="bold" fill="#000000">S</text>
</svg>`;
  
  const svgFilename = path.join(__dirname, '..', 'public', `icon-${size}-maskable.svg`);
  fs.writeFileSync(svgFilename, svg);
  console.log(`Created ${svgFilename}`);
});

// Create apple-touch-icon
const appleSvg = createSvgIcon(180);
const appleFilename = path.join(__dirname, '..', 'public', 'apple-touch-icon.svg');
fs.writeFileSync(appleFilename, appleSvg);
console.log(`Created ${appleFilename}`);

console.log('\nNote: These are SVG placeholders. For production, convert them to PNG using a tool like:');
console.log('- ImageMagick: convert icon-192.svg icon-192.png');
console.log('- Online converter: https://cloudconvert.com/svg-to-png');
console.log('- Or use a proper icon generator with your actual logo');