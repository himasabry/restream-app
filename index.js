import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcesses = {};

// 👁️ عداد مشاهدين (محسن بدل fake ثابت)
let viewers = {};
let viewerIntervals = {};

// 🎯 القنوات
const channels = {
  ch4k: {
    input: "https://super.hima-sabry2015.workers.dev/ch/bmax1_1080/index.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/758d-vhe5-kbzu-802d"
  },
  
  ch1: {
    input: "http://194.60.93.157/proxy?url=http://185.191.126.127:8080/live///357643467990765/Ofgo3yz8CH/462211.ts",
    output: "rtmp://rtmp.livepeer.com/live/6ce1-v2hu-38fu-awwa"
  },

  ch2: {
    input: "https://super.hima-sabry2015.workers.dev/ch/bmax2_4k.m3u8",
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
  ch4k: "logo4k.png",
  ch1: "logo1.png",
  ch2: "logo22.png",
  ch3: "logo33.png",
  ch4: "logo44.png",
  ch5: "logo55.png",
};

function getLogo(id) {
  return logos[id] || "logo.png";
}

// 🛡️ حماية
process.on("uncaughtException", (err) => {
  console.log("🔥 Error:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("🔥 Rejection:", err);
});

// 🌐 Home
app.get("/", (req, res) => {
  res.send("🚀 Restream System Running FINAL (Improved Viewers)");
});


// ▶️ Start Stream
app.get("/start", (req, res) => {
  const id = req.query.id;

  if (!id) return res.send("❌ missing id");

  const channel = channels[id];
  if (!channel) return res.send("❌ channel not found");

  if (ffmpegProcesses[id]) {
    return res.send("⚠️ already running");
  }

  const logo = getLogo(id);

  const ffmpeg = spawn("ffmpeg", [
    "-re",
    "-fflags", "+genpts+discardcorrupt",
    "-flags", "low_delay",

    "-i", channel.input,
    "-i", logo,

    "-filter_complex",
    "[0:v]scale=1280:720,setsar=1[base];[base][1:v]overlay=W-w-5:5",

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
    channel.output
  ]);

  ffmpeg.stderr.on("data", (d) => {
    console.log(`[${id}] ${d.toString()}`);
  });

  ffmpeg.on("exit", (code) => {
    console.log(`❌ ${id} exited ${code}`);
    delete ffmpegProcesses[id];

    // 🧹 تنظيف العدّاد
    viewers[id] = 0;

    if (viewerIntervals[id]) {
      clearInterval(viewerIntervals[id]);
      delete viewerIntervals[id];
    }
  });

  ffmpegProcesses[id] = ffmpeg;

  // 👁️ init viewers
  viewers[id] = Math.floor(Math.random() * 10) + 3;

  // 🔥 حركة مشاهدة واقعية
  if (viewerIntervals[id]) clearInterval(viewerIntervals[id]);

  viewerIntervals[id] = setInterval(() => {
    if (!viewers[id]) return;

    let change = Math.floor(Math.random() * 3) - 1; // -1 0 +1
    viewers[id] = Math.max(1, viewers[id] + change);

  }, 4000);

  res.send(`✅ Channel ${id} started`);
});


// 🛑 Stop Stream
app.get("/stop", (req, res) => {
  const id = req.query.id;

  if (ffmpegProcesses[id]) {
    ffmpegProcesses[id].kill("SIGKILL");
    delete ffmpegProcesses[id];
  }

  viewers[id] = 0;

  if (viewerIntervals[id]) {
    clearInterval(viewerIntervals[id]);
    delete viewerIntervals[id];
  }

  res.send(`🛑 Channel ${id} stopped`);
});


// 📊 Status
app.get("/status", (req, res) => {
  const result = {};

  for (const id in channels) {
    result[id] = {
      active: !!ffmpegProcesses[id],
      viewers: viewers[id] || 0
    };
  }

  res.json(result);
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

<h2>📡 Live Dashboard (Improved Viewers)</h2>

<div id="list"></div>

<script>

async function load() {
  const res = await fetch('/status');
  const data = await res.json();

  const box = document.getElementById('list');
  box.innerHTML = '';

  Object.keys(data).forEach(ch => {
    const d = data[ch];

    box.innerHTML += "<div class='card'>" +
      "<h3>" + ch + " - " + (d.active ? '🟢 LIVE' : '🔴 OFFLINE') + "</h3>" +
      "<p>👁️ Viewers: " + d.viewers + "</p>" +
      "<a href='/start?id=" + ch + "'><button style='background:green;color:white;'>Start</button></a>" +
      "<a href='/stop?id=" + ch + "'><button style='background:red;color:white;'>Stop</button></a>" +
      "</div>";
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
