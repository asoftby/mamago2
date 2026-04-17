import { SectionWrapper } from "../_components/SectionWrapper";

export function AdminUIRulesSection() {
  return (
    <SectionWrapper
      id="rules"
      title="Admin UI Rules"
      description="UI standards and patterns for the admin panel"
    >
      <div className="space-y-8">
        {/* Source of Truth */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Source of Truth Policy</h3>
          <div className="space-y-2 text-sm text-blue-900">
            <p className="font-medium">This page (/ui-lab-admin) is the single source of truth for admin UI patterns.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>All admin pages must follow the patterns demonstrated here</li>
              <li>Do NOT create custom layouts or one-off patterns</li>
              <li>Reference this page before building or refactoring admin pages</li>
              <li>When in doubt, copy the pattern from ui-lab-admin</li>
            </ul>
          </div>
        </div>

        {/* Page Layout Structure */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Page Layout Structure</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
            <div className="font-mono text-xs bg-gray-50 p-3 rounded border border-gray-200">
              <div>{'<div className="p-6 space-y-6">'}</div>
              <div className="ml-4">{'  {/* Page Header */'}</div>
              <div className="ml-4">{'  <div className="flex items-center justify-between">'}</div>
              <div className="ml-8">{'    <h1 className="text-2xl md:text-xl font-bold">Title</h1>'}</div>
              <div className="ml-8">{'    <div>{/* Actions */}</div>'}</div>
              <div className="ml-4">{'  </div>'}</div>
              <div className="ml-4 mt-2">{'  {/* Toolbar */'}</div>
              <div className="ml-4">{'  {/* Content */'}</div>
              <div>{'</div>'}</div>
            </div>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-6</code> page padding (desktop), <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-4</code> (mobile)</li>
              <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-6</code> vertical rhythm between major sections</li>
              <li>Page header always at top with title + actions</li>
              <li>Toolbar below header (search, filters, tabs)</li>
              <li>Content area below toolbar</li>
            </ul>
          </div>
        </div>

        {/* Typography Scale */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Typography Scale</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Element</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Desktop</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Mobile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 text-gray-900">Page Title</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-2xl font-bold</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-xl font-bold</code></td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Section Title</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-lg font-semibold</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-base font-semibold</code></td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Body Text</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-sm</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-sm</code></td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Helper Text</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-xs text-gray-600</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-xs text-gray-600</code></td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Table Text</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-sm</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-sm</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Toolbar Sizing Rules */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Toolbar Sizing Rules</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Search input: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">h-10</code> height, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-sm</code></li>
              <li>Filter buttons: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">h-10</code> height, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">px-4</code> padding</li>
              <li>Action buttons: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">h-10</code> height, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">px-4</code> padding</li>
              <li>Select controls: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">h-10</code> height</li>
              <li>Desktop: Inline layout with <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">gap-3</code> between elements</li>
              <li>Mobile: Stacked layout with <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-3</code>, full-width inputs</li>
            </ul>
          </div>
        </div>

        {/* Card/Container Style */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Card/Container Style</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
            <div className="font-medium text-gray-900 mb-2">Standard Card Pattern:</div>
            <div className="font-mono text-xs bg-gray-50 p-3 rounded border border-gray-200">
              {'className="bg-white border border-gray-200 rounded-lg p-6"'}
            </div>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2 mt-3">
              <li>Use <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">border</code> style, NOT shadow-based cards</li>
              <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">rounded-lg</code> for all containers</li>
              <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-6</code> padding (desktop), <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-4</code> (mobile)</li>
              <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">bg-white</code> background with <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">border-gray-200</code></li>
              <li>Alert cards: Use colored backgrounds (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">bg-red-50</code>, <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">bg-yellow-50</code>)</li>
            </ul>
          </div>
        </div>

        {/* Table Rhythm */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Table Rhythm</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
            <ul className="list-disc list-inside space-y-2 text-gray-700 ml-2">
              <li>Table container: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">border border-gray-200 rounded-lg overflow-hidden</code></li>
              <li>Header row: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">bg-gray-50 border-b border-gray-200</code></li>
              <li>Body rows: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">divide-y divide-gray-200</code></li>
              <li>Cell padding: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">px-4 py-3</code></li>
              <li>Text size: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-sm</code></li>
              <li>Header text: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">font-medium text-gray-700</code></li>
              <li className="font-medium text-gray-900 mt-2">Mobile: Transform tables to card lists (see Tables section)</li>
            </ul>
          </div>
        </div>

        {/* Spacing System */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Spacing System</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-medium text-gray-900 mb-2">Vertical Rhythm:</div>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
                  <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-6</code> - Between major sections</li>
                  <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-4</code> - Within sections</li>
                  <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-3</code> - Between form fields</li>
                  <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-2</code> - Tight grouping</li>
                </ul>
              </div>
              <div>
                <div className="font-medium text-gray-900 mb-2">Horizontal Rhythm:</div>
                <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
                  <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">gap-6</code> - Between major columns</li>
                  <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">gap-4</code> - Between cards in grid</li>
                  <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">gap-3</code> - Between toolbar items</li>
                  <li><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">gap-2</code> - Between inline elements</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* UI States */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">UI States</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
            <div className="space-y-3">
              <div>
                <div className="font-medium text-gray-900 mb-1">Loading State:</div>
                <p className="text-gray-700">Show skeleton loaders or spinner. Use <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">animate-pulse</code> for skeleton screens.</p>
              </div>
              <div>
                <div className="font-medium text-gray-900 mb-1">Empty State:</div>
                <p className="text-gray-700">Center-aligned icon + message + optional action button. Use <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-gray-500</code> for message.</p>
              </div>
              <div>
                <div className="font-medium text-gray-900 mb-1">Error State:</div>
                <p className="text-gray-700">Red alert box with error message. Use <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">bg-red-50 border-red-200 text-red-900</code>.</p>
              </div>
              <div>
                <div className="font-medium text-gray-900 mb-1">No Results State:</div>
                <p className="text-gray-700">Similar to empty state but with search/filter context. Suggest clearing filters.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop vs Mobile Patterns */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Desktop vs Mobile Patterns</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Pattern</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Desktop</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Mobile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 text-gray-900">Page Title</td>
                  <td className="px-4 py-2">text-2xl</td>
                  <td className="px-4 py-2">text-xl</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Page Padding</td>
                  <td className="px-4 py-2">p-6</td>
                  <td className="px-4 py-2">p-4</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Toolbar</td>
                  <td className="px-4 py-2">Inline (flex-row)</td>
                  <td className="px-4 py-2">Stacked (flex-col)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Tables</td>
                  <td className="px-4 py-2">Full table</td>
                  <td className="px-4 py-2">Card list</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">KPI Cards</td>
                  <td className="px-4 py-2">grid-cols-4</td>
                  <td className="px-4 py-2">grid-cols-2</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Two-Column Layout</td>
                  <td className="px-4 py-2">Side by side</td>
                  <td className="px-4 py-2">Stacked</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Form Actions</td>
                  <td className="px-4 py-2">Inline buttons</td>
                  <td className="px-4 py-2">Full-width stacked</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Filters</td>
                  <td className="px-4 py-2">Inline dropdowns</td>
                  <td className="px-4 py-2">Bottom sheet</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Restriction Against Custom Layouts */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-3">⚠️ Restriction Against Custom Layouts</h3>
          <div className="space-y-2 text-sm text-red-900">
            <p className="font-medium">Do NOT create custom layouts or one-off patterns.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Every admin page must use patterns from this lab</li>
              <li>If you need a new pattern, add it to ui-lab-admin first</li>
              <li>Do NOT use shadow-based cards (use border-based)</li>
              <li>Do NOT use custom spacing values (use the spacing system)</li>
              <li>Do NOT use custom font sizes (use the typography scale)</li>
              <li>Do NOT create responsive patterns that differ from the documented mobile transformations</li>
            </ul>
            <p className="font-medium mt-3">When in doubt: Copy from ui-lab-admin, don&#39;t improvise.</p>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
