// debug-env.js
const fs = require('fs');
const path = require('path');

console.log('🔍 Debugging .env file...');
console.log('📁 Current directory:', process.cwd());

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
console.log('📄 .env file path:', envPath);
console.log('📄 .env file exists?', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  // Read the file content
  const content = fs.readFileSync(envPath, 'utf8');
  console.log('\n📄 Raw .env file content:');
  console.log('---START---');
  console.log(content);
  console.log('---END---');
  
  // Show each line with character codes
  console.log('\n🔍 Character analysis:');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.trim() && !line.startsWith('#')) {
      console.log(`Line ${index + 1}: "${line}"`);
      console.log(`  Length: ${line.length}`);
      console.log(`  Characters:`, Array.from(line).map(c => `${c}(${c.charCodeAt(0)})`).join(' '));
    }
  });
}

// Try loading with dotenv
console.log('\n🔄 Loading with dotenv...');
require('dotenv').config();

console.log('\n📊 Environment variables loaded:');
console.log('MONGO_URI:', process.env.MONGO_URI || '❌ NOT FOUND');
console.log('PORT:', process.env.PORT || '❌ NOT FOUND');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ FOUND' : '❌ NOT FOUND');
console.log('NODE_ENV:', process.env.NODE_ENV || '❌ NOT FOUND');

// List all loaded env vars
console.log('\n📋 All environment variables starting with:');
Object.keys(process.env)
  .filter(key => key.match(/MONGO|PORT|JWT|NODE/))
  .forEach(key => {
    console.log(`  ${key}: ${process.env[key]}`);
  });