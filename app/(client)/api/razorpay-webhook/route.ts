import { backendClient } from "@/sanity/lib/backendClient";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = headers();
  const signature = headersList.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "No Signature found for Razorpay" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.log("Razorpay webhook secret is not set");
    return NextResponse.json(
      {
        error: "Razorpay webhook secret is not set",
      },
      { status: 400 }
    );
  }

  try {
    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(body);
    const digest = hmac.digest("hex");

    if (digest !== signature) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const event = JSON.parse(body);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const order = event.payload.payment.entity.order_id;

      try {
        await createOrderInSanity(payment, order);
      } catch (error) {
        console.error("Error creating order in sanity:", error);
        return NextResponse.json(
          {
            error: `Error creating order: ${error}`,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json(
      {
        error: `Webhook Error: ${error}`,
      },
      { status: 400 }
    );
  }
}

async function createOrderInSanity(payment: any, order: any) {
  const {
    id,
    amount,
    currency,
    notes,
    receipt,
  } = payment;

  const { customerName, customerEmail, clerkUserId, address } = notes;
  const parsedAddress = address ? JSON.parse(address) : null;

  // Create order in Sanity
  const orderDoc = await backendClient.create({
    _type: "order",
    orderNumber: receipt,
    razorpayOrderId: order,
    razorpayPaymentId: id,
    customerName,
    razorpayCustomerId: customerEmail,
    clerkUserId,
    email: customerEmail,
    currency,
    totalPrice: amount / 100, // Convert from paise to rupees
    status: "paid",
    orderDate: new Date().toISOString(),
    address: parsedAddress
      ? {
          state: parsedAddress.state,
          zip: parsedAddress.zip,
          city: parsedAddress.city,
          address: parsedAddress.address,
          name: parsedAddress.name,
        }
      : null,
  });

  return orderDoc;
} 