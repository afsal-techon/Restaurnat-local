// printer-test.mjs
import printer from '@thiagoelg/node-printer';

// Set your printer name directly (you already saw it's POS-80)
const printerName = "POS-80";

// ESC/POS-style test print
const textToPrint = `
         HELETT POS
      =====================
        Test Print Receipt
      =====================

Token Number: #123

-----------------------------
Item            Qty   Price
-----------------------------
Test Item        1    100.00

-----------------------------
Total                 100.00
-----------------------------

Thank you for your visit!

\n\n\n\n
`;


// Send it to printer as RAW
printer.printDirect({
  data: textToPrint,
  printer: printerName,
  type: 'RAW',
  success(jobID) {
    console.log("✅ Successfully sent to printer. Job ID:", jobID);
  },
  error(err) {
    console.error("❌ Failed to print:", err);
  }
});
