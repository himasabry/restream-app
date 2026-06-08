import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcess;

app.get("/", (req, res) => {
  res.send("🚀 Restream is running");
});

app.get("/start", (req, res) => {
  const input = req.query.input;
  const output = req.query.output;

  if (!input || !output) {
    return res.send("❌ لازم input و output");
  }

  if (ffmpegProcess) {
    return res.send("⚠️ البث شغال بالفعل");
  }

  console.log("▶️ Starting FFmpeg...");

  ffmpegProcess = spawn("ffmpeg", [
    "-re",
    "-i", input,

    // 🔥 FIX: تحويل HEVC → H264
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",

    "-c:a", "aac",

    "-f", "flv",
    output
  ]);

  // 🔍 مهم: عرض كل اللوج
  ffmpegProcess.stderr.on("data", data => {
    const msg = data.toString();
    console.log(msg);

    if (msg.includes("frame=")) {
      console.log("📡 LIVE STREAMING ACTIVE");
    }

    if (msg.includes("Error") || msg.includes("failed")) {
      console.log("❌ FFmpeg ERROR DETECTED");
    }
  });

  ffmpegProcess.on("exit", (code) => {
    console.log("❌ FFmpeg exited with code:", code);
    ffmpegProcess = null;
  });

  ffmpegProcess.on("close", () => {
    console.log("❌ FFmpeg closed");
    ffmpegProcess = null;
  });

  res.send("✅ تم تشغيل البث");
});

app.get("/stop", (req, res) => {
  if (ffmpegProcess) {
    ffmpegProcess.kill("SIGKILL");
    ffmpegProcess = null;
    return res.send("🛑 تم إيقاف البث");
  }
  res.send("❌ مفيش بث شغال");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
