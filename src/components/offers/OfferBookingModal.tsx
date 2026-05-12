"use client";

import * as React from "react";
import { X, CalendarDays, User, Phone, Mail, Baby, Calendar, MessageSquare, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ShiftCtaContext } from "@/lib/offer/offerPageTypes";

interface OfferBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftCtaContext | null;
  onSubmit: (data: any) => void;
}

/**
 * Модальное окно записи на смену в лагерь.
 * Дизайн на базе предоставленного макета, цвета в стиле mamaGo (#EF8759).
 */
export function OfferBookingModal({
  open,
  onOpenChange,
  shift,
  onSubmit,
}: OfferBookingModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Имитация отправки
    setTimeout(() => {
      setIsSubmitting(false);
      onSubmit({});
      onOpenChange(false);
    }, 1500);
  };

  const dateLabel = shift?.dateFrom && shift?.dateTo 
    ? `${shift.dateFrom} — ${shift.dateTo}`
    : shift?.dateFrom || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px] max-h-[calc(100dvh-60px)] gap-0 p-0 overflow-hidden rounded-[32px] border-none shadow-2xl flex flex-col">
        <div className="overflow-y-auto flex-1 no-scrollbar">
          {/* Header with Illustration Background */}
          <div className="relative bg-[#FDFCFB] px-8 pt-8 pb-6">
            <div className="relative z-10">
              <DialogTitle className="text-[28px] font-bold text-gray-900 leading-tight">
                Запись на смену
              </DialogTitle>
              <p className="mt-1 text-[15px] font-medium text-gray-500">
                Быстро и просто — всего 1 минута!
              </p>
            </div>
            
            {/* Decorative Illustration (Abstract Camp) */}
            <div className="absolute top-0 right-0 h-full w-1/2 opacity-20 pointer-events-none overflow-hidden">
               <div className="absolute bottom-0 right-4 flex items-end gap-1">
                  <div className="w-8 h-16 bg-[#EF8759] rounded-t-full" />
                  <div className="w-12 h-20 bg-[#EF8759]/60 rounded-t-full" />
                  <div className="w-10 h-12 bg-[#EF8759]/40 rounded-t-full" />
               </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-8 pb-10 space-y-6">
            {/* Shift Info Card */}
            {shift && (
              <div className="flex items-center gap-4 rounded-2xl bg-[#F9FAFB] border border-gray-100 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#EF8759] shadow-sm">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-gray-900 truncate">
                    {shift.title || "Смена в лагере"}
                  </p>
                  <p className="text-[13px] font-medium text-gray-500">
                    {dateLabel}
                  </p>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-5">
              {/* Parent Name */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[#EF8759]" />
                  <Label htmlFor="parentName" className="text-[14px] font-bold text-gray-700">Как к вам обращаться? *</Label>
                </div>
                <Input 
                  id="parentName" 
                  required 
                  placeholder="Имя родителя или законного представителя"
                  className="h-12 rounded-xl border-gray-200 focus-visible:ring-[#EF8759]/20 focus-visible:border-[#EF8759]"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#EF8759]" />
                  <Label htmlFor="phone" className="text-[14px] font-bold text-gray-700">Ваш телефон *</Label>
                </div>
                <Input 
                  id="phone" 
                  type="tel" 
                  required 
                  placeholder="+375 (__) ___-__-__"
                  className="h-12 rounded-xl border-gray-200 focus-visible:ring-[#EF8759]/20 focus-visible:border-[#EF8759]"
                />
                <p className="text-[12px] text-gray-400">Мы свяжемся с вами по этому номеру</p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#EF8759]" />
                  <Label htmlFor="email" className="text-[14px] font-bold text-gray-700">Email (необязательно)</Label>
                </div>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="Для подтверждения заявки"
                  className="h-12 rounded-xl border-gray-200 focus-visible:ring-[#EF8759]/20 focus-visible:border-[#EF8759]"
                />
              </div>

              {/* Child Section */}
              <div className="pt-2">
                <h3 className="text-[16px] font-bold text-gray-900 mb-4">О ребёнке</h3>
                <div className="space-y-5">
                  {/* Child Name */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Baby className="h-4 w-4 text-[#EF8759]" />
                      <Label htmlFor="childName" className="text-[14px] font-bold text-gray-700">Имя ребёнка *</Label>
                    </div>
                    <Input 
                      id="childName" 
                      required 
                      placeholder="Имя ребёнка"
                      className="h-12 rounded-xl border-gray-200 focus-visible:ring-[#EF8759]/20 focus-visible:border-[#EF8759]"
                    />
                  </div>

                  {/* Child Age */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#EF8759]" />
                      <Label htmlFor="childAge" className="text-[14px] font-bold text-gray-700">Возраст ребёнка *</Label>
                    </div>
                    <Select required>
                      <SelectTrigger id="childAge" className="h-12 w-full rounded-xl border-gray-200 focus:ring-[#EF8759]/20 focus:border-[#EF8759]">
                        <SelectValue placeholder="Выберите возраст" />
                      </SelectTrigger>
                      <SelectContent className="z-[80]">
                        {Array.from({ length: 15 }, (_, i) => i + 3).map((age) => (
                          <SelectItem key={age} value={age.toString()}>{age} лет</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#EF8759]" />
                  <Label htmlFor="comment" className="text-[14px] font-bold text-gray-700">Комментарий (необязательно)</Label>
                </div>
                <Textarea 
                  id="comment" 
                  placeholder="Вопросы, пожелания, особенности ребёнка и др."
                  className="min-h-[100px] rounded-xl border-gray-200 focus-visible:ring-[#EF8759]/20 focus-visible:border-[#EF8759] resize-none"
                />
              </div>
            </div>

            {/* Footer & Submit */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-center gap-2 text-[12px] text-gray-400">
                <Lock className="h-3 w-3" />
                <span>Ваши данные защищены и не передаются третьим лицам</span>
              </div>
              
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="h-14 w-full rounded-2xl bg-[#EF8759] text-[16px] font-bold text-white shadow-lg shadow-[#EF8759]/25 hover:bg-[#e07848] transition-all"
              >
                {isSubmitting ? "Отправка..." : "Отправить заявку"}
              </Button>

              <p className="text-center text-[11px] text-gray-400 leading-relaxed">
                Нажимая кнопку, вы соглашаетесь на обработку персональных данных.
              </p>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
