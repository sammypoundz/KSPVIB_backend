KSPVIB Invoice Verification Prototype

This is a FRONTEND prototype based on the screenshots supplied in the conversation.

Files:
- index.html: verification page
- receipt.html: paid receipt page
- styles.css: verification-page styling
- app.js: sample invoice data and verification behavior

Demo:
- INV-2026-0001 = PAID, receipt available
- INV-2026-0004 = UNPAID, receipt disabled

Important:
This prototype uses mock data. A production system must connect the verification page to a secure backend/database and payment-status source. The QR code should carry only a secure invoice verification URL/reference, not the payment status itself.

When the invoice screenshot is supplied later, the invoice template can be adjusted to match it.
