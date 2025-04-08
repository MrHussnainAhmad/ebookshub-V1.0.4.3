import express from "express";
import User from "../models/User.js";
const router = express.Router();
import jwt from "jsonwebtoken";
import protectRoute from "../middlewares/auth.middleware.js";
import Token from "../models/token.js";
import sendMail from "../../utils/sendMail.js";
import crypto from "crypto";

//TokenGenerator
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15d" });
};

// SignUp
router.post("/register", async (req, res) => {
  try {
    const { email, username, password, userType } = req.body;
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Looks like you missed something!" });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }
    if (username.length < 4) {
      return res
        .status(400)
        .json({ message: "Username must be at least 4 characters long" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already exists" });
    }
    //get random avatar
    const profileImage = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
    const user = new User({
      email,
      username,
      password,
      profileImage,
      userType,
    });

    await user.save();

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const newToken = new Token({
      userId: user._id,
      token: verificationToken,
    });
    await newToken.save();

    const verificationUrl = `${process.env.BASE_URL}/api/auth/verify/${user._id}/${verificationToken}`;
    await sendMail(
      user.email,
      "Account Verification",
      `Welcome to our app! Please verify your email by clicking this link: ${verificationUrl}`
    );

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        userType: user.userType,
        verified: user.verified,
        createdAt: user.createdAt,
      },
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Looks like you missed something!" });
    }

    //checking user
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Are You Spy? Cause You are not in our list!" });
    }
    // Check if email is verified
    if (!user.verified) {
      return res.status(400).json({ 
        message: "Please verify your email before logging in",
        needsVerification: true 
      });
    }
    //checking pass:
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    //genToken:
    const token = generateToken(user._id);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        userType: user.userType,
        verified: user.verified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.log("Intruder Alert! ", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// Send verification email
router.post("/send-verification-email", async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (user.verified) {
      return res.status(400).json({ message: "User already verified" });
    }
    
    // Create a token
    let token = await Token.findOne({ userId: user._id });
    if (token) {
      await token.deleteOne(); // Remove existing token if any
    }
    
    const verificationToken = crypto.randomBytes(32).toString("hex");
    
    const newToken = new Token({
      userId: user._id,
      token: verificationToken,
    });
    
    await newToken.save();
    
    // Create verification URL
    const verificationUrl = `${process.env.BASE_URL}/api/auth/verify/${user._id}/${verificationToken}`;
    
    // Send email
    await sendMail(
      user.email,
      "Account Verification",
      `Click the link to verify your account: ${verificationUrl}`
    );
    
    res.status(200).json({ message: "Verification email sent" });
  } catch (error) {
    console.error("Send verification email error:", error);
    res.status(500).json({ message: "Error sending verification email" });
  }
});
// resending verification email
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (user.verified) {
      return res.status(400).json({ message: "Email already verified" });
    }
    
    // Delete existing token if any
    let token = await Token.findOne({ userId: user._id });
    if (token) {
      await token.deleteOne();
    }
    
    // Create new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    
    const newToken = new Token({
      userId: user._id,
      token: verificationToken,
    });
    
    await newToken.save();
    
    // Create verification URL
    const verificationUrl = `${process.env.BASE_URL}/api/auth/verify/${user._id}/${verificationToken}`;
    
    // Send email
    await sendMail(
      user.email,
      "Account Verification",
      `Click the link to verify your account: ${verificationUrl}`
    );
    
    res.status(200).json({ message: "Verification email resent" });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Error resending verification email" });
  }
});
// Verify email
router.get("/verify/:userId/:token", async (req, res) => {
  try {
    const { userId, token } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Invalid link" });
    }
    
    const verificationToken = await Token.findOne({
      userId: user._id,
      token: token,
    });
    
    if (!verificationToken) {
      return res.status(400).json({ message: "Invalid or expired link" });
    }
    
    // Verify the user
    user.verified = true;
    await user.save();
    
    // Delete the token after verification
    await verificationToken.deleteOne();
    
    // Redirect to frontend or return success
    res.redirect(`${process.env.FRONTEND_URL}/verification-success`);
    // Or if you prefer JSON response:
    // res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ message: "Verification failed" });
  }
});
// Update username - USING MIDDLEWARE
router.put("/update-username", protectRoute, async (req, res) => {
  try {
    const { newUsername } = req.body;
    const userId = req.userId || req.user._id; // Use either one that's available

    if (!newUsername || newUsername.length < 4) {
      return res
        .status(400)
        .json({ message: "Username must be at least 4 characters" });
    }

    const existingUser = await User.findOne({ username: newUsername });
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { username: newUsername },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Username updated",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        userType: user.userType,
      },
    });
  } catch (error) {
    console.error("Update username error:", error);
    res.status(500).json({ message: "Error updating username" });
  }
});

// Add this to your authRoutes.js
router.get("/user-details", protectRoute, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Error fetching user details" });
  }
});

// Update password - USING MIDDLEWARE
router.put("/update-password", protectRoute, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId || req.user._id; // Use either one that's available

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Please provide both passwords" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters long" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ message: "Error updating password" });
  }
});

export default router;