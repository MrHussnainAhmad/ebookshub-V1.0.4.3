import express from "express";
import "dotenv/config";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import bookRoutes from "./routes/bookRoutes.js";
import { connectDB } from "./lib/db.js";
import notificationRoutes from "./routes/notificationRoutes.js";



const app = express();
const PORT = process.env.PORT || 3001;

// Increased body parser limits for larger file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(cors());
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
    res.send("Welcome to the home route of eBooksHub!");
});



app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    connectDB();
});