import express from "express";
import User from "../models/User.js";
const router = express.Router();
import jwt from "jsonwebtoken";
import protectRoute from "../middlewares/auth.middleware.js";
import Token from "../models/token.js";
import sendMail from "../../utils/sendMail.js";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

//TokenGenerator
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15d" });
};

//Email Verification:
const sendVerificationEmail = async (user, verificationToken) => {
  const baseUrl = process.env.BASE_URL || "http://192.168.100.24:3001"; // Fallback to your local server
  const verificationUrl = `${baseUrl}/api/auth/verify/${user._id}/${verificationToken}`;

  const emailSubject = "eBooksHub - Verify Your Email Address";

  const emailText = `
Hello ${user.username},

Thank you for signing up with eBooksHub!

Please verify your email address by clicking the link below:
${verificationUrl}

This link will expire in 1 hour.

If you did not create an account with us, please ignore this email.

Best regards,
The eBooksHub Team
  `.trim();

  return await sendMail(user.email, emailSubject, emailText);
};

// SignUp
router.post("/register", async (req, res) => {
  try {
    const { email, username, password, userType } = req.body;

    // Basic validation
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

    // Check for existing email AND username together
    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ username }),
    ]);

    // Better error reporting - check both conditions
    if (existingEmail && existingUsername) {
      return res.status(400).json({
        message: "Both email and username already exist",
        type: "duplicate_both",
      });
    }

    if (existingEmail) {
      return res.status(400).json({
        message: "Email already exists",
        type: "duplicate_email",
      });
    }

    if (existingUsername) {
      return res.status(400).json({
        message: "Username already exists",
        type: "duplicate_username",
      });
    }

    // Get random avatar and continue with user creation
    const profileImage = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
    const user = new User({
      email,
      username,
      password,
      profileImage,
      userType,
    });

    await user.save();

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const newToken = new Token({
      userId: user._id,
      token: verificationToken,
    });
    await newToken.save();

    // Try to send email but don't fail if it doesn't work
    let emailSent = false;
    try {
      await sendVerificationEmail(user, verificationToken);
      emailSent = true;
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Continue with registration even if email fails
    }

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
      message: emailSent
        ? "Verification email sent. Please check your inbox."
        : "Account created, but we couldn't send the verification email. Please request a new one.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Something went wrong during registration",
      error: error.message,
    });
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

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.verified) {
      return res.status(400).json({
        message: "Please verify your email before logging in",
        needsVerification: true,
        email: user.email,
      });
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate token
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
    console.error("Login error:", error);
    res.status(500).json({ message: "Something went wrong during login" });
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

    try {
      await sendVerificationEmail(user, verificationToken);
      res.status(200).json({ message: "Verification email sent" });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ message: "Error sending verification email" });
    }
  } catch (error) {
    console.error("Send verification email error:", error);
    res.status(500).json({ message: "Error sending verification email" });
  }
});

// resending verification email
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Delete existing token if any
    await Token.deleteMany({ userId: user._id });

    // Create new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const newToken = new Token({
      userId: user._id,
      token: verificationToken,
    });

    await newToken.save();

    try {
      await sendVerificationEmail(user, verificationToken);
      res
        .status(200)
        .json({ message: "Verification email has been sent to your inbox" });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ message: "Error sending verification email" });
    }
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ message: "Error sending verification email" });
  }
});

// Verify email
router.get("/verify/:userId/:token", async (req, res) => {
  try {
    const { userId, token } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Invalid verification link" });
    }

    // Check if user is already verified
    if (user.verified) {
      // Since we don't have FRONTEND_URL, redirect to a simple success page
      return res.send(`
        <html>
          <head>
            <title>Already Verified</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              h1 { color: #4CAF50; }
              p { font-size: 18px; }
              .btn { 
                display: inline-block; 
                background: #4CAF50; 
                color: white; 
                padding: 10px 20px; 
                text-decoration: none; 
                border-radius: 5px; 
                margin-top: 20px; 
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Already Verified</h1>
              <p>Your email has already been verified. You can now login to your account.</p>
            </div>
          </body>
        </html>
      `);
    }

    const verificationToken = await Token.findOne({
      userId: user._id,
      token: token,
    });

    if (!verificationToken) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification link" });
    }

    // Verify the user
    user.verified = true;
    await user.save();

    // Delete the token after verification
    await verificationToken.deleteOne();

    // Since we don't have FRONTEND_URL, redirect to a simple success page
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verified | EBooksHub</title>
    <style>
        :root {
            --primary: #4CAF50;
            --primary-light: #E8F5E9;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: var(--primary-light);
            padding: 20px;
        }

        .card {
            background: white;
            max-width: 500px;
            width: 100%;
            padding: 2.5rem;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            text-align: center;
            animation: fadeIn 0.6s ease-out;
        }

        .checkmark {
            width: 72px;
            height: 72px;
            background: var(--primary);
            border-radius: 50%;
            margin: 0 auto 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: scaleUp 0.4s ease;
        }

        .checkmark svg {
            width: 36px;
            height: 36px;
            fill: white;
        }

        h1 {
            color: var(--primary);
            margin-bottom: 1rem;
            font-size: 1.8rem;
        }

        p {
            color: #444;
            line-height: 1.6;
            margin-bottom: 1.5rem;
        }
li {
  list-style: none;
}
        .progress-note {
            background: #FFF3E0;
            padding: 1rem;
            border-radius: 8px;
            margin: 2rem 0;
            border-left: 4px solid #FFA726;
        }

        .cta-button {
            display: inline-block;
            background: var(--primary);
            color: white;
            padding: 0.8rem 2rem;
            border-radius: 8px;
            text-decoration: none;
            transition: transform 0.2s ease;
        }

        .cta-button:hover {
            transform: translateY(-2px);
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes scaleUp {
            from { transform: scale(0); }
            to { transform: scale(1); }
        }

        @media (max-width: 480px) {
            .card {
                padding: 1.5rem;
            }
            
            h1 {
                font-size: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="checkmark">
            <svg viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
        </div>
        
        <h1>Email Verified Successfully</h1>
        
        <p>
            Thank you for verifying your email address. You're now ready to access 
            your EBooksHub account and all its features.
            <br/>
<ul>
    <li>If you are an author, you can read and upload your own books.</li>
    <li>If you are a reader, you can read and download books.</li>
</ul>
            <br/>
        </p>

        <div class="progress-note">
            <p>
                We're actively working on improving our website too!<br>
                Follow our progress at:<br>
                <a href="https://ebookshub.live" style="color: var(--primary); font-weight: 500;">
                    ebookshub.live
                </a>
            </p>
        </div>
    </div>
</body>
</html>
    `);
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

// Update sex
router.put("/update-sex", protectRoute, async (req, res) => {
  try {
    const { sex } = req.body;
    const userId = req.userId || req.user._id;

    const allowedValues = ["Male", "Female", "Other", "Prefer not to say"];
    if (!allowedValues.includes(sex)) {
      return res.status(400).json({ message: "Invalid sex value" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { sex },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Sex updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error updating sex:", error);
    res.status(500).json({ message: "Server error" });
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

//token for notification
router.post("/save-token", protectRoute, async (req, res) => {
  const { expoPushToken } = req.body;

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  user.expoPushToken = expoPushToken;
  await user.save();

  res.status(200).json({ message: "Token saved" });
});

export default router;
