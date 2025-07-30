import mongoose from "mongoose";

const partnerDividendPayoutSchema = new mongoose.Schema({
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "Partner", required: true },

  // Period this payout corresponds to
  periodFrom: { type: Date, required: true },
  periodTo: { type: Date, required: true },

  // Snapshot values for audit/transparency
  netProfit: { type: Number, required: true },          // net profit (without VAT) for the period
  percentage: { type: Number, required: true },          // partner's fixed share %
  eligibleAmount: { type: Number, required: true },      // netProfit * percentage / 100

  // This payout
  amount: { type: Number, required: true, min: 0 },
  paymentModeId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" }, // cash/bank/UPI account
  note: { type: String },

  // Link to the accounting entry you create
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },

  status: { type: String, default: "Paid", enum: ["Paid", "Voided"] },

  createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdBy: String,
},{
    timestamps:true
});

 const devidentModel = mongoose.model("DividendPayout", partnerDividendPayoutSchema);
 export default devidentModel;
