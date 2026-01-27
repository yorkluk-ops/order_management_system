import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const CHINESE_FONT = path.join(process.cwd(), "fonts/NotoSansTC-Regular.otf");

console.log("Font path:", CHINESE_FONT);
console.log("Font exists:", fs.existsSync(CHINESE_FONT));

const doc = new PDFDocument({ margin: 50 });
const output = fs.createWriteStream("/home/ubuntu/Downloads/test-chinese.pdf");

doc.pipe(output);

try {
  doc.registerFont("Chinese", CHINESE_FONT);
  doc.fontSize(24).font("Chinese").text("報價單", { align: "center" });
  doc.fontSize(14).text("QUOTATION", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text("客戶姓名: 測試客戶");
  doc.text("電話: 12345678");
  doc.text("地址: 香港九龍");
  doc.end();
  console.log("PDF created successfully");
} catch (error) {
  console.error("Error:", error);
}
