-- GITAcademy real backend schema (SQLite)
-- Adapted from _all_migrations.php (kept as the source of truth for field names)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- student | instructor | admin
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | pending
  avatar TEXT,
  bio TEXT,
  tagline TEXT,
  location TEXT,
  website TEXT,
  twitter TEXT,
  linkedin TEXT,
  github TEXT,
  youtube TEXT,
  streak_days INTEGER DEFAULT 0,
  hours_learned REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL, -- email or IP
  attempted_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  emoji TEXT,
  color TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id INTEGER NOT NULL,
  category_id INTEGER,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  subtitle TEXT,
  description TEXT,
  emoji TEXT,
  thumbnail_bg TEXT,
  price REAL DEFAULT 0,           -- GHS cedis
  original_price REAL,            -- GHS cedis
  level TEXT DEFAULT 'All Levels',
  language TEXT DEFAULT 'English',
  duration_minutes INTEGER DEFAULT 0,
  lessons_count INTEGER DEFAULT 0,
  students_count INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published', -- draft | pending | published | archived
  has_certificate INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  what_you_learn TEXT,            -- JSON array
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'video', -- video | article | quiz
  duration_seconds INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_free INTEGER DEFAULT 0,
  is_downloadable INTEGER DEFAULT 0,
  video_path TEXT,        -- real path under api/storage/uploads, set on real upload
  video_original_name TEXT,
  video_size_bytes INTEGER,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  order_id INTEGER,
  price_paid REAL DEFAULT 0,
  progress_pct INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- active | completed | refunded
  completed_at TEXT,
  last_accessed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  is_completed INTEGER DEFAULT 0,
  completed_at TEXT,
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL,        -- JSON array of strings
  correct_answer INTEGER NOT NULL, -- index
  explanation TEXT,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  answers TEXT,          -- JSON {question_id: chosen_index}
  score INTEGER,
  total_questions INTEGER,
  passed INTEGER,
  completed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE,
  user_id INTEGER NOT NULL,
  subtotal REAL,
  discount REAL DEFAULT 0,
  total REAL,             -- GHS cedis
  currency TEXT DEFAULT 'GHS',
  payment_method TEXT DEFAULT 'momo', -- momo | card | free
  status TEXT DEFAULT 'pending', -- pending | paid | failed | refunded
  payment_reference TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  course_title TEXT,
  price REAL,            -- GHS cedis
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  title TEXT,
  comment TEXT,
  status TEXT DEFAULT 'approved', -- pending | approved | flagged | removed
  instructor_reply TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS earnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  order_item_id INTEGER,
  gross_amount REAL,   -- GHS cedis, what student paid
  platform_fee REAL,   -- GHS cedis (30%)
  net_amount REAL,     -- GHS cedis (70%)
  status TEXT DEFAULT 'available',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  topic TEXT,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lesson_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  lesson_id INTEGER,
  content TEXT NOT NULL,
  timestamp_seconds INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  lesson_id INTEGER,
  question TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qa_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qa_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (qa_id) REFERENCES qa_questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT,
  body TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
