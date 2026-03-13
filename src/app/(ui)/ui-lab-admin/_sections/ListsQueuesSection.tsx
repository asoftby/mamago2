import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";

export function ListsQueuesSection() {
  return (
    <SectionWrapper
      id="lists-queues"
      title="6. Lists & Queues"
      description="List items for moderation queues, activity feeds, and notifications"
    >
      <PatternBlock
        title="Moderation Queue Item"
        description="Item in moderation queue with status indicator"
        desktop={
          <div className="border rounded-lg divide-y divide-gray-200">
            {[
              { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100", title: "Place needs review", desc: "Детский центр Радуга", time: "5 min ago" },
              { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100", title: "Pending approval", desc: "Мастер-класс по рисованию", time: "15 min ago" },
            ].map((item, i) => (
              <div key={i} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-3">
                <div className={`p-2 rounded-lg ${item.bg}`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
                </div>
                <span className="text-xs text-gray-500">{item.time}</span>
              </div>
            ))}
          </div>
        }
        mobile={
          <div className="border rounded-lg divide-y divide-gray-200">
            {[
              { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100", title: "Place needs review", desc: "Детский центр Радуга", time: "5 min ago" },
              { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100", title: "Pending approval", desc: "Мастер-класс", time: "15 min ago" },
            ].map((item, i) => (
              <div key={i} className="p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-2 mb-2">
                  <div className={`p-1.5 rounded ${item.bg}`}>
                    <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{item.desc}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">{item.time}</span>
              </div>
            ))}
          </div>
        }
        note="Mobile uses smaller icons and tighter spacing, truncates long text"
      />

      <PatternBlock
        title="Recent Activity Item"
        description="Activity feed item with type badge"
        desktop={
          <div className="border rounded-lg divide-y divide-gray-200">
            {[
              { type: "Approved", color: "bg-green-100 text-green-700", actor: "Admin", action: "approved place", entity: "Детский центр", time: "2 hours ago" },
              { type: "Created", color: "bg-blue-100 text-blue-700", actor: "Business", action: "created offer", entity: "Скидка 20%", time: "3 hours ago" },
            ].map((item, i) => (
              <div key={i} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-3">
                <div className={`px-2 py-1 rounded text-xs font-medium ${item.color}`}>
                  {item.type}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{item.actor}</span> {item.action} <span className="font-medium">{item.entity}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        }
        mobile={
          <div className="border rounded-lg divide-y divide-gray-200">
            {[
              { type: "Approved", color: "bg-green-100 text-green-700", actor: "Admin", action: "approved", entity: "Детский центр", time: "2h ago" },
              { type: "Created", color: "bg-blue-100 text-blue-700", actor: "Business", action: "created", entity: "Скидка 20%", time: "3h ago" },
            ].map((item, i) => (
              <div key={i} className="p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-2">
                  <div className={`px-1.5 py-0.5 rounded text-xs font-medium ${item.color}`}>
                    {item.type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-900">
                      <span className="font-medium">{item.actor}</span> {item.action} <span className="font-medium">{item.entity}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
        note="Mobile uses shorter time format and smaller badges"
      />
    </SectionWrapper>
  );
}
