import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";

/**
 * POST /api/business/reviews/place-reviews/[id]/reply
 * Create or update owner reply (only for mamaGo PUBLISHED reviews)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get business profile
    const business = await getMyBusiness(user.id);

    if (!business) {
      return NextResponse.json(
        { success: false, error: "Business profile not found" },
        { status: 404 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Reply text is required" },
        { status: 400 }
      );
    }

    // Check if review exists and belongs to business
    const review = await prisma.placeReview.findUnique({
      where: { id },
      include: {
        place: {
          select: {
            ownerBusinessId: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (review.place.ownerBusinessId !== business.id) {
      return NextResponse.json(
        { success: false, error: "You can only reply to reviews of your own places" },
        { status: 403 }
      );
    }

    // Check if review is from mamaGo
    if (review.source !== "MAMAGO") {
      return NextResponse.json(
        { success: false, error: "Cannot reply to Google reviews within mamaGo" },
        { status: 400 }
      );
    }

    // Check if review is published
    if (review.status !== "PUBLISHED") {
      return NextResponse.json(
        { success: false, error: "Can only reply to published reviews" },
        { status: 400 }
      );
    }

    const updatedReview = await prisma.placeReview.update({
      where: { id },
      data: {
        ownerReplyText: text.trim(),
        ownerReplyAuthorId: user.id,
        ownerReplyAuthorName: user.displayName || user.email,
        ownerReplyCreatedAt: review.ownerReplyText ? review.ownerReplyCreatedAt : new Date(),
        ownerReplyUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { review: updatedReview },
    });
  } catch (error) {
    console.error("POST /api/business/reviews/place-reviews/[id]/reply error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/business/reviews/place-reviews/[id]/reply
 * Delete owner reply (only for mamaGo reviews)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get business profile
    const business = await getMyBusiness(user.id);

    if (!business) {
      return NextResponse.json(
        { success: false, error: "Business profile not found" },
        { status: 404 }
      );
    }

    const { id } = await params;

    // Check if review exists and belongs to business
    const review = await prisma.placeReview.findUnique({
      where: { id },
      include: {
        place: {
          select: {
            ownerBusinessId: true,
          },
        },
      },
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (review.place.ownerBusinessId !== business.id) {
      return NextResponse.json(
        { success: false, error: "You can only manage replies to reviews of your own places" },
        { status: 403 }
      );
    }

    // Check if review is from mamaGo
    if (review.source !== "MAMAGO") {
      return NextResponse.json(
        { success: false, error: "Cannot delete reply from Google reviews" },
        { status: 400 }
      );
    }

    const updatedReview = await prisma.placeReview.update({
      where: { id },
      data: {
        ownerReplyText: null,
        ownerReplyAuthorId: null,
        ownerReplyAuthorName: null,
        ownerReplyCreatedAt: null,
        ownerReplyUpdatedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { review: updatedReview },
    });
  } catch (error) {
    console.error("DELETE /api/business/reviews/place-reviews/[id]/reply error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
