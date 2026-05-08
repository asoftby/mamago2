"use client";

import { useState, useEffect } from "react";
import { X, Shield, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthMe } from "@/lib/auth/useAuthMe";
import { usePendingAction } from "@/contexts/PendingActionContext";

interface PhoneVerificationGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: "review" | "comment" | "business_request" | "chat";
  entityName?: string;
}

export function PhoneVerificationGateModal({
  isOpen,
  onClose,
  reason = "review",
  entityName,
}: PhoneVerificationGateModalProps) {
  const { refetch } = useAuthMe();
  const { executePendingAction } = usePendingAction();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("phone");
      setPhone("");
      setOtp("");
      setError(null);
    }
  }, [isOpen]);

  const handleSendOtp = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/phone/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164: phone }),
      });

      const result = await response.json();

      if (result.success) {
        setStep("otp");
      } else {
        setError(result.error || "Не удалось отправить код");
      }
    } catch (err) {
      setError("Произошла ошибка. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneE164: phone, code: otp }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh user data
        await refetch();

        // Execute pending action
        executePendingAction();

        // Close modal
        onClose();
      } else {
        setError(result.error || "Неверный код");
      }
    } catch (err) {
      setError("Произошла ошибка. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (reason) {
      case "review":
        return "Подтвердите номер телефона";
      case "comment":
        return "Подтвердите номер телефона";
      case "business_request":
        return "Подтвердите номер телефона";
      case "chat":
        return "Подтвердите номер телефона";
      default:
        return "Подтвердите номер телефона";
    }
  };

  const getDescription = () => {
    const action = reason === "review" ? "оставлять отзывы" : "оставлять комментарии";
    return `Чтобы ${action}, нужно подтвердить номер телефона. Это помогает защищать mamaGo от спама и делает ${
      reason === "review" ? "отзывы" : "комментарии"
    } надежнее.`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl pointer-events-auto">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{getTitle()}</h2>
              <p className="text-gray-600 mt-2">{getDescription()}</p>
              {entityName && (
                <p className="text-sm text-gray-500 mt-2">
                  После подтверждения вы сможете оставить отзыв о{" "}
                  <span className="font-medium">{entityName}</span>
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Phone Step */}
            {step === "phone" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Номер телефона</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+375 29 123 45 67"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Введите номер в формате +375XXXXXXXXX
                  </p>
                </div>

                <Button
                  onClick={handleSendOtp}
                  disabled={!phone || loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? "Отправка..." : "Получить код"}
                </Button>
              </div>
            )}

            {/* OTP Step */}
            {step === "otp" && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700">
                    Код отправлен на номер <strong>{phone}</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp">Код подтверждения</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    maxLength={6}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep("phone")}
                    disabled={loading}
                    className="flex-1"
                  >
                    Изменить номер
                  </Button>
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={otp.length !== 6 || loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? "Проверка..." : "Подтвердить"}
                  </Button>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="text-center text-xs text-gray-500">
              Ваш номер телефона не будет виден другим пользователям
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
