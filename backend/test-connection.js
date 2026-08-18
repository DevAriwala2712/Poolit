// test-connection.js
require('dotenv').config();

const mongoose = require('mongoose');

console.log('🔍 Testing MongoDB connection...');
console.log('📊 Database:', process.env.MONGO_URI ? process.env.MONGO_URI.split('/').pop().split('?')[0] : 'Not found');
console.log('🔄 Connecting...');

// Check if MONGO_URI exists
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env file');
  process.exit(1);
}

const options = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  family: 4,
  tls: true,
  tlsAllowInvalidCertificates: true,
  tlsAllowInvalidHostnames: true,
};

mongoose.connect(process.env.MONGO_URI, options)
.then(() => {
  console.log('✅ Connected successfully! 🎉');
  console.log('📊 Database:', mongoose.connection.db.databaseName);
  console.log('🔗 Host:', mongoose.connection.host);
  console.log('🔌 Port:', mongoose.connection.port);
  
  // List collections
  return mongoose.connection.db.listCollections().toArray();
})
.then(collections => {
  console.log('📚 Collections:', collections.map(c => c.name).join(', ') || 'No collections yet');
  console.log('\n✅ Connection test passed! You can now run: npm run dev');
  mongoose.connection.close();
  process.exit(0);
})
.catch(err => {
  console.error('❌ Connection failed:', err.message);
  console.error('\n💡 Make sure:');
  console.error('   1. Your IP is whitelisted in MongoDB Atlas');
  console.error('   2. Your username and password are correct');
  console.error('   3. You have internet connection');
  console.error('   4. Try running: npm run dev');
  process.exit(1);
});