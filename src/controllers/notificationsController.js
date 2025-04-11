// controllers/notificationsController.js
import Book from "../models/Book.js";
import User from "../models/User.js";
import axios from "axios";

let lastBookNotificationDate = null;

export const sendDailyBookNotification = async (req, res) => {
  const today = new Date().toDateString();

  const latestBook = await Book.findOne().sort({ createdAt: -1 });
  if (!latestBook) return res.status(404).json({ message: "No books found" });

  const isHussnain = latestBook.author.trim().toLowerCase() === "hussnain ahmad";

  if (lastBookNotificationDate === today && !isHussnain) {
    return res.status(200).json({ message: "Book notification already sent today" });
  }

  const users = await User.find({ expoPushToken: { $ne: null } });
  const pushMessages = users.map(user => ({
    to: user.expoPushToken,
    title: isHussnain
      ? "🔥 Exclusive Release by Hussnain Ahmad!"
      : "📚 New Book Uploaded!",
    body: `Check out "${latestBook.title}" by ${latestBook.author}`,
    data: { type: "book", bookId: latestBook._id },
  }));

  try {
    await axios.post("https://exp.host/--/api/v2/push/send", pushMessages);

    if (!isHussnain) lastBookNotificationDate = today;

    return res.status(200).json({
      message: `Notification sent${isHussnain ? " (Hussnain override)" : ""}`,
    });
  } catch (err) {
    console.error("Push error:", err.message);
    return res.status(500).json({ message: "Failed to send push" });
  }
};

export const sendManualUpdateNotification = async (req, res) => {
  const { version, features } = req.body;
  if (!version || !features) {
    return res.status(400).json({ message: "Version and features are required" });
  }

  const users = await User.find({ expoPushToken: { $ne: null } });
  const updateMessages = users.map(user => ({
    to: user.expoPushToken,
    title: `App Update ${version} 🚀`,
    body: `What's new: ${features}`,
    data: { type: "update", version },
  }));

  try {
    await axios.post("https://exp.host/--/api/v2/push/send", updateMessages);
    return res.status(200).json({ message: "Update push sent" });
  } catch (err) {
    console.error("Update push error:", err.message);
    return res.status(500).json({ message: "Failed to send update push" });
  }
};
