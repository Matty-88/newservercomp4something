// routes/music.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

const MUSICGEN_API_URL = "https://router.huggingface.co/hf-inference/models/facebook/musicgen-small";

router.post("/generate-music", async (req, res) => {
    const { prompt } = req.body;

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
