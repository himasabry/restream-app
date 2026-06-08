import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcesses = {};

// 🎯 لوجو لكل قناة
function getLogo(id) {
  const logos = {
    ch1: "logo.png",
    ch2: "logo2.png",
    ch3: "logo3.png",
    ch4: "logo4.png",
    ch5: "logo5.png",
  };

  return logos[id] || "logo.png";
}

app.get("/", (req, res) => {
  res.send("🚀 Restream Running");
});

// ▶️ تشغيل قناة
app.get("/start", (req, res) => {
  const id = req.query.id;
  const input = req.query.input;
  const output = req.query.output;

  if (!id || !input || !output) {
    return res.send("❌ لازم id + input + output");
  }

  if (ffmpegProcesses[id]) {
    return res.send("⚠️ القناة شغالة بالفعل");
  }

  const logo = getLogo(id);

  const ffmpeg = spawn("ffmpeg", [
    // 🔥 استقرار
    "-re",
    "-fflags", "+genpts+discardcorrupt",
    "-flags", "low_delay",

    "-i", input,
    "-i", logo,

    // 🔥 مهم جدًا (بدون map عشان ما نكسرش البث)
    "-filter_complex",
    "[0:v]scale=1280:720[bg];[bg][1:v]overlay=W-w-20:20",

    // 🎥 فيديو
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-b:v", "1500k",
    "-maxrate", "1500k",
    "-bufsize", "3000k",
    "-r", "25",

    // 🔊 صوت
    "-c:a", "aac",
    "-b:a", "96k",

    "-f", "flv",
    output
  ]);

  ffmpeg.stderr.on("data", data => {
    console.log(`[${id}] ${data.toString()}`);
  });

  ffmpeg.on("exit", code => {
    console.log(`❌ ${id} exited with code ${code}`);
    delete ffmpegProcesses[id];
  });

  ffmpegProcesses[id] = ffmpeg;

  res.send(`✅ Channel ${id} started`);
});

// 🛑 إيقاف قناة
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
    activeChannels: Object.keys(ffmpegProcesses)
  });
});

// 🎛️ Dashboard
app.get("/dashboard", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Dashboard</title>
<style>
body{background:#111;color:#fff;font-family:Arial;padding:20px}
.card{background:#222;padding:15px;margin:10px 0;border-radius:10px}
button{padding:8px 12px;margin:5px}
</style>
</head>
<body>

<h2>📡 Live Dashboard</h2>
<div id="list"></div>

<script>
async function load(){
  const res = await fetch('/status');
  const data = await res.json();

  const channels = ['ch1','ch2','ch3','ch4','ch5'];
  const box = document.getElementById('list');
  box.innerHTML = '';

  channels.forEach(ch=>{
    const active = data.activeChannels.includes(ch);

    box.innerHTML += `
      <div class="card">
        <h3>${ch} - ${active ? '🟢 LIVE' : '🔴 OFFLINE'}</h3>

        <a href="/start?id=${ch}&input=INPUT_URL&output=RTMP_URL">
          <button style="background:green;color:white;">Start</button>
        </a>

        <a href="/stop?id=${ch}">
          <button style="background:red;color:white;">Stop</button>
        </a>
      </div>
    `;
  });
}

load();
setInterval(load,3000);
</script>

</body>
</html>
  `);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🚀 Server running on", port));
