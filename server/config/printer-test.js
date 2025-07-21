// printer-test.js

import { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine  } from "node-thermal-printer";

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON, // or STAR if your printer is different
  interface: "tcp://192.168.1.87:9100", // your printer's IP
  characterSet: "SLOVENIA",
  removeSpecialCharacters: false,
  lineCharacter: "-",
  options: {
    timeout: 5000,
  },
});

async function testPrint() {
  const isConnected = await printer.isPrinterConnected();
  console.log("Printer connected:", isConnected);

  printer.alignCenter();
  printer.bold(true);
  printer.setTextDoubleWidth();
  printer.println("HELLO FROM RONGTA!");
  printer.setTextNormal();
  
  printer.drawLine();
  printer.println("✓ Node.js + ESModule + TCP Print OK");
  
  printer.cut();

  try {
    await printer.execute();
    console.log("✅ Print executed successfully!");
  } catch (err) {
    console.error("❌ Print failed:", err);
  }
}

testPrint();
