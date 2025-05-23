import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protectRoute = async (req, res, next) => {
  try {
    // Check if Authorization header exists
    if (!req.header("Authorization")) {
      return res.status(401).json({ 
        success: false,
        message: "You need to login first" 
      });
    }
    
    const token = req.header("Authorization").replace("Bearer ", "");
    
    // Check if token exists after Bearer is removed
    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({ 
        success: false,
        message: "Invalid authentication token" 
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if userId exists in decoded token
    if (!decoded.userId) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token format" 
      });
    }
    
    // Find user
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User account not found" 
      });
    }

    // Check if user is verified (if you have this field)
    if (user.verified === false) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email to access this resource"
      });
    }

    // Set user and userId in request object
    req.user = user;
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: "Invalid authentication token" 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: "Authentication token expired. Please login again" 
      });
    }
    
    res.status(401).json({ 
      success: false,
      message: "Authentication failed. Please login again" 
    });
  }
};

export default protectRoute;