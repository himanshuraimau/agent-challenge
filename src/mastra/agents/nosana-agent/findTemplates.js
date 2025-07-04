// Simple script to help locate the templates.json file
const fs = require('fs');
const path = require('path');

// Attempt to find templates.json in various locations
const possiblePaths = [
  path.join(__dirname, 'templates.json'),
  path.join(process.cwd(), 'src/mastra/agents/nosana-agent/templates.json'),
  path.join(process.cwd(), 'agents/nosana-agent/templates.json'),
  path.join(process.cwd(), 'templates.json'),
  '/home/himanshu/agent-challenge/src/mastra/agents/nosana-agent/templates.json'
];

console.log('Current directory:', __dirname);
console.log('Working directory:', process.cwd());

let found = false;

for (const p of possiblePaths) {
  try {
    if (fs.existsSync(p)) {
      console.log(`✅ Found templates at: ${p}`);
      const stats = fs.statSync(p);
      console.log(`   File size: ${stats.size} bytes`);
      console.log(`   Modified: ${stats.mtime}`);
      found = true;
      
      // Try to read and parse it
      try {
        const content = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(content);
        console.log(`   Valid JSON: ${typeof parsed === 'object'}`);
        console.log(`   Categories: ${parsed.categories ? parsed.categories.length : 'none'}`);
        console.log(`   Templates: ${parsed.templates ? Object.keys(parsed.templates).length : 'none'}`);
      } catch (parseErr) {
        console.log(`   ❌ Error parsing JSON: ${parseErr.message}`);
      }
    } else {
      console.log(`❌ Not found: ${p}`);
    }
  } catch (err) {
    console.log(`❌ Error checking ${p}: ${err.message}`);
  }
}

if (!found) {
  console.log('❌ Could not find templates.json in any expected location');
}
