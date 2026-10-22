// public/icon.svg から PNG アイコンを生成する（生成物は public/ にコミット済み）。 npm run icons
import sharp from 'sharp';
const svg = new URL('../public/icon.svg', import.meta.url);
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(svg.pathname, { density: 300 }).resize(size, size).png().toFile(new URL(`../public/${name}`, import.meta.url).pathname);
  console.log('wrote', name);
}
