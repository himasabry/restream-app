import express from "express";
import { spawn } from "child_process";

const app = express();

let ffmpegProcesses = {};

// 🎯 اختيار اللوجو لكل قناة
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

app.get("/", (req, res) => {
  res.send("🚀 Stable Multi Stream Running");
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

  console.log(`▶️ Starting ${id} with logo: ${logo}`);

  ffmpegProcesses[id] = spawn("ffmpeg", [
    // 🔥 استقرار قوي للمصدر
    "-fflags", "+genpts+discardcorrupt",
    "-flags", "low_delay",
    "-rw_timeout", "15000000",

    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",

    "-re",
    "-i", input,

    // 🎯 اللوجو (ثابت)
    "-loop", "1",
    "-i", logo,

    // 🔥 تحويل الفيديو (حل HEVC + تقليل الضغط)
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-crf", "28",

    "-c:a", "aac",

    // 🎯 دمج اللوجو
    "-filter_complex", "overlay=W-w-20:20",

    "-f", "flv",
    output
  ]);

  ffmpegProcesses[id].stderr.on("data", data => {
    console.log(`[${id}] ${data.toString()}`);
  });

  ffmpegProcesses[id].on("exit", code => {
    console.log(`❌ ${id} exited with code:`, code);
    delete ffmpegProcesses[id];
  });

  ffmpegProcesses[id].on("close", () => {
    console.log(`❌ ${id} closed`);
    delete ffmpegProcesses[id];
  });

  res.send(`✅ Channel ${id} started`);
});

// 🛑 إيقاف قناة
app.get("/stop", (req, res) => {
  const id = req.query.id;

  if (!id || !ffmpegProcesses[id]) {
    return res.send("❌ القناة غير شغالة");
  }

  ffmpegProcesses[id].kill("SIGKILL");
  delete ffmpegProcesses[id];

  res.send(`🛑 Channel ${id} stopped`);
});

// 📊 حالة القنوات
app.get("/status", (req, res) => {
  res.json({
    activeChannels: Object.keys(ffmpegProcesses)
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
