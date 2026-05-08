"use client";

import { X, LogIn } from "lucide-react";
import { AuthForm } from "./AuthForm";

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: "review" | "comment" | "business_request" | "chat";
  entityName?: string;
}

export function AuthRequiredModal({
  isOpen,
  onClose,
  reason = "review",
  entityName,
}: AuthRequiredModalProps) {
  const getTitle = () => {
    switch (reason) {
      case "review":
        return "Войдите, чтобы оставить отзыв";
      case "comment":
        return "Войдите, чтобы оставить комментарий";
      case "business_request":
        return "Войдите, чтобы отправить заявку";
      case "chat":
        return "Войдите, чтобы начать чат";
      default:
        return "Войдите в аккаунт";
    }
  };

  const getDescription = () => {
    return "Мы сохраним ваше действие и вернём вас к нему после входа.";
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
        <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl pointer-events-auto">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <LogIn className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{getTitle()}</h2>
              <p className="text-gray-600 mt-2">{getDescription()}</p>
              {entityName && (
                <p className="text-sm text-gray-500 mt-2">
                  {reason === "review" ? "Отзыв о" : "Комментарий к"}{" "}
                  <span className="font-medium">{entityName}</span>
                </p>
              )}
            </div>

            {/* Auth Form */}
            <AuthForm
              open={isOpen}
              onRequestClose={onClose}
              nextHref={typeof window !== "undefined" ? window.location.pathname : "/"}
              title=""
              subtitle=""
              hideCloseButton={true}
              initialMode="login"
              postAuthSource="profile"
            />
          </div>
        </div>
      </div>
    </>
  );
}
