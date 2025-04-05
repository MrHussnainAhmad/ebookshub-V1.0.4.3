import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protectRoute = async (req, res, next) => {
  try {
    // Check if Authorization header exists
    if (!req.header("Authorization")) {
      return res.status(401).json({ message: "You need to login first" });
    }
    
    const token = req.header("Authorization").replace("Bearer ", "");
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({ message: "You need to login first" });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if userId exists in decoded token
    if (!decoded.userId) {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    // Find user
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Set user and userId in request object
    req.user = user;
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Invalid token" });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Token expired" });
    }
    
    res.status(401).json({ message: "Authentication failed" });
  }
};

export default protectRoute;