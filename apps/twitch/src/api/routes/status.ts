import express from "express";
import consola from "consola";

const router: ReturnType<typeof express.Router> = express.Router();

import { botStatus } from "../../app.js";

/**
 *  @route GET /status
 *  @desc Get status of Twitch Bot
 *  @access Public
 *  @returns {object} - Status of Twitch Bot
 */
router.get("/", async (req, res) => {
  try {
    res.status(200).json({
      status: botStatus.status,
    });
  } catch (err) {
    consola.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
