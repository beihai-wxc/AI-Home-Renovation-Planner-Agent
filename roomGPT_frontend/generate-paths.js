const opentype = require('opentype.js');
const https = require('https');
const fs = require('fs');

const FONT_URL = 'https://fonts.gstatic.com/s/cormorantgaramond/v15/co3YmX5slCNuHLi8bLeY9MK7whWMhyjYrEtFmT2O1o.ttf';
const TEXT = "Lumière";
const FONT_SIZE = 120;

// 下载字体
https.get(FONT_URL, (response) => {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => {
    const buffer = Buffer.concat(chunks);
    try {
      const font = opentype.parse(buffer);

      const paths = [];
      let xOffset = 0;
      const scale = FONT_SIZE / font.unitsPerEm;

      // 计算总宽度用于居中
      let totalWidth = 0;
      for (let char of TEXT) {
        const glyph = font.charToGlyph(char);
        totalWidth += (glyph.advanceWidth || 0) * scale;
      }
      xOffset = (600 - totalWidth) / 2; // viewBox width 600

      // 生成每个字符的路径
      for (let char of TEXT) {
        const glyph = font.charToGlyph(char);
        const path = glyph.getPath(xOffset, FONT_SIZE * 0.3, FONT_SIZE);
        const d = path.toPathData(0);

        // 计算路径长度
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', d);
        const length = pathEl.getTotalLength();

        paths.push({
          char,
          d,
          length: Math.round(length)
        });

        xOffset += (glyph.advanceWidth || 0) * scale;
      }

      console.log('Generated paths:');
      console.log(JSON.stringify(paths, null, 2));

      // 同时生成可直接复制到React的常量代码
      console.log('\n// Copy this to your component:');
      console.log('const LETTER_PATHS = {');
      paths.forEach((p, i) => {
        console.log(`  ${i}: "${p.d.replace(/"/g, '\\"')}"`);
      });
      console.log('};');

      console.log('\nconst PATH_LENGTHS = {');
      paths.forEach((p, i) => {
        console.log(`  ${i}: ${p.length}`);
      });
      console.log('};');

    } catch (err) {
      console.error('Error parsing font:', err);
    }
  });
}).on('error', (err) => {
  console.error('Download error:', err);
});
