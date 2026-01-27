import { jsPDF } from "jspdf";
import fs from "fs";

const doc = new jsPDF();

doc.setFontSize(24);
doc.setFont("helvetica", "bold");
doc.text("QUOTATION", 105, 20, { align: "center" });

doc.setFontSize(12);
doc.text("Order Management System", 20, 35);
doc.text("Hong Kong", 20, 41);

doc.text("Quotation No: 26EGB0001", 20, 55);
doc.text("Date: 01/26/2026", 20, 61);

doc.line(20, 70, 190, 70);

doc.text("Customer Information", 20, 80);
doc.setFont("helvetica", "normal");
doc.text("Name: LUK", 20, 88);
doc.text("Phone: 62225121", 20, 94);

doc.setFontSize(14);
doc.setFont("helvetica", "bold");
doc.text("Total Amount: HK\$4,660", 190, 150, { align: "right" });

const buffer = Buffer.from(doc.output("arraybuffer"));
fs.writeFileSync("/home/ubuntu/Downloads/test-jspdf2.pdf", buffer);
console.log("PDF created successfully:", buffer.length, "bytes");
