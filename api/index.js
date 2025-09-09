import express from "express";
import serverless from "serverless-http";
import session from "express-session";
import mongoose from "mongoose";
import morgan from "morgan";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(express.static(path.join(__dirname, "../public")));

// --- MongoDB connection (lazy connect for serverless) ---
let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log("✅ MongoDB connected");
  }
}

// Schemas
const UserSchema = new mongoose.Schema({
  email: String,
  passwordHash: String,
  isAdmin: Boolean,
});
const PostSchema = new mongoose.Schema({
  title: String,
  author: String,
  body: String,
  createdAt: { type: Date, default: Date.now },
});
const ReviewSchema = new mongoose.Schema({
  postId: mongoose.Schema.Types.ObjectId,
  name: String,
  rating: Number,
  text: String,
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);
const Review = mongoose.models.Review || mongoose.model("Review", ReviewSchema);

// Seed admin (run only when DB connected)
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const pass = process.env.ADMIN_PASSWORD || "admin123";
  const exists = await User.findOne({ email, isAdmin: true });
  if (!exists) {
    const passwordHash = await bcrypt.hash(pass, 10);
    await User.create({ email, passwordHash, isAdmin: true });
    console.log("👤 Created admin", email, "/", pass);
  }
}

// Middleware to ensure DB before each request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    await seedAdmin();
    next();
  } catch (err) {
    console.error("DB Connection error:", err);
    res.status(500).send("Database connection failed");
  }
});

// Routes (same as before)
// ...

// Export as serverless function
export default serverless(app);
