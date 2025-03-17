import jwt from "jsonwebtoken";
import User from "../models/User.js"; // Fix: Correct path to User model

const protectRoute = async (req, res, next) => {
  try {
    // Check if Authorization header exists
    if (!req.header("Authorization")) {
      return res.status(401).json({ message: "You need to login first" });
    }
    
    const token = req.header("Authorization").replace("Bearer ", "");
    
    //check if token exists
    if (!token) {
      return res.status(401).json({ message: "You need to login first" });
    }
    
    //verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    //find user
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

export default protectRoute;