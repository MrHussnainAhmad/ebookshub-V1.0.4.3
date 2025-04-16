import express from "express";
import Book from "../models/Book.js";
import User from "../models/User.js";
import protectRoute from "../middlewares/auth.middleware.js";
import adminMiddleware from "../middlewares/admin.middleware.js";

const router = express.Router();

// Protect all admin routes with auth and admin middleware
router.use(protectRoute);
router.use(adminMiddleware);

// Add these routes to your adminRoutes.js file

// Update user
router.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email } = req.body;
    
    // Basic validation
    if (!username || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Username and email are required" 
      });
    }
    
    // Check if email is already taken by another user
    const existingEmail = await User.findOne({ 
      email, 
      _id: { $ne: id } 
    });
    
    if (existingEmail) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is already in use by another account" 
      });
    }
    
    // Check if username is already taken by another user
    const existingUsername = await User.findOne({ 
      username, 
      _id: { $ne: id } 
    });
    
    if (existingUsername) {
      return res.status(400).json({ 
        success: false, 
        message: "Username is already in use by another account" 
      });
    }
    
    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { username, email },
      { new: true }
    ).select("-password");
    
    if (!updatedUser) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    
    res.json({
      success: true,
      message: "User updated successfully",
      data: updatedUser
    });
  } catch (error) {
    console.error("Admin - Error updating user:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update user" 
    });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find and delete the user
    const deletedUser = await User.findByIdAndDelete(id);
    
    if (!deletedUser) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    
    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Admin - Error deleting user:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to delete user" 
    });
  }
});

// Get all books for admin
router.get("/books", async (req, res) => {
  try {
    // Add optional pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const books = await Book.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "username email")
      .select("title author image genre caption Rating views isPremium premiumDisplayUntil");
      
    const total = await Book.countDocuments();
    
    res.json({
      success: true,
      count: books.length,
      data: books,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Admin - Error fetching books:", error);
    res.status(500).json({ success: false, message: "Failed to fetch books" });
  }
});

// Get all users for admin
router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-password");
      
    const total = await User.countDocuments();
    
    res.json({
      success: true,
      count: users.length,
      data: users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Admin - Error fetching users:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

// Toggle premium status for a book
router.put("/books/:id/toggle-premium", async (req, res) => {
  try {
    const { id } = req.params;
    const { isPremium, premiumDisplayUntil } = req.body;
    
    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ 
        success: false, 
        message: "Book not found" 
      });
    }
    
    // Update premium status
    book.isPremium = isPremium;
    
    // Set or clear the premium expiration date
    if (isPremium && premiumDisplayUntil) {
      book.premiumDisplayUntil = new Date(premiumDisplayUntil);
    } else if (!isPremium) {
      book.premiumDisplayUntil = null;
    }
    
    await book.save();
    
    res.json({
      success: true,
      message: `Book ${isPremium ? 'set as premium' : 'removed from premium'} successfully`,
      book: {
        _id: book._id,
        title: book.title,
        isPremium: book.isPremium,
        premiumDisplayUntil: book.premiumDisplayUntil
      }
    });
  } catch (error) {
    console.error("Admin - Error toggling premium status:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update premium status" 
    });
  }
});

// Get dashboard stats for admin
router.get("/dashboard-stats", async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const readerCount = await User.countDocuments({ userType: "reader" });
    const authorCount = await User.countDocuments({ userType: "author" });
    const verifiedUsers = await User.countDocuments({ verified: true });
    
    // Book statistics
    const totalBooks = await Book.countDocuments();
    const totalPremiumBooks = await Book.countDocuments({ isPremium: true });
    
    // Get top books by views
    const topViewedBooks = await Book.find()
      .sort({ views: -1 })
      .limit(5)
      .select("title author views");
      
    // Get top books by rating
    const topRatedBooks = await Book.find({ Rating: { $exists: true, $ne: null } })
      .sort({ Rating: -1 })
      .limit(5)
      .select("title author Rating");
    
    // Get genre distribution
    const genreDistribution = await Book.aggregate([
      { $group: { _id: "$genre", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("username email userType createdAt");
      
    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          readers: readerCount,
          authors: authorCount,
          verified: verifiedUsers,
          unverified: totalUsers - verifiedUsers
        },
        books: {
          total: totalBooks,
          premium: totalPremiumBooks
        },
        topViewedBooks,
        topRatedBooks,
        genreDistribution,
        recentUsers
      }
    });
  } catch (error) {
    console.error("Admin - Error fetching dashboard stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch dashboard statistics" });
  }
});

export default router;