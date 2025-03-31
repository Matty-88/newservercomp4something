/**
 * @swagger
 * tags:
 *   name: Music
 *   description: Music generation endpoint using AI
 */

const express = require("express");
const axios = require("axios");
const router = express.Router();

/**
 * @swagger
 * /generate-music:
 *   post:
 *     summary: Generate AI music from a text prompt
 *     tags: [Music]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: "An energetic EDM beat with synths"
 *     responses:
 *       200:
 *         description: Audio file generated successfully
 *         content:
 *           audio/wav:
 *             schema:
 *               type: string
 *               format: binary
 *       500:
 *         description: Music generation failed
 */
router.post("/generate-music", async (req, res) => {
    const { prompt } = req.body;
    const MUSICGEN_API_URL = "https://router.huggingface.co/hf-inference/models/facebook/musicgen-small";

    try {
        const response = await axios.post(
            MUSICGEN_API_URL,
            { inputs: prompt },
            {
                headers: {
                    Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    "Content-Type": "application/json",
                },
                responseType: "arraybuffer",
            }
        );

        res.set({
            "Content-Type": "audio/wav",
            "Content-Disposition": 'attachment; filename="audio.wav"',
        });

        res.send(Buffer.from(response.data, "binary"));
    } catch (error) {
        console.error("Music generation failed:", error);
        res.status(500).json({
            error: "Music generation failed",
            details: error.response ? error.response.data : error.message,
        });
    }
});

module.exports = router;
