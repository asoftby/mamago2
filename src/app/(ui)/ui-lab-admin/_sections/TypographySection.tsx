import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";

export function TypographySection() {
  return (
    <SectionWrapper
      id="typography"
      title="0. Typography"
      description="Font sizes, weights, and code font variants for admin interface"
    >
      <PatternBlock
        title="Text Sizes"
        description="Standard text size scale for admin UI"
        desktop={
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">text-xs (12px)</p>
              <p className="text-xs text-gray-900">Helper text, timestamps, secondary labels</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">text-sm (14px)</p>
              <p className="text-sm text-gray-900">Body text, table cells, form labels</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">text-base (16px)</p>
              <p className="text-base text-gray-900">Default body text, mobile section titles</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">text-lg (18px)</p>
              <p className="text-lg text-gray-900">Section titles, card headers</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">text-xl (20px)</p>
              <p className="text-xl text-gray-900">Mobile page titles, large KPI values</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">text-2xl (24px)</p>
              <p className="text-2xl text-gray-900">Desktop page titles, KPI values</p>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">text-xs</p>
              <p className="text-xs text-gray-900">Helper text</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">text-sm</p>
              <p className="text-sm text-gray-900">Body text</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">text-base</p>
              <p className="text-base text-gray-900">Section titles</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">text-xl</p>
              <p className="text-xl text-gray-900">Page titles</p>
            </div>
          </div>
        }
        note="Desktop uses text-2xl for page titles, mobile uses text-xl. Body text is text-sm."
      />

      <PatternBlock
        title="Font Weights"
        description="Standard font weight scale"
        desktop={
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">font-normal (400)</p>
              <p className="font-normal text-sm text-gray-900">Regular body text, descriptions</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">font-medium (500)</p>
              <p className="font-medium text-sm text-gray-900">Labels, table headers, emphasized text</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">font-semibold (600)</p>
              <p className="font-semibold text-sm text-gray-900">Section titles, card headers</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">font-bold (700)</p>
              <p className="font-bold text-sm text-gray-900">Page titles, KPI values</p>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-2">
            <p className="font-normal text-sm text-gray-900">font-normal</p>
            <p className="font-medium text-sm text-gray-900">font-medium</p>
            <p className="font-semibold text-sm text-gray-900">font-semibold</p>
            <p className="font-bold text-sm text-gray-900">font-bold</p>
          </div>
        }
        note="Use font-bold for page titles, font-semibold for section titles, font-medium for labels"
      />

      <PatternBlock
        title="Code Font - Inline"
        description="Inline code snippets and technical values"
        desktop={
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Default inline code:</p>
              <p className="text-sm text-gray-900">
                Run <code className="px-1.5 py-0.5 bg-gray-100 text-gray-900 rounded text-xs font-mono">npm install</code> to install dependencies
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Technical values:</p>
              <p className="text-sm text-gray-900">
                API Key: <code className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">sk_live_abc123xyz</code>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">File paths:</p>
              <p className="text-sm text-gray-900">
                Edit <code className="px-1.5 py-0.5 bg-gray-100 text-gray-900 rounded text-xs font-mono">/src/config/settings.ts</code>
              </p>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-3">
            <p className="text-sm text-gray-900">
              Run <code className="px-1 py-0.5 bg-gray-100 text-gray-900 rounded text-xs font-mono">npm install</code>
            </p>
            <p className="text-sm text-gray-900">
              Key: <code className="px-1 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">sk_live_abc</code>
            </p>
          </div>
        }
        note="Use font-mono with bg-gray-100 for inline code. Use colored backgrounds for special values."
      />

      <PatternBlock
        title="Code Font - Block"
        description="Multi-line code blocks and command examples"
        desktop={
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Command block:</p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                npm run db:generate{'\n'}
                npm run db:migrate{'\n'}
                npm run dev
              </pre>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">JSON/Config block:</p>
              <pre className="bg-gray-50 border border-gray-200 text-gray-900 p-4 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "name": "admin-config",
  "version": "1.0.0",
  "enabled": true
}`}
              </pre>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Error/Warning block:</p>
              <pre className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-lg text-xs font-mono overflow-x-auto">
                Error: Connection failed{'\n'}
                at Database.connect (db.ts:45)
              </pre>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-600 mb-1">Command:</p>
              <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono overflow-x-auto">
                npm run dev
              </pre>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Config:</p>
              <pre className="bg-gray-50 border border-gray-200 text-gray-900 p-3 rounded text-xs font-mono overflow-x-auto">
{`{
  "enabled": true
}`}
              </pre>
            </div>
          </div>
        }
        note="Use bg-gray-900 with text-green-400 for terminal commands. Use bg-gray-50 for config/JSON."
      />

      <PatternBlock
        title="Code Font - Technical IDs"
        description="Database IDs, UUIDs, and technical identifiers"
        desktop={
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-600">User ID:</span>
              <code className="text-xs font-mono text-gray-900">usr_2kj4h5k6j7h8k9</code>
            </div>
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-600">Transaction ID:</span>
              <code className="text-xs font-mono text-gray-900">txn_abc123def456ghi789</code>
            </div>
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-600">API Endpoint:</span>
              <code className="text-xs font-mono text-blue-600">/api/v1/users</code>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-2">
            <div className="p-2 border border-gray-200 rounded">
              <p className="text-xs text-gray-600 mb-1">User ID:</p>
              <code className="text-xs font-mono text-gray-900 break-all">usr_2kj4h5k6j7h8k9</code>
            </div>
            <div className="p-2 border border-gray-200 rounded">
              <p className="text-xs text-gray-600 mb-1">Endpoint:</p>
              <code className="text-xs font-mono text-blue-600 break-all">/api/v1/users</code>
            </div>
          </div>
        }
        note="Use font-mono for IDs without background. Use break-all on mobile for long IDs."
      />

      <PatternBlock
        title="Typography Hierarchy"
        description="Complete hierarchy example"
        desktop={
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">Page Title (text-2xl font-bold)</h1>
            <p className="text-gray-600 text-sm">Page subtitle or description (text-sm text-gray-600)</p>
            
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Section Title (text-lg font-semibold)</h2>
              <p className="text-sm text-gray-900 mb-2">
                Body text paragraph (text-sm). This is the standard text size for most content in the admin panel.
              </p>
              <p className="text-xs text-gray-600">
                Helper text or secondary information (text-xs text-gray-600)
              </p>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase">Label (text-xs uppercase)</span>
              </div>
              <p className="text-sm font-medium text-gray-900">Value (text-sm font-medium)</p>
            </div>
          </div>
        }
        mobile={
          <div className="space-y-3">
            <h1 className="text-xl font-bold text-gray-900">Page Title (text-xl)</h1>
            <p className="text-gray-600 text-sm">Subtitle (text-sm)</p>
            
            <div className="mt-4">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Section (text-base)</h2>
              <p className="text-sm text-gray-900 mb-1">Body text (text-sm)</p>
              <p className="text-xs text-gray-600">Helper (text-xs)</p>
            </div>
          </div>
        }
        note="Maintain clear hierarchy: Page title > Section title > Body > Helper text"
      />
    </SectionWrapper>
  );
}
