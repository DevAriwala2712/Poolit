const mongoose = require("mongoose");

const restockLogSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

restockLogSchema.index({ vendorId: 1, at: -1 });

restockLogSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.vendorId = ret.vendorId.toString();
    ret.menuItemId = ret.menuItemId.toString();
    ret.at = new Date(ret.at).getTime();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("RestockLog", restockLogSchema);