import express from "express";
import {
  sendDailyBookNotification,
  sendManualUpdateNotification,
} from "../controllers/notificationsController.js";
import protectRoute from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/daily-book", protectRoute, sendDailyBookNotification);
router.post("/update", protectRoute, sendManualUpdateNotification);

export default router;
