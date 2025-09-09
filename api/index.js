import express from 'express';
import serverless from 'serverless-http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import session from 'express-session';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// MongoDB connection
await mongoose.connect(process.env.MONGO_URI);

// ... keep the rest of your routes and models here ...

export default serverless(app);