// config/db.js
require('dotenv').config();

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Check if MONGO_URI exists
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not defined in environment variables");
      console.error("📁 Please check if .env file exists in the root directory");
      console.error("📁 Current directory:", process.cwd());
      process.exit(1);
    }

    console.log("🔄 Connecting to MongoDB...");
    console.log("📊 Database:", process.env.MONGO_URI.split('/').pop().split('?')[0] || 'default');

    // Connection options for MongoDB
    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4
      // SSL/TLS options
      tls: true,
      tlsAllowInvalidCertificates: true, // For development only
      tlsAllowInvalidHostnames: true, // For development only
    };

    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    
    console.log(`✅ MongoDB Connected Successfully`);
    console.log(`📊 Database: ${conn.connection.db.databaseName}`);
    console.log(`🔗 Host: ${conn.connection.host}`);
    console.log(`🔌 Port: ${conn.connection.port}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error after connection:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;

  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    console.error("\n💡 Troubleshooting Tips:");
    console.error("   1. Check your MONGO_URI in .env file is correct");
    console.error("   2. Verify your IP is whitelisted in MongoDB Atlas");
    console.error("   3. Check your username and password are correct");
    console.error("   4. Make sure the database user has proper permissions");
    console.error("   5. Check if you're connected to the internet");
    console.error("   6. If using VPN, try disconnecting it");
    console.error("\n📝 Your MONGO_URI should look like:");
    console.error("   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority");
    
    // Exit with failure
    process.exit(1);
  }
};

module.exports = connectDB;