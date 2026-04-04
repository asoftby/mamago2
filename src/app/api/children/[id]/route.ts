import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";

const updateChildSchema = z.object({
  name: z.string().min(1, "Укажите имя").max(50),
  birthDate: z
    .union([z.string(), z.null()])
    .optional()
    .refine((date) => {
      if (date == null || date === "") return true;
      const parsed = new Date(date);
      const now = new Date();
      return parsed <= now && parsed > new Date(now.getFullYear() - 25, 0, 1);
    }, "Некорректная дата рождения"),
  systemInterests: z.array(z.string()).default([]),
  customInterests: z.array(z.string().max(50)).default([]),
});

export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  console.log("PUT /api/children/[id] - START");
  console.log("Full context:", context);
  console.log("Request URL:", request.url);
  
  // Try to extract ID from URL as fallback
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const idFromPath = pathSegments[pathSegments.length - 1];
  
  console.log("Path segments:", pathSegments);
  console.log("ID from path:", idFromPath);
  
  const { params } = context;
  console.log("Context params:", params);
  
  // Use ID from params or fallback to path
  const childId = params?.id || idFromPath;
  console.log("Final child ID:", childId);
  
  // Test database connection
  try {
    await prisma.$connect();
    console.log("Database connection successful");
  } catch (dbConnectionError) {
    console.error("Database connection failed:", dbConnectionError);
    return NextResponse.json(
      { error: "Ошибка подключения к базе данных" },
      { status: 500 }
    );
  }
  
  try {
    if (!childId || childId === 'route.ts') {
      console.error("Invalid child ID:", childId);
      return NextResponse.json(
        { error: "Некорректный ID ребенка" },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await getCurrentUser();
      console.log("User lookup result:", user ? "found" : "not found");
    } catch (userError) {
      console.error("Error getting current user:", userError);
      return NextResponse.json(
        { error: "Ошибка авторизации" },
        { status: 500 }
      );
    }

    if (!user) {
      console.log("No user found");
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    console.log("User found:", user.id);
    console.log("Using child ID:", childId);
    
    let body;
    try {
      body = await request.json();
      console.log("Request body:", body);
    } catch (bodyError) {
      console.error("Error parsing request body:", bodyError);
      return NextResponse.json(
        { error: "Некорректный формат данных" },
        { status: 400 }
      );
    }
    
    let data;
    try {
      data = updateChildSchema.parse(body);
      console.log("Parsed data:", data);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { 
            error: "Некорректные данные", 
            details: validationError.issues.map(issue => ({
              field: issue.path.join('.'),
              message: issue.message
            }))
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Ошибка валидации данных" },
        { status: 400 }
      );
    }

    // Check if child belongs to user
    let existingChild;
    try {
      existingChild = await prisma.child.findFirst({
        where: { id: childId, parentId: user.id },
      });
      console.log("Existing child found:", existingChild ? "yes" : "no");
    } catch (dbError) {
      console.error("Database error finding child:", dbError);
      return NextResponse.json(
        { error: "Ошибка базы данных при поиске ребенка" },
        { status: 500 }
      );
    }

    if (!existingChild) {
      console.log("Child not found for user");
      return NextResponse.json(
        { error: "Ребенок не найден" },
        { status: 404 }
      );
    }

    // Validate system interests
    const validSystemInterests = data.systemInterests.filter(slug => 
      SYSTEM_INTERESTS.some(interest => interest.slug === slug)
    );

    console.log("Valid system interests:", validSystemInterests);

    // Update child with interests in a transaction
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        console.log("Starting transaction");
        
        // Update child basic info
        const child = await tx.child.update({
          where: { id: childId },
          data: {
            name: data.name,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
          },
        });

        console.log("Child updated:", child);

        // Delete existing interests
        await tx.childInterest.deleteMany({
          where: { childId },
        });
        await tx.childCustomInterest.deleteMany({
          where: { childId },
        });

        console.log("Existing interests deleted");

        // Add new system interests
        if (validSystemInterests.length > 0) {
          await tx.childInterest.createMany({
            data: validSystemInterests.map(slug => ({
              childId,
              interestSlug: slug,
            })),
          });
          console.log("System interests added:", validSystemInterests.length);
        }

        // Add new custom interests
        if (data.customInterests.length > 0) {
          await tx.childCustomInterest.createMany({
            data: data.customInterests.map(label => ({
              childId,
              label: label.trim(),
            })),
          });
          console.log("Custom interests added:", data.customInterests.length);
        }

        console.log("Transaction completed successfully");
        return child;
      });
    } catch (transactionError) {
      console.error("Transaction error:", transactionError);
      return NextResponse.json(
        { error: "Ошибка при обновлении данных ребенка" },
        { status: 500 }
      );
    }

    console.log("Final result:", result);
    return NextResponse.json({ success: true, child: result });
  } catch (error) {
    console.error("Update child error:", error);

    if (error instanceof z.ZodError) {
      console.error("Validation errors:", error.issues);
      return NextResponse.json(
        { 
          error: "Некорректные данные", 
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    // Log the actual error for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      { error: "Не удалось обновить ребенка" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("GET /api/children/[id] - params:", params);
    
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const childId = params.id;
    
    const child = await prisma.child.findFirst({
      where: { id: childId, parentId: user.id },
      include: {
        systemInterests: true,
        customInterests: true,
      },
    });

    if (!child) {
      return NextResponse.json(
        { error: "Ребенок не найден" },
        { status: 404 }
      );
    }

    return NextResponse.json({ child });
  } catch (error) {
    console.error("Get child error:", error);
    return NextResponse.json(
      { error: "Не удалось загрузить ребенка" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  console.log("DELETE /api/children/[id] - START");
  console.log("Full context:", context);
  console.log("Request URL:", request.url);
  
  // Try to extract ID from URL as fallback
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const idFromPath = pathSegments[pathSegments.length - 1];
  
  console.log("Path segments:", pathSegments);
  console.log("ID from path:", idFromPath);
  
  const { params } = context;
  console.log("Context params:", params);
  
  // Use ID from params or fallback to path
  const childId = params?.id || idFromPath;
  console.log("Final child ID:", childId);

  try {
    if (!childId || childId === 'route.ts') {
      console.error("Invalid child ID:", childId);
      return NextResponse.json(
        { error: "Некорректный ID ребенка" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    console.log("User lookup result:", user ? "found" : "not found");
    
    if (!user) {
      console.log("No user found");
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    console.log("User found:", user.id);
    console.log("Looking for child with ID:", childId, "and parentId:", user.id);

    // Check if child belongs to user
    const existingChild = await prisma.child.findFirst({
      where: { id: childId, parentId: user.id },
    });

    console.log("Existing child found:", existingChild ? "yes" : "no");
    if (existingChild) {
      console.log("Child details:", { id: existingChild.id, name: existingChild.name });
    }

    if (!existingChild) {
      console.log("Child not found for user");
      return NextResponse.json(
        { error: "Ребенок не найден" },
        { status: 404 }
      );
    }

    console.log("Attempting to delete child:", childId);
    
    // Delete child (interests will be deleted via cascade)
    const deleteResult = await prisma.child.delete({
      where: { id: childId },
    });

    console.log("Delete successful:", deleteResult);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete child error:", error);
    
    // Log the actual error for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    return NextResponse.json(
      { error: "Не удалось удалить ребенка" },
      { status: 500 }
    );
  }
}