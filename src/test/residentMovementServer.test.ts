// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const S="11111111-1111-1111-1111-111111111111", R="22222222-2222-2222-2222-222222222222", U="33333333-3333-3333-3333-333333333333", O="44444444-4444-4444-4444-444444444444";
let db:PGlite; let sequence=0;
const request=()=>`55555555-5555-5555-5555-${String(++sequence).padStart(12,"0")}`;
async function result(sql:string,args:unknown[]=[]){return (await db.query<{result:any}>(sql,args)).rows[0]?.result;}
async function move(action:string,id=request(),details:Record<string,unknown>={},site=S,resident=R,status=action==="leave"?"checked-in":"checked-out"){
  return result("select staff_resident_movement($1,$2,$3,$4,$5,$6::jsonb) result",[site,resident,id,action,status,JSON.stringify(details)]);
}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE TYPE app_permission AS ENUM('checkout.perform','checkin.create');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$select nullif(current_setting('test.actor',true),'')::uuid$$;
 CREATE FUNCTION user_can_access_site(uuid) RETURNS boolean LANGUAGE sql AS $$select $1='${S}'::uuid$$;
 CREATE FUNCTION has_permission(uuid,app_permission) RETURNS boolean LANGUAGE sql AS $$select coalesce(current_setting('test.allowed',true),'true')='true'$$;
 CREATE FUNCTION kiosk_device_site(text,boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$BEGIN IF $1='valid' THEN RETURN '${S}'::uuid;END IF;RAISE EXCEPTION 'device_refused';END$$;
 CREATE TABLE branches(id uuid,is_legacy_placeholder boolean);
 CREATE TABLE visitors(id uuid PRIMARY KEY,branch_id uuid,type text,status text,check_in_time timestamptz,check_out_time timestamptz,expected_return_date timestamptz,checkout_reason text,leave_type text,accompanied_by text,accompanied_by_name text,comments text,return_notification_opt_in boolean,companion_details jsonb,additional_visitors int);
 CREATE TABLE audit_log(action text,user_id uuid,performed_by text,records_affected int,details jsonb,change_reason text,created_at timestamptz DEFAULT now());
 CREATE FUNCTION kioskd_resident_directory(text,text) RETURNS int LANGUAGE sql AS 'select 1';
 CREATE FUNCTION kioskd_presence_list(text) RETURNS int LANGUAGE sql AS 'select 1';
 CREATE FUNCTION kioskd_resident_leave(text,uuid,timestamptz,text,timestamptz,text,text) RETURNS boolean LANGUAGE sql AS 'select true';
 CREATE FUNCTION kioskd_resident_return(text,uuid,timestamptz) RETURNS boolean LANGUAGE sql AS 'select true';
 CREATE FUNCTION kioskd_check_out(text,uuid,timestamptz) RETURNS boolean LANGUAGE sql AS 'select true';
 CREATE FUNCTION kiosk_resident_directory(text,uuid) RETURNS int LANGUAGE sql AS 'select 1';
 CREATE FUNCTION kiosk_resident_leave(uuid,timestamptz,text,timestamptz,text,text) RETURNS boolean LANGUAGE sql AS 'select true';
 CREATE FUNCTION kiosk_resident_return(uuid,timestamptz) RETURNS boolean LANGUAGE sql AS 'select true';
 CREATE FUNCTION kiosk_check_out(uuid,timestamptz) RETURNS boolean LANGUAGE sql AS 'select true';
 INSERT INTO visitors(id,branch_id,type,status,check_in_time) VALUES('${R}','${S}','resident','checked-in',now()),('${O}','${O}','resident','checked-in',now());
 INSERT INTO branches VALUES('${S}',true);
 SELECT set_config('test.actor','${U}',false);`);
 await db.exec(readFileSync("drizzle/migrations/0006_resident_movement_staff_boundary.sql","utf8"));
 await db.exec(readFileSync("drizzle/migrations/0007_validate_resident_movement_inputs.sql","utf8"));
},30000);
afterAll(async()=>{await db?.close();});
describe("applied resident movement SQL in isolated PostgreSQL",()=>{
 it("public and signed-in browsers cannot call old directory or UUID movement helpers",async()=>{
  const signatures=["kioskd_resident_directory(text,text)","kioskd_presence_list(text)","kioskd_resident_leave(text,uuid,timestamptz,text,timestamptz,text,text)","kioskd_resident_return(text,uuid,timestamptz)","kioskd_check_out(text,uuid,timestamptz)","kiosk_resident_directory(text,uuid)","kiosk_resident_leave(uuid,timestamptz,text,timestamptz,text,text)","kiosk_resident_return(uuid,timestamptz)","kiosk_check_out(uuid,timestamptz)"];
  for(const role of ["anon","authenticated"]) for(const signature of signatures) expect(await result("select has_function_privilege($1,$2,'EXECUTE') result",[role,signature])).toBe(false);
  expect(await result("select has_function_privilege('anon','staff_resident_movement(uuid,uuid,uuid,text,text,jsonb)','EXECUTE') result")).toBe(false);
 });
 it("resident codes disclose nothing for valid, unknown or other-site codes",async()=>{
  for(const code of ["RESIDENT1234","UNKNOWN12345","",O]) expect(await result("select kioskd_resident_code('valid',$1) result",[code])).toEqual({state:"staff_required"});
  await expect(result("select kioskd_resident_code('revoked','RESIDENT1234') result")).rejects.toThrow("device_refused");
 });
 it("rejects no-session, no-site, wrong-site and missing permission without changing records",async()=>{
  await db.exec("select set_config('test.actor','',false)"); await expect(move("leave")).rejects.toThrow("invalid_movement");
  await db.exec(`select set_config('test.actor','${U}',false)`);
  await expect(move("leave",request(),{},null as unknown as string)).rejects.toThrow("invalid_movement");
  await expect(move("leave",request(),{},O)).rejects.toThrow("movement_not_permitted");
  await expect(move("leave",request(),{},S,O)).rejects.toThrow("resident_not_at_site");
  await db.exec("select set_config('test.allowed','false',false)");await expect(move("leave")).rejects.toThrow("movement_not_permitted");await db.exec("select set_config('test.allowed','true',false)");
  expect(await result(`select status result from visitors where id='${R}'`)).toBe("checked-in");
 });
 it("persists optional return, reason and honest atomic actor/site/time audit",async()=>{
  const id=request();const details={expected_return:"2099-10-28T13:30:00Z",reason:"Resident-chosen family visit",accompanied_by:"family",accompanied_by_name:"Family member"};
  const saved=await move("leave",id,details);expect(saved.saved).toBe(true);expect(saved.expected_return).toBe("2099-10-28T13:30:00+00:00");
  expect(await result(`select checkout_reason result from visitors where id='${R}'`)).toBe(details.reason);
  const audit=await result("select details result from audit_log where details->>'request_id'=$1",[id]);expect(audit.branch_id).toBe(S);expect(audit.message_sent).toBe(false);expect(audit.evidence).toBe("staff_recorded_movement_not_physical_safety");
  expect(await result("select user_id::text result from audit_log where details->>'request_id'=$1",[id])).toBe(U);
  expect(await move("leave",id,details)).toEqual(saved);
  expect(await result("select count(*)::int result from audit_log where details->>'request_id'=$1",[id])).toBe(1);
  await expect(move("leave",id,{reason:"changed"})).rejects.toThrow("request_mismatch");
 });
 it("rejects stale double departure and invalid overnight return",async()=>{
  await expect(move("leave")).rejects.toThrow("movement_changed_refresh");
  await expect(move("return",request(),{recorded_time:"2000-01-01T00:00Z"})).rejects.toThrow("invalid_movement_time");
 });
 it("return clears absence metadata, retains historical audit and retries safely",async()=>{
  const id=request();const saved=await move("return",id,{comments:"Return reported at reception"});expect(saved.saved).toBe(true);expect(saved.expected_return).toBeNull();
  expect(await result(`select check_out_time is null and expected_return_date is null result from visitors where id='${R}'`)).toBe(true);
  expect(await move("return",id,{comments:"Return reported at reception"})).toEqual(saved);
  await expect(move("return")).rejects.toThrow("movement_changed_refresh");
 });
 it("optional independent absence stores no invented reason/return/escort",async()=>{
  await move("leave");expect(await result(`select expected_return_date is null and checkout_reason is null and accompanied_by is null result from visitors where id='${R}'`)).toBe(true);await move("return");
 });
 it("legacy unassigned records stay in their legacy site only",async()=>{
  await db.exec(`UPDATE visitors SET branch_id=NULL WHERE id='${R}'`);expect((await move("leave")).saved).toBe(true);await move("return");await db.exec(`UPDATE visitors SET branch_id='${S}' WHERE id='${R}'`);
 });
 it("rejects arbitrary fields, malformed companions and oversized audit content",async()=>{
  for(const details of [{clinical_notes:"unexpected"},{companion_details:"wrong"},{return_notification_opt_in:"yes"},{reason:"x".repeat(4001)}]) await expect(move("leave",request(),details)).rejects.toThrow();
  expect(await result(`select status result from visitors where id='${R}'`)).toBe("checked-in");
 });
 it("audit failure rolls back a movement instead of showing unaudited success",async()=>{
  await db.exec(`CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit_failed';END$$;CREATE TRIGGER audit_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_audit();`);
  await expect(move("leave")).rejects.toThrow("audit_failed");expect(await result(`select status result from visitors where id='${R}'`)).toBe("checked-in");
 });
});