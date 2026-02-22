// server.js
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// SQLite Database
const db = new sqlite3.Database("./chat.db");
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) return res.status(400).json({ error: "Mesaj boş" });

  // Kullanıcı mesajını kaydet
  db.run("INSERT INTO messages (role, content) VALUES (?, ?)", ["user", userMessage]);

  // Son 10 mesajı al
  db.all("SELECT role, content FROM messages ORDER BY id DESC LIMIT 10", async (err, rows) => {
    if (err) return res.status(500).json({ error: "DB hata" });

    const messages = rows.reverse();
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages
      });
      const aiReply = completion.choices[0].message.content;

      // AI cevabını kaydet
      db.run("INSERT INTO messages (role, content) VALUES (?, ?)", ["assistant", aiReply]);

      res.json({ reply: aiReply });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "AI hata" });
    }
  });
});

// Sohbet geçmişi
app.get("/history", (req, res) => {
  db.all("SELECT * FROM messages ORDER BY id ASC", (err, rows) => {
    if (err) return res.status(500).json({ error: "DB hata" });
    res.json(rows);
  });
});

// Sohbeti sil
app.delete("/history", (req, res) => {
  db.run("DELETE FROM messages", (err) => {
    if (err) return res.status(500).json({ error: "Silme hata" });
    res.json({ message: "Sohbet temizlendi" });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));
