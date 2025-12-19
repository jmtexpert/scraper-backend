import express from "express";
import crypto from "crypto";

export class BloomFilter {
  size: number;
  bitArray: Uint8Array;
  hashCount: number;

  constructor(items: number, bitsPerItem = 10) {
    this.size = items * bitsPerItem;
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
    this.hashCount = Math.round((this.size / items) * Math.log(2));
  }

  private hash(value: string, seed: number) {
    const hex = crypto
      .createHash("md5")
      .update(seed.toString() + value)
      .digest("hex")
      .substring(0, 8);
    const intVal = parseInt(hex, 16);
    return intVal % this.size;
  }

  add(value: string) {
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(value, i);
      this.bitArray[Math.floor(index / 8)] |= 1 << (index % 8);
    }
  }

  probablyHas(value: string) {
    for (let i = 0; i < this.hashCount; i++) {
      const index = this.hash(value, i);
      const bit = this.bitArray[Math.floor(index / 8)] & (1 << (index % 8));
      if (!bit) return false;
    }
    return true;
  }
}

// init filter for 100k usernames
export const filter = new BloomFilter(100000);

// add existing usernames
filter.add("ali123");
filter.add("sana_khan");
filter.add("faizan007");

const app = express();
app.use(express.json());

app.post("/check-username", (req, res) => {
  const username = req.body.username;

  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username required" });
  }

  const exists = filter.probablyHas(username);
  return res.json({
    username,
    status: exists ? "possibly_taken" : "available"
  });
});

app.listen(3000, () => {
  console.log("Bloom username API running on port 3000");
});