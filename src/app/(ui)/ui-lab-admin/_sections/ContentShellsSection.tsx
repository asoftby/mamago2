import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";

export function ContentShellsSection() {
  return (
    <SectionWrapper
      id="content-shells"
      title="4. Content Shells"
      description="Reusable container patterns for different content types"
    >
      <PatternBlock
        title="Card Shell"
        description="Standard card container"
        desktop={
          <div className="border rounded-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">Card Title</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600">Card content goes here</p>
            </div>
          </div>
        }
        mobile={
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">Card Title</h3>
            </div>
            <div className="p-3">
              <p className="text-sm text-gray-600">Card content</p>
            </div>
          </div>
        }
        note="Use border instead of shadow for admin cards. Reduce padding on mobile."
      />

      <PatternBlock
        title="Section Shell"
        description="Content section with header"
        desktop={
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Section Title</h2>
              <p className="text-sm text-gray-600 mt-1">Section description</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">Section content</p>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Section Title</h2>
              <p className="text-sm text-gray-600 mt-0.5">Section description</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-sm text-gray-600">Section content</p>
            </div>
          </div>
        }
        note="Section titles use text-lg on desktop, text-base on mobile"
      />

      <PatternBlock
        title="Two-Column Shell"
        description="Side-by-side content layout"
        desktop={
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">Left column</p>
            </div>
            <div className="border rounded-lg p-4">
              <p className="text-sm text-gray-600">Right column</p>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-3">
            <div className="border rounded-lg p-3">
              <p className="text-sm text-gray-600">First item (stacked)</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-sm text-gray-600">Second item (stacked)</p>
            </div>
          </div>
        }
        note="Desktop uses grid-cols-2, mobile stacks vertically"
      />
    </SectionWrapper>
  );
}
