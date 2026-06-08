import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcesses = {};

// 🎯 دالة اختيار اللوجو حسب القناة
function getLogo(id) {
  const logos = {
    ch1: "logo.png",
    ch2: "logo2.png",
    ch3: "logo3.png",
    ch4: "logo4.png",
    ch5: "logo5.png",
  };

  return logos[id] || "logo.png"; // fallback
}

app.get("/", (req, res) => {
  res.send("🚀 Multi Stream with Fixed Logos Running");
});

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

  console.log(`▶️ Starting ${id} with logo: ${logo}`);

  ffmpegProcesses[id] = spawn("ffmpeg", [
    "-re",
    "-i", input,

    // 🎯 اللوجو حسب القناة
    "-i", logo,

    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",

    "-c:a", "aac",

    "-filter_complex", "overlay=W-w-20:20",

    "-f", "flv",
    output
  ]);

  ffmpegProcesses[id].stderr.on("data", data => {
    console.log(`[${id}] ${data}`);
  });

  ffmpegProcesses[id].on("exit", code => {
    console.log(`❌ ${id} exited:`, code);
    delete ffmpegProcesses[id];
  });

  res.send(`✅ Channel ${id} started with ${logo}`);
});

app.get("/stop", (req, res) => {
  const id = req.query.id;

  if (ffmpegProcesses[id]) {
    ffmpegProcesses[id].kill("SIGKILL");
    delete ffmpegProcesses[id];
    return res.send(`🛑 ${id} stopped`);
  }

  res.send("❌ القناة مش شغالة");
});

app.get("/status", (req, res) => {
  res.json({
    active: Object.keys(ffmpegProcesses)
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running"));
