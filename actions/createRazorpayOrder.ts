"use server";

import razorpay from "@/lib/razorpay";
import { Address } from "@/sanity.types";
import { CartItem } from "@/store";

export interface Metadata {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  clerkUserId?: string;
  address?: Address | null;
}

export interface GroupedCartItems {
  product: CartItem["product"];
  quantity: number;
}

export async function createRazorpayOrder(
  items: GroupedCartItems[],
  metadata: Metadata
) {
  try {
    const totalAmount = items.reduce(
      (total, item) => total + (item.product?.price || 0) * item.quantity,
      0
    );

    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // Convert to paise
      currency: "INR",
      receipt: metadata.orderNumber,
      notes: {
        customerName: metadata.customerName,
        customerEmail: metadata.customerEmail,
        clerkUserId: metadata.clerkUserId,
        address: JSON.stringify(metadata.address),
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    };
  } catch (error) {
    console.error("Error creating Razorpay Order", error);
    throw error;
  }
} 