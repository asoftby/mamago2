import { submitPartyAnchor } from "./partySubmit.service";
import { cancelPartyBeforeConfirmation } from "./partyCancel.service";
import { constructorIntervalPrice } from "./constructorIntervalPrice";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getDefaultFormData } from "@/components/business/wizard/offer/defaults";
import { buildOfferCreatePayload, buildOfferUpdatePayload, mapOfferToFormData } from "@/components/business/wizard/offer/mappers";
import { PartySelectionContextSchema, OfferForConstructorSchema } from "@/lib/birthday/constructorContract";
import { loadConstructorCandidates, type ConstructorCandidateQuery } from "./constructorCandidates.service";
import { constructorOfferSelect, toConstructorOffer } from "./constructorOffer";
import { loadPartyAvailability } from "./partyAvailabilityPreview.service";
import { getPublicBirthdayCatalog } from "./catalog.service";
import { verifyPartyOffers, updatePartyDraft } from "./partyDraft.service";
import { getPublicPartySlotPreview } from "./partyPublicSlots.service";
import { rankPartyCandidates } from "./partyCandidateRanking";
import { findAvailablePartyCandidates } from "./partyAvailableCandidates";
import { discoverPartyProviders } from "./partyProviderMatching.service";
import { findCandidatesForParty } from "./partyOrderCandidates.service";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55443" || url.pathname !== "/mamago_a3_test") throw Error("Only disposable 127.0.0.1:55443/mamago_a3_test is allowed");
const base = process.env.A3_HTTP_BASE ?? "http://127.0.0.1:3028";
if (new URL(base).hostname !== "127.0.0.1" || new URL(base).port !== "3028") throw Error("Only local A3 HTTP server is allowed");
const db = new PrismaClient({ log: [{ level: "query", emit: "event" }] });
let queries = 0; db.$on("query",()=>queries++);

test("Wizard persistence → canonical A1 → common matching/availability on PostgreSQL", async t => {
  const run = randomUUID().slice(0,8), users: string[] = [], businesses: string[] = [], places: string[] = [], offers: string[] = [];
  const day = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const interval = { startAt: new Date(day+"T12:00:00+03:00").toISOString(), endAt: new Date(day+"T13:00:00+03:00").toISOString() };
  const country = await db.country.upsert({where:{slug:'belarus'},update:{isActive:true,isoCode:'BY'},create:{slug:'belarus',name:'Belarus',isoCode:'BY',isActive:true}});
  const city = await db.city.create({data:{slug:'a3-'+run,name:'A3 synthetic',countryId:country.id,isActive:true}});
  const otherCity = await db.city.create({data:{slug:'a3-other-'+run,name:'A3 other',countryId:country.id,isActive:true}});
  const territory = await db.territory.create({data:{slug:city.slug,name:city.name,type:'CITY',isActive:true}});
  const otherTerritory = await db.territory.create({data:{slug:otherCity.slug,name:otherCity.name,type:'CITY',isActive:true}});
  for(const [c,tr] of [[city,territory],[otherCity,otherTerritory]]) await db.territoryLegacyMap.create({data:{legacyKind:'CITY',legacyId:c.id,territoryId:tr.id}});
  async function business(label:string,balance=1,other=false) {
    const user=await db.user.create({data:{email:`a3-${run}-${label}@example.test`,role:'BUSINESS_OWNER'}});users.push(user.id);
    const b=await db.business.create({data:{name:'A3 '+label,ownerUserId:user.id,operationalStatus:'ACTIVE',verificationStatus:'APPROVED',status:'APPROVED',billingAccount:{create:{depositBalance:balance}}}});businesses.push(b.id);
    await db.businessMember.create({data:{businessId:b.id,userId:user.id,role:'OWNER'}});
    const p=await db.place.create({data:{title:'A3 place '+label,shortDesc:'Synthetic',createdByUserId:user.id,ownerBusinessId:b.id,status:'PUBLISHED',cityId:other?otherCity.id:city.id,territoryId:other?otherTerritory.id:territory.id,activityTypes:[],ageTags:[],visitFormats:[]}});places.push(p.id);
    const token=randomBytes(32).toString('hex');await db.session.create({data:{userId:user.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+86400000)}});
    return {user,b,p,headers:{cookie:`mg_dev_session=${token}`,'Content-Type':'application/json'}};
  }
  type Business = Awaited<ReturnType<typeof business>>;
  async function request(b:Business,path:string,method='GET',body?:unknown) {
    const res=await fetch(base+path,{method,headers:b.headers,body:body===undefined?undefined:JSON.stringify(body)});const json=await res.json();assert.ok(res.ok,`${method} ${path} ${res.status} ${JSON.stringify(json)}`);return json;
  }
  async function save(b:Business,label:string,change:(d:ReturnType<typeof getDefaultFormData>)=>void=()=>{}) {
    const form=getDefaultFormData(b.p.id);form.productType='PARTY_SERVICE';form.offerWizardType='SINGLE';form.partyCategory='SHOW';form.requestedPlacements=['BIRTHDAY'];
    form.title='A3 '+label;form.description='Structured synthetic birthday offer';form.shortDescription='Structured synthetic offer';form.agePolicy='UNRESTRICTED';
    form.singleCurrency='BYN';form.singlePrice='150';form.priceKind='EXACT';form.birthdayDetails={...form.birthdayDetails,locationType:'BOTH',included:'Materials',durationMinutes:60};
    change(form);
    if(label==='science')form.partyCategory='ANIMATOR';
    const created=await request(b,'/api/business/offers','POST',buildOfferCreatePayload(form,{status:'DRAFT'}));offers.push(created.id);
    const loaded=await request(b,'/api/business/offers/'+created.id);const reopened=mapOfferToFormData(loaded);if(label==='science')reopened.partyCategory='SHOW';
    await request(b,'/api/business/offers/'+created.id,'PATCH',buildOfferUpdatePayload(reopened));
    const again=await request(b,'/api/business/offers/'+created.id);
    assert.equal(again.agePolicy,form.agePolicy);assert.deepEqual(again.interestSlugs,form.interestSlugs);assert.equal(again.currency,form.singleCurrency);assert.equal(again.priceMode,form.priceKind);
    if(again.productType==='PARTY_PACKAGE') assert.deepEqual(again.components.map((c:{id:string})=>c.id),loaded.components.map((c:{id:string})=>c.id));
    // Synthetic moderation fixture, not a production moderation bypass.
    await db.offer.update({where:{id:created.id},data:{status:'PUBLISHED',publishedAt:new Date()}});
    await db.offerPlacement.updateMany({where:{offerId:created.id},data:{status:'APPROVED'}});
    return created.id as string;
  }
  const query:ConstructorCandidateQuery={citySlug:city.slug,category:'SHOW',venueMode:'HOME',childrenCount:0,adultsCount:5,childAge:null,budgetByn:500,date:day,timeFrom:'12:00',timeTo:'13:00'};
  const parent=await db.user.create({data:{email:`a3-parent-${run}@example.test`}});users.push(parent.id);
  let partyId='';
  try {
    const science=await business('science'),music=await business('music'),host=await business('host'),animator=await business('animator'),child=await business('child'),cake=await business('cake'),pack=await business('package'),blocked=await business('blocked',0),travel=await business('travel',1,true),onsite=await business('onsite',1,true);
    const scienceId=await save(science,'science',d=>{d.interestSlugs=['science'];d.birthdayDetails.performerRole='HOST';}); // hidden role from another category
    const siblingId=await save(science,'shared-resource');
    const musicId=await save(music,'music',d=>{d.interestSlugs=['music'];d.priceKind='FROM';});
    const hostId=await save(host,'host',d=>{d.partyCategory='ANIMATOR';d.agePolicy='ADULT_ONLY';d.birthdayDetails.performerRole='HOST';});
    const animatorId=await save(animator,'animator',d=>{d.partyCategory='ANIMATOR';d.birthdayDetails.performerRole='ANIMATOR';});
    const childId=await save(child,'children',d=>{d.agePolicy='SPECIFIC';d.ageGroups=['5-7'];});
    const cakeId=await save(cake,'cake',d=>{d.partyCategory='CAKE';d.priceKind='ON_REQUEST';d.birthdayDetails.acceptsCustomOrders=true;d.birthdayDetails.acceptsReferences=true;});
    const packageId=await save(pack,'package',d=>{d.productType='PARTY_PACKAGE';d.partyCategory=null;d.packageComponentsEdited=true;d.packageComponentsBaseline=[];d.packageComponents=[{title:'Зал',category:'VENUE'},{title:'Шоу',category:'SHOW'}];});
    const blockedId=await save(blocked,'no deposit');const travelId=await save(travel,'travel',d=>{d.birthdayDetails.locationType='OFF_SITE';});
    const onsiteId=await save(onsite,'onsite',d=>{d.birthdayDetails.locationType='ON_SITE';});
    const party=await db.partyOrder.create({data:{ownerUserId:parent.id,citySlug:city.slug,venueMode:'HOME',eventDate:new Date(day),timeFrom:'12:00',timeTo:'13:00',childrenCount:0,adultsCount:5,budgetByn:500}});partyId=party.id;
    const context=PartySelectionContextSchema.parse({contractVersion:1,partyOrderId:party.id,partyVersion:party.version,entry:'FULL',venueMode:'HOME',subjects:[{kind:'adult',refId:parent.id,source:'profile'}],ageMonthsOnEventDate:{state:'UNKNOWN',reason:'NOT_PROVIDED'},interests:{state:'KNOWN',value:['science']},destination:{state:'KNOWN',value:{territoryId:territory.id,placeId:null}},budget:{state:'KNOWN',value:{minimumByn:null,maximumByn:'500.00'}},dateRange:{from:day,to:day},interval:{state:'KNOWN',value:interval},guests:{children:0,adults:5}});
    await t.test('submit replay produces exactly one private plan item and cancellation preserves history', async () => {
      const draft = await db.partyOrder.create({ data: { ownerUserId: parent.id, citySlug: city.slug,
        venueMode: 'HOME', eventDate: new Date(day), timeFrom: '12:00', timeTo: '13:00',
        childrenCount: 0, adultsCount: 5, contactName: "Test parent", contactPhone: "+375291234567" } });
      let planId: string | null = null;
      try {
        assert.equal(draft.planItemId, null);
        const foreignChild = await db.child.create({ data: { parentId: host.user.id, birthDate: new Date("2018-01-01") } });
        await assert.rejects(updatePartyDraft(parent.id, draft.id, { version: draft.version, selectedChildId: foreignChild.id }), /профиль ребёнка недоступен/);
        const child = await db.child.create({ data: { parentId: parent.id, birthDate: new Date("2018-01-01") } });
        const updated = await updatePartyDraft(parent.id, draft.id, { version: draft.version, anchorOfferId: scienceId,
          selectedChildId: child.id, childrenCount: 1 });
        const first = await submitPartyAnchor(parent.id, draft.id, updated.version, 'a5-test-replay');
        const replay = await submitPartyAnchor(parent.id, draft.id, updated.version, 'a5-test-replay');
        assert.equal(first.request.id, replay.request.id);
        const sent = await db.partyOrder.findUniqueOrThrow({ where: { id: draft.id } });
        planId = sent.planItemId;
        assert.ok(planId);
        const plan = await db.planItem.findUniqueOrThrow({ where: { id: planId } });
        assert.equal(plan.visibility, 'PRIVATE');
        assert.equal(plan.userId, sent.ownerUserId);
        assert.equal(plan.familyId, sent.familyId);
        const linkAttempt = { ownerUserId: parent.id, citySlug: city.slug, venueMode: 'HOME' as const };
        await assert.rejects(db.partyOrder.create({data:{...linkAttempt,planItemId:planId}}), {code:'P2002'});
        await assert.rejects(db.partyOrder.create({data:{...linkAttempt,planItemId:'missing-plan-fixture'}}), {code:'P2003'});

        assert.equal(plan.date, day);
        assert.equal(plan.childId, child.id);
        assert.equal(plan.assigneeUserId, null);
        assert.equal(await db.planItem.count({ where: { partyOrder: { is: { id: draft.id } } } }), 1);
        await assert.rejects(cancelPartyBeforeConfirmation(host.user.id, draft.id, sent.version));
        await cancelPartyBeforeConfirmation(parent.id, draft.id, sent.version);
        const cancelled = await db.planItem.findUniqueOrThrow({ where: { id: planId } });
        assert.equal(cancelled.status, 'CANCELLED');
        assert.ok(cancelled.cancelledAt);
      } finally {
        await db.partyOrder.delete({ where: { id: draft.id } });
        if (planId) await db.planItem.delete({ where: { id: planId } });
      }
    });
    await t.test('adult recipient without DOB reaches ADULT_ONLY matching and submission', async () => {
      const draft = await db.partyOrder.create({ data: { ownerUserId: parent.id, citySlug: city.slug,
        venueMode: 'HOME', eventDate: new Date(day), timeFrom: '12:00', timeTo: '13:00',
        childrenCount: 0, adultsCount: 5, contactName: 'Test parent', contactPhone: '+375291234567' } });
      let planId: string | null = null;
      try {
        const selected = await updatePartyDraft(parent.id, draft.id, { version: draft.version, anchorOfferId: hostId,
          childAge: null, recipientAudience: 'ADULT', selectedChildId: null });
        const candidates = await findCandidatesForParty(parent.id, draft.id, 'ANIMATOR', [], {performerRole:'HOST'});
        assert.ok(candidates.candidates.some(candidate => candidate.offerId === hostId));
        await submitPartyAnchor(parent.id, draft.id, selected.version, 'integration-adult-no-dob');
        const submitted = await db.partyOrder.findUniqueOrThrow({ where: { id: draft.id } });
        planId = submitted.planItemId;
        assert.ok(planId);
        const plan = await db.planItem.findUniqueOrThrow({where:{id:planId}});
        assert.equal(plan.childId,null);
        assert.equal(plan.assigneeUserId,null);
      } finally {
        await db.partyOrder.delete({where:{id:draft.id}});
        if(planId) await db.planItem.delete({where:{id:planId}});
      }
    });
    await t.test('real saved data reaches A1; adult-only, hidden category data, prices and package IDs',async()=>{
      const rows=await db.offer.findMany({where:{id:{in:offers}},select:constructorOfferSelect});
      for(const row of rows)assert.ok(OfferForConstructorSchema.safeParse(toConstructorOffer(row)).success);
      const dto=(id:string)=>toConstructorOffer(rows.find(r=>r.id===id)!);
      assert.equal(dto(hostId).age.agePolicy,'ADULT_ONLY');assert.equal(dto(scienceId).performerRole?.state,'UNKNOWN');
      assert.equal(dto(musicId).price.state,'RESOLVED');assert.equal(dto(cakeId).price.state,'RESOLVED');
      const composition=dto(packageId).composition;assert.equal(composition.state,'COMPONENTS');
      if(composition.state==='COMPONENTS'){assert.deepEqual(composition.components.map(c=>c.componentId),rows.find(r=>r.id===packageId)!.components.map(c=>c.id));assert.ok(composition.components.every(c=>c.removable.state==='UNKNOWN'));}
      const adults=await loadConstructorCandidates({...query,category:'ANIMATOR',selectionContext:context,performerRole:'HOST'},db);
      assert.ok(adults.some(r=>r.offer.offerId===hostId));assert.ok(!adults.some(r=>r.offer.offerId===animatorId));
      const ranked=await loadConstructorCandidates({...query,selectionContext:context},db);
      assert.ok(!ranked.some(r=>r.offer.offerId===childId));assert.ok(!ranked.some(r=>r.offer.offerId===blockedId));
      assert.ok(ranked.findIndex(r=>r.offer.offerId===scienceId)<ranked.findIndex(r=>r.offer.offerId===musicId));
    });
    await t.test('draft captures each mandatory package component independently of the offer',async()=>{
      const packageOrder=await db.partyOrder.create({data:{ownerUserId:parent.id,citySlug:city.slug,venueMode:'PACKAGE'}});
      try {
        const result=await updatePartyDraft(parent.id,packageOrder.id,{version:packageOrder.version,anchorOfferId:packageId});
        const included=result.items.filter(item=>item.role==='INCLUDED');
        assert.equal(included.length,2);
        for (const item of included) {
          assert.ok(item.packageComponentId);
          assert.equal((item.packageComponentSnapshot as {id:string}).id,item.packageComponentId);
        }
        const first=included[0];
        await db.packageComponent.update({where:{id:first.packageComponentId!},data:{title:'Edited catalogue title'}});
        const historical=await db.partyOrderItem.findUniqueOrThrow({where:{id:first.id}});
        assert.deepEqual(historical.packageComponentSnapshot,first.packageComponentSnapshot);
        assert.equal(result.items.find(item=>item.role==='ANCHOR')?.offerPriceSnapshot?.toFixed(2),'150.00');
      } finally { await db.partyOrder.delete({where:{id:packageOrder.id}}); }
    });
    await t.test('geography stays real across catalog, explicit selection and public slots',async()=>{
      const catalog=await getPublicBirthdayCatalog(city.slug);assert.ok(catalog?.some(c=>c.id===travelId));assert.ok(!catalog?.some(c=>c.id===onsiteId));assert.ok(!catalog?.some(c=>c.id===blockedId));
      await verifyPartyOffers(city.slug,[travelId],db);await assert.rejects(verifyPartyOffers(city.slug,[onsiteId],db));
      const found=await loadConstructorCandidates({...query,selectionContext:context},db);
      assert.equal(found.find(c=>c.offer.offerId===travelId)?.assessments.find(a=>a.dimension==='GEOGRAPHY')?.outcome,'UNKNOWN');
      assert.ok(await getPublicPartySlotPreview({citySlug:city.slug,offerId:travelId,day,durationMinutes:60,guestCount:5}));
      assert.equal(await getPublicPartySlotPreview({citySlug:city.slug,offerId:blockedId,day,durationMinutes:60,guestCount:5}),null);
      const path = '/api/business/offers/' + travelId;
      const form = mapOfferToFormData(await request(travel,path));
      form.birthdayDetails.serviceAreas = {travel:[territory.id,otherTerritory.id],delivery:[]};
      form.pricingMode = 'multiple';
      form.priceKind = 'RANGE';
      form.pricingOptions = [{id:'conditional', title:'Для шести гостей', price:'90', description:'', partyConditions:{durationMinutes:60,minGuests:6}}];
      await db.offer.update({where:{id:travelId},data:{status:'DRAFT'}});
      await request(travel,path,'PATCH',buildOfferUpdatePayload(form));
      const reopened = mapOfferToFormData(await request(travel,path));
      assert.deepEqual(reopened.birthdayDetails.serviceAreas,form.birthdayDetails.serviceAreas);
      assert.deepEqual(reopened.pricingOptions[0]?.partyConditions,form.pricingOptions[0].partyConditions);
      const priced=await db.offer.findUniqueOrThrow({where:{id:travelId},select:constructorOfferSelect});
      assert.equal(toConstructorOffer(priced).price.state,'UNRESOLVED');

      await db.offer.update({where:{id:travelId},data:{status:'PUBLISHED'}});
      const matching = await loadConstructorCandidates({...query,selectionContext:context},db);
      assert.equal(matching.find(c=>c.offer.offerId===travelId)?.assessments.find(a=>a.dimension==='GEOGRAPHY')?.outcome,'MATCH');
      reopened.birthdayDetails.serviceAreas = {travel:[otherTerritory.id],delivery:[]};
      await db.offer.update({where:{id:travelId},data:{status:'DRAFT'}});
      await request(travel,path,'PATCH',buildOfferUpdatePayload(reopened));
      await db.offer.update({where:{id:travelId},data:{status:'PUBLISHED'}});
      assert.ok(!(await loadConstructorCandidates({...query,selectionContext:context},db)).some(c=>c.offer.offerId===travelId));

    });
    await t.test('conflicts, unpriced semantics and unsupported currency are never exact zero',async()=>{
      await db.offerBooking.create({data:{offerId:musicId,basePriceByn:200,pricingRevision:2}});
      let row=await db.offer.findUniqueOrThrow({where:{id:musicId},select:constructorOfferSelect});assert.equal(toConstructorOffer(row).price.state,'UNRESOLVED');
      await updatePartyDraft(parent.id,party.id,{version:party.version,anchorOfferId:musicId});
      const selected=await db.partyOrderItem.findFirstOrThrow({where:{partyOrderId:party.id,role:'ANCHOR'}});assert.equal(selected.offerPriceSnapshot,null);
      party.version++;context.partyVersion=party.version;
      await db.offerBooking.delete({where:{offerId:musicId}});
      await db.offer.update({where:{id:cakeId},data:{priceFrom:900}});row=await db.offer.findUniqueOrThrow({where:{id:cakeId},select:constructorOfferSelect});
      const onRequest=toConstructorOffer(row).price;assert.equal(onRequest.state,'RESOLVED');if(onRequest.state==='RESOLVED')assert.deepEqual(onRequest.price,{kind:'ON_REQUEST'});
      await db.offer.update({where:{id:musicId},data:{currency:'USD'}});row=await db.offer.findUniqueOrThrow({where:{id:musicId},select:constructorOfferSelect});assert.equal(toConstructorOffer(row).price.state,'UNRESOLVED');
      await db.offer.update({where:{id:musicId},data:{currency:'BYN'}});
      await db.offer.update({where:{id:musicId},data:{priceMode:'FROM',priceFrom:150}});
      try {
        const ranked = await loadConstructorCandidates({...query,selectionContext:context},db);
        assert.equal(ranked.find(c=>c.offer.offerId===musicId)?.budgetFit,'UNKNOWN');
        await updatePartyDraft(parent.id,party.id,{version:party.version,anchorOfferId:musicId});
        const from = await db.partyOrderItem.findFirstOrThrow({where:{partyOrderId:party.id,role:'ANCHOR'}});
        assert.equal(from.offerPriceSnapshot,null);
        party.version++;context.partyVersion=party.version;
      } finally {
        await db.offer.update({where:{id:musicId},data:{priceMode:'EXACT'}});
      }
    });
    await t.test('BookingUnit after real API save: step, buffers, partial and shared allocations',async()=>{
      const created=await request(science,'/api/business/booking-units','POST',{name:'A3 resource',offerIds:[scienceId,siblingId],capacity:12,minDurationMinutes:60,stepMinutes:60,prepMinutes:20,cleanupMinutes:30,rules:[1,2,3,4,5,6,7].map(weekday=>({weekday,startMinutes:600,endMinutes:1080}))});
      const unitId=created.unit.id;
      const persisted=(await request(science,'/api/business/booking-units/'+unitId)).unit;assert.equal(persisted.stepMinutes,60);assert.equal(persisted.prepMinutes,20);assert.equal(persisted.cleanupMinutes,30);
      const inputs=[{id:scienceId,businessId:science.b.id},{id:siblingId,businessId:science.b.id}];
      let evidence=await loadPartyAvailability(db,inputs,interval,5,new Date());assert.equal(evidence.get(scienceId)?.availability.state,'AVAILABLE');
      const window=evidence.get(scienceId)!.availability;if(window.state==='AVAILABLE'){assert.equal(new Date(window.windows[0].occupied.startAt).getTime(),new Date(interval.startAt).getTime()-20*60000);assert.equal(new Date(window.windows[0].occupied.endAt).getTime(),new Date(interval.endAt).getTime()+30*60000);}
      const block=await db.calendarBlock.create({data:{bookingUnitId:unitId,blockStart:new Date(new Date(interval.endAt).getTime()+10*60000),blockEnd:new Date(new Date(interval.endAt).getTime()+60*60000)}});
      evidence=await loadPartyAvailability(db,inputs,interval,5,new Date());assert.equal(evidence.get(scienceId)?.availability.state,'PARTIAL');await db.calendarBlock.delete({where:{id:block.id}});
      await db.offerBooking.create({data:{offerId:scienceId,scheduleKind:'ON_REQUEST_WINDOWS',durationMin:60,basePriceByn:120,maxExtensionHours:2,extensionHourPriceByn:30}});
      try {
        const row=await db.offer.findUniqueOrThrow({where:{id:scienceId},select:constructorOfferSelect});
        const base=constructorIntervalPrice(row,interval,window,5);
        assert.equal(base.state==='RESOLVED' && base.price.kind==='EXACT' && base.price.amountByn,'120.00');
        const extended={...interval,endAt:new Date(Date.parse(interval.endAt)+60*60000).toISOString()};
        const available=(await loadPartyAvailability(db,inputs,extended,5,new Date())).get(scienceId)!.availability;
        const conditional={...row,priceMode:'RANGE' as const,priceItems:[
          {price:100,partyConditions:{durationMinutes:120,maxGuests:4}},
          {price:170,partyConditions:{durationMinutes:120,minGuests:5}},
          {price:160,partyConditions:{durationMinutes:120,minGuests:5}},
        ]};
        const tariff=constructorIntervalPrice(conditional,extended,available,5);
        assert.equal(tariff.state==='RESOLVED' && tariff.price.kind==='EXACT' && tariff.price.amountByn,'160.00');
        assert.equal(constructorIntervalPrice({...conditional,offerBooking:{...conditional.offerBooking!,maxExtensionHours:0}},extended,available,5).state,'UNRESOLVED');
        const quote=constructorIntervalPrice(row,extended,available,5);
        assert.equal(quote.state==='RESOLVED' && quote.price.kind==='EXACT' && quote.price.amountByn,'150.00');
        const buffer=await db.calendarBlock.create({data:{bookingUnitId:unitId,blockStart:new Date(Date.parse(extended.endAt)+10*60000),blockEnd:new Date(Date.parse(extended.endAt)+40*60000)}});
        try {
          const busy=(await loadPartyAvailability(db,inputs,extended,5,new Date())).get(scienceId)!.availability;
          assert.notEqual(busy.state,'AVAILABLE');
          assert.equal(constructorIntervalPrice(row,extended,busy,5).state,'UNRESOLVED');
        } finally { await db.calendarBlock.delete({where:{id:buffer.id}}); }
      } finally { await db.offerBooking.delete({where:{offerId:scienceId}}); }
      const booking=await db.bookingRequest.create({data:{businessId:science.b.id,offerId:scienceId,publicationType:'OFFER',customerName:'Synthetic',customerPhone:'+375000000000'}});
      let allocation=await db.bookingAllocation.create({data:{bookingUnitId:unitId,bookingRequestId:booking.id,blockStart:new Date(interval.startAt),blockEnd:new Date(interval.endAt),status:'HELD',expiresAt:new Date(Date.now()-60000)}});
      assert.equal((await loadPartyAvailability(db,inputs,interval,5,new Date())).get(scienceId)?.availability.state,'AVAILABLE');await db.bookingAllocation.delete({where:{id:allocation.id}});
      allocation=await db.bookingAllocation.create({data:{bookingUnitId:unitId,bookingRequestId:booking.id,blockStart:new Date(day+'T00:00:00Z'),blockEnd:new Date(day+'T23:59:00Z'),status:'CONFIRMED'}});
      evidence=await loadPartyAvailability(db,inputs,interval,5,new Date());for(const input of inputs)assert.equal(evidence.get(input.id)?.availability.state,'UNAVAILABLE');
      await db.bookingAllocation.delete({where:{id:allocation.id}});
      const candidates=await loadConstructorCandidates({...query,selectionContext:context},db);const projected=candidates.find(c=>c.offer.businessId===science.b.id)?.offer;assert.ok(projected?.resources?.some(r=>r.source.id===unitId&&r.stepMinutes.state==='KNOWN'&&r.stepMinutes.value===60));
    });
    await t.test('both existing matching entry points agree and Boost cannot change results',async()=>{
      const before=await findAvailablePartyCandidates({...query,date:day,timeFrom:'12:00',timeTo:'13:00',adultsCount:5});
      const other=await discoverPartyProviders({...query,category:'SHOW',venueMode:'HOME',date:new Date(day),timeFrom:'12:00',timeTo:'13:00',adultsCount:5,childAgeYears:null});
      assert.deepEqual(other.map(c=>c.offerId),before.map(c=>c.offerId));
      await db.boost.create({data:{businessId:music.b.id,offerId:musicId,startAt:new Date(),endAt:new Date(Date.now()+86400000),targetRegionIds:['*'],price:9999}});
      const after=await findAvailablePartyCandidates({...query,date:day,timeFrom:'12:00',timeTo:'13:00',adultsCount:5});assert.deepEqual(after,before);
      assert.equal((await rankPartyCandidates({...query,includeAllRanked:true})).length>0,true);
    });
    await t.test('owned profile interests are server-resolved; foreign profile and party cannot leak',async()=>{
      const kid=await db.child.create({data:{parentId:parent.id,birthDate:new Date('2019-01-01'),birthPrecision:'DAY',systemInterests:{create:{interestSlug:'science'}}}});
      const own=await findCandidatesForParty(parent.id,party.id,'SHOW',[],{personaIds:[kid.id]});assert.ok(own.candidates.some(c=>c.businessId===science.b.id));
      await db.offer.update({where:{id:childId},data:{agePolicy:'SPECIFIC',ageMinMonths:null,ageMaxMonths:90}});
      const precise=await findCandidatesForParty(parent.id,party.id,'SHOW',[],{personaIds:[kid.id]});assert.ok(!precise.candidates.some(c=>c.businessId===child.b.id));
      await db.partyOrder.update({where:{id:party.id},data:{childAge:7}});
      const adultOverride=await findCandidatesForParty(parent.id,party.id,'ANIMATOR',[],{audience:'ADULT',performerRole:'HOST'});assert.ok(adultOverride.candidates.some(c=>c.offerId===hostId));
      await assert.rejects(findCandidatesForParty(host.user.id,party.id,'SHOW'));
      const foreignParty=await db.partyOrder.create({data:{ownerUserId:host.user.id,citySlug:city.slug,venueMode:'HOME',eventDate:new Date(day),timeFrom:'12:00',timeTo:'13:00',childrenCount:0,adultsCount:5}});
      const foreign=await findCandidatesForParty(host.user.id,foreignParty.id,'SHOW',[],{personaIds:[kid.id]});
      const neutral=await findCandidatesForParty(host.user.id,foreignParty.id,'SHOW');assert.deepEqual(foreign,neutral);
      const token=randomBytes(32).toString('hex');await db.session.create({data:{userId:parent.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+86400000)}});
      const response=await fetch(base+`/api/parent/parties/${party.id}/candidates?category=ANIMATOR&audience=ADULT&performerRole=HOST`,{headers:{cookie:`mg_dev_session=${token}`}});
      assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/no-store/);
      const payload=await response.json();assert.ok(payload.candidates.some((c:{offerId:string})=>c.offerId===hostId));assert.ok(!JSON.stringify(payload).includes('depositBalance'));
      await db.partyOrder.deleteMany({where:{ownerUserId:host.user.id}});
    });
    await t.test('candidate reads are batched per page, not per offer; no requests/allocations are written',async()=>{
      const beforeRequests=await db.bookingRequest.count(),beforeAllocations=await db.bookingAllocation.count();
      queries=0;await loadConstructorCandidates({...query,selectionContext:context},db);const small=queries;
      const more=[];for(let i=0;i<20;i++)more.push({kind:'SERVICE' as const,productType:'PARTY_SERVICE' as const,category:'SHOW' as const,title:'A3 batch '+i,placeId:science.p.id,status:'PUBLISHED' as const,agePolicy:'UNRESTRICTED' as const});
      await db.offer.createMany({data:more});const added=await db.offer.findMany({where:{placeId:science.p.id,title:{startsWith:'A3 batch '}},select:{id:true}});offers.push(...added.map(o=>o.id));
      await db.offerPlacement.createMany({data:added.map(o=>({offerId:o.id,key:'BIRTHDAY' as const,status:'APPROVED' as const}))});
      queries=0;await loadConstructorCandidates({...query,selectionContext:context},db);const large=queries;
      assert.equal(large,small);assert.ok(large<25);console.log('A3 queries/page:',small,'→',large);
      assert.equal(await db.bookingRequest.count(),beforeRequests);assert.equal(await db.bookingAllocation.count(),beforeAllocations);
    });
  } finally {
    if(partyId)await db.partyOrder.deleteMany({where:{id:partyId}});
    await db.bookingRequest.deleteMany({where:{businessId:{in:businesses}}});await db.bookingUnit.deleteMany({where:{businessId:{in:businesses}}});
    await db.offer.deleteMany({where:{id:{in:offers}}});await db.place.deleteMany({where:{id:{in:places}}});await db.business.deleteMany({where:{id:{in:businesses}}});await db.user.deleteMany({where:{id:{in:users}}});
    await db.territoryLegacyMap.deleteMany({where:{legacyId:{in:[city.id,otherCity.id]}}});await db.city.deleteMany({where:{id:{in:[city.id,otherCity.id]}}});await db.territory.deleteMany({where:{id:{in:[territory.id,otherTerritory.id]}}});
    await db.$disconnect();
  }
});
