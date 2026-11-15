/**
 * Plain-language versions of the Terms, Privacy Policy, Refund policy and Grievance policy
 * shown inside the app. They follow the drafts in docs/legal/ and must be replaced with the
 * lawyer-approved wording before launch. Anything in [SQUARE BRACKETS] is still to be filled
 * in; while any remain, the screen shows a "draft" notice (see Legal.tsx).
 */
export interface LegalSection {
  heading: string;
  body: string[];
}
export interface LegalDoc {
  title: string;
  sections: LegalSection[];
}

export const LEGAL: Record<string, LegalDoc> = {
  terms: {
    title: "Terms of Use",
    sections: [
      {
        heading: "Who can use Poolit",
        body: [
          "You must be 18 or older and live in a hostel where Poolit works. By signing in you confirm both.",
          "Keep your phone safe: anyone who has it can order in your name. Tell us at once if it is lost.",
        ],
      },
      {
        heading: "How ordering and pools work",
        body: [
          "Orders from your hostel are grouped into a short pool. When the pool closes, the delivery fee for everyone in it is fixed by how many orders it holds: 1 to 2 orders ₹20, 3 to 5 ₹10, 6 to 10 ₹5, 11 or more free. A ₹4 platform fee and an optional tip are added.",
          "The price you see is the price when you place the order. You can place up to 3 orders in one pool.",
          "You can cancel an order until its pool closes. After that the store is already packing, so please contact the store.",
        ],
      },
      {
        heading: "Payment and delivery",
        body: [
          "You can pay cash on delivery to the store's staff at your door. Online payment is coming later.",
          "Store staff deliver to your block and room. Delivery times are estimates.",
        ],
      },
      {
        heading: "Who is responsible for what",
        body: [
          "Poolit provides the app and the pooling. The goods are sold by the store, which is responsible for them being in date, correctly labelled and licensed.",
          "Operator: [COMPANY NAME], [ADDRESS]. Governing law and courts: [TO BE SET BY LAWYER].",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "What we keep, and why",
        body: [
          "Your mobile number, to sign you in. Your name, hostel, block and room, so the store can deliver to you. What you order, so the pool, the bill and the store's accounts work.",
          "We do not collect your location, contacts or photos. Other students never see your name, number or orders. Your store sees your name, block, room, note and order to deliver it.",
        ],
      },
      {
        heading: "Where it is kept",
        body: [
          "On Supabase servers in Singapore. Text messages with your sign-in code are sent by [SMS PROVIDER]. The app is hosted by [HOSTING PROVIDER].",
        ],
      },
      {
        heading: "How long",
        body: [
          "Your account until you delete it. After you delete it, orders are kept for the store's accounts but your name, block, room, note and account link are removed. Encrypted backups are kept for [N] days.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "In Profile you can download everything we hold about you and delete your account. You cannot delete while an order is on its way.",
          "To complain, see Help and grievance. You may also complain to the Data Protection Board of India.",
        ],
      },
      {
        heading: "Children",
        body: ["Poolit is for people aged 18 or over. If you think a minor has an account, tell us and we will remove it."],
      },
    ],
  },
  refunds: {
    title: "Cancellation, refunds and delivery",
    sections: [
      {
        heading: "Cancelling",
        body: [
          "Before the pool closes: open Your orders and tap Cancel order. The items go back in stock and you are not charged.",
          "After the pool closes: the store is packing. Contact the store; the order is delivered as placed unless the store agrees.",
        ],
      },
      {
        heading: "Wrong, missing or damaged items",
        body: [
          "Tell the store's staff at the door and do not pay for what is missing or damaged. For cash on delivery you pay only for what you keep.",
          "If you notice later, tell us within [24 hours] with your order number.",
        ],
      },
      {
        heading: "If nobody is there to receive it",
        body: ["The store [calls once and waits N minutes, then returns the order]. A returned order is not charged."],
      },
    ],
  },
  grievance: {
    title: "Help and grievance",
    sections: [
      {
        heading: "Grievance Officer",
        body: [
          "Name: [NAME]. Email: [EMAIL]. Phone: [PHONE] ([HOURS]).",
          "Address: [ADDRESS].",
        ],
      },
      {
        heading: "What to send",
        body: ["Your order number (the last 6 characters shown in Your orders) and a short description of the problem."],
      },
      {
        heading: "What we do",
        body: [
          "We acknowledge within 48 hours and give you the result within one month. Delivery problems we aim to settle within 3 working days.",
          "If you are not satisfied, ask for a review by [SENIOR PERSON]. You may also approach the consumer commission.",
        ],
      },
    ],
  },
};

export const LEGAL_ORDER = ["terms", "privacy", "refunds", "grievance"] as const;

/** True while any placeholder is still in the text. */
export function hasPlaceholders(doc: LegalDoc): boolean {
  return doc.sections.some((s) => s.body.some((b) => /\[[A-Z]/.test(b)));
}
