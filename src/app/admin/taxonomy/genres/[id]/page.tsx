import { GenreEditPage } from "../_components/GenreEditPage";

export default function TaxonomyGenreEditPage() {
  return (
    <GenreEditPage
      listHrefBase="/admin/taxonomy/genres"
      listLabel="← К списку жанров"
      entityLabel="жанр"
    />
  );
}
