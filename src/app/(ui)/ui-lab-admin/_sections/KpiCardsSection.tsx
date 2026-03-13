import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";
import { DollarSign, Users, AlertTriangle, TrendingUp } from "lucide-react";

export function KpiCardsSection() {
  return (
    <SectionWrapper
      id="kpi-cards"
      title="3. KPI Cards"
      description="Metric cards for dashboards and overview pages"
    >
      <PatternBlock
        title="Standard KPI Cards"
        description="Basic metric display cards"
        desktop={
          <div className="grid grid-cols-4 gap-4">
            {[
              { icon: Users, label: "Total Users", value: "1,234", color: "text-blue-600" },
              { icon: DollarSign, label: "Revenue", value: "$12.5K", color: "text-green-600" },
              { icon: TrendingUp, label: "Growth", value: "+12%", color: "text-purple-600" },
              { icon: AlertTriangle, label: "Pending", value: "23", color: "text-orange-600" },
            ].map((kpi, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  <p className="text-sm text-gray-600">{kpi.label}</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              </div>
            ))}
          </div>
        }
        mobile={
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Users, label: "Users", value: "1,234", color: "text-blue-600" },
              { icon: DollarSign, label: "Revenue", value: "$12.5K", color: "text-green-600" },
              { icon: TrendingUp, label: "Growth", value: "+12%", color: "text-purple-600" },
              { icon: AlertTriangle, label: "Pending", value: "23", color: "text-orange-600" },
            ].map((kpi, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  <p className="text-xs text-gray-600">{kpi.label}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
              </div>
            ))}
          </div>
        }
        note="Desktop uses 4-column grid, mobile uses 2-column with smaller text"
      />

      <PatternBlock
        title="Alert KPI Card"
        description="KPI card with alert state"
        desktop={
          <div className="bg-red-50 rounded-lg border-2 border-red-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <p className="text-sm text-red-700 font-medium">Failed Payments</p>
            </div>
            <p className="text-2xl font-bold text-red-900">8</p>
            <p className="text-xs text-red-600 mt-1">Requires attention</p>
          </div>
        }
        mobile={
          <div className="bg-red-50 rounded-lg border-2 border-red-200 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <p className="text-xs text-red-700 font-medium">Failed Payments</p>
            </div>
            <p className="text-xl font-bold text-red-900">8</p>
            <p className="text-xs text-red-600 mt-1">Requires attention</p>
          </div>
        }
        note="Use colored backgrounds and borders for alert states"
      />
    </SectionWrapper>
  );
}
