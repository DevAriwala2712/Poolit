const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Snacks",
        "Instant Food",
        "Drinks",
        "Essentials",
        "Fresh",
        "Midnight Cravings",
      ],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // Struck-through original price when the item is discounted.
    mrp: {
      type: Number,
      min: 0,
      default: undefined,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 4.2,
    },
    ratingCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    isVeg: {
      type: Boolean,
      default: true,
    },
    // Emoji stand-in for product photography.
    art: {
      type: String,
      default: "📦",
    },
    // Soft tint rendered behind the product art.
    tint: {
      type: String,
      default: "#F1EDE6",
    },
    stockQty: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      min: 0,
      default: 5,
    },
  },
  { timestamps: true }
);

menuItemSchema.index({ vendorId: 1, category: 1 });
menuItemSchema.index({ vendorId: 1, stockQty: 1 });

menuItemSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.vendorId = ret.vendorId.toString();
    if (ret.mrp === null || ret.mrp === undefined) delete ret.mrp;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("MenuItem", menuItemSchema);