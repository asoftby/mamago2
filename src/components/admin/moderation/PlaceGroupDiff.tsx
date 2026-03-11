/**
 * Component to display place group changes with related places
 */

"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Link2 } from "lucide-react";

interface PlaceGroupDiffProps {
  oldGroupId: string | null;
  newGroupId: string | null;
  placeId: string;
  changeType: "added" | "removed" | "changed" | "unchanged";
}

interface GroupInfo {
  groupId: string;
  places: Array<{
    id: string;
    title: string;
    shortAddress?: string | null;
  }>;
}

export function PlaceGroupDiff({ oldGroupId, newGroupId, placeId, changeType }: PlaceGroupDiffProps) {
  const [oldGroupInfo, setOldGroupInfo] = useState<GroupInfo | null>(null);
  const [newGroupInfo, setNewGroupInfo] = useState<GroupInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchGroupInfo() {
      setIsLoading(true);
      try {
        // Fetch old group info
        if (oldGroupId) {
          const res = await fetch(`/api/admin/place-groups/${oldGroupId}/places`);
          if (res.ok) {
            const data = await res.json();
            setOldGroupInfo({ groupId: oldGroupId, places: data.places || [] });
          }
        }

        // Fetch new group info
        if (newGroupId && newGroupId !== oldGroupId) {
          const res = await fetch(`/api/admin/place-groups/${newGroupId}/places`);
          if (res.ok) {
            const data = await res.json();
            setNewGroupInfo({ groupId: newGroupId, places: data.places || [] });
          }
        } else if (newGroupId === oldGroupId && oldGroupInfo) {
          setNewGroupInfo(oldGroupInfo);
        }
      } catch (error) {
        console.error("Failed to fetch group info:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchGroupInfo();
  }, [oldGroupId, newGroupId, placeId]);

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-start justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900">Принадлежность к сети</h4>
        </div>
        <p className="text-sm text-gray-500">Загрузка...</p>
      </div>
    );
  }

  const renderGroupInfo = (groupInfo: GroupInfo | null, isOld: boolean) => {
    if (!groupInfo) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
          <p className="text-sm text-gray-700">Отдельное место (не в сети)</p>
        </div>
      );
    }

    const otherPlaces = groupInfo.places.filter(p => p.id !== placeId);

    return (
      <div className={`border rounded px-3 py-2 ${
        isOld ? "bg-gray-50 border-gray-200" : "bg-blue-50 border-blue-200"
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <Link2 className={`w-4 h-4 ${isOld ? "text-gray-600" : "text-blue-600"}`} />
          <p className={`text-sm font-medium ${isOld ? "text-gray-900" : "text-blue-900"}`}>
            Одна из нескольких точек
          </p>
        </div>
        {otherPlaces.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-600 mb-1">Связанные места:</p>
            {otherPlaces.map((place) => (
              <div key={place.id} className="text-xs text-gray-700 pl-2">
                • {place.title}
                {place.shortAddress && (
                  <span className="text-gray-500"> ({place.shortAddress})</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Принадлежность к сети</h4>
        {changeType === "added" && (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Добавлено
          </Badge>
        )}
        {changeType === "removed" && (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            Удалено
          </Badge>
        )}
        {changeType === "changed" && (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            Изменено
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {/* Old Value */}
        {changeType !== "added" && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Текущее значение</p>
            {renderGroupInfo(oldGroupInfo, true)}
          </div>
        )}

        {/* Arrow for changed */}
        {changeType === "changed" && (
          <div className="flex justify-center">
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {/* New Value */}
        {changeType !== "removed" && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Новое значение</p>
            {renderGroupInfo(newGroupInfo, false)}
          </div>
        )}
      </div>
    </div>
  );
}
