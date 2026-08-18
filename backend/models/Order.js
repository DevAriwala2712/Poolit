const mongoose = require("mongoose");

const orderLineItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Slot",
      required: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [orderLineItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Order must have at least one item",
      },
    },
    status: {
      type: String,
      enum: ["placed", "pooled", "dispatched", "delivered"],
      default: "placed",
      required: true,
    },
    deliveryFeeCharged: {
      type: Number,
      min: 0,
      default: undefined,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

orderSchema.index({ slotId: 1 });
orderSchema.index({ slotId: 1, status: 1 });

orderSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    ret.slotId = ret.slotId.toString();
    ret.items = (ret.items || []).map((item) => ({
      menuItemId: item.menuItemId.toString(),
      qty: item.qty,
    }));
    ret.createdAt = new Date(ret.createdAt).getTime();
    if (ret.deliveryFeeCharged === null || ret.deliveryFeeCharged === undefined) {
      delete ret.deliveryFeeCharged;
    }
    delete ret._id;
    delete ret.__v;
    delete ret.updatedAt;
    return ret;
  },
});

module.exports = mongoose.model("Order", orderSchema);