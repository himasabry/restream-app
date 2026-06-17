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
    "https://genral.oxml1237.workers.dev/index.m3u8?base=https%3A%2F%2Fk-f.for-sav-ogr-403-cf.monster&id=BEIN4KHDR&key=TtOoLl5ger5gr5",
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
"[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[base];[1:v]scale=-1:3100[logo];[base][logo]overlay=main_w-overlay_w-2:2",

"-c:v", "libx264",

"-preset", "veryfast",

"-tune", "zerolatency",

"-profile:v", "high",

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

<html dir="rtl">

<head>

<meta charset="UTF-8">

<title>لوحة إعادة البث</title>

<meta name="viewport"
content="width=device-width,initial-scale=1">

<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
font-family:Arial;
}

body{

background:
linear-gradient(
180deg,
#040915,
#091325
);

color:white;

padding:18px;

}

.wrap{

max-width:1500px;

margin:auto;

}

.grid{

display:grid;

grid-template-columns:
430px 1fr;

gap:20px;

}

.panel{

background:
#0f1730;

padding:20px;

border-radius:25px;

border:1px solid #1d2b56;

}

.title{

font-size:34px;

font-weight:bold;

margin-bottom:20px;

}

.menu{

display:flex;

flex-direction:column;

gap:14px;

}

.menu button{

height:72px;

border:none;

border-radius:18px;

font-size:24px;

cursor:pointer;

color:white;

}

.clear{
background:#3b3520;
}

.settings{
background:#151f3f;
}

.import{
background:#151f3f;
}

.add{
background:#3d83ff;
}

.exit{
background:#341827;
}

.stats{

display:grid;

grid-template-columns:
1fr 1fr;

gap:20px;

margin-top:20px;

}

.card{

background:#101938;

padding:30px;

border-radius:24px;

min-height:180px;

display:flex;

justify-content:space-between;

align-items:center;

}

.big{

font-size:60px;

font-weight:bold;

}

.box{

background:#101938;

margin-top:20px;

padding:25px;

border-radius:24px;

}

.copy{

margin-top:20px;

background:#3d83ff;

padding:15px;

border:none;

border-radius:15px;

color:white;

width:100%;

font-size:22px;

cursor:pointer;

}

.channels{

margin-top:20px;

display:flex;

gap:12px;

overflow:auto;

}

.tag{

background:#121c3f;

padding:14px 22px;

border-radius:999px;

white-space:nowrap;

}

.active{

background:#3d83ff;
}

.liveGrid{

margin-top:25px;

display:grid;

grid-template-columns:
repeat(auto-fill,minmax(300px,1fr));

gap:18px;

}

.liveCard{

background:#101938;

padding:22px;

border-radius:20px;

}

.online{

color:#00ff88;
}

.offline{

color:#ff5555;
}

.btns{

display:flex;

gap:10px;

margin-top:18px;

}

a{

flex:1;

}

.action{

width:100%;

border:none;

padding:14px;

border-radius:14px;

color:white;

cursor:pointer;

}

.start{

background:#1da74f;

}

.stop{

background:#d53d3d;

}

.viewer{

margin-top:15px;

font-size:18px;

color:#6dbfff;

}

.total{

margin-top:10px;

color:#ffcc66;

}

@media(max-width:900px){

.grid{

grid-template-columns:
1fr;

}

}

</style>

</head>

<body>

<div class="wrap">

<div class="grid">

<div class="panel">

<div class="title">

📡 لوحة إعادة بث القنوات

</div>

<div class="menu">

<button class="clear">
🗑️ تفريغ الكاش والـ FFmpeg
</button>

<button class="settings">
⚙️ الإعدادات
</button>

<button class="import">
↪ استيراد M3U
</button>

<button class="add">
＋ إضافة قناة
</button>

<button class="exit">
↩ خروج
</button>

</div>

</div>


<div>

<div class="stats">

<div class="card">

<div>

القنوات النشطة حالياً

</div>

<div class="big" id="live">

0

</div>

</div>

<div class="card">

<div>

إجمالي القنوات

</div>

<div class="big">

${Object.keys(channels).length}

</div>

</div>

</div>

<div class="box">

رابط ملف M3U الكامل

<button class="copy">

نسخ الرابط

</button>

</div>

<div class="channels">

<div class="tag active">

الكل

</div>

</div>

<div
class="liveGrid"
id="list">

</div>

</div>

</div>

</div>

<script>

let totalViews={};

async function load(){

const r=
await fetch("/status");

const data=
await r.json();

const box=
document
.getElementById(
"list"
);

box.innerHTML="";

let live=0;

Object
.keys(data)
.forEach(ch=>{

const d=data[ch];

if(!totalViews[ch])
totalViews[ch]=0;

totalViews[ch]+=
d.viewers;

if(d.active)
live++;

box.innerHTML+=\`

<div class="liveCard">

<h2>
\${ch}
</h2>

<h3 class="
\${d.active
?'online'
:'offline'}
">

\${d.active
?'🟢 LIVE'
:'🔴 OFFLINE'}

</h3>

<div class="viewer">

👁️ المشاهدين الآن:
<b>

\${d.viewers}

</b>

</div>

<div class="total">

📈 إجمالي المشاهدات:
<b>

\${totalViews[ch]}

</b>

</div>

<div class="btns">

<a href="/start?id=\${ch}">
<button class="action start">

تشغيل

</button>
</a>

<a href="/stop?id=\${ch}">
<button class="action stop">

إيقاف

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
