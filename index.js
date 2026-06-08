import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcesses = {};

// 🎯 لوجو لكل قناة
const logos = {
  ch1: "logo.png",
  ch2: "logo2.png",
  ch3: "logo3.png",
  ch4: "logo4.png",
  ch5: "logo5.png",
};

function getLogo(id) {
  return logos[id] || "logo.png";
}

// 🛡️ حماية السيرفر من crash
process.on("uncaughtException", (err) => {
  console.log("🔥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("🔥 Unhandled Rejection:", err);
});

app.get("/", (req, res) => {
  res.send("🚀 Restream Running Safe Mode");
});

// ▶️ تشغيل قناة
app.get("/start", (req, res) => {
  try {
    const id = req.query.id;
    const input = req.query.input;
    const output = req.query.output;

    if (!id || !input || !output) {
      return res.send("❌ missing params");
    }

    if (ffmpegProcesses[id]) {
      return res.send("⚠️ already running");
    }

    const logo = getLogo(id);

    const ffmpeg = spawn("ffmpeg", [
      "-re",
      "-i", input,
      "-i", logo,

      "-filter_complex",
      "[0:v]scale=1280:720[vid];[vid][1:v]overlay=W-w-20:20",

      "-c:v", "libx264",
      "-preset", "veryfast",
      "-tune", "zerolatency",

      "-b:v", "1200k",
      "-maxrate", "1200k",
      "-bufsize", "2400k",
      "-r", "25",

      "-c:a", "aac",
      "-b:a", "96k",

      "-f", "flv",
      output
    ]);

    ffmpeg.stderr.on("data", (d) => {
      console.log(`[${id}] ${d.toString()}`);
    });

    ffmpeg.on("error", (err) => {
      console.log("FFMPEG ERROR:", err);
    });

    ffmpeg.on("exit", (code) => {
      console.log(`❌ ${id} exited ${code}`);
      delete ffmpegProcesses[id];
    });

    ffmpegProcesses[id] = ffmpeg;

    res.send(`✅ started ${id}`);
  } catch (err) {
    console.log("START ERROR:", err);
    res.send("❌ error starting stream");
  }
});

// 🛑 إيقاف
app.get("/stop", (req, res) => {
  const id = req.query.id;

  if (ffmpegProcesses[id]) {
    ffmpegProcesses[id].kill("SIGKILL");
    delete ffmpegProcesses[id];
  }

  res.send(`🛑 stopped ${id}`);
});

// 📊 status
app.get("/status", (req, res) => {
  res.json({
    active: Object.keys(ffmpegProcesses)
  });
});

// 🚀 مهم جدًا: Railway health check
app.get("/health", (req, res) => {
  res.send("OK");
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("🚀 Server running on port", port);
});
