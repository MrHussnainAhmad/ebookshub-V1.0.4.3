import express from "express";
import User from "../models/User.js";
const router = express.Router(); // FIXED: "Router()" is correct
import jwt from "jsonwebtoken";

//TokenGenerator
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15d" });
};

// SignUp
router.post("/register", async (req, res) => {
  try {
    const { email, username, password ,userType} = req.body;
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

    const existingEmail = await User.findOne({  email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const existingUsername = await User.findOne({ username  });
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

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage,
        userType: user.userType,
      },
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
        return res.status(400).json({ message: "Looks like you missed something!" });
    }

    //checking user
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: "Are You Spy? Cuz You are not in our list!" });
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
        },
    });
  } catch (error) {
    console.log("Intruder Alert! ", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;
