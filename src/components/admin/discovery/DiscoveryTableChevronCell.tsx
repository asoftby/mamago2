import { ChevronRight } from "lucide-react";

export function DiscoveryTableChevronCell() {
  return (
    <td className="px-2 py-2.5 text-right align-middle">
      <ChevronRight
        className="inline-block h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-600"
        aria-hidden
      />
    </td>
  );
}
