export default async function run(page, ui) {
  // Wait for the receipt to render fully
  await page.waitForSelector(".qr-img", { timeout: 15000 });
  await page.waitForTimeout(1500); // fonts/logos settle

  // Click "Download PDF" and capture the download to a file
  const dlPromise = page.waitForEvent("download", { timeout: 30000 });
  await page.locator('button:has-text("Download PDF")').click();
  const download = await dlPromise;
  const path = "receipt_INV-2026-0001.pdf";
  await download.saveAs(path);
  return { saved: path, suggested: download.suggestedFilename() };
}
