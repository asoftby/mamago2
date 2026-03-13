import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";
import { Button } from "@/components/ui/button";
import { X, Bell, CheckCircle, AlertCircle, FileText, UserPlus } from "lucide-react";

export function OverlaysSection() {
  return (
    <SectionWrapper
      id="overlays"
      title="9. Overlays"
      description="Dropdowns, popovers, dialogs, and sheets"
    >
      <PatternBlock
        title="Notification Dropdown"
        description="Standard notification overlay for admin panel"
        desktop={
          <div className="inline-block">
            <div className="w-[300px] rounded-xl border border-gray-200 bg-white shadow-md">
              {/* Header */}
              <div className="px-3 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              </div>
              
              {/* Notification List */}
              <div className="max-h-[420px] overflow-y-auto">
                {/* Notification Item 1 */}
                <div className="px-3 py-3 hover:bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Place approved</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        "Central Park Playground" has been approved
                      </p>
                      <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
                    </div>
                  </div>
                </div>

                {/* Notification Item 2 */}
                <div className="px-3 py-3 hover:bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Improvement request created</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        New request for "Downtown Museum"
                      </p>
                      <p className="text-xs text-gray-500 mt-1">5 hours ago</p>
                    </div>
                  </div>
                </div>

                {/* Notification Item 3 */}
                <div className="px-3 py-3 hover:bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <UserPlus className="w-4 h-4 text-purple-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Business registered</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        "Happy Kids Entertainment" joined
                      </p>
                      <p className="text-xs text-gray-500 mt-1">1 day ago</p>
                    </div>
                  </div>
                </div>

                {/* Notification Item 4 */}
                <div className="px-3 py-3 hover:bg-gray-50 border-b border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Content updated</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        "Summer Festival" details changed
                      </p>
                      <p className="text-xs text-gray-500 mt-1">2 days ago</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-3 py-2 border-t border-gray-200">
                <a href="#" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  View all notifications →
                </a>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="w-full">
            {/* Mobile Bottom Sheet */}
            <div className="border rounded-t-2xl bg-white shadow-xl">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-gray-300" />
              </div>
              
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">Notifications</h3>
                  <button className="p-1">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-[420px] overflow-y-auto">
                {/* Notification Item 1 */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Place approved</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        "Central Park Playground" has been approved
                      </p>
                      <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
                    </div>
                  </div>
                </div>

                {/* Notification Item 2 */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Improvement request created</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        New request for "Downtown Museum"
                      </p>
                      <p className="text-xs text-gray-500 mt-1">5 hours ago</p>
                    </div>
                  </div>
                </div>

                {/* Notification Item 3 */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <UserPlus className="w-4 h-4 text-purple-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Business registered</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        "Happy Kids Entertainment" joined
                      </p>
                      <p className="text-xs text-gray-500 mt-1">1 day ago</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-200">
                <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium block text-center">
                  View all notifications →
                </a>
              </div>
            </div>
          </div>
        }
        note="Desktop: 300px dropdown with max-h-[420px] scroll. Mobile: Full-width bottom sheet"
      />

      <PatternBlock
        title="Notification Dropdown (Empty State)"
        description="Empty state when no notifications exist"
        desktop={
          <div className="inline-block">
            <div className="w-[300px] rounded-xl border border-gray-200 bg-white shadow-md">
              {/* Header */}
              <div className="px-3 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              </div>
              
              {/* Empty State */}
              <div className="px-3 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600">No notifications</p>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="w-full">
            {/* Mobile Bottom Sheet */}
            <div className="border rounded-t-2xl bg-white shadow-xl">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-gray-300" />
              </div>
              
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">Notifications</h3>
                  <button className="p-1">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Empty State */}
              <div className="px-4 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600">No notifications</p>
              </div>
            </div>
          </div>
        }
        note="Show empty state with icon when no notifications exist"
      />

      <PatternBlock
        title="Dropdown Menu"
        description="Action menu dropdown"
        desktop={
          <div className="inline-block">
            <div className="border rounded-lg bg-white shadow-lg w-48">
              <div className="py-1">
                <button className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50">
                  Edit
                </button>
                <button className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50">
                  Duplicate
                </button>
                <div className="my-1 border-t border-gray-200" />
                <button className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="inline-block">
            <div className="border rounded-lg bg-white shadow-lg w-40">
              <div className="py-1">
                <button className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50">
                  Edit
                </button>
                <button className="w-full px-3 py-2 text-xs text-left hover:bg-gray-50">
                  Duplicate
                </button>
                <div className="my-1 border-t border-gray-200" />
                <button className="w-full px-3 py-2 text-xs text-left text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </div>
          </div>
        }
        note="Mobile uses smaller text and tighter padding"
      />

      <PatternBlock
        title="Confirmation Dialog"
        description="Modal dialog for confirmations"
        desktop={
          <div className="border rounded-lg bg-white shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Action</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline">Cancel</Button>
              <Button variant="destructive">Delete</Button>
            </div>
          </div>
        }
        mobile={
          <div className="border rounded-lg bg-white shadow-xl p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Confirm Action</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">Cancel</Button>
              <Button variant="destructive" className="flex-1">Delete</Button>
            </div>
          </div>
        }
        note="Mobile uses full-width buttons and shorter text"
      />

      <PatternBlock
        title="Bottom Sheet (Mobile)"
        description="Mobile sheet for filters or forms"
        desktop={
          <div className="text-center py-8 text-sm text-gray-600">
            Bottom sheets are mobile-only.<br />
            Desktop uses popovers or modals instead.
          </div>
        }
        mobile={
          <div className="border rounded-t-2xl bg-white shadow-xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-gray-300" />
            </div>
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Filters</h3>
                <button className="p-1">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600">Sheet content goes here</p>
            </div>
            <div className="p-4 border-t border-gray-200">
              <Button className="w-full">Apply Filters</Button>
            </div>
          </div>
        }
        note="Use bottom sheets on mobile for complex interactions like filters"
      />
    </SectionWrapper>
  );
}
