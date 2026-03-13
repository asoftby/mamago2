import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ToolbarsSection() {
  return (
    <SectionWrapper
      id="toolbars"
      title="2. Toolbars"
      description="Search, filters, and action controls for admin list pages"
    >
      <PatternBlock
        title="Search & Filter Toolbar"
        description="Standard toolbar with search and filter controls"
        desktop={
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search..."
                className="pl-9"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="type1">Type 1</SelectItem>
                <SelectItem value="type2">Type 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        mobile={
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              Filters (2)
            </Button>
          </div>
        }
        note="Desktop shows inline filters, mobile uses filter sheet trigger"
      />

      <PatternBlock
        title="Status Tabs"
        description="Segmented control for status filtering"
        desktop={
          <div className="flex gap-2 border-b border-gray-200">
            <button className="px-4 py-2 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
              All (24)
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Pending (12)
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Approved (8)
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              Rejected (4)
            </button>
          </div>
        }
        mobile={
          <div className="flex gap-1 overflow-x-auto pb-2">
            <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-full whitespace-nowrap">
              All (24)
            </button>
            <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full whitespace-nowrap">
              Pending (12)
            </button>
            <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full whitespace-nowrap">
              Approved (8)
            </button>
            <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-full whitespace-nowrap">
              Rejected (4)
            </button>
          </div>
        }
        note="Desktop uses underline tabs, mobile uses pill buttons with horizontal scroll"
      />
    </SectionWrapper>
  );
}
