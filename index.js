// Suppress optional dependency warnings (@napi-rs/canvas from jsdom)
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, ...args) {
  if (typeof warning === 'string' && warning.includes('@napi-rs/canvas')) {
    return;
  }
  return originalEmitWarning.call(process, warning, ...args);
};

const originalWarn = console.warn;
console.warn = function(...args) {
  const message = args.join(' ');
  if (message.includes('@napi-rs/canvas') || 
      message.includes('Cannot load "@napi-rs/canvas"') ||
      message.includes('Cannot find module \'@napi-rs/canvas\'')) {
    return;
  }
  return originalWarn.apply(console, args);
};

// Core dependencies
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");

// Local modules
const errorHandler = require("./middlewares/errorHandlers");
const MongoDB = require("./config/db");
const authRoute = require("./routes/authRoute");
const contentRoute = require("./routes/contentRoute");
const adminRoute = require("./routes/adminRoute");
const employerRoute = require("./routes/employerRoute");
const studentRoute = require("./routes/studentRoute");

// Initialize environment variables
dotenv.config();

// Initialize Express app
const app = express();

// CORS Configuration
const allowedOrigins = [
  "https://genai-frontend-xi.vercel.app",
  "https://www.genailearning.in",
  "http://localhost:5173",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Database connection
MongoDB();

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60,
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.get("/", (req, res) => {
  res.json("Hello from the API!");
});

app.use("/api/auth", authRoute);
app.use("/api/content", contentRoute);
app.use("/api/admin", adminRoute);
app.use("/api/employer", employerRoute);
app.use("/api/student", studentRoute);

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
