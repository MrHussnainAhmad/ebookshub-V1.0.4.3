// models/Author.js
import mongoose from "mongoose";

const authorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  bio: {
    type: String,
    default: ""
  },
  genres: [{
    type: String
  }],
  books: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book"
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  dislikes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  dislikesCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Author = mongoose.model("Author", authorSchema);
export default Author;