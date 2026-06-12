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
    input: 
    "http://185.160.192.14/live/171348492752/5S6HGsea3j/255224.m3u8",
    output: "rtmp://ssh101.bozztv.com/ssh101/max4khdr"
  },
  
  ch1: {
    input: "https://lb1.aab1.top/odai/123321/66.ts",
    output: "rtmp://rtmp.livepeer.com/live/6ce1-v2hu-38fu-awwa"
  },

  ch2: {
    input: "https://streem.rodoye.com/live/rr/max2/index.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/5716-lclm-8mhs-hd0n"
  },

  ch3: {
    input: "http://2030.buzz-4k.xyz/live/56272882873737/xh3agpq1cm/1950411.m3u8",
    output: "rtmp://ssh101.bozztv.com/ssh101/max1hd"
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


// 📡 Dashboard Modern UI
app.get("/dashboard", (req, res) => {
res.send(`
<!DOCTYPE html>
<html>

<head>

<meta charset="utf-8">

<title>Super Dashboard</title>

<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
font-family:Arial;
}

body{
background:#0b1020;
color:white;
padding:30px;
}

.top{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:30px;
}

.title{
font-size:34px;
font-weight:bold;
}

.stats{
display:flex;
gap:15px;
}

.stat{
background:#151d35;
padding:18px;
border-radius:15px;
min-width:150px;
}

.grid{
display:grid;
grid-template-columns:
repeat(auto-fill,minmax(300px,1fr));

gap:20px;
}

.card{

background:

linear-gradient(
145deg,
#141d36,
#0c1326
);

border-radius:18px;

padding:20px;

border:1px solid #222;

transition:.2s;
}

.card:hover{
transform:translateY(-3px);
}

.live{
color:#00ff88;
}

.off{
color:#ff4444;
}

.view{
color:#66ccff;
margin-top:10px;
}

.btns{
margin-top:20px;
display:flex;
gap:10px;
}

button{

border:none;

padding:12px;

border-radius:12px;

color:white;

cursor:pointer;

width:100%;

font-size:15px;

}

.start{
background:#00aa55;
}

.stop{
background:#dd3333;
}

.start:hover{
opacity:.9;
}

.stop:hover{
opacity:.9;
}

</style>

</head>

<body>

<div class="top">

<div class="title">
📡 Super Dashboard
</div>

<div class="stats">

<div class="stat">
LIVE
<br>
<span id="live">
0
</span>
</div>

<div class="stat">
VIEWERS
<br>
<span id="total">
0
</span>
</div>

</div>

</div>

<div
class="grid"
id="list">
</div>

<script>

async function load(){

const res=
await fetch("/status");

const data=
await res.json();

const box=
document.getElementById(
"list"
);

box.innerHTML="";

let live=0;

let total=0;

Object
.keys(data)
.forEach(ch=>{

const d=data[ch];

if(d.active)
live++;

total+=
d.viewers;

box.innerHTML+=\`

<div class="card">

<h2>
\${ch}
</h2>

<h3 class="\${d.active?'live':'off'}">

\${d.active
?'🟢 LIVE'
:'🔴 OFFLINE'}

</h3>

<div class="view">

👁️
\${d.viewers}

مشاهد

</div>

<div class="btns">

<a href="/start?id=\${ch}">
<button class="start">
START
</button>
</a>

<a href="/stop?id=\${ch}">
<button class="stop">
STOP
</button>
</a>

</div>

</div>

\`;

});

document
.getElementById(
"live"
)
.innerText=
live;

document
.getElementById(
"total"
)
.innerText=
total;

}

load();

setInterval(
load,
3000
);

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
