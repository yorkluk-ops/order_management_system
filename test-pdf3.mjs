import pdfMake from "pdfmake";

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
  // 使用 pdfmake 的 createPdf 方法
  const pdfDoc = pdfMake.createPdf(docDefinition, null, fonts);
  pdfDoc.getBuffer((buffer) => {
    console.log("PDF generated successfully, size:", buffer.length);
  });
} catch (error) {
  console.error("Error:", error);
}
