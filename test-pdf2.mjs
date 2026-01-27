import pkg from "pdfmake";
const PdfPrinter = pkg.default || pkg;

console.log("PdfPrinter type:", typeof PdfPrinter);
console.log("PdfPrinter:", PdfPrinter);
