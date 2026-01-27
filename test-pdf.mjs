import PdfPrinter from "pdfmake";

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const docDefinition = {
  content: [
    { text: "Test PDF", style: "header" },
    { text: "This is a test" },
  ],
  styles: {
    header: { fontSize: 24, bold: true },
  },
  defaultStyle: {
    font: "Helvetica",
    fontSize: 10,
  },
};

try {
  const printer = new PdfPrinter(fonts);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  
  const chunks = [];
  pdfDoc.on("data", (chunk) => chunks.push(chunk));
  pdfDoc.on("end", () => {
    const buffer = Buffer.concat(chunks);
    console.log("PDF generated successfully, size:", buffer.length);
  });
  pdfDoc.on("error", (err) => {
    console.error("PDF error:", err);
  });
  pdfDoc.end();
} catch (error) {
  console.error("Error:", error);
}
