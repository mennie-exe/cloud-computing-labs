const express = require("express");
const multer = require("multer");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("redis");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(__dirname, "uploads");

const starterItems = [
  { id: 1, name: "Secret Sauce", quantity: 4, notes: "Keep under lock and key.", createdAt: "2026-01-01T12:00:00.000Z" },
  { id: 2, name: "Pickles", quantity: 12, notes: "Extra crispy circles.", createdAt: "2026-01-02T12:00:00.000Z" },
  { id: 3, name: "Jellyfish Jelly", quantity: 7, notes: "Handle with a net.", createdAt: "2026-01-03T12:00:00.000Z" },
];

const redis = createClient({ url: REDIS_URL });
redis.on("error", (error) => console.error("Redis error:", error.message));

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase() || ".bin";
      cb(null, `${crypto.randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use("/uploads", express.static(uploadDir));

async function initializeIngredients() {
  const claimedInitialization = await redis.set("ingredients:initialized", "1", { NX: true });
  if (claimedInitialization === "OK") {
    const transaction = redis.multi();
    for (const item of starterItems) transaction.rPush("ingredients", JSON.stringify(item));
    transaction.set("ingredients:nextId", String(Math.max(...starterItems.map((item) => item.id))));
    await transaction.exec();
    console.log("Seeded starter ingredients in Redis.");
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    await redis.ping();
    res.json({ status: "I'm Ready!", redis: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "Redis unavailable" });
  }
});

app.get("/api/items", async (_req, res) => {
  try {
    const storedItems = await redis.lRange("ingredients", 0, -1);
    const items = storedItems.map((item) => JSON.parse(item));
    res.json(items.sort((a, b) => b.id - a.id));
  } catch (error) {
    console.error("Could not read ingredients:", error);
    res.status(503).json({ error: "Could not load ingredients from Redis." });
  }
});

app.post("/api/items", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const quantity = Number(req.body?.quantity ?? 1);
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

  if (!name) return res.status(400).json({ error: "Item name is required." });
  if (name.length > 80) return res.status(400).json({ error: "Item name must be 80 characters or fewer." });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    return res.status(400).json({ error: "Quantity must be a whole number between 1 and 9999." });
  }
  if (notes.length > 240) return res.status(400).json({ error: "Note must be 240 characters or fewer." });

  try {
    const id = await redis.incr("ingredients:nextId");
    const item = { id, name, quantity, notes, createdAt: new Date().toISOString() };
    await redis.lPush("ingredients", JSON.stringify(item));
    res.status(201).json(item);
  } catch (error) {
    console.error("Could not save ingredient:", error);
    res.status(503).json({ error: "Could not save ingredient to Redis." });
  }
});

app.get("/api/uploads", (_req, res) => {
  const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg"]);
  fs.readdir(uploadDir, { withFileTypes: true }, (error, entries) => {
    if (error) return res.status(500).json({ error: "Could not read uploaded images." });
    const files = entries
      .filter((entry) => entry.isFile() && allowedExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => ({ name: entry.name, url: `/uploads/${encodeURIComponent(entry.name)}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(files);
  });
});

app.post("/api/upload", upload.single("recipeImage"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an image file first." });
  res.status(201).json({
    message: "Recipe image stored locally!",
    file: {
      originalName: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      contentType: req.file.mimetype,
    },
  });
});

app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

async function start() {
  // await redis.connect();
  // await initializeIngredients();
  app.listen(PORT, () => console.log(`Krabby Patty Vault is running on port ${PORT}`));
}

start().catch((error) => {
  console.error("Could not start server:", error);
  process.exit(1);
});