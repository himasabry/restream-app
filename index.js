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

  console.log("▶️ Starting stream with logo...");

  ffmpegProcess = spawn("ffmpeg", [
    "-re",
    "-i", input,

    // 🎯 اللوجو (الصورة الثانية)
    "-i", "logo.png",

    // 🔥 تحويل الفيديو (حل HEVC)
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",

    "-c:a", "aac",

    // 🎯 دمج اللوجو (Overlay)
    "-filter_complex",
    "overlay=W-w-20:20",

    "-f", "flv",
    output
  ]);

  // 📡 لوج التشغيل
  ffmpegProcess.stderr.on("data", data => {
    console.log(data.toString());
  });

  ffmpegProcess.on("exit", (code) => {
    console.log("❌ FFmpeg exited with code:", code);
    ffmpegProcess = null;
  });

  ffmpegProcess.on("close", () => {
    console.log("❌ FFmpeg closed");
    ffmpegProcess = null;
  });

  res.send("✅ تم تشغيل البث مع اللوجو");
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
