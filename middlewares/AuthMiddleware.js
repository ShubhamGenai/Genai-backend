const jwt = require("jsonwebtoken");
const User = require("../models/UserModel"); // Adjust the path
const Employer = require("../models/EmployerModel"); // Import Employer model
const dotenv = require("dotenv").config();

const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ message: "Authentication token is missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check in User collection
    let user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = { 
      id: user._id, 
      email: user.email, 
      role: user.role 
    }; // Attach user data to request
    next(); // Move to next middleware
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(401).json({ message: "User token Expired" });
  }
};

module.exports = authMiddleware;
