from transformers import pipeline
from flask import Flask, request, jsonify, send_from_directory
import scipy
import os

app = Flask(__name__)

# Load the MusicGen-Small model
print("Loading MusicGen model...")
musicgen = pipeline("text-to-audio", model="facebook/musicgen-small", device="cpu")

@app.route("/generate-music", methods=["POST"])
def generate_music():
    data = request.json
    prompt = data.get("prompt", "default music")

    # Generate music
    output = musicgen(prompt)

    # Save to file
    filename = "generated_music.wav"
    scipy.io.wavfile.write(filename, rate=output["sampling_rate"], data=output["audio"])

    return jsonify({"message": "Music generated", "file": "generated_music.wav"})

# ✅ New Route to Serve the Generated Music File
@app.route("/generated_music.wav")
def serve_music():
    return send_from_directory(os.getcwd(), "generated_music.wav", mimetype="audio/wav")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
