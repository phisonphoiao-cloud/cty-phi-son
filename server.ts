import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("invoice.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    total_quantity INTEGER DEFAULT 0,
    total_price INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers (id)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    shirt_type TEXT,
    color TEXT,
    sizes TEXT,
    quantity INTEGER DEFAULT 0,
    unit_price INTEGER DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  
  // Search customers
  app.get("/api/customers", (req, res) => {
    const q = req.query.q as string;
    if (!q) {
      const customers = db.prepare("SELECT * FROM customers ORDER BY name ASC").all();
      return res.json(customers);
    }
    const customers = db.prepare("SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ?").all(`%${q}%`, `%${q}%`);
    res.json(customers);
  });

  // Get invoices with customer info
  app.get("/api/invoices", (req, res) => {
    const invoices = db.prepare(`
      SELECT i.id, i.customer_id as customerId, i.date, 
             i.total_quantity as totalQuantity, i.total_price as totalPrice, 
             c.name as customerName, c.phone as customerPhone 
      FROM invoices i 
      JOIN customers c ON i.customer_id = c.id 
      ORDER BY i.date DESC, i.created_at DESC
    `).all();
    res.json(invoices);
  });

  // Get single invoice with items
  app.get("/api/invoices/:id", (req, res) => {
    const invoice = db.prepare(`
      SELECT i.id, i.customer_id as customerId, i.date, 
             i.total_quantity as totalQuantity, i.total_price as totalPrice,
             c.name as customerName, c.phone as customerPhone, c.address as customerAddress
      FROM invoices i 
      JOIN customers c ON i.customer_id = c.id 
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const items = db.prepare(`
      SELECT id, shirt_type as shirtType, color, sizes, quantity, unit_price as unitPrice 
      FROM invoice_items 
      WHERE invoice_id = ?
    `).all(req.params.id);
    res.json({ ...invoice, items });
  });

  // Save invoice (create or update)
  app.post("/api/invoices", (req, res) => {
    const { id, customerName, phone, address, date, items } = req.body;
    const invoiceId = id || Math.random().toString(36).substr(2, 9);
    
    // 1. Find or create customer
    let customer = db.prepare("SELECT id FROM customers WHERE phone = ?").get(phone);
    if (!customer && phone) {
        // Try by name if phone is empty? Usually phone is better unique key.
        // For this app, let's try phone first, then name if phone is empty.
    }
    
    if (!customer) {
      const customerId = Math.random().toString(36).substr(2, 9);
      db.prepare("INSERT INTO customers (id, name, phone, address) VALUES (?, ?, ?, ?)").run(customerId, customerName, phone, address);
      customer = { id: customerId };
    } else {
      // Update customer info if it exists
      db.prepare("UPDATE customers SET name = ?, address = ? WHERE id = ?").run(customerName, address, customer.id);
    }

    const totalQuantity = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
    const totalPrice = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.unitPrice) || 0), 0);

    // 2. Insert/Replace invoice
    db.prepare(`
      INSERT OR REPLACE INTO invoices (id, customer_id, date, total_quantity, total_price) 
      VALUES (?, ?, ?, ?, ?)
    `).run(invoiceId, customer.id, date, totalQuantity, totalPrice);

    // 3. Handle items (delete old ones if updating)
    db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(invoiceId);
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, shirt_type, color, sizes, quantity, unit_price) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        item.id || Math.random().toString(36).substr(2, 9),
        invoiceId,
        item.shirtType,
        item.color,
        item.sizes,
        item.quantity,
        item.unitPrice
      );
    }

    res.json({ id: invoiceId, success: true });
  });

  // Delete invoice
  app.delete("/api/invoices/:id", (req, res) => {
    db.prepare("DELETE FROM invoices WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Stats
  app.get("/api/stats/customers", (req, res) => {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT c.name, c.phone, SUM(i.total_quantity) as totalQuantity, SUM(i.total_price) as totalPrice
      FROM customers c
      JOIN invoices i ON c.id = i.customer_id
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += " WHERE i.date BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }

    query += " GROUP BY c.id ORDER BY totalPrice DESC";
    
    const stats = db.prepare(query).all(...params);
    res.json(stats);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
