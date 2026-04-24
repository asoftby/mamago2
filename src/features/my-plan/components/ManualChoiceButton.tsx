"use client";

type ManualChoiceButtonProps = {
  onClick: () => void;
};

export function ManualChoiceButton({ onClick }: ManualChoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-[24px] border border-neutral-200 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:bg-neutral-50"
    >
      <span className="min-w-0">
        <span className="block text-base font-semibold text-neutral-900">Сама решу</span>
        <span className="mt-1 block text-sm leading-snug text-neutral-500">
          Иду в каталог и выбираю сама
        </span>
      </span>
      <span className="ml-4 text-xl text-neutral-400" aria-hidden>
        →
      </span>
    </button>
  );
}
