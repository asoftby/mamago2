/**
 * Diagnostic: District and Metro Resolution
 * 
 * Checks why district and metro are not being resolved
 */

import prisma from "../src/lib/prisma";

const testCoordinates = {
  lat: 53.9320215,
  lng: 27.5025518,
  cityId: "cmmap1t160011wsa4n1f0ymz1", // Minsk
};

async function main() {
  console.log("=".repeat(80));
  console.log("DIAGNOSTIC: District and Metro Resolution");
  console.log("=".repeat(80));
  console.log();

  console.log("Test coordinates:");
  console.log(`  lat: ${testCoordinates.lat}`);
  console.log(`  lng: ${testCoordinates.lng}`);
  console.log(`  cityId: ${testCoordinates.cityId}`);
  console.log();

  // Check City
  console.log("Step 1: Checking City...");
  console.log("-".repeat(80));
  
  const city = await prisma.city.findUnique({
    where: { id: testCoordinates.cityId },
    select: {
      id: true,
      name: true,
      hasMetro: true,
      metroMaxDistanceM: true,
    },
  });

  if (!city) {
    console.log("❌ City not found!");
    process.exit(1);
  }

  console.log(`✅ City found: ${city.name}`);
  console.log(`   hasMetro: ${city.hasMetro}`);
  console.log(`   metroMaxDistanceM: ${city.metroMaxDistanceM || "NULL"}`);
  console.log();

  // Check Districts
  console.log("Step 2: Checking Districts...");
  console.log("-".repeat(80));
  
  const districts = await prisma.district.findMany({
    where: { cityId: testCoordinates.cityId },
    select: {
      id: true,
      name: true,
      centerLat: true,
      centerLng: true,
    },
  });

  console.log(`Found ${districts.length} districts for ${city.name}`);
  
  if (districts.length === 0) {
    console.log("❌ No districts found!");
  } else {
    districts.forEach((d) => {
      const hasCentroid = d.centerLat !== null && d.centerLng !== null;
      console.log(`  - ${d.name}`);
      console.log(`    centerLat: ${d.centerLat || "NULL"}`);
      console.log(`    centerLng: ${d.centerLng || "NULL"}`);
      console.log(`    ${hasCentroid ? "✅" : "❌"} Has centroid`);
    });
  }
  console.log();

  // Check Metro Stations
  console.log("Step 3: Checking Metro Stations...");
  console.log("-".repeat(80));
  
  const stations = await prisma.metroStation.findMany({
    where: { cityId: testCoordinates.cityId },
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
    },
  });

  console.log(`Found ${stations.length} metro stations for ${city.name}`);
  
  if (stations.length === 0) {
    console.log("❌ No metro stations found!");
  } else {
    console.log(`✅ Metro stations available`);
    stations.slice(0, 5).forEach((s) => {
      console.log(`  - ${s.name} (${s.lat}, ${s.lng})`);
    });
    if (stations.length > 5) {
      console.log(`  ... and ${stations.length - 5} more`);
    }
  }
  console.log();

  // Calculate distances
  if (districts.length > 0 && districts.some(d => d.centerLat && d.centerLng)) {
    console.log("Step 4: Calculating distances to districts...");
    console.log("-".repeat(80));

    const EARTH_RADIUS_KM = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return EARTH_RADIUS_KM * c;
    };

    let nearestDistrict: { name: string; distance: number } | null = null;

    for (const district of districts) {
      if (district.centerLat === null || district.centerLng === null) continue;

      const distance = haversineKm(
        testCoordinates.lat,
        testCoordinates.lng,
        district.centerLat,
        district.centerLng
      );

      console.log(`  ${district.name}: ${distance.toFixed(2)}km`);

      if (!nearestDistrict || distance < nearestDistrict.distance) {
        nearestDistrict = { name: district.name, distance };
      }
    }

    if (nearestDistrict) {
      console.log();
      console.log(`✅ Nearest district: ${nearestDistrict.name} (${nearestDistrict.distance.toFixed(2)}km)`);
    }
    console.log();
  }

  if (stations.length > 0) {
    console.log("Step 5: Calculating distances to metro stations...");
    console.log("-".repeat(80));

    const EARTH_RADIUS_KM = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return EARTH_RADIUS_KM * c * 1000; // meters
    };

    const maxDistance = city.metroMaxDistanceM || 4000;
    let nearestStation: { name: string; distance: number } | null = null;
    let stationsWithinRadius = 0;

    for (const station of stations) {
      const distance = haversineMeters(
        testCoordinates.lat,
        testCoordinates.lng,
        station.lat,
        station.lng
      );

      const withinRadius = distance <= maxDistance;
      if (withinRadius) stationsWithinRadius++;

      if (distance < 2000) { // Show stations within 2km
        console.log(`  ${station.name}: ${Math.round(distance)}m ${withinRadius ? "✅" : "❌ (too far)"}`);
      }

      if (distance <= maxDistance) {
        if (!nearestStation || distance < nearestStation.distance) {
          nearestStation = { name: station.name, distance };
        }
      }
    }

    console.log();
    console.log(`Max search radius: ${maxDistance}m`);
    console.log(`Stations within radius: ${stationsWithinRadius}`);
    
    if (nearestStation) {
      console.log(`✅ Nearest station: ${nearestStation.name} (${Math.round(nearestStation.distance)}m)`);
    } else {
      console.log(`❌ No station within ${maxDistance}m`);
    }
    console.log();
  }

  // Summary
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  const issues: string[] = [];

  if (!city.hasMetro) {
    issues.push("❌ City.hasMetro is false");
  }

  if (districts.length === 0) {
    issues.push("❌ No districts in database");
  } else if (!districts.some(d => d.centerLat && d.centerLng)) {
    issues.push("❌ No districts have centroids (centerLat/centerLng)");
  }

  if (stations.length === 0) {
    issues.push("❌ No metro stations in database");
  }

  if (issues.length === 0) {
    console.log("✅ All data present - enrichment should work");
  } else {
    console.log("Issues found:");
    issues.forEach(issue => console.log(`  ${issue}`));
  }

  console.log();
}

main()
  .catch((error) => {
    console.error("Diagnostic error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
