// This script creates PNG placeholders for PWA
// For production, use proper logo images

const fs = require('fs');
const path = require('path');

// Create a simple base64 PNG placeholder
const createPngPlaceholder = () => {
  // 1x1 black pixel PNG
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
};

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

// Create PNG placeholders
sizes.forEach(size => {
  const pngPath = path.join(__dirname, '..', 'public', `icon-${size}.png`);
  fs.writeFileSync(pngPath, createPngPlaceholder());
  console.log(`Created placeholder: ${pngPath}`);
  
  // Remove SVG files
  const svgPath = path.join(__dirname, '..', 'public', `icon-${size}.svg`);
  if (fs.existsSync(svgPath)) {
    fs.unlinkSync(svgPath);
  }
});

// Create maskable versions
[192, 512].forEach(size => {
  const pngPath = path.join(__dirname, '..', 'public', `icon-${size}-maskable.png`);
  fs.writeFileSync(pngPath, createPngPlaceholder());
  console.log(`Created placeholder: ${pngPath}`);
  
  // Remove SVG files
  const svgPath = path.join(__dirname, '..', 'public', `icon-${size}-maskable.svg`);
  if (fs.existsSync(svgPath)) {
    fs.unlinkSync(svgPath);
  }
});

// Create apple-touch-icon
const applePath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
fs.writeFileSync(applePath, createPngPlaceholder());
console.log(`Created placeholder: ${applePath}`);

// Remove SVG file
const appleSvgPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.svg');
if (fs.existsSync(appleSvgPath)) {
  fs.unlinkSync(appleSvgPath);
}

// Create screenshot placeholders
const screenshotPath1 = path.join(__dirname, '..', 'public', 'screenshot-1.png');
const screenshotPath2 = path.join(__dirname, '..', 'public', 'screenshot-2.png');
fs.writeFileSync(screenshotPath1, createPngPlaceholder());
fs.writeFileSync(screenshotPath2, createPngPlaceholder());
console.log(`Created placeholder: ${screenshotPath1}`);
console.log(`Created placeholder: ${screenshotPath2}`);

console.log('\nPNG placeholders created successfully!');
console.log('For production, replace these with actual logo images.');