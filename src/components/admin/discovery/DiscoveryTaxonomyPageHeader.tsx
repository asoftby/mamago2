export function DiscoveryTaxonomyPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl md:text-xl font-bold text-gray-900">{title}</h1>
        {description ? (
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
