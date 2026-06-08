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

  ffmpegProcess = spawn("ffmpeg", [
    "-re",
    "-i", input,

    // 🔥 FIX: تحويل إلى H.264 بدل copy
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",

    "-c:a", "aac",

    "-f", "flv",
    output
  ]);

  ffmpegProcess.stderr.on("data", data => {
    console.log(data.toString());
  });

  ffmpegProcess.on("close", () => {
    console.log("❌ FFmpeg stopped");
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
app.listen(port, () => console.log("Server running"));
