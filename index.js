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

// 🛡️ حماية السيرفر
process.on("uncaughtException", (err) => {
  console.log("🔥 Error:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("🔥 Rejection:", err);
});

// 🌐 Home
app.get("/", (req, res) => {
  res.send("🚀 Restream System Running");
});

// ▶️ Start Stream
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
      "-fflags", "+genpts+discardcorrupt",
      "-flags", "low_delay",

      "-i", input,
      "-i", logo,

      // 🎯 scale + overlay (stable)
      "-filter_complex",
      "[0:v]scale=1280:720[vid];[vid][1:v]overlay=W-w-20:20",

      // 🎥 video
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-tune", "zerolatency",
      "-b:v", "1200k",
      "-maxrate", "1200k",
      "-bufsize", "2400k",
      "-r", "25",

      // 🔊 audio
      "-c:a", "aac",
      "-b:a", "96k",

      "-f", "flv",
      output
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.log(`[${id}] ${data.toString()}`);
    });

    ffmpeg.on("exit", (code) => {
      console.log(`❌ ${id} exited ${code}`);
      delete ffmpegProcesses[id];
    });

    ffmpeg.on("error", (err) => {
      console.log("FFMPEG ERROR:", err);
    });

    ffmpegProcesses[id] = ffmpeg;

    res.send(`✅ Channel ${id} started`);
  } catch (err) {
    console.log("START ERROR:", err);
    res.send("❌ error starting stream");
  }
});

// 🛑 Stop Stream
app.get("/stop", (req, res) => {
  const id = req.query.id;

  if (ffmpegProcesses[id]) {
    ffmpegProcesses[id].kill("SIGKILL");
    delete ffmpegProcesses[id];
  }

  res.send(`🛑 Channel ${id} stopped`);
});

// 📊 Status API
app.get("/status", (req, res) => {
  res.json({
    active: Object.keys(ffmpegProcesses)
  });
});

// 📡 Dashboard (FIXED)
app.get("/dashboard", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard</title>
  <style>
    body { font-family: Arial; background:#111; color:#fff; padding:20px; }
    .card { background:#222; padding:15px; margin:10px 0; border-radius:10px; }
    button { padding:8px 12px; margin:5px; cursor:pointer; }
  </style>
</head>
<body>

<h2>📡 Live Dashboard</h2>

<div id="list"></div>

<script>
async function load() {
  const res = await fetch('/status');
  const data = await res.json();

  const channels = ['ch1','ch2','ch3','ch4','ch5'];

  const box = document.getElementById('list');
  box.innerHTML = '';

  channels.forEach(ch => {
    const active = data.active.includes(ch);

    box.innerHTML += \`
      <div class="card">
        <h3>\${ch} - \${active ? '🟢 LIVE' : '🔴 OFFLINE'}</h3>

        <a href="/start?id=\${ch}&input=INPUT_URL&output=RTMP_URL">
          <button style="background:green;color:white;">Start</button>
        </a>

        <a href="/stop?id=\${ch}">
          <button style="background:red;color:white;">Stop</button>
        </a>
      </div>
    \`;
  });
}

load();
setInterval(load, 3000);
</script>

</body>
</html>
  `);
});

// 🚀 Railway health check
app.get("/health", (req, res) => {
  res.send("OK");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("🚀 Server running on port", port);
});
