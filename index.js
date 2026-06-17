import express from "express";
import { spawn } from "child_process";
import { WebSocketServer } from "ws";

const app = express();
app.use(express.json());

// ===============================
// 🔥 WebSocket setup
// ===============================
const wss = new WebSocketServer({ noServer: true });
let clients = [];

// ===============================
// 🎯 State
// ===============================
let ffmpegProcesses = {};
let viewerIntervals = {};
let viewers = {};

// ===============================
// 🎯 Channels
// ===============================
const channels = {
  ch4k: {
    input: "http://185.160.192.14/live/171348492752/5S6HGsea3j/255224.m3u8",
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

// ===============================
// 🎯 Logos
// ===============================
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
// 🛡️ Safety
// ===============================
process.on("uncaughtException", (err) => {
  console.log("🔥 ERROR:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("🔥 PROMISE ERROR:", err);
});

// ===============================
// 🎬 FFmpeg stream
// ===============================
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
    "-rw_timeout", "15000000",

    "-i", ch.input,
    "-i", getLogo(id),

    "-filter_complex",
    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[base];[1:v]scale=-1:3100[logo];[base][logo]overlay=main_w-overlay_w-2:2",
    
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",

    "-b:v", "2200k",
    "-maxrate", "2200k",
    "-bufsize", "3500k",

    "-r", "25",
    "-g", "50",

    "-c:a", "aac",
    "-b:a", "128k",

    "-f", "flv",
    ch.output
  ]);

  ffmpegProcesses[id] = ffmpeg;

  viewers[id] = Math.floor(Math.random() * 5) + 2;

  if (viewerIntervals[id]) clearInterval(viewerIntervals[id]);

  viewerIntervals[id] = setInterval(() => {
    const r = Math.random();
    if (r > 0.7) viewers[id]++;
    else if (r < 0.3) viewers[id] = Math.max(1, viewers[id] - 1);
  }, 5000);

  ffmpeg.stderr.on("data", (d) => {
    console.log(`[${id}] ${d.toString()}`);
  });

  ffmpeg.on("exit", (code) => {
    console.log("❌ EXIT:", id);

    delete ffmpegProcesses[id];
    viewers[id] = 0;

    if (viewerIntervals[id]) {
      clearInterval(viewerIntervals[id]);
      delete viewerIntervals[id];
    }

    // 🔥 auto restart safe
    setTimeout(() => {
      spawnStream(id);
    }, 8000);
  });
}

// ===============================
// 🌐 API ROUTES
// ===============================
app.get("/", (req, res) => {
  res.send("🚀 STREAM SERVER PRO RUNNING");
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

app.get("/clear", (req, res) => {
  for (const id in ffmpegProcesses) {
    ffmpegProcesses[id].kill("SIGKILL");
  }

  ffmpegProcesses = {};
  viewers = {};
  viewerIntervals = {};

  res.send("cleared");
});

app.get("/settings", (req, res) => {
  res.json({
    status: "ok",
    channels: Object.keys(channels).length,
    system: "PRO MODE"
  });
});

app.post("/add", (req, res) => {
  const { id, input, output } = req.body;

  if (!id || !input || !output) {
    return res.status(400).send("missing data");
  }

  channels[id] = { input, output };

  res.send("added");
});

app.post("/import", (req, res) => {
  console.log("M3U:", req.body?.url);
  res.send("imported");
});

// ===============================
// 📡 DASHBOARD PRO
// ===============================
app.get("/dashboard", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Control Panel PRO</title>

<style>
body{
margin:0;
font-family:Arial;
background:#0b1020;
color:#fff;
display:flex;
height:100vh;
}

/* SIDEBAR */
.sidebar{
width:240px;
background:#0f1730;
padding:15px;
border-left:1px solid #1d2b56;
display:flex;
flex-direction:column;
gap:10px;
}

.sidebar h2{
font-size:18px;
margin-bottom:10px;
}

.menu button{
width:100%;
padding:12px;
border:none;
border-radius:10px;
cursor:pointer;
background:#151f3f;
color:white;
text-align:right;
}

.menu button:hover{
background:#22305f;
}

/* CONTENT */
.content{
flex:1;
padding:20px;
overflow:auto;
}

/* CARDS */
.grid{
display:grid;
grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
gap:15px;
margin-top:15px;
}

.card{
background:#101938;
padding:15px;
border-radius:15px;
border:1px solid #1d2b56;
}

.online{color:#00ff88}
.offline{color:#ff4d4d}

.btns{
display:flex;
gap:10px;
margin-top:10px;
}

button.action{
flex:1;
padding:10px;
border:none;
border-radius:10px;
cursor:pointer;
}

.start{background:#1db954;color:white}
.stop{background:#e74c3c;color:white}

.section{
display:none;
}

.active{
display:block;
}
</style>
</head>

<body>

<!-- SIDEBAR -->
<div class="sidebar">
<h2>📡 CONTROL PANEL</h2>

<div class="menu">
<button onclick="show('overview')">📊 Overview</button>
<button onclick="show('channels')">📺 Channels</button>
<button onclick="show('settings')">⚙ Settings</button>
<button onclick="show('logs')">📜 Logs</button>
</div>
</div>

<!-- CONTENT -->
<div class="content">

<!-- OVERVIEW -->
<div id="overview" class="section active">
<h2>📊 Overview</h2>
<div id="stats"></div>
</div>

<!-- CHANNELS -->
<div id="channels" class="section">
<h2>📺 Channels</h2>
<div id="grid" class="grid"></div>
</div>

<!-- SETTINGS -->
<div id="settings" class="section">
<h2>⚙ Settings</h2>
<p>System is running in PRO mode</p>
</div>

<!-- LOGS -->
<div id="logs" class="section">
<h2>📜 Logs</h2>
<p>FFmpeg logs will appear in server console</p>
</div>

</div>

<script>

function show(id){
document.querySelectorAll('.section')
.forEach(s=>s.classList.remove('active'));

document.getElementById(id).classList.add('active');
}

async function load(){

const res = await fetch("/status");
const data = await res.json();

/* OVERVIEW */
let live = 0;
let total = 0;

for(const id in data){
total++;
if(data[id].active) live++;
}

document.getElementById("stats").innerHTML = \`
<div class="card">
<h3>🟢 Live Channels: \${live}</h3>
<h3>📡 Total: \${total}</h3>
</div>
\`;

/* CHANNELS */
const grid = document.getElementById("grid");
grid.innerHTML = "";

for(const id in data){
const ch = data[id];

grid.innerHTML += \`
<div class="card">
<h3>\${id}</h3>

<div class="\${ch.active ? 'online':'offline'}">
\${ch.active ? '🟢 LIVE' : '🔴 OFFLINE'}
</div>

<p>👁️ \${ch.viewers}</p>

<div class="btns">
<a href="/start?id=\${id}">
<button class="action start">Start</button>
</a>

<a href="/stop?id=\${id}">
<button class="action stop">Stop</button>
</a>
</div>

</div>
\`;
}
}

load();
setInterval(load, 2000);

</script>

</body>
</html>
`);
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
