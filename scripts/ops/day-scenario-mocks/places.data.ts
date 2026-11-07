/**
 * Mock places for the day-scenario test catalog (DEV only). Coordinates are real
 * OpenStreetMap point positions inside five Minsk clusters (osm = source object id);
 * names are generic and prefixed "[MOCK]", so no real business is represented.
 * Generated once from OSM category searches; edit by hand afterwards.
 */
export type ClusterKey = "center" | "uruche" | "kamgorka" | "serebr" | "bor" | "zhd";
export type MockCategory = "ent" | "play" | "museum" | "park" | "sport" | "creative" | "food";
export type HoursVariant = "weekly" | "exception" | "always" | "appointment" | "temp-closed" | "none" | "monday-off";

export type MockPlaceSpec = {
  key: string;
  cluster: ClusterKey;
  category: MockCategory;
  title: string;
  lat: number | null;
  lng: number | null;
  osm: string | null;
  /** Place category slugs from prisma/seed/place-categories.ts. */
  primary: string;
  sub: string | null;
  ages: string[];
  adultOnly: boolean;
  hours: HoursVariant;
};

export const CLUSTER_LABEL: Record<ClusterKey, string> = {
  center: "Центр",
  uruche: "Уручье / Зелёный Луг",
  kamgorka: "Каменная Горка",
  serebr: "Серебрянка / Чижовка",
  bor: "Пригород: Боровляны",
  zhd: "Пригород: Ждановичи",
};

export const MOCK_PLACES: MockPlaceSpec[] = [
  { key: "center-ent-1", cluster: "center", category: "ent", title: "[MOCK] Развлекательный центр · Центр 1", lat: 53.90519, lng: 27.5576, osm: "n6568094841", primary: "entertainment", sub: "kids-entertainment-centers", ages: ["3-5", "5-7"], adultOnly: false, hours: "weekly" },
  { key: "center-ent-2", cluster: "center", category: "ent", title: "[MOCK] Развлекательный центр · Центр 2", lat: 53.89037, lng: 27.5536, osm: "n3213463783", primary: "entertainment", sub: "kids-entertainment-centers", ages: ["0-1", "1-3"], adultOnly: false, hours: "weekly" },
  { key: "center-play-1", cluster: "center", category: "play", title: "[MOCK] Игровая комната · Центр 3", lat: 53.90212, lng: 27.57688, osm: "w326579633", primary: "entertainment", sub: "playrooms", ages: ["7-9", "9-12"], adultOnly: false, hours: "exception" },
  { key: "center-play-2", cluster: "center", category: "play", title: "[MOCK] Игровая комната · Центр 4", lat: 53.89801, lng: 27.55873, osm: "w256413692", primary: "entertainment", sub: "playrooms", ages: ["12-14", "14-16", "16-18"], adultOnly: false, hours: "always" },
  { key: "center-museum-1", cluster: "center", category: "museum", title: "[MOCK] Музей · Центр 5", lat: 53.91633, lng: 27.5379, osm: "w127103385", primary: "entertainment", sub: "museums-galleries", ages: [], adultOnly: false, hours: "weekly" },
  { key: "center-museum-2", cluster: "center", category: "museum", title: "[MOCK] Музей · Центр 6", lat: 53.89681, lng: 27.55562, osm: "n12140682327", primary: "entertainment", sub: "museums-galleries", ages: ["3-5", "5-7"], adultOnly: false, hours: "appointment" },
  { key: "center-museum-3", cluster: "center", category: "museum", title: "[MOCK] Музей · Центр 7", lat: 53.90781, lng: 27.57156, osm: "w25326652", primary: "entertainment", sub: "museums-galleries", ages: ["7-9", "9-12"], adultOnly: false, hours: "none" },
  { key: "center-park-1", cluster: "center", category: "park", title: "[MOCK] Парк · Центр 8", lat: 53.90154, lng: 27.56309, osm: "r5696921", primary: "outdoor", sub: "parks-playgrounds", ages: ["0-1", "1-3"], adultOnly: false, hours: "monday-off" },
  { key: "center-park-2", cluster: "center", category: "park", title: "[MOCK] Парк · Центр 9", lat: 53.90655, lng: 27.56718, osm: "r14605047", primary: "outdoor", sub: "parks-playgrounds", ages: ["12-14", "14-16", "16-18"], adultOnly: false, hours: "weekly" },
  { key: "center-sport-1", cluster: "center", category: "sport", title: "[MOCK] Спорт · Центр 10", lat: 53.91367, lng: 27.57515, osm: "n3901260257", primary: "sport", sub: null, ages: ["5-7", "7-9"], adultOnly: false, hours: "temp-closed" },
  { key: "center-sport-2", cluster: "center", category: "sport", title: "[MOCK] Спорт · Центр 11", lat: 53.89169, lng: 27.56551, osm: "r7562488", primary: "sport", sub: null, ages: ["3-5", "5-7"], adultOnly: false, hours: "none" },
  { key: "center-creative-1", cluster: "center", category: "creative", title: "[MOCK] Студия творчества · Центр 12", lat: 53.90286, lng: 27.55772, osm: "w25327624", primary: "education", sub: "art-schools", ages: ["0-1", "1-3"], adultOnly: false, hours: "weekly" },
  { key: "center-creative-2", cluster: "center", category: "creative", title: "[MOCK] Студия творчества · Центр 13", lat: 53.90091, lng: 27.56275, osm: "w25327619", primary: "education", sub: "art-schools", ages: ["7-9", "9-12"], adultOnly: false, hours: "exception" },
  { key: "center-food-1", cluster: "center", category: "food", title: "[MOCK] Кафе · Центр 14", lat: 53.89964, lng: 27.5657, osm: "n4502252677", primary: "food", sub: "kids-cafes", ages: ["18+"], adultOnly: true, hours: "always" },
  { key: "center-food-2", cluster: "center", category: "food", title: "[MOCK] Кафе · Центр 15", lat: 53.89302, lng: 27.55668, osm: "n12115144892", primary: "food", sub: "kids-cafes", ages: [], adultOnly: false, hours: "monday-off" },
  { key: "uruche-ent-1", cluster: "uruche", category: "ent", title: "[MOCK] Развлекательный центр · Уручье 1", lat: 53.94514, lng: 27.67738, osm: "w784812851", primary: "entertainment", sub: "kids-entertainment-centers", ages: ["3-5", "5-7"], adultOnly: false, hours: "weekly" },
  { key: "uruche-play-1", cluster: "uruche", category: "play", title: "[MOCK] Игровая комната · Уручье 2", lat: 53.93931, lng: 27.67884, osm: "w44729833", primary: "entertainment", sub: "playrooms", ages: ["7-9", "9-12"], adultOnly: false, hours: "none" },
  { key: "uruche-museum-1", cluster: "uruche", category: "museum", title: "[MOCK] Музей · Уручье 3", lat: 53.93178, lng: 27.69112, osm: "w689138683", primary: "entertainment", sub: "museums-galleries", ages: ["0-1", "1-3"], adultOnly: false, hours: "weekly" },
  { key: "uruche-park-1", cluster: "uruche", category: "park", title: "[MOCK] Парк · Уручье 4", lat: 53.94465, lng: 27.67925, osm: "r9577157", primary: "outdoor", sub: "parks-playgrounds", ages: ["12-14", "14-16", "16-18"], adultOnly: false, hours: "weekly" },
  { key: "uruche-sport-1", cluster: "uruche", category: "sport", title: "[MOCK] Спорт · Уручье 5", lat: 53.95074, lng: 27.70833, osm: "w39668988", primary: "sport", sub: null, ages: ["5-7", "7-9"], adultOnly: false, hours: "weekly" },
  { key: "uruche-sport-2", cluster: "uruche", category: "sport", title: "[MOCK] Спорт · Уручье 6", lat: 53.94949, lng: 27.70717, osm: "w39668981", primary: "sport", sub: null, ages: ["3-5", "5-7"], adultOnly: false, hours: "exception" },
  { key: "uruche-creative-1", cluster: "uruche", category: "creative", title: "[MOCK] Студия творчества · Уручье 7", lat: 53.95137, lng: 27.6957, osm: "w256343415", primary: "education", sub: "art-schools", ages: ["0-1", "1-3"], adultOnly: false, hours: "always" },
  { key: "uruche-food-1", cluster: "uruche", category: "food", title: "[MOCK] Кафе · Уручье 8", lat: 53.94694, lng: 27.68399, osm: "n13805722407", primary: "food", sub: "kids-cafes", ages: ["7-9", "9-12"], adultOnly: false, hours: "weekly" },
  { key: "kamgorka-ent-1", cluster: "kamgorka", category: "ent", title: "[MOCK] Развлекательный центр · Каменная Горка 1", lat: 53.91341, lng: 27.44655, osm: "n5986902785", primary: "entertainment", sub: "kids-entertainment-centers", ages: ["12-14", "14-16", "16-18"], adultOnly: false, hours: "appointment" },
  { key: "kamgorka-play-1", cluster: "kamgorka", category: "play", title: "[MOCK] Игровая комната · Каменная Горка 2", lat: 53.92207, lng: 27.43518, osm: "w351554573", primary: "entertainment", sub: "playrooms", ages: [], adultOnly: false, hours: "none" },
  { key: "kamgorka-museum-1", cluster: "kamgorka", category: "museum", title: "[MOCK] Музей · Каменная Горка 3", lat: 53.92027, lng: 27.42276, osm: "r9084399", primary: "entertainment", sub: "museums-galleries", ages: ["3-5", "5-7"], adultOnly: false, hours: "monday-off" },
  { key: "kamgorka-park-1", cluster: "kamgorka", category: "park", title: "[MOCK] Парк · Каменная Горка 4", lat: 53.91868, lng: 27.44314, osm: "w653240225", primary: "outdoor", sub: "parks-playgrounds", ages: ["7-9", "9-12"], adultOnly: false, hours: "weekly" },
  { key: "kamgorka-sport-1", cluster: "kamgorka", category: "sport", title: "[MOCK] Спорт · Каменная Горка 5", lat: 53.90475, lng: 27.41579, osm: "w603428130", primary: "sport", sub: null, ages: ["0-1", "1-3"], adultOnly: false, hours: "temp-closed" },
  { key: "kamgorka-creative-1", cluster: "kamgorka", category: "creative", title: "[MOCK] Студия творчества · Каменная Горка 6", lat: 53.90369, lng: 27.42352, osm: "w1531182416", primary: "education", sub: "art-schools", ages: ["12-14", "14-16", "16-18"], adultOnly: false, hours: "none" },
  { key: "kamgorka-food-1", cluster: "kamgorka", category: "food", title: "[MOCK] Кафе · Каменная Горка 7", lat: 53.90569, lng: 27.44924, osm: "n5305216023", primary: "food", sub: "kids-cafes", ages: ["5-7", "7-9"], adultOnly: false, hours: "weekly" },
  { key: "kamgorka-food-2", cluster: "kamgorka", category: "food", title: "[MOCK] Кафе · Каменная Горка 8", lat: 53.90615, lng: 27.43977, osm: "n11974950769", primary: "food", sub: "kids-cafes", ages: ["3-5", "5-7"], adultOnly: false, hours: "exception" },
  { key: "serebr-play-1", cluster: "serebr", category: "play", title: "[MOCK] Игровая комната · Серебрянка 1", lat: 53.86372, lng: 27.60125, osm: "w1006143810", primary: "entertainment", sub: "playrooms", ages: ["0-1", "1-3"], adultOnly: false, hours: "always" },
  { key: "serebr-museum-1", cluster: "serebr", category: "museum", title: "[MOCK] Музей · Серебрянка 2", lat: 53.85528, lng: 27.60999, osm: "n259028010", primary: "entertainment", sub: "museums-galleries", ages: ["7-9", "9-12"], adultOnly: false, hours: "monday-off" },
  { key: "serebr-park-1", cluster: "serebr", category: "park", title: "[MOCK] Парк · Серебрянка 3", lat: 53.85068, lng: 27.63674, osm: "r14620332", primary: "outdoor", sub: "parks-playgrounds", ages: ["12-14", "14-16", "16-18"], adultOnly: false, hours: "weekly" },
  { key: "serebr-sport-1", cluster: "serebr", category: "sport", title: "[MOCK] Спорт · Серебрянка 4", lat: 53.84439, lng: 27.62863, osm: "w150930532", primary: "sport", sub: null, ages: [], adultOnly: false, hours: "none" },
  { key: "serebr-creative-1", cluster: "serebr", category: "creative", title: "[MOCK] Студия творчества · Серебрянка 5", lat: 53.85853, lng: 27.59523, osm: "w615232004", primary: "education", sub: "art-schools", ages: ["3-5", "5-7"], adultOnly: false, hours: "weekly" },
  { key: "serebr-food-1", cluster: "serebr", category: "food", title: "[MOCK] Кафе · Серебрянка 6", lat: 53.86129, lng: 27.63888, osm: "n9860899646", primary: "food", sub: "kids-cafes", ages: ["7-9", "9-12"], adultOnly: false, hours: "weekly" },
  { key: "bor-park-1", cluster: "bor", category: "park", title: "[MOCK] Парк · Боровляны 1", lat: 54.00226, lng: 27.68498, osm: "w579496318", primary: "outdoor", sub: "parks-playgrounds", ages: ["0-1", "1-3"], adultOnly: false, hours: "weekly" },
  { key: "bor-food-1", cluster: "bor", category: "food", title: "[MOCK] Кафе · Боровляны 2", lat: 54.00769, lng: 27.67723, osm: "w1458159883", primary: "food", sub: "kids-cafes", ages: ["12-14", "14-16", "16-18"], adultOnly: false, hours: "exception" },
  { key: "zhd-play-1", cluster: "zhd", category: "play", title: "[MOCK] Игровая комната · Ждановичи 1", lat: 53.94291, lng: 27.45477, osm: "w886534105", primary: "entertainment", sub: "playrooms", ages: ["5-7", "7-9"], adultOnly: false, hours: "always" },
  { key: "zhd-sport-1", cluster: "zhd", category: "sport", title: "[MOCK] Спорт · Ждановичи 2", lat: 53.96651, lng: 27.42682, osm: "w484276370", primary: "sport", sub: null, ages: ["3-5", "5-7"], adultOnly: false, hours: "weekly" },
  // Place without coordinates: the venue of the "place without coordinates" event.
  { key: "center-nocoords-1", cluster: "center", category: "ent", title: "[MOCK] Место без координат · Центр", lat: null, lng: null, osm: null, primary: "entertainment", sub: "kids-entertainment-centers", ages: ["3-5", "5-7"], adultOnly: false, hours: "weekly" },
];
