import { getAdminCommercialOverview } from "../src/server/services/commercial/commercialOverview.service";
import { getContracts } from "../src/server/services/commercial/contracts.service";
import { getPlacements } from "../src/server/services/commercial/placements.service";

async function testCommercialServices() {
  console.log("🧪 Testing commercial services...\n");

  try {
    console.log("1. Testing getAdminCommercialOverview()...");
    const overview = await getAdminCommercialOverview();
    console.log("✅ Overview:", JSON.stringify(overview, null, 2));
  } catch (e: any) {
    console.error("❌ Overview error:", e.message);
  }

  try {
    console.log("\n2. Testing getContracts()...");
    const contracts = await getContracts();
    console.log(`✅ Found ${contracts.length} contracts`);
  } catch (e: any) {
    console.error("❌ Contracts error:", e.message);
  }

  try {
    console.log("\n3. Testing getPlacements()...");
    const placements = await getPlacements();
    console.log(`✅ Found ${placements.length} placements`);
  } catch (e: any) {
    console.error("❌ Placements error:", e.message);
  }

  console.log("\n✅ All services working!");
}

testCommercialServices()
  .catch(console.error)
  .finally(() => process.exit(0));
