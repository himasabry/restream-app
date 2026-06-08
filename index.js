import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcesses = {};

// 🔥 Playback IDs
const playbackIds = {
  ch1: "6ce1k8qh6zhk8ian",
  ch2: "5716cx0dcob4oe5v",
  ch3: "",
  ch4: "",
  ch5: ""
};

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

// 👁️ Livepeer Viewers
async function getLivepeerViewers(channelId) {
  try {
    const playbackId = playbackIds[channelId];

    if (!playbackId) return 0;

    const response = await fetch(
      `https://livepeer.studio/api/data/views/now?playbackId=${playbackId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LIVEPEER_API_KEY}`
        }
      }
    );

    const data = await response.json();

    if (!Array.isArray(data)) return 0;

    return data.reduce(
      (total, item) => total + (item.viewCount || 0),
      0
    );

  } catch (err) {
    console.error(err);
    return 0;
  }
}

app.get("/", (req, res) => {
  res.send("🚀 Restream System Running");
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

  ffmpegProcesses[id] = spawn("ffmpeg", [
    "-fflags", "+genpts+discardcorrupt",
    "-flags", "low_delay",
    "-rw_timeout", "15000000",
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",

    "-re",
    "-i", input,

    "-loop", "1",
    "-i", logo,

    "-filter_complex", "overlay=W-w-20:20",

    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-crf", "28",

    "-c:a", "aac",

    "-f", "flv",
    output
  ]);

  ffmpegProcesses[id].stderr.on("data", data => {
    console.log(`[${id}] ${data}`);
  });

  ffmpegProcesses[id].on("exit", code => {
    console.log(`❌ ${id} exited: ${code}`);
    delete ffmpegProcesses[id];
  });

  res.send(`✅ Channel ${id} started`);
});

// 🛑 إيقاف قناة
app.get("/stop", (req, res) => {
  const id = req.query.id;

  if (!id) {
    return res.send("❌ missing id");
  }

  if (ffmpegProcesses[id]) {
    ffmpegProcesses[id].kill("SIGKILL");
    delete ffmpegProcesses[id];
  }

  res.send(`🛑 Channel ${id} stopped`);
});

// 📊 Status API
app.get("/status", async (req, res) => {

  const liveViewers = {};

  for (const channelId of Object.keys(playbackIds)) {
    liveViewers[channelId] =
      await getLivepeerViewers(channelId);
  }

  res.json({
    activeChannels: Object.keys(ffmpegProcesses),
    viewers: liveViewers
  });

});

// 🎛️ Dashboard
app.get("/dashboard", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Live Dashboard</title>
<style>
body{
background:#111;
color:white;
font-family:Arial;
padding:20px;
}
.card{
background:#222;
padding:15px;
margin-bottom:10px;
border-radius:10px;
}
.live{
color:#00ff66;
}
.offline{
color:red;
}
</style>
</head>
<body>

<h2>📡 Live Dashboard</h2>

<div id="channels"></div>

<script>

async function load() {

  const response = await fetch('/status');
  const data = await response.json();

  const channels =
    ['ch1','ch2','ch3','ch4','ch5'];

  let html = '';

  channels.forEach(ch => {

    const active =
      data.activeChannels.includes(ch);

    const viewers =
      data.viewers?.[ch] || 0;

    html += \`
      <div class="card">

        <h3>
          \${ch}
          -
          <span class="\${active ? 'live':'offline'}">
            \${active ? '🟢 LIVE' : '🔴 OFFLINE'}
          </span>
        </h3>

        <p>👁️ Viewers: \${viewers}</p>

      </div>
    \`;

  });

  document.getElementById('channels').innerHTML = html;
}

load();

setInterval(load,3000);

</script>

</body>
</html>
`);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("🚀 Server running on port", port);
});
