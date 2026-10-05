require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { MongoClient } = require("mongodb");

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
    // seed demo invoices if the collection is empty
    const count = await db.collection("invoices").countDocuments();
    if (count === 0) {
      await db.collection("invoices").insertMany([
        {
          invoiceNumber: "INV-2026-0001",
          school: "PRIVATE SCHOOL TEST II",
          lga: "Nassarawa",
          grade: "Grade B",
          term: "First Term",
          paymentType: "Renewal",
          description: "Renewal fee",
          amount: 100,
          issued: "2026-09-15",
          status: "PAID",
          paidDate: "2026-09-15",
          receiptNumber: "RCP-2026-0001",
          proprietor: "—",
        },
        {
          invoiceNumber: "INV-2026-0004",
          school: "PRIVATE SCHOOL TEST II",
          lga: "Nassarawa",
          grade: "Grade B",
          term: "First Term",
          paymentType: "Registration",
          description: "Registration fee",
          amount: 150,
          issued: "2026-09-16",
          status: "UNPAID",
          paidDate: null,
          receiptNumber: null,
          proprietor: "—",
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
  "Tax Fee": "Tax Fee",
  Other: "Other Fee",
};

const clean = (inv) =>
  inv && {
    invoiceNumber: inv.invoiceNumber,
    school: inv.school,
    lga: inv.lga || "—",
    grade: inv.grade || "—",
    term: inv.term || "—",
    paymentType: inv.paymentType,
    description: inv.description,
    amount: inv.amount,
    issued: inv.issued,
    status: inv.status,
    paidDate: inv.paidDate,
    proprietor: inv.proprietor,
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
// API
// ---------------------------------------------------------------------------
app.use(express.json());

// GET /api/invoices — dashboard list + stats
app.get("/api/invoices", async (req, res) => {
  try {
    const list = (await allInvoices()).map(clean);
    res.json({
      ok: true,
      invoices: list,
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

// POST /api/invoices — create a new invoice
app.post("/api/invoices", async (req, res) => {
  try {
    const {
      school,
      proprietor,
      paymentType,
      amount,
      lga,
      grade,
      term,
    } = req.body || {};
    if (!school || !String(school).trim())
      return res.status(400).json({ ok: false, error: "Received From is required." });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0)
      return res.status(400).json({ ok: false, error: "A valid amount is required." });

    const invoiceNumber = await nextInvoiceNumber();
    const descriptions = DESCRIPTIONS;
    const category = paymentType || "Other";
    const inv = {
      invoiceNumber,
      school: String(school).trim().toUpperCase(),
      lga: lga ? String(lga).trim() : "—",
      grade: grade ? String(grade).trim() : "—",
      term: term ? String(term).trim() : "—",
      paymentType: category,
      description: descriptions[category] || "Other Fee",
      amount: amt,
      issued: new Date().toISOString().slice(0, 10),
      status: "UNPAID",
      paidDate: null,
      receiptNumber: null,
      proprietor: proprietor ? String(proprietor).trim() : "—",
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

// POST /api/invoices/:ref/pay — mark an invoice as paid (demo payment workflow)
app.post("/api/invoices/:ref/pay", async (req, res) => {
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
      state: inv.state,
      category: inv.paymentType,
      proprietor: inv.proprietor,
      description: inv.description,
      amount: inv.amount,
      paidDate: inv.paidDate,
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
    pdfBrowser = await puppeteer.launch({
      args: ["--no-sandbox"],
      // Prefer an explicitly configured Chrome (PUPPETEER_EXECUTABLE_PATH),
      // then the system Chrome/Edge. On Render/Linux the bundled Chromium is
      // used automatically when none of these are set.
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        puppeteer.executablePath() ||
        undefined,
    });
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
