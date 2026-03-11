import { PlaceCard } from "@/components/place/PlaceCard";

export function PlaceCardSection() {
  // Mock data for demonstrations
  const mockPlaces = {
    place1: {
      id: "place1",
      slug: "pugovka-na-vostochnoy",
      title: "Пуговка",
      coverImage: "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600",
      cityAddress: "Минск, ул.Восточная 137",
      district: "Московский район",
      metro: "м.Уручье",
      tags: ["0+", "indoor", "playroom"],
    },
    place2: {
      id: "place2",
      slug: "detskiy-mir-na-pritytskogo",
      title: "Детский мир на Притыцкого",
      coverImage: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600",
      cityAddress: "Минск, ул.Притыцкого 12",
      district: undefined,
      metro: "м.Спортивная",
      tags: ["0+", "shop", "toys"],
    },
    place3: {
      id: "place3",
      slug: "kafe-skazka",
      title: "Кафе Сказка с детской комнатой и игровой зоной",
      coverImage: null,
      cityAddress: "Минск, ул.Ленина 5",
      district: "Советский район",
      metro: undefined,
      tags: ["3+", "cafe", "indoor", "playroom", "food"],
    },
    place4: {
      id: "place4",
      slug: "park-gorkogo",
      title: "Парк Горького",
      coverImage: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600",
      cityAddress: "Минск, ул.Кирова 1",
      district: "Центральный район",
      metro: "м.Площадь Победы",
      tags: ["0+", "outdoor", "park", "free"],
    },
    place5: {
      id: "place5",
      slug: "pugovka-na-ratomskoy",
      title: "Пуговка на Ратомской",
      coverImage: "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600",
      cityAddress: "Минск, ул.Ратомская 7",
      district: "Советский район",
      metro: "м.Восток",
      tags: ["0+", "indoor", "playroom"],
    },
    place6: {
      id: "place6",
      slug: "pugovka-na-nezavisimosti",
      title: "Пуговка",
      coverImage: "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600",
      cityAddress: "Минск, пр-т Независимости 47",
      district: "Ленинский район",
      metro: "м.Площадь Ленина",
      tags: ["0+", "indoor"],
    },
  };

  return (
    <section id="place-card" className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">PlaceCard</h2>
        <p className="text-muted-foreground">
          Card component for places with focus on photo, title, and location. Three variants: default, compact, network.
        </p>
      </div>

      <div className="space-y-12">
        {/* Address Format Demo */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">2-Line Address Format</h3>
            <p className="text-sm text-muted-foreground">
              Line 1: City + Address | Line 2: District • Metro (with • separator)
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Full address (both lines)</p>
              <PlaceCard
                id="addr1"
                slug="full-address"
                title="Место с полным адресом"
                coverImage="https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600"
                cityAddress="Минск, ул.Ратомская 7"
                district="Центральный район"
                metro="м.Немига"
                tags={["0+", "indoor"]}
                variant="default"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Only metro (no district)</p>
              <PlaceCard
                id="addr2"
                slug="metro-only"
                title="Место только с метро"
                coverImage="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600"
                cityAddress="Минск, ул.Притыцкого 12"
                district={undefined}
                metro="м.Спортивная"
                tags={["0+", "shop"]}
                variant="default"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Only district (no metro)</p>
              <PlaceCard
                id="addr3"
                slug="district-only"
                title="Место только с районом"
                coverImage="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600"
                cityAddress="Минск, ул.Ленина 5"
                district="Советский район"
                metro={undefined}
                tags={["3+", "cafe"]}
                variant="default"
              />
            </div>
          </div>
        </div>

        {/* Variant: Default */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Default Variant</h3>
            <p className="text-sm text-muted-foreground">
              Standard place card for general use. Suitable for grids and lists.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <PlaceCard {...mockPlaces.place1} variant="default" />
            <PlaceCard {...mockPlaces.place2} variant="default" isSaved />
            <PlaceCard {...mockPlaces.place3} variant="default" />
          </div>
        </div>

        {/* Variant: Compact */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Compact Variant</h3>
            <p className="text-sm text-muted-foreground">
              Compact version for dense layouts. Same content, tighter spacing.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <PlaceCard {...mockPlaces.place1} variant="compact" />
            <PlaceCard {...mockPlaces.place2} variant="compact" />
            <PlaceCard {...mockPlaces.place3} variant="compact" isSaved />
            <PlaceCard {...mockPlaces.place4} variant="compact" />
          </div>
        </div>

        {/* Variant: Network */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Network Variant</h3>
            <p className="text-sm text-muted-foreground">
              Compact vertical card for "Places in this network" sections. Optimized for horizontal scroll on mobile.
            </p>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4">
            <PlaceCard {...mockPlaces.place1} variant="network" />
            <PlaceCard {...mockPlaces.place5} variant="network" isSaved />
            <PlaceCard {...mockPlaces.place6} variant="network" />
            <PlaceCard {...mockPlaces.place1} variant="network" />
          </div>
        </div>

        {/* Save States */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Save States</h3>
            <p className="text-sm text-muted-foreground">
              Heart icon in top-right corner. Default (outline) and saved (filled) states.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <p className="text-sm font-medium">Default (not saved)</p>
              <PlaceCard {...mockPlaces.place1} variant="default" isSaved={false} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Saved</p>
              <PlaceCard {...mockPlaces.place1} variant="default" isSaved={true} />
            </div>
          </div>
        </div>

        {/* Edge Cases */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Edge Cases</h3>
            <p className="text-sm text-muted-foreground">
              Long titles, no image, no location, many tags, address variations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PlaceCard
              id="edge1"
              slug="long-title"
              title="Очень длинное название места которое должно обрезаться на две строки"
              coverImage="https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600"
              cityAddress="Минск, ул.Восточная 137"
              district="Московский район"
              metro="м.Уручье"
              tags={["0+"]}
              variant="default"
            />
            <PlaceCard
              id="edge2"
              slug="no-image"
              title="Место без фото"
              coverImage={null}
              cityAddress="Минск, ул.Ленина 10"
              district="Центральный район"
              metro={undefined}
              tags={["3+", "indoor"]}
              variant="default"
            />
            <PlaceCard
              id="edge3"
              slug="many-tags"
              title="Место с множеством тегов"
              coverImage="https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=600"
              cityAddress="Минск, пр-т Независимости 47"
              district={undefined}
              metro="м.Площадь Ленина"
              tags={["0+", "indoor", "outdoor", "cafe", "playroom", "shop", "free"]}
              variant="default"
            />
          </div>
        </div>

        {/* Network Section Example */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Network Section Example</h3>
            <p className="text-sm text-muted-foreground">
              "Other places in this network" section with horizontal scroll. Note 2-line address format.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-4">
              <h4 className="text-lg font-semibold">Другие места сети Пуговка</h4>
              <p className="text-sm text-muted-foreground">3 филиала в Минске</p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              <PlaceCard
                id="network1"
                slug="pugovka-na-vostochnoy"
                title="Пуговка на Восточной"
                coverImage="https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600"
                cityAddress="Минск, ул.Восточная 137"
                district="Московский район"
                metro="м.Уручье"
                tags={["0+", "indoor", "playroom"]}
                variant="network"
              />
              <PlaceCard
                id="network2"
                slug="pugovka-na-ratomskoy"
                title="Пуговка на Ратомской"
                coverImage="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600"
                cityAddress="Минск, ул.Ратомская 7"
                district="Советский район"
                metro="м.Восток"
                tags={["0+", "indoor"]}
                variant="network"
                isSaved
              />
              <PlaceCard
                id="network3"
                slug="pugovka-na-nezavisimosti"
                title="Пуговка"
                coverImage="https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600"
                cityAddress="Минск, пр-т Независимости 47"
                district="Ленинский район"
                metro={undefined}
                tags={["0+", "playroom"]}
                variant="network"
              />
            </div>
          </div>
        </div>

        {/* Responsive Grid */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold mb-1">Responsive Grid</h3>
            <p className="text-sm text-muted-foreground">
              Default variant in responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <PlaceCard {...mockPlaces.place1} variant="default" />
            <PlaceCard {...mockPlaces.place2} variant="default" isSaved />
            <PlaceCard {...mockPlaces.place3} variant="default" />
            <PlaceCard {...mockPlaces.place4} variant="default" />
            <PlaceCard {...mockPlaces.place5} variant="default" />
            <PlaceCard {...mockPlaces.place6} variant="default" isSaved />
          </div>
        </div>
      </div>
    </section>
  );
}
