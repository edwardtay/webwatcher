import express from "express";

const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

app.get("/", (_req, res) => {
  res
    .status(200)
    .send("WebWatcher / VeriSense agent server is running");
});

// simple placeholder for your phishing A2A later
app.post("/check", (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: "missing url" });
  }

  return res.json({
    verdict: "unknown",
    details: `Server is up. Would analyze url: ${url}`
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`[INFO] http server listening on port ${port}`);
});
