const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const redis = require("redis");
const path = require('path');
const jwt = require("jsonwebtoken");
const cluster = require("cluster");
const os = require("os");
const errorHandler = require("./middlewares/errorHandlers");
const MongoDB = require("./config/db");

// Import routes
const authRoute = require("./routes/authRoute");
const contentRoute = require("./routes/contentRoute");
const adminRoute = require("./routes/adminRoute");
const employerRoute = require("./routes/employerRoute");

// Initialize environment variables
dotenv.config();

const app = express();

// Enable CORS (uncomment and modify if needed)

const corsOptions = {
  // origin: "https://www.genailearning.in", // Allow only this origin
  // methods: ["GET", "POST", "PUT", "DELETE"],
  // credentials: true,
};

app.use(cors(corsOptions));

// Apply security, compression, and logging middleware
app.use(helmet());
app.use(compression());
app.use(bodyParser.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));

// Static file hosting
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic route to verify server is working
app.get("/", (req, res) => {
  res.json("Hello from the API!");
});

// Error handling middleware
app.use(errorHandler);

// Redis client for caching and session management
const redisClient = redis.createClient();
redisClient.on("error", (err) => {
  console.log("Redis Client Error", err);
});

// MongoDB connection
MongoDB();

// Define routes
app.use("/api/auth", authRoute);
app.use("/api/content", contentRoute);
app.use("/api/admin", adminRoute);
app.use("/api/employer", employerRoute);






// Cluster mode to utilize all CPU cores (for scalability)
if (cluster.isMaster) {
  const numCPUs = os.cpus().length;
  console.log(`Master server is running. Forking ${numCPUs} workers...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
  });
} else {
  // App listening on specified port
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`Worker ${process.pid} listening on port ${PORT}`);
  });
}

