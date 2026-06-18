import express from "express";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

// ======================
// 🎯 STATE
// ======================
let ffmpegProcesses = {};
let viewers = {};
let viewerIntervals = {};

// ======================
// 🎯 CHANNELS
// ======================
const channels = {
  ch4k: {
    input: "http://185.160.192.14/live/171348492752/5S6HGsea3j/255224.m3u8",
    output: "rtmp://mediamtx-server-production.up.railway.app/live/test"
  },
  ch1: {
    input: "https://ranapkbd.site/RANAPK33g/TVD/play.php?id=1745020",
    output: "rtmp://rtmp.livepeer.com/live/a013-em1u-5x5q-u023"
  },
  ch2: {
    input: "https://max.pl4k.workers.dev/max24k/index.m3u8",
    output: "rtmp://rtmp.livepeer.com/live/5716-lclm-8mhs-hd0n"
  },
  ch3: {
    input: "https://man1ted.com/watch/beemax1.m3u8",
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

// ======================
// 🎬 LOGO
// ======================
function getLogo(id) {
  const logos = {
    ch4k: "logo4kh.png",
    ch1: "logo1.png",
    ch2: "logo22.png",
    ch3: "logo33.png",
    ch4: "logo44.png",
    ch5: "logo55.png",
  };

  return logos[id] || "logo.png";
}

// ======================
// 🛡️ SAFETY
// ======================
process.on("uncaughtException", (err) => {
  console.log("🔥 ERROR:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("🔥 PROMISE ERROR:", err);
});

// ======================
// 🎬 START STREAM
// ======================
function spawnStream(id) {
  if (ffmpegProcesses[id]) return;

  const ch = channels[id];
  if (!ch) return;

  console.log("▶ START:", id);

  const ffmpeg = spawn("ffmpeg", [
    "-re",

    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",

    "-i", ch.input,
    "-i", getLogo(id),

    "-filter_complex",
    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[base];[1:v]scale=-1:3000[logo];[base][logo]overlay=W-w-2:2",

    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",

    "-b:v", "2500k",
    "-maxrate", "2500k",
    "-bufsize", "4000k",

    "-r", "25",
    "-g", "50",

    "-c:a", "aac",
    "-b:a", "128k",

    "-f", "flv",
    ch.output
  ]);

  ffmpegProcesses[id] = ffmpeg;

  // 👁️ viewers fake stable
  viewers[id] = Math.floor(Math.random() * 5) + 3;

  if (viewerIntervals[id]) clearInterval(viewerIntervals[id]);

  viewerIntervals[id] = setInterval(() => {
    const r = Math.random();
    if (r > 0.6) viewers[id]++;
    else if (r < 0.3) viewers[id] = Math.max(1, viewers[id] - 1);
  }, 5000);

  ffmpeg.stderr.on("data", (d) => {
    console.log(`[${id}] ${d.toString()}`);
  });

  ffmpeg.on("exit", () => {
    console.log("❌ EXIT:", id);

    delete ffmpegProcesses[id];
    viewers[id] = 0;

    if (viewerIntervals[id]) {
      clearInterval(viewerIntervals[id]);
      delete viewerIntervals[id];
    }

    // safe restart
    setTimeout(() => {
      if (!ffmpegProcesses[id]) spawnStream(id);
    }, 8000);
  });
}

// ======================
// 🌐 ROUTES
// ======================
app.get("/", (req, res) => {
  res.send("🚀 IPTV PRO SERVER RUNNING");
});

app.get("/start", (req, res) => {
  const id = req.query.id;
  if (!channels[id]) return res.send("❌ invalid channel");

  spawnStream(id);
  res.send("started " + id);
});

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

  res.send("stopped " + id);
});

// ======================
// 📊 STATUS
// ======================
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

// ======================
// 📺 CHANNELS API
// ======================
app.get("/channels", (req, res) => {
  res.json(channels);
});

app.post("/channel", (req, res) => {
  const { id, input, output } = req.body;

  if (!id || !input || !output)
    return res.status(400).json({ ok: false });

  channels[id] = { input, output };

  res.json({ ok: true });
});

app.put("/channel/:id", (req, res) => {
  const id = req.params.id;

  if (!channels[id])
    return res.status(404).json({ ok: false });

  channels[id] = {
    ...channels[id],
    input: req.body.input ?? channels[id].input,
    output: req.body.output ?? channels[id].output
  };

  res.json({ ok: true });
});

app.delete("/channel/:id", (req, res) => {
  const id = req.params.id;

  if (ffmpegProcesses[id]) {
    ffmpegProcesses[id].kill("SIGKILL");
    delete ffmpegProcesses[id];
  }

  delete channels[id];

  res.json({ ok: true });
});

// ======================
// 🚀 SERVER START
// ======================
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("🚀 IPTV PRO RUNNING ON PORT", port);
});

// ===============================
// 📡 DASHBOARD PRO
// ===============================
app.get("/dashboard",(req,res)=>{

const html = `

<!DOCTYPE html>
<html dir="rtl">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IPTV PRO PANEL</title>

<style>

body{
margin:0;
font-family:Arial;
background:linear-gradient(135deg,#070b1a,#0b1020);
color:white;
display:flex;
min-height:100vh;
}

/* SIDE */
.side{
width:260px;
background:rgba(16,25,56,0.9);
backdrop-filter:blur(10px);
padding:20px;
border-right:1px solid #1d2b56;
}

.side h2{
margin-bottom:20px;
color:#3da9fc;
}

.side button{
width:100%;
padding:12px;
margin-bottom:10px;
border:none;
border-radius:12px;
cursor:pointer;
background:#182347;
color:white;
font-weight:bold;
transition:0.3s;
}

.side button:hover{
background:#2a3a6a;
transform:scale(1.03);
}

/* MAIN */
.main{
flex:1;
padding:20px;
overflow:auto;
}

/* GRID */
.grid{
display:grid;
grid-template-columns:repeat(auto-fill,minmax(320px,1fr));
gap:18px;
}

/* CARD */
.card{
background:linear-gradient(145deg,#141d38,#101938);
padding:18px;
border-radius:18px;
border:1px solid #26345f;
box-shadow:0 8px 20px rgba(0,0,0,0.4);
transition:0.3s;
position:relative;
overflow:hidden;
}

.card:hover{
transform:translateY(-5px);
box-shadow:0 12px 25px rgba(0,0,0,0.6);
}

.card::before{
content:"";
position:absolute;
top:0;
left:0;
width:100%;
height:3px;
background:linear-gradient(90deg,#3da9fc,#00ff99);
}

/* STATUS */
.live{
color:#00ff99;
font-weight:bold;
font-size:14px;
}

.off{
color:#ff4d4d;
font-weight:bold;
font-size:14px;
}

/* INFO */
.info{
margin-top:10px;
font-size:13px;
color:#b8c1ec;
word-break:break-all;
}

/* BUTTONS */
.btns{
display:flex;
gap:8px;
margin-top:12px;
flex-wrap:wrap;
}

button{
padding:10px;
border:none;
border-radius:10px;
cursor:pointer;
font-weight:bold;
transition:0.2s;
}

button:hover{
transform:scale(1.05);
}

.start{background:#1db954;color:white}
.stop{background:#e74c3c;color:white}
.edit{background:#3498db;color:white}
.del{background:#555;color:white}

/* INPUT FORM */
input{
width:100%;
padding:12px;
margin-bottom:10px;
border-radius:10px;
border:none;
background:#0f1733;
color:white;
outline:none;
}

input:focus{
border:1px solid #3da9fc;
}

/* TITLE */
h3{
margin:0;
color:#3da9fc;
}

hr{
border:0;
height:1px;
background:#26345f;
margin:10px 0;
}

</style>

</head>

<body>

<div class="side">

<h2>📡 IPTV PRO</h2>

<button onclick="show('channels')">📺 القنوات</button>
<button onclick="show('add')">➕ إضافة قناة</button>

</div>

<div class="main">

<div id="channels">
<div id="list" class="grid"></div>
</div>

<div id="add" style="display:none">

<h2>➕ إضافة قناة</h2>

<input id="id" placeholder="Channel ID">
<input id="input" placeholder="Input URL">
<input id="output" placeholder="RTMP Output">

<button onclick="addChannel()">➕ إضافة القناة</button>

</div>

</div>

<script>

let totalViews = {};

function show(id){
document.getElementById("channels").style.display="none";
document.getElementById("add").style.display="none";
document.getElementById(id).style.display="block";
}

async function load(){

const ch = await fetch("/channels");
const channels = await ch.json();

const st = await fetch("/status");
const status = await st.json();

const box = document.getElementById("list");
box.innerHTML="";

for(const id in channels){

if(!totalViews[id]) totalViews[id]=0;
totalViews[id] += status[id]?.viewers || 0;

box.innerHTML += \`
<div class="card">

<h3>📺 \${id}</h3>

<div class="\${status[id]?.active ? 'live' : 'off'}">
\${status[id]?.active ? '🟢 LIVE' : '🔴 OFFLINE'}
</div>

<div class="info">
👁️ الحالي: <b>\${status[id]?.viewers || 0}</b><br>
📊 الإجمالي: <b>\${totalViews[id]}</b>
</div>

<hr>

<div class="info">
<b>INPUT:</b><br>\${channels[id].input}
</div>

<div class="info">
<b>OUTPUT:</b><br>\${channels[id].output}
</div>

<div class="btns">

<button class="start" onclick="start('\${id}')">▶ تشغيل</button>
<button class="stop" onclick="stop('\${id}')">⏹ إيقاف</button>
<button class="edit" onclick="editChannel('\${id}')">✏ تعديل</button>
<button class="del" onclick="del('\${id}')">🗑 حذف</button>

</div>

</div>
\`;

}

}

async function start(id){
await fetch("/start?id="+id);
load();
}

async function stop(id){
await fetch("/stop?id="+id);
load();
}

async function addChannel(){

await fetch("/channel",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
id:id.value,
input:input.value,
output:output.value
})
});

load();
show("channels");
}

async function del(id){
await fetch("/channel/"+id,{method:"DELETE"});
load();
}

async function editChannel(id){

const r = await fetch("/channels");
const data = await r.json();

const inputVal = prompt("Input",data[id].input);
if(!inputVal) return;

const outputVal = prompt("Output",data[id].output);
if(!outputVal) return;

await fetch("/channel/"+id,{
method:"PUT",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({
input:inputVal,
output:outputVal
})
});

load();
}

load();
setInterval(load,3000);

</script>

</body>
</html>

`;

res.send(html);

});


// ===============================
// 🚀 WebSocket server
// ===============================
const server = app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 RUNNING PRO");
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws) => {
  clients.push(ws);

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
  });
});

// broadcast
function broadcast() {
  const data = {};

  for (const id in channels) {
    data[id] = {
      active: !!ffmpegProcesses[id],
      viewers: viewers[id] || 0
    };
  }

  clients.forEach(ws => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    }
  });
}

setInterval(broadcast, 2000);
