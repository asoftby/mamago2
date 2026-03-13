import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";
import { AlertCircle, Inbox, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StatesSection() {
  return (
    <SectionWrapper
      id="states"
      title="7. States"
      description="Empty, loading, error, and no results states"
    >
      <PatternBlock
        title="Empty State"
        description="When no data exists yet"
        desktop={
          <div className="text-center py-12">
            <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No items yet</h3>
            <p className="text-sm text-gray-600 mb-4">Get started by creating your first item</p>
            <Button size="sm">Create Item</Button>
          </div>
        }
        mobile={
          <div className="text-center py-8">
            <Inbox className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">No items yet</h3>
            <p className="text-xs text-gray-600 mb-3">Create your first item</p>
            <Button size="sm" className="text-xs">Create Item</Button>
          </div>
        }
        note="Mobile uses smaller icon and tighter spacing"
      />

      <PatternBlock
        title="Loading State"
        description="While data is being fetched"
        desktop={
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        }
        mobile={
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 text-gray-400 mx-auto mb-2 animate-spin" />
            <p className="text-xs text-gray-600">Loading...</p>
          </div>
        }
        note="Use spinner animation for loading states"
      />

      <PatternBlock
        title="Error State"
        description="When an error occurs"
        desktop={
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900 mb-1">Error loading data</h3>
                <p className="text-sm text-red-800 mb-3">
                  Unable to fetch data. Please try again.
                </p>
                <Button variant="outline" size="sm">Retry</Button>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-red-900 mb-1">Error loading data</h3>
                <p className="text-xs text-red-800 mb-2">
                  Unable to fetch data.
                </p>
                <Button variant="outline" size="sm" className="text-xs">Retry</Button>
              </div>
            </div>
          </div>
        }
        note="Use red color scheme for errors with clear action button"
      />

      <PatternBlock
        title="No Results State"
        description="When search/filter returns no results"
        desktop={
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No results found</h3>
            <p className="text-sm text-gray-600 mb-4">Try adjusting your filters or search query</p>
            <Button variant="outline" size="sm">Clear Filters</Button>
          </div>
        }
        mobile={
          <div className="text-center py-8">
            <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <h3 className="text-base font-semibold text-gray-900 mb-1">No results</h3>
            <p className="text-xs text-gray-600 mb-3">Try adjusting filters</p>
            <Button variant="outline" size="sm" className="text-xs">Clear Filters</Button>
          </div>
        }
        note="Different from empty state - suggests user action to see results"
      />
    </SectionWrapper>
  );
}
