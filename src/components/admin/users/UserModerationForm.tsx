"use client";

import { useState } from "react";
import { UserStatus, UserModerationActionType, Role } from "@/types/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserModerationFormProps {
  userId: string;
  currentStatus: UserStatus;
  onSuccess: () => void;
}

export function UserModerationForm({ userId, currentStatus, onSuccess }: UserModerationFormProps) {
  const [action, setAction] = useState<UserModerationActionType | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [newRole, setNewRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleActionClick = (actionType: UserModerationActionType) => {
    setAction(actionType);
    setReason("");
    setNote("");
    setExpiresAt("");
    setNewRole(null);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!action || !reason) {
      alert("Укажите причину действия");
      return;
    }

    if (action === UserModerationActionType.SUSPEND && !expiresAt) {
      alert("Укажите дату окончания приостановки");
      return;
    }

    if (action === UserModerationActionType.ROLE_CHANGE && !newRole) {
      alert("Выберите новую роль");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        action,
        reason,
        note: note || undefined,
      };

      if (action === UserModerationActionType.SUSPEND) {
        body.expiresAt = new Date(expiresAt).toISOString();
      }

      if (action === UserModerationActionType.ROLE_CHANGE) {
        body.newRole = newRole;
      }

      const res = await fetch(`/api/admin/users/${userId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to perform action");
      }

      alert("Действие выполнено успешно");

      setDialogOpen(false);
      onSuccess();
    } catch (error: unknown) {
      console.error("Error performing moderation action:", error);
      alert(`Ошибка: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (actionType: UserModerationActionType) => {
    const labels: Record<UserModerationActionType, string> = {
      WARN: "Предупредить",
      LIMIT: "Ограничить",
      SUSPEND: "Приостановить",
      BAN: "Заблокировать",
      UNBAN: "Разблокировать",
      ROLE_CHANGE: "Изменить роль",
    };
    return labels[actionType];
  };

  const getActionDescription = (actionType: UserModerationActionType) => {
    const descriptions: Record<UserModerationActionType, string> = {
      WARN: "Предупреждение не меняет статус пользователя, но записывается в историю",
      LIMIT: "Пользователь получит статус LIMITED (частичные ограничения)",
      SUSPEND: "Временная блокировка с указанием срока",
      BAN: "Постоянная блокировка доступа к платформе",
      UNBAN: "Восстановление доступа (статус ACTIVE)",
      ROLE_CHANGE: "Изменение роли пользователя",
    };
    return descriptions[actionType];
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleActionClick(UserModerationActionType.WARN)}
        >
          Предупредить
        </Button>

        {currentStatus !== UserStatus.LIMITED && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick(UserModerationActionType.LIMIT)}
          >
            Ограничить
          </Button>
        )}

        {currentStatus !== UserStatus.SUSPENDED && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick(UserModerationActionType.SUSPEND)}
          >
            Приостановить
          </Button>
        )}

        {currentStatus !== UserStatus.BANNED && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleActionClick(UserModerationActionType.BAN)}
          >
            Заблокировать
          </Button>
        )}

        {(currentStatus === UserStatus.BANNED || currentStatus === UserStatus.SUSPENDED) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick(UserModerationActionType.UNBAN)}
          >
            Разблокировать
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleActionClick(UserModerationActionType.ROLE_CHANGE)}
        >
          Изменить роль
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action && getActionLabel(action)}</DialogTitle>
            <DialogDescription>
              {action && getActionDescription(action)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Причина (обязательно)</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Укажите причину действия"
              />
            </div>

            <div>
              <Label htmlFor="note">Дополнительная заметка</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
                rows={3}
              />
            </div>

            {action === UserModerationActionType.SUSPEND && (
              <div>
                <Label htmlFor="expiresAt">Дата окончания приостановки</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            )}

            {action === UserModerationActionType.ROLE_CHANGE && (
              <div>
                <Label htmlFor="newRole">Новая роль</Label>
                <Select value={newRole || undefined} onValueChange={(v) => setNewRole(v as Role)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">Пользователь</SelectItem>
                    <SelectItem value="BUSINESS_OWNER">Бизнес</SelectItem>
                    <SelectItem value="MODERATOR">Модератор</SelectItem>
                    <SelectItem value="ADMIN">Админ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Выполняется..." : "Подтвердить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
