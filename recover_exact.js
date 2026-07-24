const fs = require('fs');
const readline = require('readline');

async function run() {
  const rl = readline.createInterface({
    input: fs.createReadStream('/home/binyam/.gemini/antigravity-ide/brain/4951fb96-18a6-4aa9-8ecb-602040e09db4/.system_generated/logs/transcript_full.jsonl'),
    crlfDelay: Infinity
  });

  const fileLines = new Array(800).fill(null);
  let isTargetBlock = false;

  for await (const line of rl) {
    try {
      const json = JSON.parse(line);
      const content = json.content || '';
      
      // We are looking for the content blocks that start with "Created At" and contain OnboardingPage.tsx
      if (content.includes('File Path: `file:///home/binyam/products/yakal/src/pages/shared/OnboardingPage.tsx`') && 
          content.includes('The following code has been modified to include a line number')) {
          
        const contentLines = content.split('\n');
        let capturing = false;
        
        for (const row of contentLines) {
          if (row.startsWith('The following code has been modified')) {
            capturing = true;
            continue;
          }
          if (row === 'The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.') {
            capturing = false;
            continue;
          }
          
          if (capturing) {
            const colonIndex = row.indexOf(':');
            if (colonIndex !== -1) {
              const numStr = row.substring(0, colonIndex);
              const num = parseInt(numStr);
              if (numStr === num.toString()) {
                const text = row.substring(colonIndex + 2); // +2 for ": "
                if (!isNaN(num) && num >= 1 && num <= 800) {
                  fileLines[num - 1] = text;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignore parse errors on bad lines
    }
  }

  // Find out how many lines we successfully read from the top (contiguous)
  let maxValidLine = 0;
  for (let i = 0; i < fileLines.length; i++) {
    if (fileLines[i] !== null) {
      maxValidLine = i;
    }
  }
  
  const recovered = fileLines.slice(0, maxValidLine + 1).map(x => x !== null ? x : '');
  console.log('Recovered ' + recovered.length + ' lines.');
  
  if (recovered.length > 500) {
    fs.writeFileSync('src/pages/shared/OnboardingPage_recovered.tsx', recovered.join('\n'));
    console.log('Saved to OnboardingPage_recovered.tsx');
  } else {
    console.log("Not enough lines recovered.");
  }
}

run();
