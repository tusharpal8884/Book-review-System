import express from 'express';
import session from 'express-session';
import mongoose from 'mongoose';
import morgan from 'morgan';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || 'dev', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, 'public')));


await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bookblog');

const UserSchema = new mongoose.Schema({ email: String, passwordHash: String, isAdmin: Boolean });
const PostSchema = new mongoose.Schema({ title: String, author: String, body: String, createdAt: { type: Date, default: Date.now } });
const ReviewSchema = new mongoose.Schema({ postId: mongoose.Schema.Types.ObjectId, name: String, rating: Number, text: String, status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' }, createdAt: { type: Date, default: Date.now } });

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);
const Review = mongoose.model('Review', ReviewSchema);

// Seed admin
(async () => {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const pass = process.env.ADMIN_PASSWORD || 'admin123';
  const exists = await User.findOne({ email, isAdmin: true });
  if (!exists) {
    const passwordHash = await bcrypt.hash(pass, 10);
    await User.create({ email, passwordHash, isAdmin: true });
    console.log('Created admin', email, '/', pass);
  }
})();

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.redirect('/admin/login');
  next();
}

// Public pages
app.get('/', async (req, res) => {
  const posts = await Post.find({}).sort({ createdAt: -1 }).limit(20);
  res.render('index', { posts });
});

app.get('/post/:id', async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).send('Not found');
  const reviews = await Review.find({ postId: post._id, status: 'approved' }).sort({ createdAt: -1 });
  res.render('post', { post, reviews, info: null });
});

app.post('/post/:id/review', async (req, res) => {
  const { name, rating, text } = req.body;
  await Review.create({ postId: req.params.id, name, rating: Math.max(1, Math.min(5, parseInt(rating||5))), text });
  const post = await Post.findById(req.params.id);
  const reviews = await Review.find({ postId: post._id, status: 'approved' }).sort({ createdAt: -1 });
  res.render('post', { post, reviews, info: 'Review submitted! Pending approval.' });
});

// Admin
app.get('/admin/login', (req, res) => res.render('login', { error: null }));
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, isAdmin: true });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.render('login', { error: 'Invalid credentials' });
  }
  req.session.userId = user._id.toString();
  res.redirect('/admin');
});

app.get('/admin', requireAdmin, async (req, res) => {
  const posts = await Post.find({}).sort({ createdAt: -1 });
  const pending = await Review.find({ status: 'pending' }).sort({ createdAt: -1 });
  res.render('admin', { posts, pending });
});

app.post('/admin/post', requireAdmin, async (req, res) => {
  const { title, author, body } = req.body;
  await Post.create({ title, author, body });
  res.redirect('/admin');
});

app.post('/admin/review/:id/:action', requireAdmin, async (req, res) => {
  const act = req.params.action;
  const status = act === 'approve' ? 'approved' : 'rejected';
  await Review.updateOne({ _id: req.params.id }, { $set: { status } });
  res.redirect('/admin');
});

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => console.log('Blog running at http://localhost:' + PORT));
