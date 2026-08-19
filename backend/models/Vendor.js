const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hostel",
      required: true,
      unique: true, // 1 vendor per hostel
    },
    // Minutes the store needs to pack a pooled run.
    prepMinutes: {
      type: Number,
      required: true,
      min: 1,
      default: 6,
    },
  },
  { timestamps: true }
);

vendorSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.hostelId = ret.hostelId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Vendor", vendorSchema);