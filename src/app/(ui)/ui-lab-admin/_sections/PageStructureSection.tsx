import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageStructureSection() {
  return (
    <SectionWrapper
      id="page-structure"
      title="1. Page Structure"
      description="Standard admin page layout patterns with consistent spacing and hierarchy"
    >
      <PatternBlock
        title="Admin Page Header"
        description="Standard page header with title, subtitle, and actions"
        desktop={
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Page Title</h1>
                <p className="text-gray-600 mt-1">Page subtitle or description</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New
                </Button>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Page Title</h1>
              <p className="text-sm text-gray-600 mt-1">Page subtitle</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <Download className="w-4 h-4" />
              </Button>
              <Button size="sm" className="flex-1">
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Button>
            </div>
          </div>
        }
        note="Use text-2xl for desktop titles, text-xl for mobile. Actions stack on mobile."
      />

      <PatternBlock
        title="Admin Page Container"
        description="Standard page wrapper with consistent padding"
        desktop={
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-6">
              <div className="text-sm text-gray-600">
                Page content with p-6 padding (24px)
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4">
              <div className="text-sm text-gray-600">
                Page content with p-4 padding (16px) on mobile
              </div>
            </div>
          </div>
        }
        note="Desktop uses p-6, mobile uses p-4 for better space utilization"
      />
    </SectionWrapper>
  );
}
