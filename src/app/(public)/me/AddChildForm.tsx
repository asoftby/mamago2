"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addChildAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
    >
      {pending ? "Добавление..." : "Добавить ребёнка"}
    </button>
  );
}

export function AddChildForm() {
  const [state, formAction] = useActionState(addChildAction, { ok: true });

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Имя
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          minLength={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Имя ребёнка"
        />
        {!state.ok && state.fieldErrors?.name && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.name[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="birthDate"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Дата рождения
        </label>
        <input
          type="date"
          id="birthDate"
          name="birthDate"
          required
          max={new Date().toISOString().split('T')[0]}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {!state.ok && state.fieldErrors?.birthDate && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.birthDate[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="interests"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Интересы (необязательно)
        </label>
        <input
          type="text"
          id="interests"
          name="interests"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Например: спорт, музыка, рисование"
        />
        {!state.ok && state.fieldErrors?.interests && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.interests[0]}
          </p>
        )}
      </div>

      {!state.ok && state.message && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{state.message}</p>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
