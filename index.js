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
    input: "http://185.160.192.14/live/171348492752/5S6HGsea3j/255224.",
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
    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[base];[1:v]scale=-1:3100[logo];[base][logo]overlay=W-w-2:2",
    
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

// ======================
// CHANNELS API
// ======================

// قائمة القنوات
app.get("/channels",(req,res)=>{
res.json(channels);
});

// إضافة قناة
app.post("/channel",(req,res)=>{

const {id,input,output}=req.body;

if(!id||!input||!output){
return res.status(400).json({
ok:false
});
}

channels[id]={
input,
output
};

res.json({
ok:true
});

});

// تعديل قناة
app.put("/channel/:id",(req,res)=>{

const id=req.params.id;

if(!channels[id]){
return res.status(404).json({
ok:false
});
}

channels[id]={

...channels[id],

input:
req.body.input
??
channels[id].input,

output:
req.body.output
??
channels[id].output

};

res.json({
ok:true
});

});

// حذف قناة
app.delete("/channel/:id",(req,res)=>{

const id=req.params.id;

if(ffmpegProcesses[id]){
ffmpegProcesses[id].kill("SIGKILL");
delete ffmpegProcesses[id];
}

delete channels[id];

res.json({
ok:true
});

});

// ===============================
// 📡 DASHBOARD PRO
// ===============================
app.get("/dashboard",(req,res)=>{

res.send(`

<!DOCTYPE html>

<html dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>
Control Panel
</title>

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

display:flex;

min-height:100vh;

}

.side{

width:260px;

background:#101938;

padding:20px;

}

.side h2{

margin-bottom:20px;

}

.side button{

width:100%;

padding:14px;

margin-bottom:10px;

background:#182347;

border:none;

border-radius:12px;

color:white;

cursor:pointer;

}

.main{

flex:1;

padding:20px;

overflow:auto;

}

.grid{

display:grid;

grid-template-columns:
repeat(
auto-fill,
minmax(
330px,
1fr
));

gap:15px;

}

.card{

background:#151f3f;

padding:18px;

border-radius:15px;

}

.live{

color:#00ff88;

}

.off{

color:#ff5555;

}

.actions{

display:flex;

gap:10px;

margin-top:15px;

}

.actions button{

padding:10px;

border:none;

border-radius:10px;

cursor:pointer;

}

input{

width:100%;

padding:12px;

margin-bottom:10px;

}

</style>

</head>

<body>

<div class="side">

<h2>

📡 لوحة التحكم

</h2>

<button
onclick="show('channels')">

📺 القنوات

</button>

<button
onclick="show('add')">

➕ إضافة

</button>

</div>

<div class="main">

<div
id="channels">

<div
class="grid"
id="list">

</div>

</div>

<div
id="add"

style="
display:none
">

<input
id="newid"
placeholder="ID">

<input
id="newinput"
placeholder="Input">

<input
id="newoutput"
placeholder="Output">

<button
onclick="save()">

إضافة

</button>

</div>

</div>

<script>

let totalViews={};

function show(id){

document
.getElementById(
"channels"
)

style.display=
"none";

document
.getElementById(
"add"
)

style.display=
"none";

document
.getElementById(
id
)

style.display=
"block";

}

async function load(){

const ch=
await fetch(
"/channels"
);

const channels=
await ch.json();

const st=
await fetch(
"/status"
);

const status=
await st.json();

const box=
document
.getElementById(
"list"
);

box.innerHTML="";

for(
const id
in channels
){

if(
!totalViews[id]
)

totalViews[id]=0;

totalViews[id]+=
status[id]
?.viewers
||
0;

box.innerHTML+=\`

<div class="card">

<h2>

📺 \${id}

</h2>

<div class="
\${

status[id]
?.active

?

'live'

:

'off'

}

">

\${

status[id]
?.active

?

'🟢 شغالة'

:

'🔴 متوقفة'

}

</div>

<br>

👁️ المشاهدين الآن:

<b>

\${

status[id]
?.viewers

||

0

}

</b>

<br><br>

📈 إجمالي المشاهدات:

<b>

\${

totalViews[id]

}

</b>

<br><br>

<div>

<b>

Input

</b>

<br>

\${

channels[id]
.input

}

</div>

<br>

<div>

<b>

Output

</b>

<br>

\${

channels[id]
.output

}

</div>

<div
class="actions">

<button
onclick="start('\${id}')">

▶

</button>

<button
onclick="stop('\${id}')">

⏹

</button>

<button
onclick="editChannel('\${id}')">

✏

</button>

<button
onclick="del('\${id}')">

🗑

</button>

</div>

</div>

\`;

}

}

function start(id){

location=
"/start?id="+id;

}

function stop(id){

location=
"/stop?id="+id;

}

async function save(){

await fetch(

"/channel",

{

method:
"POST",

headers:{

"Content-Type":

"application/json"

},

body:

JSON.stringify({

id:
newid.value,

input:
newinput.value,

output:
newoutput.value

})

}

);

load();

show(
"channels"
);

}

async function editChannel(id){

const r=
await fetch(
"/channels"
);

const data=
await r.json();

const input=
prompt(

"Input",

data[id]
.input

);

if(
input===null
)
return;

const output=
prompt(

"Output",

data[id]
.output

);

if(
output===null
)
return;

await fetch(

"/channel/"+id,

{

method:
"PUT",

headers:{

"Content-Type":
"application/json"

},

body:

JSON.stringify({

input,

output

})

}

);

load();

}

async function del(id){

if(
!confirm(
"حذف؟"
)
)

return;

await fetch(

"/channel/"+id,

{

method:
"DELETE"

}

);

load();

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
