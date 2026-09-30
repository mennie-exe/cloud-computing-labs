const express = require("express");
const multer = require("multer");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const publicDir = path.join(__dirname, "public");
const uploadDir = path.join(__dirname, "uploads");

const starterItems = [
  { id: 1, name: "Secret Sauce", quantity: 4, notes: "Keep under lock and key.", createdAt: "2026-01-01T12:00:00.000Z" },
  { id: 2, name: "Pickles", quantity: 12, notes: "Extra crispy circles.", createdAt: "2026-01-02T12:00:00.000Z" },
  { id: 3, name: "Jellyfish Jelly", quantity: 7, notes: "Handle with a net.", createdAt: "2026-01-03T12:00:00.000Z" },
];

let items = [...starterItems];
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

app.get("/api/health", (_req, res) => {
  res.json({ status: "I'm Ready!", timestamp: new Date().toISOString() });
});

app.get("/api/items", (_req, res) => {
  res.json([...items].sort((a, b) => b.id - a.id));
});

app.post("/api/items", (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const quantity = Number(req.body?.quantity ?? 1);
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";

  if (!name) return res.status(400).json({ error: "Item name is required." });
  if (name.length > 80) return res.status(400).json({ error: "Item name must be 80 characters or fewer." });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
    return res.status(400).json({ error: "Quantity must be a whole number between 1 and 9999." });
  }
  if (notes.length > 240) return res.status(400).json({ error: "Note must be 240 characters or fewer." });

  const item = {
    id: Math.max(...items.map((entry) => entry.id), 0) + 1,
    name,
    quantity,
    notes,
    createdAt: new Date().toISOString(),
  };

  items.push(item);
  res.status(201).json(item);
});

app.post("/api/upload", upload.single("recipeImage"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Choose an image file first." });
  }

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

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Krabby Patty Vault is running at http://localhost:${PORT}`);
});
