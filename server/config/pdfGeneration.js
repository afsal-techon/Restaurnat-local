import ejs from "ejs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from 'puppeteer';
import * as chromeLauncher from 'chrome-launcher';





const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generatePDF = async (templateName, data) => {

  const installations = await chromeLauncher.Launcher.getInstallations();
const chromePath = installations[0];

if (!chromePath) {
  throw new Error("Google Chrome is not installed. Please install it to generate PDFs.");
}


  const templatePath = path.join(__dirname, "../templates", `${templateName}.ejs`);
  const html = await ejs.renderFile(templatePath, data);

const browser = await puppeteer.launch({
  headless: true,
  executablePath: chromePath,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
  });

  await browser.close();
  return pdfBuffer;
};