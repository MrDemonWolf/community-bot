import express from "express";

import { logger } from "../../utils/logger.js";

const router: ReturnType<typeof express.Router> = express.Router();

import { botStatus } from "../../app.js";

/**
 *  @route GET /health
 *  @desc Get health of Twitch Bot
 *  @access Public
 *  @returns {object} - Health status of Twitch Bot
 */
router.get("/", async (req, res) => {
  try {
    res.status(200).json({
      status: botStatus.status,
    });
  } catch (err) {
    logger.error("API", "Health check failed", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
