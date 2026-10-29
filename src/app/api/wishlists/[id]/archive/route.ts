import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { setWishlistArchived } from "@/server/wishlist/wishlist.service";
import { readJson, withWishlistUser } from "@/server/wishlist/wishlistRoute";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ archived: z.boolean() });

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return withWishlistUser(async (user) => {
    const { archived } = schema.parse(await readJson(request));
    return NextResponse.json({ wishlist: await setWishlistArchived(user.id, id, archived) });
  });
}
