import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcesses = {};

// 🎯 القنوات (هنا تعدل الروابط براحتك)
const channels = {
  ch1: {
    input: "https://streem.rodoye.com/live/fac/max1/index.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/6ce1-v2hu-38fu-awwa"
  },

  ch2: {
    input: "https://streem.rodoye.com/live/rodo/max_2/index.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/5716-lclm-8mhs-hd0n"
  },

  ch3: {
    input: "https://streem.rodoye.com/live/rodo/max_3/index.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/stream-key-3"
  },

  ch4: {
    input: "https://streem.rodoye.com/live/rodo/max_4/index.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/stream-key-4"
  },

  ch5: {
    input: "https://example.com/ch5.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/stream-key-5"
  }
};

// 🎯 لوجو لكل قناة
const logos = {
  ch1: "logo1.png",
  ch2: "logo22.png",
  ch3: "logo33.png",
  ch4: "logo44.png",
  ch5: "logo55.png",
};

function getLogo(id) {
  return logos[id] || "logo.png";
}

// 🛡️ حماية من الكراش
process.on("uncaughtException", (err) => {
  console.log("🔥 Error:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("🔥 Rejection:", err);
});

// 🌐 Home
app.get("/", (req, res) => {
  res.send("🚀 Restream System Running PRO");
});


// ▶️ Start Stream (بدون input/output)
app.get("/start", (req, res) => {
  try {
    const id = req.query.id;

    if (!id) {
      return res.send("❌ missing channel id");
    }

    const channel = channels[id];

    if (!channel) {
      return res.send("❌ channel not found");
    }

    if (ffmpegProcesses[id]) {
      return res.send("⚠️ already running");
    }

    const input = channel.input;
    const output = channel.output;
    const logo = getLogo(id);

    const ffmpeg = spawn("ffmpeg", [
      "-re",
      "-fflags", "+genpts+discardcorrupt",
      "-flags", "low_delay",

      "-i", input,
      "-i", logo,

      // 🎯 لوجو ثابت احترافي
      "-filter_complex",
      "[0:v]scale=1280:720,setsar=1[base];[base][1:v]overlay=W-w-5:5",

      // 🎥 Video
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-tune", "zerolatency",

      "-b:v", "1200k",
      "-maxrate", "1200k",
      "-bufsize", "2400k",
      "-r", "25",

      // 🔊 Audio
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

    ffmpegProcesses[id] = ffmpeg;

    res.send(`✅ Channel ${id} started`);
  } catch (err) {
    console.log("START ERROR:", err);
    res.send("❌ error");
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


// 📊 Status
app.get("/status", (req, res) => {
  res.json({
    active: Object.keys(ffmpegProcesses)
  });
});


// 📡 Dashboard
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

<h2>📡 Live Dashboard PRO</h2>

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

        <a href="/start?id=\${ch}">
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


// 🚀 Health check
app.get("/health", (req, res) => {
  res.send("OK");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("🚀 Server running on port", port);
});
