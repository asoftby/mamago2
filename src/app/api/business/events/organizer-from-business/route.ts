import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";

/**
 * GET /api/business/events/organizer-from-business
 * 
 * Получить организатора на основе бизнес-профиля текущего пользователя.
 * Если организатор для этого бизнеса уже существует - вернуть его.
 * Если нет - вернуть данные бизнеса для создания организатора.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Получаем бизнес-профиль пользователя
    const business = await getMyBusiness(user.id);
    
    if (!business) {
      return NextResponse.json(
        { hasBusinessProfile: false, organizer: null },
        { status: 200 }
      );
    }

    // Проверяем есть ли уже организатор для этого бизнеса
    const existingOrganizer = await prisma.organizer.findFirst({
      where: {
        linkedBusinessId: business.id,
      },
      select: {
        id: true,
        name: true,
        unp: true,
        phone: true,
        website: true,
        instagram: true,
      },
    });

    if (existingOrganizer) {
      return NextResponse.json({
        hasBusinessProfile: true,
        organizer: existingOrganizer,
        business: {
          id: business.id,
          name: business.name,
          legalName: business.legalName,
        },
      });
    }

    // Если организатора нет, возвращаем данные бизнеса для создания
    // Note: Business model doesn't have website/instagram fields
    return NextResponse.json({
      hasBusinessProfile: true,
      organizer: null,
      business: {
        id: business.id,
        name: business.name,
        legalName: business.legalName,
        unp: business.unp,
        phone: business.phone,
      },
    });
  } catch (error) {
    console.error("[organizer-from-business] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
