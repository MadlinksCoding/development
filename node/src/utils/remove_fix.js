const fs=require('fs');
let text=fs.readFileSync('Logger.js','utf8');
text=text.replace(/\s*\(fix #[^)]+\)/g,'');
fs.writeFileSync('Logger.js',text);
