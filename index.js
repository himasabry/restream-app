import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcesses = {};
let viewerIntervals = {};
let viewers = {};
let totalViews = {};

// 🎯 القنوات
const channels = {
  ch4k: {
    input: "https://genral.oxml1237.workers.dev/index.m3u8?base=https%3A%2F%2Fk-f.for-sav-ogr-403-cf.monster&id=BEIN4KHDR&key=TtOoLl5ger5gr5",
    output: "rtmp://rtmp.livepeer.com/live/a4be-dmef-x7d9-4kme"
  },
  ch1: {
    input: "https://max.pl4k.workers.dev/max14k/index.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/6ce1-v2hu-38fu-awwa"
  },
  ch2: {
    input: "https://max.pl4k.workers.dev/max24k/index.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/5716-lclm-8mhs-hd0n"
  },
  ch3: {
    input: "http://2030.buzz-4k.xyz/live/56272882873737/xh3agpq1cm/1950411.m3u8",
    output: "rtmp://ssh101.bozztv.com/ssh101/max1hd"
  },
  ch4: {
    input: "http://185.160.192.14/live/171348492752/5S6HGsea3j/255226.m3u8",
    output: "rtmp://live.restream.io/live/re_1727644_event8e0ea00bf3544ac2b68fffd99b87b0f2"
  },
  ch5: {
    input: "http://185.160.192.14/live/171348492752/5S6HGsea3j/255225.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/a4be-dmef-x7d9-4kme"
  }
};

const logos = {
  ch4k: "logo4kh.png",
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
process.on("uncaughtException", (err) => console.log("🔥 Error:", err));
process.on("unhandledRejection", (err) => console.log("🔥 Rejection:", err));

// ===============================
// 🔥 تشغيل الستريم (أساسي)
// ===============================
function spawnStream(id) {
  const channel = channels[id];
  if (!channel) return;

  if (ffmpegProcesses[id]) return;

  const logo = getLogo(id);

  const ffmpeg = spawn("ffmpeg", [
    "-re",

    // 🔥 حل مشكلة التقطيع
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-rw_timeout", "15000000",

    "-fflags", "+genpts+discardcorrupt",
    "-flags", "low_delay",

    "-i", channel.input,
    "-i", logo,

    "-filter_complex",
    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[base];[1:v]scale=-1:300[logo];[base][logo]overlay=W-w-10:10",

    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",

    "-b:v", "4500k",
    "-maxrate", "5000k",
    "-bufsize", "10000k",

    "-r", "25",
    "-g", "50",

    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "48000",

    "-f", "flv",
    channel.output
  ]);

  ffmpegProcesses[id] = ffmpeg;

  // 👁️ viewers init
  viewers[id] = Math.floor(Math.random() * 10) + 3;

  if (viewerIntervals[id]) clearInterval(viewerIntervals[id]);

  viewerIntervals[id] = setInterval(() => {
    if (!viewers[id]) return;

    let r = Math.random();
    if (r > 0.7) viewers[id]++;
    else if (r < 0.3) viewers[id] = Math.max(1, viewers[id] - 1);

  }, 4000);

  ffmpeg.stderr.on("data", (d) => {
    console.log(`[${id}] ${d.toString()}`);
  });

  ffmpeg.on("exit", (code) => {
    console.log(`❌ ${id} exited ${code}`);

    delete ffmpegProcesses[id];
    viewers[id] = 0;

    if (viewerIntervals[id]) {
      clearInterval(viewerIntervals[id]);
      delete viewerIntervals[id];
    }

    // 🔥 Auto restart
    setTimeout(() => {
      console.log(`🔁 restarting ${id}`);
      spawnStream(id);
    }, 3000);
  });
}

// ===============================
// 🌐 Routes
// ===============================

app.get("/", (req, res) => {
  res.send("🚀 Restream System Running FINAL FIXED");
});

// ▶️ Start
app.get("/start", (req, res) => {
  const id = req.query.id;

  if (!id) return res.send("❌ missing id");
  if (!channels[id]) return res.send("❌ channel not found");

  spawnStream(id);

  res.send(`✅ Channel ${id} started`);
});

// 🛑 Stop
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

// 📊 Status API
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

// ===============================
// 📡 Dashboard
// ===============================
app.get("/dashboard", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<title>Dashboard</title>

<style>
body{background:#050b18;color:#fff;font-family:Arial;padding:20px}
.card{background:#101938;padding:20px;margin:10px;border-radius:12px}
.online{color:#00ff88}
.offline{color:#ff5555}
button{padding:10px;border:none;border-radius:8px;cursor:pointer}
.start{background:#1da74f;color:#fff}
.stop{background:#d53d3d;color:#fff}
</style>
</head>

<body>

<h1>📡 Dashboard</h1>

<div id="list"></div>

<script>
let total = {};

async function load(){
  const r = await fetch("/status");
  const data = await r.json();

  const box = document.getElementById("list");
  box.innerHTML = "";

  for(const ch in data){
    const d = data[ch];

    if(!total[ch]) total[ch] = 0;
    total[ch] = Math.max(total[ch], d.viewers);

    box.innerHTML += \`
      <div class="card">
        <h2>\${ch}</h2>
        <div class="\${d.active ? 'online':'offline'}">
          \${d.active ? '🟢 LIVE' : '🔴 OFFLINE'}
        </div>

        <p>👁️ الآن: \${d.viewers}</p>
        <p>📈 أعلى مشاهدة: \${total[ch]}</p>

        <a href="/start?id=\${ch}"><button class="start">تشغيل</button></a>
        <a href="/stop?id=\${ch}"><button class="stop">إيقاف</button></a>
      </div>
    \`;
  }
}

load();
setInterval(load, 3000);
</script>

</body>
</html>
  `);
});

// ===============================
app.get("/health", (req, res) => res.send("OK"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("🚀 Server running on port", port);
});
