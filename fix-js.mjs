// Fix all JS files script
import fs from 'fs';
import path from 'path';

const fixJSFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove console.error statements
  content = content.replace(/console\.error\([^)]*\);?\s*\n?/g, '');
  
  // Fix if statements without braces
  content = content.replace(/if\s*\([^)]*\)\s*return[^;]*;/g, (match) => {
    const condition = match.match(/if\s*\(([^)]*)\)/)[1];
    const returnPart = match.match(/return[^;]*;/)[0];
    return `if (${condition}) {\n      ${returnPart}\n    }`;
  });
  
  // Fix unused parameters
  content = content.replace(/static async searchItems\(searchTerm, filters = \[\], pageSize = 12\)/, 
    'static async searchItems(searchTerm, filters = [])');
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
};

// Files to fix
const files = [
  'e:\\ReWearX\\js\\utils\\firestore-ops.js',
  'e:\\ReWearX\\js\\utils\\validators.js'
];

files.forEach(fixJSFile);
