const fs = require('fs');
const transcriptPath = '/home/binyam/.gemini/antigravity-ide/brain/4951fb96-18a6-4aa9-8ecb-602040e09db4/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);

let fileLines = new Array(800).fill(null);
let found = 0;

for (const line of lines) {
  try {
    const json = JSON.parse(line);
    // Try to get content from tool_calls or response
    let contentStr = "";
    
    // Check in content
    if (json.content && typeof json.content === 'string') {
        contentStr = json.content;
    }
    
    if (contentStr.includes('Showing lines 1 to 250') || 
        contentStr.includes('Showing lines 250 to 500') ||
        contentStr.includes('Showing lines 500 to 750')) {
      
      const match = contentStr.match(/<line_number>: <original_line>\. Please note.*\n([\s\S]+?)(?:\nThe above content|$)/);
      if (match) {
        const text = match[1];
        const rows = text.split('\n');
        for (const row of rows) {
          const colonIndex = row.indexOf(':');
          if (colonIndex !== -1) {
            const num = parseInt(row.substring(0, colonIndex));
            const content = row.substring(colonIndex + 2); // +2 for ": "
            if (!isNaN(num) && num >= 1 && num <= 800) {
              fileLines[num - 1] = content;
              found++;
            }
          }
        }
      }
    }
  } catch(e) {}
}

const recovered = fileLines.filter(x => x !== null);
console.log('Recovered ' + recovered.length + ' lines.');
if (recovered.length > 500) {
  fs.writeFileSync('src/pages/shared/OnboardingPage.tsx', recovered.join('\n'));
} else {
  console.log("Failed to find enough lines");
}
