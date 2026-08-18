const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "closed", "dispatched"],
      default: "open",
      required: true,
    },
    opensAt: {
      type: Date,
      required: true,
    },
    closesAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

slotSchema.index({ hostelId: 1, status: 1 });
slotSchema.index({ status: 1, closesAt: 1 });

slotSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.hostelId = ret.hostelId.toString();
    ret.vendorId = ret.vendorId.toString();
    ret.opensAt = new Date(ret.opensAt).getTime();
    ret.closesAt = new Date(ret.closesAt).getTime();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Slot", slotSchema);