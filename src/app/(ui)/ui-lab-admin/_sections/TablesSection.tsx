import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const mockData = [
  { id: 1, name: "John Doe", email: "john@example.com", status: "Active", role: "User" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", status: "Pending", role: "Business" },
  { id: 3, name: "Bob Johnson", email: "bob@example.com", status: "Active", role: "Admin" },
];

export function TablesSection() {
  return (
    <SectionWrapper
      id="tables"
      title="5. Tables"
      description="Data tables with desktop table and mobile card transformation"
    >
      <PatternBlock
        title="Standard Admin Table"
        description="Desktop table transforms to cards on mobile"
        desktop={
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mockData.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.role}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={row.status === "Active" ? "default" : "secondary"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Button variant="ghost" size="sm">View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
        mobile={
          <div className="space-y-3">
            {mockData.map((row) => (
              <div key={row.id} className="border rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{row.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{row.email}</p>
                  </div>
                  <Badge variant={row.status === "Active" ? "default" : "secondary"} className="text-xs">
                    {row.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-600">{row.role}</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">View</Button>
                </div>
              </div>
            ))}
          </div>
        }
        note="Desktop uses table, mobile transforms to card list with key info visible"
      />

      <PatternBlock
        title="Table Pagination"
        description="Pagination controls for tables"
        desktop={
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing 1-10 of 45
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>Previous</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-2 px-3 py-2 border-t border-gray-200">
            <div className="text-xs text-gray-600 text-center">
              Page 1 of 5
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled className="flex-1 text-xs">Prev</Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs">Next</Button>
            </div>
          </div>
        }
        note="Mobile pagination uses full-width buttons with shorter labels"
      />
    </SectionWrapper>
  );
}
