import express from "express";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

let ffmpegProcesses = {};
let viewerIntervals = {};
let viewers = {};

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

// ===============================
// 🧠 حماية
// ===============================
process.on("uncaughtException", (err) => console.log("🔥", err));
process.on("unhandledRejection", (err) => console.log("🔥", err));

// ===============================
// 🎬 تشغيل قناة
// ===============================
function spawnStream(id) {
  if (ffmpegProcesses[id]) return;

  const ch = channels[id];
  if (!ch) return;

  const ffmpeg = spawn("ffmpeg", [
    "-re",

    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",

    "-i", ch.input,
    "-i", getLogo(id),

    "-filter_complex",
    "[0:v]scale=1920:1080[base];[1:v]scale=300:-1[logo];[base][logo]overlay=W-w-10:10",

    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",

    "-c:a", "aac",
    "-b:v", "4500k",
    "-b:a", "128k",

    "-f", "flv",
    ch.output
  ]);

  ffmpegProcesses[id] = ffmpeg;

  viewers[id] = Math.floor(Math.random() * 10) + 3;

  if (viewerIntervals[id]) clearInterval(viewerIntervals[id]);

  viewerIntervals[id] = setInterval(() => {
    let r = Math.random();
    if (r > 0.7) viewers[id]++;
    else if (r < 0.3) viewers[id] = Math.max(1, viewers[id] - 1);
  }, 4000);

  ffmpeg.on("exit", () => {
    delete ffmpegProcesses[id];
    viewers[id] = 0;
    clearInterval(viewerIntervals[id]);

    setTimeout(() => spawnStream(id), 3000);
  });
}

// ===============================
// 🌐 API
// ===============================
app.get("/", (req, res) => {
  res.send("🚀 Server Running");
});

app.get("/start", (req, res) => {
  const id = req.query.id;
  spawnStream(id);
  res.send("started");
});

app.get("/stop", (req, res) => {
  const id = req.query.id;

  if (ffmpegProcesses[id]) {
    ffmpegProcesses[id].kill("SIGKILL");
    delete ffmpegProcesses[id];
  }

  viewers[id] = 0;
  clearInterval(viewerIntervals[id]);

  res.send("stopped");
});

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
// 🧹 زر تفريغ الكل
// ===============================
app.get("/clear", (req, res) => {
  for (const id in ffmpegProcesses) {
    ffmpegProcesses[id].kill("SIGKILL");
  }

  ffmpegProcesses = {};
  viewers = {};
  viewerIntervals = {};

  res.send("cleared");
});

// ===============================
// ⚙️ إعدادات
// ===============================
app.get("/settings", (req, res) => {
  res.json({
    channels: Object.keys(channels).length,
    ffmpeg: "running system"
  });
});

// ===============================
// ➕ إضافة قناة
// ===============================
app.post("/add", (req, res) => {
  const { id, input, output } = req.body;

  channels[id] = { input, output };

  res.send("added");
});

// ===============================
// 📥 M3U (تجريبي)
// ===============================
app.post("/import", (req, res) => {
  const { url } = req.body;

  console.log("M3U:", url);

  res.send("imported");
});

// ===============================
// 📡 Dashboard (نفس شكل UI)
// ===============================
app.get("/dashboard", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<title>لوحة التحكم</title>

<style>
body{
background:linear-gradient(180deg,#040915,#091325);
color:white;
padding:18px;
font-family:Arial;
}

.wrap{max-width:1400px;margin:auto;}
.grid{display:grid;grid-template-columns:430px 1fr;gap:20px;}

.panel{background:#0f1730;padding:20px;border-radius:25px;}

.menu button{
display:block;
width:100%;
margin:10px 0;
padding:18px;
border:none;
border-radius:12px;
font-size:18px;
cursor:pointer;
color:white;
}

.clear{background:#3b3520;}
.settings{background:#151f3f;}
.import{background:#151f3f;}
.add{background:#3d83ff;}
.exit{background:#341827;}

.card{background:#101938;padding:20px;border-radius:15px;margin:10px;}

.online{color:#00ff88;}
.offline{color:#ff5555;}

button.action{padding:10px;border:none;border-radius:8px;cursor:pointer;}
.start{background:#1da74f;color:white;}
.stop{background:#d53d3d;color:white;}
</style>
</head>

<body>

<div class="wrap">
<div class="grid">

<div class="panel">
<h2>📡 لوحة التحكم</h2>

<button class="clear" onclick="clearAll()">🗑️ تفريغ الكل</button>
<button class="settings" onclick="settings()">⚙️ الإعدادات</button>
<button class="import" onclick="importM3U()">↪ M3U</button>
<button class="add" onclick="add()">＋ إضافة</button>
<button class="exit" onclick="exitApp()">↩ خروج</button>
</div>

<div id="list"></div>

</div>
</div>

<script>

async function load(){
const r = await fetch("/status");
const data = await r.json();

const box = document.getElementById("list");
box.innerHTML = "";

for(const ch in data){
const d = data[ch];

box.innerHTML += \`
<div class="card">
<h3>\${ch}</h3>

<div class="\${d.active ? 'online':'offline'}">
\${d.active ? 'LIVE':'OFFLINE'}
</div>

<p>👁️ \${d.viewers}</p>

<a href="/start?id=\${ch}"><button class="action start">تشغيل</button></a>
<a href="/stop?id=\${ch}"><button class="action stop">إيقاف</button></a>
</div>
\`;
}
}

load();
setInterval(load,3000);

// ===== actions =====
async function clearAll(){
await fetch("/clear");
load();
}

async function settings(){
const r = await fetch("/settings");
alert(JSON.stringify(await r.json()));
}

async function importM3U(){
const url = prompt("M3U URL");
await fetch("/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
alert("done");
}

async function add(){
const id = prompt("id");
const input = prompt("input");
const output = prompt("output");

await fetch("/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,input,output})});
load();
}

function exitApp(){
alert("لا يمكن إغلاق السيرفر من المتصفح");
}

</script>

</body>
</html>
`);
});

// ===============================
app.listen(3000, () => console.log("running"));
