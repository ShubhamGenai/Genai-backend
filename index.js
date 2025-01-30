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
const errorHandler = require("./middlewares/errorHandlers");
const MongoDB = require("./config/db");


const authRoute = require("./routes/authRoute");


// Initialize environment variables
dotenv.config();

const app = express();


const corsOptions = {};

 // app.use(cors({
  //   origin: "https://www.genailearning.in", // Allow only this origin
  //   methods: ["GET", "POST", "PUT", "DELETE"], // Allow these HTTP methods
  //   credentials: true // Allow credentials if needed
  // }));

app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(bodyParser.json());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.get("/", (req, res) => {
    res.json("hello");
  });


app.use(errorHandler);

const redisClient = redis.createClient();

redisClient.on("error", (err) => {
    console.log("Redis Client Error", err);
  });


  app.use("/api/auth",authRoute)

//   app.use("/api/admin",adminRoute)
//   app.use("/api/user",userRoute)
//   app.use("/api/ai",aiRoute)
//   app.use("/api/chatbot",chatRoute)



  MongoDB();

  const PORT = process.env.PORT||8080;
app.listen(PORT,()=>{
console.log(`conected localhost//:${PORT}`);
})