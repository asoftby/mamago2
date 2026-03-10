"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { getStatusBadgeProps, type SectionStatus } from "@/lib/placeReviewUtils";

interface ReviewSectionProps {
  title: string;
  status: SectionStatus;
  onEdit: () => void;
  children: React.ReactNode;
}

export function ReviewSection({ title, status, onEdit, children }: ReviewSectionProps) {
  const badgeProps = getStatusBadgeProps(status);

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant={badgeProps.variant}
              className={badgeProps.className}
            >
              {badgeProps.text}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 px-2"
            >
              <Edit className="h-4 w-4 mr-1" />
              Редактировать
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

interface ReviewFieldProps {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}

export function ReviewField({ label, value, multiline = false }: ReviewFieldProps) {
  const displayValue = value || "Не указано";
  const isEmpty = !value;

  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-gray-600">{label}:</dt>
      <dd className={`text-sm ${isEmpty ? 'text-gray-400 italic' : 'text-gray-900'} ${multiline ? 'whitespace-pre-wrap' : ''}`}>
        {displayValue}
      </dd>
    </div>
  );
}