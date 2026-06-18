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
    input: "http://185.160.192.14/live/171348492752/5S6HGsea3j/255224",
    output: "rtmp://ssh101.bozztv.com:1935/ssh101/max4khdr"
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
    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[base];[1:v]scale=-1:300[logo];[base][logo]overlay=W-w-10:10",

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
<title>Streaming Panel</title>

<style>

body{
margin:0;
font-family:Arial;
background:#0b1020;
color:white;
display:flex;
min-height:100vh;
}

/* SIDE */
.side{
width:240px;
background:#101938;
padding:20px;
}

.side h2{
margin-bottom:20px;
}

.side button{
width:100%;
padding:12px;
margin-bottom:10px;
border:none;
border-radius:10px;
cursor:pointer;
background:#182347;
color:white;
font-weight:bold;
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
grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
gap:15px;
}

/* CARD */
.card{
background:#151f3f;
padding:15px;
border-radius:15px;
border:1px solid #1d2b56;
}

.live{color:#00ff88;font-weight:bold}
.off{color:#ff5555;font-weight:bold}

.btns{
display:flex;
gap:8px;
margin-top:12px;
flex-wrap:wrap;
}

button{
padding:10px;
border:none;
border-radius:8px;
cursor:pointer;
font-weight:bold;
}

.start{background:#1db954;color:white}
.stop{background:#e74c3c;color:white}
.edit{background:#3498db;color:white}
.del{background:#444;color:white}

input{
width:100%;
padding:10px;
margin-bottom:10px;
border-radius:8px;
border:none;
}

</style>

</head>

<body>

<div class="side">

<h2>📡 PANEL</h2>

<button onclick="show('channels')">📺 القنوات</button>
<button onclick="show('add')">➕ إضافة قناة</button>

</div>

<div class="main">

<div id="channels">
<div id="list" class="grid"></div>
</div>

<div id="add" style="display:none">

<h2>➕ إضافة قناة</h2>

<input id="id" placeholder="ID">
<input id="input" placeholder="Input URL">
<input id="output" placeholder="Output RTMP">

<button onclick="addChannel()">إضافة</button>

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

<div>
\${status[id]?.active
? '<span class="live">🟢 LIVE</span>'
: '<span class="off">🔴 OFF</span>'}
</div>

<br>

👁️ المشاهدين: <b>\${status[id]?.viewers || 0}</b><br>
📈 الإجمالي: <b>\${totalViews[id]}</b>

<hr>

<b>INPUT</b><br>
\${channels[id].input}

<br><br>

<b>OUTPUT</b><br>
\${channels[id].output}

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
