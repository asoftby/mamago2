import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export function FormsSection() {
  return (
    <SectionWrapper
      id="forms"
      title="8. Forms"
      description="Form fields and layouts for admin data entry"
    >
      <PatternBlock
        title="Form Field with Label"
        description="Standard labeled input field"
        desktop={
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">
              Field Label
            </label>
            <Input placeholder="Enter value..." />
            <p className="text-xs text-gray-600">Helper text for this field</p>
          </div>
        }
        mobile={
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-900">
              Field Label
            </label>
            <Input placeholder="Enter value..." />
            <p className="text-xs text-gray-600">Helper text</p>
          </div>
        }
        note="Use consistent spacing between label, input, and helper text"
      />

      <PatternBlock
        title="Inline Field Row"
        description="Multiple fields in a row"
        desktop={
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">First Name</label>
              <Input placeholder="John" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Last Name</label>
              <Input placeholder="Doe" />
            </div>
          </div>
        }
        mobile={
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-900">First Name</label>
              <Input placeholder="John" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-900">Last Name</label>
              <Input placeholder="Doe" />
            </div>
          </div>
        }
        note="Desktop uses grid-cols-2, mobile stacks vertically"
      />

      <PatternBlock
        title="Select Field"
        description="Dropdown select control"
        desktop={
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">
              Category
            </label>
            <Select defaultValue="option1">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">Option 1</SelectItem>
                <SelectItem value="option2">Option 2</SelectItem>
                <SelectItem value="option3">Option 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        mobile={
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-900">
              Category
            </label>
            <Select defaultValue="option1">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">Option 1</SelectItem>
                <SelectItem value="option2">Option 2</SelectItem>
                <SelectItem value="option3">Option 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        note="Select controls work the same on desktop and mobile"
      />

      <PatternBlock
        title="Form Actions"
        description="Save/cancel button group"
        desktop={
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Saved 2 minutes ago</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">Cancel</Button>
              <Button>Save Changes</Button>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span>Saved 2 min ago</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">Cancel</Button>
              <Button className="flex-1">Save</Button>
            </div>
          </div>
        }
        note="Mobile stacks save status and buttons, uses full-width buttons"
      />
    </SectionWrapper>
  );
}
