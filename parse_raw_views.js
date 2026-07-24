const fs = require('fs');
const content = fs.readFileSync('raw_views.txt', 'utf8');

const lines = content.split('\n');
const fileLines = new Array(800).fill(null);

for (const line of lines) {
  const colonIndex = line.indexOf(': ');
  if (colonIndex !== -1) {
    const numStr = line.substring(0, colonIndex);
    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num.toString() === numStr && num >= 1 && num <= 800) {
      fileLines[num - 1] = line.substring(colonIndex + 2);
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
