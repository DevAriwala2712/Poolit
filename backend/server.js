// server.js — local dev entry point. On Vercel, api/index.js serves `app`
// directly as a serverless function instead of calling listen().
require("dotenv").config();

console.log("🚀 Starting Poolit Backend...");
console.log("📁 NODE_ENV:", process.env.NODE_ENV || "development");
console.log("🔍 SUPABASE_URL:", process.env.SUPABASE_URL ? "✅ Configured" : "❌ Missing");
console.log("🔌 PORT:", process.env.PORT || 5057);
console.log("---");

const app = require("./app");

const PORT = process.env.PORT || 5057;

app.listen(PORT, () => {
  console.log(`✅ Poolit backend running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/`);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});
