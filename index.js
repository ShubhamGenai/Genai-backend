const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const passport = require("passport");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const jwt = require("jsonwebtoken");
const errorHandler = require("./middlewares/errorHandlers");
const MongoDB = require("./config/db");
const axios = require("axios");
const session = require("express-session");
const MongoStore = require("connect-mongo");

// Import routes
const authRoute = require("./routes/authRoute");
const contentRoute = require("./routes/contentRoute");
const adminRoute = require("./routes/adminRoute");
const employerRoute = require("./routes/employerRoute");
const studentRoute = require("./routes/studentRoute");

// Initialize environment variables
dotenv.config();

// Initialize Express app
const app = express();

// ✅ CORS Configuration
const allowedOrigins = [
  "https://genai-frontend-xi.vercel.app/",
  "https://www.genailearning.in", // production frontend
  "http://localhost:5173",        // local dev
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
};

// Apply CORS first
app.use(cors(corsOptions));

// ✅ Apply security, compression, and logging middleware
app.use(helmet());
app.use(compression());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ✅ Connect to MongoDB
MongoDB();

// ✅ Setup session store using MongoDB
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
      ttl: 14 * 24 * 60 * 60, // 14 days
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production", // only true over HTTPS
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// ✅ Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// ✅ Static file hosting
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Test route
app.get("/", (req, res) => {
  res.json("Hello from the API!");
});

// ✅ API routes
app.use("/api/auth", authRoute);
app.use("/api/content", contentRoute);
app.use("/api/admin", adminRoute);
app.use("/api/employer", employerRoute);
app.use("/api/student", studentRoute);

// ✅ Global error handler
app.use(errorHandler);

// ✅ Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
