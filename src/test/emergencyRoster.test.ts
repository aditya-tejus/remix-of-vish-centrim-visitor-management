import { describe, expect, it } from "vitest";
import { buildRollCall } from "@/lib/evacuation";
import type { Resident } from "@/hooks/useResidents";

describe("Emergency resident sweep roster", () => {
  it("includes directory residents without claiming their physical presence", () => {
    const resident: Resident = {id:"detail-1",visitorId:"resident-1",firstName:"Test",surname:"Resident",name:"Test Resident",room:"Villa 14",wing:"Stage A",wingId:null,careLevel:"independent",keyWorker:null,photoUrl:null,emergencyContactName:null,emergencyContactPhone:null,mobilityLevel:"independent",dolsLpsFlag:false,riskAssessmentLevel:"standard",medicationNotes:null,mobilityAids:[],notes:null,email:"",mobile:""};
    const roster=buildRollCall({visitors:[],residents:[resident],roomLabel:"Villa"});
    expect(roster.onSite).toHaveLength(1);
    expect(roster.onSite[0]).toMatchObject({key:"resident-1:self",unit:"14",checkInTime:null,type:"resident"});
    expect(roster.offSite).toHaveLength(0);
  });
});