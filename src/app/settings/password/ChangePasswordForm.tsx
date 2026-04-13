"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z
      .string()
      .min(8, "Пароль должен содержать минимум 8 символов")
      .regex(/\d/u, "Пароль должен содержать хотя бы одну цифру"),
    confirmPassword: z.string().min(1, "Повторите новый пароль"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

function PasswordField(props: {
  id: keyof ChangePasswordValues;
  label: string;
  error?: string;
  register: ReturnType<typeof useForm<ChangePasswordValues>>["register"];
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label
        htmlFor={props.id}
        className="text-sm font-medium text-neutral-800"
      >
        {props.label}
      </label>
      <div className="relative">
        <Input
          id={props.id}
          type={visible ? "text" : "password"}
          autoComplete={
            props.id === "currentPassword" ? "current-password" : "new-password"
          }
          className="h-11 rounded-xl border-neutral-200 bg-white pr-11"
          {...props.register(props.id)}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-700"
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {props.error ? (
        <p className="text-sm text-rose-600">{props.error}</p>
      ) : null}
    </div>
  );
}

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const response = await fetch("/api/settings/password", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    });

    if (response.ok) {
      toast.success("Пароль изменён");
      reset();
      return;
    }

    if (response.status === 401) {
      setError("currentPassword", {
        type: "server",
        message: "Неверный текущий пароль",
      });
      return;
    }

    toast.error("Не удалось изменить пароль");
  });

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="space-y-5">
        <PasswordField
          id="currentPassword"
          label="Текущий пароль"
          error={errors.currentPassword?.message}
          register={register}
        />

        <PasswordField
          id="newPassword"
          label="Новый пароль"
          error={errors.newPassword?.message}
          register={register}
        />

        <PasswordField
          id="confirmPassword"
          label="Повторите новый пароль"
          error={errors.confirmPassword?.message}
          register={register}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">
          После смены пароля вход останется активным на этом устройстве.
        </p>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-11 rounded-xl px-5"
        >
          {isSubmitting ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}
