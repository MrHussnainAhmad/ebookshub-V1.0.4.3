import express from "express";
import User from "../models/User.js";
import Author from "../models/Author.js";
import protectRoute from "../middlewares/auth.middleware.js";
const router = express.Router();

// Get all authors
router.get("/", async (req, res) => {
  try {
    const authors = await Author.find()
      .populate({
        path: 'user',
        select: 'username profileImage userType createdAt',
        match: { userType: "author" }
      })
      .populate("books", "title coverImage rating");

    // Filter out any that don't have valid user data
    const validAuthors = authors.filter(author => author.user);
    
    const formattedAuthors = validAuthors.map(author => ({
      id: author._id,
      userId: author.user._id,
      username: author.user.username,
      profileImage: author.user.profileImage,
      bio: author.bio,
      genres: author.genres,
      books: author.books,
      likesCount: author.likesCount,
      dislikesCount: author.dislikesCount,
      createdAt: author.createdAt
    }));

    res.status(200).json({ authors: formattedAuthors });
  } catch (error) {
    console.error("Error fetching authors:", error);
    res.status(500).json({ message: "Error fetching authors" });
  }
});

// Get author by ID
router.get("/:id", async (req, res) => {
  try {
    const author = await Author.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'username profileImage userType createdAt'
      })
      .populate("books", "title coverImage rating");

    if (!author) {
      return res.status(404).json({ message: "Author not found" });
    }

    if (!author.user || author.user.userType !== "author") {
      return res.status(400).json({ message: "This user is not an author" });
    }

    res.status(200).json({
      author: {
        id: author._id,
        userId: author.user._id,
        username: author.user.username,
        profileImage: author.user.profileImage,
        bio: author.bio,
        genres: author.genres,
        books: author.books,
        createdAt: author.createdAt,
        likesCount: author.likesCount,
        dislikesCount: author.dislikesCount
      }
    });
  } catch (error) {
    console.error("Error fetching author:", error);
    res.status(500).json({ message: "Error fetching author profile" });
  }
});

// Get top authors
router.get("/discover/top", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const topAuthors = await Author.find()
      .sort({ likesCount: -1 }) // Sort by like count descending
      .limit(limit)
      .populate({
        path: 'user',
        select: 'username profileImage userType'
      });
    
    const formattedAuthors = topAuthors
      .filter(author => author.user) // Filter out any that don't have valid user data
      .map(author => ({
        id: author._id,
        userId: author.user._id,
        username: author.user.username,
        profileImage: author.user.profileImage,
        likesCount: author.likesCount,
        dislikesCount: author.dislikesCount
      }));
    
    res.status(200).json({ authors: formattedAuthors });
  } catch (error) {
    console.error("Error fetching top authors:", error);
    res.status(500).json({ message: "Error fetching top authors" });
  }
});

// Like an author - Requires authentication
router.post("/:id/like", protectRoute, async (req, res) => {
  try {
    const authorId = req.params.id;
    const userId = req.userId;

    // Check if the author exists
    const author = await Author.findById(authorId);
    if (!author) {
      return res.status(404).json({ message: "Author not found" });
    }

    // Check if the user is trying to like their own profile
    if (author.user.toString() === userId) {
      return res.status(400).json({ message: "You cannot like your own profile" });
    }

    // Initialize likes and dislikes arrays if they don't exist
    if (!author.likes) author.likes = [];
    if (!author.dislikes) author.dislikes = [];

    // Remove from dislikes if needed
    if (author.dislikes.includes(userId)) {
      author.dislikes = author.dislikes.filter(id => id.toString() !== userId);
      author.dislikesCount = Math.max(0, author.dislikesCount - 1);
    }

    // Toggle like
    if (author.likes.includes(userId)) {
      author.likes = author.likes.filter(id => id.toString() !== userId);
      author.likesCount = Math.max(0, author.likesCount - 1);
      await author.save();

      return res.status(200).json({ 
        message: "Like removed",
        likesCount: author.likesCount,
        dislikesCount: author.dislikesCount
      });
    }

    // Add new like
    author.likes.push(userId);
    author.likesCount = author.likesCount + 1;
    await author.save();
    
    res.status(200).json({ 
      message: "Author liked successfully",
      likesCount: author.likesCount,
      dislikesCount: author.dislikesCount
    });
  } catch (error) {
    console.error("Error liking author:", error);
    res.status(500).json({ message: "Error processing like" });
  }
});

// Dislike an author - Requires authentication
router.post("/:id/dislike", protectRoute, async (req, res) => {
  try {
    const authorId = req.params.id;
    const userId = req.userId;

    // Check if the author exists
    const author = await Author.findById(authorId);
    if (!author) {
      return res.status(404).json({ message: "Author not found" });
    }

    // Check if the user is trying to dislike their own profile
    if (author.user.toString() === userId) {
      return res.status(400).json({ message: "You cannot dislike your own profile" });
    }

    // Initialize likes and dislikes arrays if they don't exist
    if (!author.likes) author.likes = [];
    if (!author.dislikes) author.dislikes = [];

    // Remove from likes if needed
    if (author.likes.includes(userId)) {
      author.likes = author.likes.filter(id => id.toString() !== userId);
      author.likesCount = Math.max(0, author.likesCount - 1);
    }

    // Toggle dislike
    if (author.dislikes.includes(userId)) {
      author.dislikes = author.dislikes.filter(id => id.toString() !== userId);
      author.dislikesCount = Math.max(0, author.dislikesCount - 1);
      await author.save();

      return res.status(200).json({ 
        message: "Dislike removed",
        likesCount: author.likesCount,
        dislikesCount: author.dislikesCount
      });
    }

    // Add new dislike
    author.dislikes.push(userId);
    author.dislikesCount = author.dislikesCount + 1;
    await author.save();
    
    res.status(200).json({ 
      message: "Author disliked successfully",
      likesCount: author.likesCount,
      dislikesCount: author.dislikesCount
    });
  } catch (error) {
    console.error("Error disliking author:", error);
    res.status(500).json({ message: "Error processing dislike" });
  }
});

// Get user's like/dislike status for an author
router.get("/:id/reaction-status", protectRoute, async (req, res) => {
  try {
    const authorId = req.params.id;
    const userId = req.userId;
    
    const author = await Author.findById(authorId);
    if (!author) {
      return res.status(404).json({ message: "Author not found" });
    }
    
    // Initialize likes and dislikes arrays if they don't exist
    if (!author.likes) author.likes = [];
    if (!author.dislikes) author.dislikes = [];
    
    const status = {
      liked: author.likes.includes(userId),
      disliked: author.dislikes.includes(userId)
    };
    
    res.status(200).json({ status });
  } catch (error) {
    console.error("Error fetching reaction status:", error);
    res.status(500).json({ message: "Error fetching reaction status" });
  }
});

export default router;