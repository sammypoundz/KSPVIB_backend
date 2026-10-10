require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// MongoDB connection
// ---------------------------------------------------------------------------
const PDF_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://KSPVIB_User:KSPVIB_Pswrd@cluster0.di9abps.mongodb.net/KSPVIB?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = process.env.MONGODB_DB || "KSPVIB";

let db = null; // set when connected; null → in-memory fallback
const memoryInvoices = {}; // fallback store if Mongo is unreachable

// One-time fix-up: stamp the demo invoices with the correct school, category
// and proprietor details (older records were seeded without these fields).
const DEMO_DATA = {
  school: "HAMISU SIDI KABO SCHOOL",
  address: "GWARZO ROAD",
  lga: "Ungogo",
  state: "Kano State",
  grade: "Grade C",
  session: "2026/2027",
  term: "First Term",
  category: "Private (Grade C)",
  proprietor: "ALI AUWAL",
  phone: "08062821735",
  email: "aliahmad@gmail.com",
};

async function applyDemoDataFix() {
  await db
    .collection("invoices")
    .updateMany(
      { invoiceNumber: { $in: ["INV-2026-0001", "INV-2026-0004"] } },
      { $set: DEMO_DATA },
    );
}

async function connectDb() {
  try {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    await client.connect();
    await client.db(DB_NAME).command({ ping: 1 });
    db = client.db(DB_NAME);
    await db
      .collection("invoices")
      .createIndex({ invoiceNumber: 1 }, { unique: true });
    await ensureDefaultAdmin();
    await applyDemoDataFix();
    // seed demo invoices if the collection is empty
    const count = await db.collection("invoices").countDocuments();
    if (count === 0) {
      await db.collection("invoices").insertMany([
        {
          invoiceNumber: "INV-2026-0001",
          school: "HAMISU SIDI KABO SCHOOL",
          address: "GWARZO ROAD",
          lga: "Ungogo",
          state: "Kano State",
          grade: "Grade C",
          term: "First Term",
          category: "Private (Grade C)",
          paymentType: "Renewal",
          description: "Renewal fee",
          amount: 100,
          issued: "2026-09-15",
          status: "PAID",
          paidDate: "2026-09-15",
          receiptNumber: "RCP-2026-0001",
          proprietor: "ALI AUWAL",
          phone: "08062821735",
          email: "aliahmad@gmail.com",
        },
        {
          invoiceNumber: "INV-2026-0004",
          school: "HAMISU SIDI KABO SCHOOL",
          address: "GWARZO ROAD",
          lga: "Ungogo",
          state: "Kano State",
          grade: "Grade C",
          term: "First Term",
          category: "Private (Grade C)",
          paymentType: "Registration",
          description: "Registration fee",
          amount: 150,
          issued: "2026-09-16",
          status: "UNPAID",
          paidDate: null,
          receiptNumber: null,
          proprietor: "ALI AUWAL",
          phone: "08062821735",
          email: "aliahmad@gmail.com",
        },
      ]);
    }
    console.log(`✓ Connected to MongoDB → db "${DB_NAME}"`);
  } catch (err) {
    db = null;
    console.error(
      "✗ MongoDB connection failed — using in-memory fallback:",
      err.message,
    );
  }
}

// ---------------------------------------------------------------------------
// Data access layer — Mongo when available, in-memory otherwise
// ---------------------------------------------------------------------------
const DESCRIPTIONS = {
  "Tuition Fees": "Tuition Fees",
  Registration: "Registration Fee",
  Renewal: "Renewal Fee",
  "Examination Fee": "Examination Fee",
  Accreditation: "Accreditation Fee",
  Fees: "Fees",
  Tax: "Tax",
  Other: "Other Fee",
};

// Title Case: capitalize the first letter of each word (keeps rest as typed)
const titleCase = (s) =>
  String(s || "").replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

const clean = (inv) =>
  inv && {
    invoiceNumber: inv.invoiceNumber,
    school: titleCase(inv.school),
    lga: inv.lga || "—",
    // Kano State is permanent — all records in this project are Kano records
    state: inv.state || "Kano State",
    grade: inv.grade || "—",
    session: inv.session || "—",
    term: inv.term || "—",
    paymentType: inv.paymentType,
    description: inv.description,
    amount: inv.amount,
    issued: inv.issued,
    status: inv.status,
    paidDate: inv.paidDate,
    proprietor: inv.proprietor,
    category: inv.category || "—",
    phone: inv.phone || "—",
    email: inv.email || "—",
    address: inv.address || "—",
  };

// Absolute origin used for QR codes / verification links so that generated
// documents point at the production verification page, never a dev URL.
function docOrigin(req) {
  return (
    PDF_BASE_URL ||
    `${req.protocol}://${req.get("host") || `localhost:${PORT}`}`
  );
}

const normRef = (ref) => String(ref || "").trim().toUpperCase();

async function findInvoice(ref) {
  const r = normRef(ref);
  if (db) return db.collection("invoices").findOne({ invoiceNumber: r });
  return memoryInvoices[r] || null;
}

async function allInvoices() {
  if (db)
    return db
      .collection("invoices")
      .find()
      .sort({ invoiceNumber: 1 })
      .toArray();
  return Object.values(memoryInvoices);
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  let max = 0;
  const docs = db
    ? await db
        .collection("invoices")
        .find({ invoiceNumber: new RegExp(`^INV-${year}-`) })
        .toArray()
    : Object.keys(memoryInvoices).map((k) => ({ invoiceNumber: k }));
  for (const d of docs) {
    const m = d.invoiceNumber.match(new RegExp(`^INV-${year}-(\\d+)$`));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `INV-${year}-${String(max + 1).padStart(4, "0")}`;
}

async function nextReceiptNumber(inv) {
  if (inv.receiptNumber) return inv.receiptNumber;
  if (db) {
    const count = await db
      .collection("invoices")
      .countDocuments({ receiptNumber: { $ne: null } });
    return `RCP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
  }
  return `RCP-${new Date().getFullYear()}-${String(
    Object.keys(memoryInvoices).length,
  ).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Auth — JWT + admin users stored in MongoDB ("admin_users" collection)
// ---------------------------------------------------------------------------
const JWT_SECRET =
  process.env.JWT_SECRET || "kspvib-dev-secret-change-me-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";

// Default admin, seeded into the DB on first run:
//   email: admin@kspvib.gov.ng / password: admin123
async function ensureDefaultAdmin() {
  const email = "admin@kspvib.gov.ng";
  const users = db.collection("admin_users");
  const existing = await users.findOne({ email });
  if (!existing) {
    await users.insertOne({
      email,
      name: "KSPVIB Admin",
      role: "admin",
      passwordHash: await bcrypt.hash("admin123", 10),
      createdAt: new Date(),
    });
    console.log(`✓ Seeded default admin → ${email} / admin123`);
  }
}

function signToken(user) {
  return jwt.sign(
    { sub: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

// Middleware — verifies "Authorization: Bearer <token>"
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Not authenticated." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Session expired. Please sign in again." });
  }
}

app.use(express.json());

// POST /api/auth/login — exchange credentials for a JWT
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!db)
      return res.status(503).json({ ok: false, error: "Database unavailable." });
    const user = await db
      .collection("admin_users")
      .findOne({ email: String(email || "").trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash)))
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    res.json({ ok: true, token: signToken(user), user: { email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Login failed." });
  }
});

// GET /api/auth/me — validate a token, return the current admin
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: { email: req.user.sub, name: req.user.name, role: req.user.role } });
});

// POST /api/auth/logout — stateless JWT: client just discards the token
app.post("/api/auth/logout", (req, res) => {
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

// GET /api/invoices — dashboard list + stats (admin only)
app.get("/api/invoices", requireAuth, async (req, res) => {
  try {
    const list = (await allInvoices()).map(clean);
    // optional pagination: ?page=1&limit=10 (limit <= 100, page >= 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const totalItems = list.length;
    const totalPages = limit ? Math.max(Math.ceil(totalItems / limit), 1) : 1;
    const safePage = Math.min(page, totalPages);
    const invoices = limit
      ? list.slice((safePage - 1) * limit, safePage * limit)
      : list;
    res.json({
      ok: true,
      invoices,
      pagination: limit
        ? { page: safePage, limit, totalItems, totalPages }
        : null,
      stats: {
        total: list.length,
        paid: list.filter((i) => i.status === "PAID").length,
        pending: list.filter((i) => i.status !== "PAID").length,
        totalPaidAmount: list
          .filter((i) => i.status === "PAID")
          .reduce((s, i) => s + i.amount, 0),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to list invoices." });
  }
});

// POST /api/invoices — create a new invoice (admin only)
app.post("/api/invoices", requireAuth, async (req, res) => {
  try {
    const {
      school,
      proprietor,
      category,
      paymentType,
      amount,
      lga,
      grade,
      session,
      terms,
      term,
      phone,
      email,
      address,
    } = req.body || {};
    if (!school || !String(school).trim())
      return res.status(400).json({ ok: false, error: "Received From is required." });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0)
      return res.status(400).json({ ok: false, error: "A valid amount is required." });

    const invoiceNumber = await nextInvoiceNumber();
    const descriptions = DESCRIPTIONS;
    // category = school type (Private / Voluntary); paymentType drives the
    // line-item description. Kept in paymentType for backwards compatibility.
    const schoolCategory =
      category ||
      (paymentType === "Private" || paymentType === "Community-Based"
        ? paymentType
        : "Private");
    const payType = paymentType && DESCRIPTIONS[paymentType] ? paymentType : "Other";
    const inv = {
      invoiceNumber,
      school: String(school).trim(),
      lga: lga ? String(lga).trim() : "—",
      grade: grade ? String(grade).trim() : "—",
      session: session ? String(session).trim() : "—",
      // accept an array of selected terms (checkboxes); fall back to a
      // single "term" string for older clients
      term: Array.isArray(terms)
        ? terms.map((t) => String(t).trim()).filter(Boolean).join(", ")
        : term
        ? String(term).trim()
        : "—",
      category: schoolCategory,
      paymentType: payType,
      description: descriptions[payType] || "Other Fee",
      amount: amt,
      issued: new Date().toISOString().slice(0, 10),
      status: "UNPAID",
      paidDate: null,
      receiptNumber: null,
      proprietor: proprietor ? String(proprietor).trim() : "—",
      phone: phone ? String(phone).trim() : "—",
      email: email ? String(email).trim() : "—",
      address: address ? String(address).trim() : "—",
    };
    if (db) {
      await db.collection("invoices").insertOne(inv);
    } else {
      memoryInvoices[invoiceNumber] = inv;
    }
    res.status(201).json({ ok: true, invoice: clean(inv) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to create invoice." });
  }
});

// POST /api/invoices/:ref/pay — mark an invoice as paid (admin only)
app.post("/api/invoices/:ref/pay", requireAuth, async (req, res) => {
  try {
    const inv = await findInvoice(req.params.ref);
    if (!inv)
      return res.status(404).json({ ok: false, error: "Invoice not found." });
    if (inv.status !== "PAID") {
      const updates = {
        status: "PAID",
        paidDate: new Date().toISOString().slice(0, 10),
        receiptNumber:
          inv.receiptNumber || (await nextReceiptNumber(inv)),
      };
      Object.assign(inv, updates);
      if (db)
        await db.collection("invoices").updateOne(
          { invoiceNumber: inv.invoiceNumber },
          { $set: updates },
        );
    }
    res.json({ ok: true, invoice: clean(inv) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Failed to mark invoice as paid." });
  }
});

// GET /api/verify/:ref — public verification endpoint
app.get("/api/verify/:ref", async (req, res) => {
  try {
    const inv = await findInvoice(req.params.ref);
    if (!inv) {
      return res.status(404).json({
        ok: false,
        error: `Invoice "${req.params.ref}" was not found. Please check the invoice number and try again.`,
      });
    }
    const sanitized = clean(inv);
    const origin = docOrigin(req);
    res.json({
      ok: true,
      invoice: sanitized,
      receiptAvailable: inv.status === "PAID",
      receiptUrl:
        inv.status === "PAID" ? `/api/receipt/${inv.invoiceNumber}` : null,
      verifyUrl: `${origin}/verify?inv=${encodeURIComponent(inv.invoiceNumber)}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Verification failed." });
  }
});

// GET /api/receipt/:ref — full receipt data (only for paid invoices)
app.get("/api/receipt/:ref", async (req, res) => {
  const inv = await findInvoice(req.params.ref);
  if (!inv)
    return res.status(404).json({ ok: false, error: "Invoice not found." });
  if (inv.status !== "PAID") {
    return res.status(403).json({
      ok: false,
      error:
        "Payment has not been confirmed. Receipt is unavailable until this invoice is recorded as paid.",
    });
  }
  res.json({
    ok: true,
    receipt: {
      invoiceNumber: inv.invoiceNumber,
      receiptNumber: inv.receiptNumber,
      school: inv.school,
      lga: inv.lga || "—",
      // Kano State is permanent — all records in this project are Kano records
      state: inv.state || "Kano State",
      address: inv.address || "—",
      category: inv.category || inv.paymentType,
      session: inv.session || "—",
      paymentType: inv.paymentType,
      proprietor: inv.proprietor,
      description: inv.description,
      amount: inv.amount,
      paidDate: inv.paidDate,
      phone: inv.phone || "—",
    },
    verifyUrl: `${docOrigin(req)}/verify?inv=${encodeURIComponent(inv.invoiceNumber)}`,
  });
});

// ---------------------------------------------------------------------------
// Server-side PDF generation — guarantees the PDF contains ONLY the document
// (no browser headers/footers, URLs, dates or page titles). Uses headless
// Chromium's native PDF engine on the exact same A4 print stylesheet the
// browser print dialog uses, so Print and PDF always match the on-screen
// preview. Works identically on localhost and in production (Render etc.).
// ---------------------------------------------------------------------------
const puppeteer = require("puppeteer");

let pdfBrowser = null;
async function getPdfBrowser() {
  if (!pdfBrowser) {
    // Resolve the Chromium path. In recent Puppeteer versions
    // executablePath() returns a Promise, so always await it (awaiting a
    // plain string is a no-op). Falls back to system Chrome/Edge when the
    // bundled Chromium cannot launch (e.g. corrupted cache / ICU data).
    let exe = process.env.PUPPETEER_EXECUTABLE_PATH || null;
    if (!exe) {
      exe = await Promise.resolve(puppeteer.executablePath()).catch(() => null);
    }
    const fallbacks = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    pdfBrowser = null;
    for (const candidate of [exe, ...fallbacks].filter(Boolean)) {
      try {
        pdfBrowser = await puppeteer.launch({
          args: ["--no-sandbox"],
          executablePath: candidate,
        });
        break;
      } catch (err) {
        console.error(`PDF browser launch failed for ${candidate}: ${err.message}`);
      }
    }
    if (!pdfBrowser) throw new Error("No usable browser for PDF generation.");
  }
  return pdfBrowser;
}

async function renderDocPdf(req, kind, ref) {
  const origin = docOrigin(req);
  const target = `${origin}/${kind}?inv=${encodeURIComponent(ref)}`;
  const browser = await getPdfBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(target, { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluateHandle("document.fonts.ready");
    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // honours @page { size: A4 } from the stylesheet
      displayHeaderFooter: false, // no header/footer — ever
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });
    return Buffer.from(pdfBuffer); // ensure binary, never string/JSON
  } finally {
    await page.close();
  }
}

app.get("/api/invoice/:ref/pdf", async (req, res) => {
  try {
    const ref = normRef(req.params.ref);
    const inv = await findInvoice(ref);
    if (!inv) return res.status(404).json({ ok: false, error: "Invoice not found." });
    const pdf = await renderDocPdf(req, "invoice", ref);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${ref}.pdf"`,
    });
    res.send(pdf);
  } catch (err) {
    console.error("Invoice PDF failed:", err.message);
    res.status(500).json({ ok: false, error: "Could not generate the invoice PDF." });
  }
});

app.get("/api/receipt/:ref/pdf", async (req, res) => {
  try {
    const ref = normRef(req.params.ref);
    const inv = await findInvoice(ref);
    if (!inv) return res.status(404).json({ ok: false, error: "Receipt not found." });
    if (inv.status !== "PAID")
      return res.status(403).json({
        ok: false,
        error: "Payment has not been confirmed. Receipt PDF is unavailable until this invoice is recorded as paid.",
      });
    const pdf = await renderDocPdf(req, "receipt", ref);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Receipt-${ref}.pdf"`,
    });
    res.send(pdf);
  } catch (err) {
    console.error("Receipt PDF failed:", err.message);
    res.status(500).json({ ok: false, error: "Could not generate the receipt PDF." });
  }
});

// ---------------------------------------------------------------------------
// Static frontend — production serves the built Vite client (client/dist)
// ---------------------------------------------------------------------------
const clientDist = path.join(__dirname, "client", "dist");

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: /verify, /receipt, etc. → client entry (except /api)
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  // Fallback: serve the legacy static prototype if the client hasn't been built
  app.use(express.static(path.join(__dirname)));
  app.get(["/verify", "/verify/:ref"], (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });
  app.get(["/invoice", "/invoice/:ref"], (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });
  console.log("⚠ client/dist not found — serving legacy prototype. Run: npm run client:build");
}

connectDb().then(() => {
  const server = app.listen(PORT, () => {
  console.log(`KSPVIB verification server running → http://localhost:${PORT}`);
  console.log(`  API:  GET /api/invoices | POST /api/invoices | GET /api/verify/:ref | GET /api/receipt/:ref | GET /api/invoice/:ref/pdf | GET /api/receipt/:ref/pdf`);
});

server.on("error", err => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Another instance of this server is probably running.`);
    console.error(`Use a different port:  PORT=3001 node server.js  (or stop the other instance).`);
    process.exit(1);
  }
  throw err;
});
});
