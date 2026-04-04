import { SectionWrapper } from "../_components/SectionWrapper";

export function LayoutContractSection() {
  return (
    <SectionWrapper
      id="layout-contract"
      title="Layout Contract"
      description="Structural specification for all admin pages"
    >
      <div className="space-y-8">
        {/* Introduction */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">Contract Definition:</span> Every admin page must follow this structural specification. 
            This is not optional. This ensures visual consistency, predictable behavior, and maintainable code across the entire admin panel.
          </p>
        </div>

        {/* 1. Page Skeleton */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">1. Page Skeleton</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <p className="text-sm text-gray-700">Every admin page must follow this structure:</p>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto">
{`// AdminPageContainer
<div className="p-6 md:p-4 space-y-6">
  
  {/* AdminPageHeader */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl md:text-xl font-bold text-gray-900">
        Page Title
      </h1>
      <p className="text-sm text-gray-600 mt-1">
        Optional subtitle
      </p>
    </div>
    <div className="flex items-center gap-3">
      {/* Header actions */}
    </div>
  </div>

  {/* AdminPageToolbar (optional) */}
  <div className="flex flex-col md:flex-row gap-3">
    {/* Search, filters, tabs */}
  </div>

  {/* AdminPageContent */}
  <div className="space-y-6">
    {/* Page content */}
  </div>

</div>`}
            </pre>
            <div className="text-sm text-gray-700 space-y-1">
              <p><span className="font-medium">Required:</span> AdminPageContainer, AdminPageHeader, AdminPageContent</p>
              <p><span className="font-medium">Optional:</span> AdminPageToolbar (only if page has search/filters/tabs)</p>
            </div>
          </div>
        </div>

        {/* 2. Spacing Contract */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">2. Spacing Contract</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Element</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Desktop</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Mobile</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 text-gray-900">Page Padding</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-6</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-4</code></td>
                  <td className="px-4 py-2 text-gray-600">Required</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Vertical Rhythm (major sections)</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-6</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-6</code></td>
                  <td className="px-4 py-2 text-gray-600">Required</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Section Internal Spacing</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-4</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-4</code></td>
                  <td className="px-4 py-2 text-gray-600">Allowed</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Card Padding</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-6</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-4</code></td>
                  <td className="px-4 py-2 text-gray-600">Standard</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Compact Card Padding</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-4</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">p-3</code></td>
                  <td className="px-4 py-2 text-gray-600">Allowed</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Toolbar Item Gap</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">gap-3</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">space-y-3</code></td>
                  <td className="px-4 py-2 text-gray-600">Required</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Grid Gap (KPI cards)</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">gap-4</code></td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">gap-4</code></td>
                  <td className="px-4 py-2 text-gray-600">Standard</td>
                </tr>
              </tbody>
            </table>
            <div className="bg-red-50 border-t border-red-200 p-3">
              <p className="text-xs text-red-900">
                <span className="font-semibold">Forbidden:</span> Custom spacing values outside this table. Use only: 2, 3, 4, 6.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Typography Contract */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">3. Typography Contract</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Element</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Class</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 text-gray-900">Page Title</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-2xl md:text-xl font-bold</code></td>
                  <td className="px-4 py-2 text-gray-600">Required on every page</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Page Subtitle</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-sm text-gray-600</code></td>
                  <td className="px-4 py-2 text-gray-600">Optional description</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Section Title</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-lg md:text-base font-semibold</code></td>
                  <td className="px-4 py-2 text-gray-600">For major sections</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Card Header</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-base font-semibold</code></td>
                  <td className="px-4 py-2 text-gray-600">Card titles</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Body / Table Text</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-sm</code></td>
                  <td className="px-4 py-2 text-gray-600">Default text size</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Helper / Secondary Text</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-xs text-gray-600</code></td>
                  <td className="px-4 py-2 text-gray-600">Timestamps, hints</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-900">Label</td>
                  <td className="px-4 py-2"><code className="text-xs bg-gray-100 px-1 py-0.5 rounded">text-sm font-medium</code></td>
                  <td className="px-4 py-2 text-gray-600">Form labels, table headers</td>
                </tr>
              </tbody>
            </table>
            <div className="bg-red-50 border-t border-red-200 p-3">
              <p className="text-xs text-red-900">
                <span className="font-semibold">Forbidden:</span> text-3xl, text-4xl, or custom font sizes in admin pages.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Controls Contract */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">4. Controls Contract</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-sm text-gray-700 font-medium">All interactive controls must use standard sizing:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">Input / Select</span>
                  <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">h-10</code>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">Button (standard)</span>
                  <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">h-10 px-4</code>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">Button (compact)</span>
                  <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">h-8 px-3</code>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">Search Input</span>
                  <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">h-10</code>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">Textarea</span>
                  <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">min-h-24</code>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-700">Checkbox / Radio</span>
                  <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">h-4 w-4</code>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
              <p className="text-xs text-yellow-900">
                <span className="font-semibold">Rule:</span> All controls in a toolbar must have the same height (h-10). 
                This creates visual alignment and professional appearance.
              </p>
            </div>
          </div>
        </div>

        {/* 5. Card / Shell Contract */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">5. Card / Shell Contract</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Standard Card Pattern:</p>
              <pre className="bg-gray-50 border border-gray-200 p-3 rounded text-xs font-mono overflow-x-auto">
                {'className="bg-white border border-gray-200 rounded-lg p-6 md:p-4"'}
              </pre>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Compact Card Pattern:</p>
              <pre className="bg-gray-50 border border-gray-200 p-3 rounded text-xs font-mono overflow-x-auto">
                {'className="bg-white border border-gray-200 rounded-lg p-4 md:p-3"'}
              </pre>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Alert Card Pattern:</p>
              <pre className="bg-gray-50 border border-gray-200 p-3 rounded text-xs font-mono overflow-x-auto">
                {'className="bg-red-50 border border-red-200 rounded-lg p-4"'}
              </pre>
            </div>
            <div className="space-y-2 text-sm text-gray-700 pt-3 border-t border-gray-200">
              <p><span className="font-medium">✓ Allowed:</span> Standard card, Compact card, Alert card (red/yellow/blue)</p>
              <p><span className="font-medium">✗ Forbidden:</span> Shadow-based cards, custom border radius, custom padding values</p>
            </div>
          </div>
        </div>

        {/* 6. Toolbar Contract */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">6. Toolbar Contract</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Desktop Toolbar Pattern (inline):</p>
              <pre className="bg-gray-50 border border-gray-200 p-3 rounded text-xs font-mono overflow-x-auto">
{`<div className="flex items-center gap-3">
  <input className="h-10 flex-1" placeholder="Search..." />
  <FilterSelect className="w-48" ... />
  <button className="h-10 px-4">Filter</button>
</div>`}
              </pre>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Mobile Toolbar Pattern (stacked):</p>
              <pre className="bg-gray-50 border border-gray-200 p-3 rounded text-xs font-mono overflow-x-auto">
{`<div className="flex flex-col md:flex-row gap-3">
  <input className="h-10 w-full" placeholder="Search..." />
  <FilterSelect className="w-full" ... />
  <button className="h-10 w-full">Filter</button>
</div>`}
              </pre>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs text-blue-900">
                <span className="font-semibold">Pattern:</span> Desktop uses <code className="bg-white px-1 rounded">flex-row</code> with <code className="bg-white px-1 rounded">gap-3</code>. 
                Mobile uses <code className="bg-white px-1 rounded">flex-col</code> with <code className="bg-white px-1 rounded">space-y-3</code> and full-width controls.
              </p>
            </div>
          </div>
        </div>

        {/* 7. Table Contract */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">7. Table Contract</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Desktop Table Pattern:</p>
              <pre className="bg-gray-50 border border-gray-200 p-3 rounded text-xs font-mono overflow-x-auto">
{`<div className="border border-gray-200 rounded-lg overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        <th className="px-4 py-3 text-left font-medium">...</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200">
      <tr>
        <td className="px-4 py-3">...</td>
      </tr>
    </tbody>
  </table>
</div>`}
              </pre>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Mobile Alternative (Card List):</p>
              <pre className="bg-gray-50 border border-gray-200 p-3 rounded text-xs font-mono overflow-x-auto">
{`<div className="md:hidden space-y-3">
  {items.map(item => (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="font-medium">{item.title}</div>
      <div className="text-sm text-gray-600">{item.subtitle}</div>
    </div>
  ))}
</div>`}
              </pre>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-xs text-red-900">
                <span className="font-semibold">Forbidden:</span> Simply shrinking tables on mobile. Tables with 5+ columns MUST transform to card lists on mobile.
              </p>
            </div>
          </div>
        </div>

        {/* 8. State Contract */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">8. State Contract</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">State</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Pattern</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Required Elements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-gray-900">Loading</td>
                  <td className="px-4 py-3 text-gray-600">Skeleton or spinner</td>
                  <td className="px-4 py-3 text-gray-600">Visual indicator, no blank screen</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-gray-900">Empty</td>
                  <td className="px-4 py-3 text-gray-600">Center-aligned message</td>
                  <td className="px-4 py-3 text-gray-600">Icon, message, optional action</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-gray-900">Error</td>
                  <td className="px-4 py-3 text-gray-600">Red alert box</td>
                  <td className="px-4 py-3 text-gray-600">Error message, retry option</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-gray-900">No Results</td>
                  <td className="px-4 py-3 text-gray-600">Empty state with context</td>
                  <td className="px-4 py-3 text-gray-600">Message, clear filters action</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg p-3">
            <p className="text-xs text-gray-700">
              <span className="font-medium">Rule:</span> Every data-dependent section must handle all four states explicitly.
            </p>
          </div>
        </div>

        {/* 9. Actionability Contract */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">9. Actionability Contract</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Rule:</span> KPI cards, attention items, and dashboard widgets must be actionable.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <div>
                  <p className="font-medium text-gray-900">Good: Clickable KPI card</p>
                  <p className="text-gray-600">Links to filtered list of items (e.g., "12 Pending" → /admin/moderation/places?status=pending)</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <div>
                  <p className="font-medium text-gray-900">Good: Alert with action</p>
                  <p className="text-gray-600">"3 Failed Payments" with "View Transactions" button</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-600 font-bold">✗</span>
                <div>
                  <p className="font-medium text-gray-900">Bad: Static KPI card</p>
                  <p className="text-gray-600">Shows number but has no link or action</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-600 font-bold">✗</span>
                <div>
                  <p className="font-medium text-gray-900">Bad: Fake link</p>
                  <p className="text-gray-600">Links to non-existent route or shows mock data</p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
              <p className="text-xs text-yellow-900">
                <span className="font-semibold">Enforcement:</span> Every KPI card must link to a real, existing admin route. 
                If the destination doesn't exist yet, don't show the KPI card.
              </p>
            </div>
          </div>
        </div>

        {/* 10. No Custom Layout Rule */}
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <h3 className="text-lg font-semibold text-red-900 mb-3">10. No Custom Layout Rule</h3>
          <div className="space-y-3 text-sm text-red-900">
            <p className="font-semibold">This is the most important rule:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Do NOT create page-specific layout inventions</li>
              <li>Do NOT use custom spacing, typography, or component sizing</li>
              <li>Do NOT improvise responsive patterns</li>
              <li>Do NOT use patterns not documented in ui-lab-admin</li>
            </ul>
            <div className="bg-white border border-red-200 rounded p-3 mt-3">
              <p className="font-semibold mb-2">If you need a new pattern:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Add it to /ui-lab-admin first</li>
                <li>Document desktop AND mobile variants</li>
                <li>Get approval for the pattern</li>
                <li>Then use it in real admin pages</li>
              </ol>
            </div>
            <p className="font-semibold mt-3">
              When in doubt: Copy from ui-lab-admin. Don't improvise.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gray-900 text-gray-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">Contract Summary</h3>
          <div className="space-y-2 text-sm">
            <p>✓ Use the page skeleton structure</p>
            <p>✓ Follow spacing contract (2, 3, 4, 6 only)</p>
            <p>✓ Follow typography contract (xs, sm, base, lg, xl, 2xl only)</p>
            <p>✓ Use standard control heights (h-8, h-10)</p>
            <p>✓ Use border-based cards, not shadow-based</p>
            <p>✓ Transform tables to cards on mobile</p>
            <p>✓ Handle all four states (loading, empty, error, no results)</p>
            <p>✓ Make KPI cards and alerts actionable</p>
            <p>✓ Copy patterns from ui-lab-admin, don't improvise</p>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
