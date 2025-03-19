import express from "express";
import cloudinary from "../lib/cloudinary.js";
import Book from "../models/Book.js";
import protectRoute from "../middlewares/auth.middleware.js";

const router = express.Router();

//create
router.post("/", protectRoute, async (req, res) => {
  try {
    const { title, author, caption, rating, image, pdfFile } = req.body;

    if (!image || !title || !caption ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    //uploading image to cloudinary
    const imageUploadResponse = await cloudinary.uploader.upload(image);
    const imageUrl = imageUploadResponse.secure_url;

    //store in db
    const book = new Book({
      title,
      author,
      caption,
      rating, // Note: This should match your schema (Rating vs rating)
      image: imageUrl,
      pdfFile,
      user: req.user._id,
    });

    await book.save(); // Fix: Using book instead of newBook
    res.status(201).json({ message: "Book created successfully", book });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/", protectRoute, async (req, res) => {
    try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 10;
        const skip = (page - 1) * limit;
        const books = await Book.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "username profileImage")

        const total = await Book.countDocuments();
        res.send({
            books,
            currentPage: page,
            totalBooks : total,
            totalPages : Math.ceil(totalBooks / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});

//recommend
router.get("/user", protectRoute, async (req, res) => {
    try {
        const books = await Book.find({ user:  req.user._id } ).sort({ createdAt: -1 });
        res.json(books);
    } catch (error) {
        console.error("Get user Books error",error);
        res.status(500).json({ message: "Internal server error" });
    }
});

//delete
router.delete("/:id", protectRoute, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ message: "Book not found" });
        }
        //check if user is creator.
        if (book.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "You are not authorized to delete this book" });
        }

        //delete image from cloudinary.
        if (book.image && book.image.includes("cloudinary")) {
            try {
                const publicId = book.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId)  ;
            } catch (error) {
                console.error("Error Deleting Book.",error);
                return res.status(500).json({ message: "Internal server error" });
                
            }
        }
        await book.deleteOne();
        res.json({ message: "Book deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
})

export default router;