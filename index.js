import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcesses = {};
let viewerIntervals = {};
let viewers = {};

// ===============================
// 🎯 القنوات
// ===============================
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
// 🛡️ حماية السيرفر
// ===============================
process.on("uncaughtException", (err) => {
  console.log("🔥 ERROR:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("🔥 PROMISE ERROR:", err);
});

// ===============================
// 🎬 تشغيل القناة (FIXED)
// ===============================
function spawnStream(id) {
  if (ffmpegProcesses[id]) return;

  const ch = channels[id];
  if (!ch) return;

  console.log("▶ starting:", id);

  const ffmpeg = spawn("ffmpeg", [
    "-re",

    // 🔥 Stability
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-rw_timeout", "15000000",

    "-i", ch.input,
    "-i", getLogo(id),

    // 🔥 FIXED overlay (no huge scale)
    "-filter_complex",
    "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[base];[1:v]scale=220:-1[logo];[base][logo]overlay=W-w-15:15",

    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",

    // 🔥 Lower bitrate to avoid Railway crash
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
    if (!viewers[id]) return;

    const r = Math.random();
    if (r > 0.7) viewers[id]++;
    else if (r < 0.3) viewers[id] = Math.max(1, viewers[id] - 1);
  }, 5000);

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

    // 🔥 prevent crash loop
    setTimeout(() => {
      if (!ffmpegProcesses[id]) {
        spawnStream(id);
      }
    }, 8000);
  });
}

// ===============================
// 🌐 API
// ===============================
app.get("/", (req, res) => {
  res.send("🚀 Streaming Server Running Stable FIXED");
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

// ===============================
// 🧹 clear system
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
// ⚙️ settings
// ===============================
app.get("/settings", (req, res) => {
  res.json({
    status: "ok",
    channels: Object.keys(channels).length,
    system: "stable-mode"
  });
});

// ===============================
// ➕ add channel
// ===============================
app.use(express.json());

app.post("/add", (req, res) => {
  const { id, input, output } = req.body;

  if (!id || !input || !output) {
    return res.status(400).send("missing data");
  }

  channels[id] = { input, output };

  res.send("added");
});

// ===============================
// 📥 M3U (basic)
// ===============================
app.post("/import", (req, res) => {
  console.log("M3U:", req.body?.url);
  res.send("imported");
});

// ===============================
// 🚀 start server (IMPORTANT)
// ===============================
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log("🚀 Server running on port", port);
});
