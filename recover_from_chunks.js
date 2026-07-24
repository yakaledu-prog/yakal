const fs = require('fs');

let fileLines = new Array(800).fill(null);

for (const f of ['chunk1.txt', 'chunk2.txt', 'chunk3.txt']) {
  if (!fs.existsSync(f)) continue;
  const contentStr = fs.readFileSync(f, 'utf8');
  
  const matches = contentStr.match(/<line_number>: <original_line>\. Please note[^\n]*\n([\s\S]+?)(?:\nThe above content|$)/g);
  if (matches) {
    for (const matchStr of matches) {
      // Find the captured group manually
      const idx = matchStr.indexOf('\n');
      if (idx === -1) continue;
      let text = matchStr.substring(idx + 1);
      if (text.endsWith('\nThe above content')) {
        text = text.substring(0, text.length - 18);
      }
      
      const rows = text.split('\n');
      for (const row of rows) {
        const colonIndex = row.indexOf(':');
        if (colonIndex !== -1) {
          const numStr = row.substring(0, colonIndex);
          const num = parseInt(numStr);
          if (numStr === num.toString()) {
            const content = row.substring(colonIndex + 2); // +2 for ": "
            if (!isNaN(num) && num >= 1 && num <= 800) {
              fileLines[num - 1] = content;
            }
          }
        }
      }
    }
  }
}

const recovered = fileLines.filter(x => x !== null);
console.log('Recovered ' + recovered.length + ' lines.');
if (recovered.length > 500) {
  fs.writeFileSync('src/pages/shared/OnboardingPage.tsx', recovered.join('\n'));
} else {
  console.log("Failed to find enough lines");
}
