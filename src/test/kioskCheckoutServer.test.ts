// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const B = "11111111-1111-1111-1111-111111111111";
const V = "22222222-2222-2222-2222-222222222222";
const VISIT = "33333333-3333-3333-3333-333333333333";
const SELF = "44444444-4444-4444-4444-444444444444";
const OTHER = "55555555-5555-5555-5555-555555555555";
const FOREIGN = "66666666-6666-6666-6666-666666666666";
const CODE = "ABC123DEF456";
let db: PGlite;
async function value(query: string, params: unknown[] = []) { const r = await db.query<{ result: any }>(query, params); return r.rows[0]?.result; }
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE visitors(id uuid PRIMARY KEY,branch_id uuid,type text,status text,first_name text,surname text,check_in_time timestamptz,check_out_time timestamptz,qr_code text,person_qr text,additional_visitors int,companion_details jsonb,expected_return_date timestamptz,leave_type text,accompanied_by_name text,checkout_reason text);
    CREATE TABLE visits(id uuid PRIMARY KEY,branch_id uuid,legacy_visitor_id uuid,status text);
    CREATE TABLE visit_parties(id uuid PRIMARY KEY,visit_id uuid,person_id uuid,is_primary boolean,companion_index int,check_out_time timestamptz,status text,updated_at timestamptz);
    CREATE TABLE people(id uuid PRIMARY KEY,branch_id uuid,person_qr text);
    CREATE TABLE key_issues(branch_id uuid,visitor_id uuid,returned_at timestamptz);
    CREATE TABLE kiosk_devices(id uuid,token_hash text);
    CREATE TABLE audit_log(action text,performed_by text,records_affected int,details jsonb);
    CREATE FUNCTION kiosk_hash(text) RETURNS text LANGUAGE sql AS 'select $1';
    CREATE FUNCTION kiosk_device_site(text,boolean DEFAULT true) RETURNS uuid LANGUAGE plpgsql AS $$BEGIN
      IF $1='active' THEN RETURN '${B}'::uuid; END IF;
      IF $1='other-site' THEN RETURN '${FOREIGN}'::uuid; END IF;
      RAISE EXCEPTION 'device_refused'; END$$;
    CREATE FUNCTION kiosk_check_out(uuid,timestamptz) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE FUNCTION kioskd_presence_list(text) RETURNS TABLE(id uuid,first_name text,surname text,type text,status text,check_in_time timestamptz,check_out_time timestamptz,whom_to_visit text,qr_code text,group_id uuid,additional_visitors integer,expected_return_date timestamptz,leave_type text,accompanied_by_name text) LANGUAGE sql AS 'select null::uuid,null::text,null::text,null::text,null::text,null::timestamptz,null::timestamptz,null::text,null::text,null::uuid,null::int,null::timestamptz,null::text,null::text where false';
    CREATE FUNCTION kiosk_presence_list(uuid) RETURNS int LANGUAGE sql AS 'select 0';
    INSERT INTO visitors VALUES('${V}','${B}','visitor','checked-in','Private','Person',now(),NULL,'${CODE}','PERSONABC123',1,'[{"name":"Private companion","qrCode":"COMPANION123"}]',NULL,NULL,NULL,NULL);
    INSERT INTO visits VALUES('${VISIT}','${B}','${V}','checked-in');
    INSERT INTO visit_parties VALUES('${SELF}','${VISIT}',NULL,true,0,NULL,'checked-in',now()),('${OTHER}','${VISIT}',NULL,false,1,NULL,'checked-in',now());
    INSERT INTO kiosk_devices VALUES('${B}','active');`);
  await db.exec(readFileSync("drizzle/migrations/0004_private_kiosk_visitor_departures.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0005_resident_qr_compatibility_lookup.sql", "utf8"));
}, 30000);
afterAll(async () => { await db?.close(); });

describe("actual kiosk SQL in isolated PostgreSQL", () => {
  it.each(["", "revoked", "expired"])("refuses device %s", async token => {
    await expect(value("select kioskd_checkout_lookup($1,$2) result", [token, CODE])).rejects.toThrow("device_refused");
  });
  it("has no unauthenticated legacy directory or internal helper grant", async () => {
    expect(await value("select has_function_privilege('anon','kiosk_presence_list(uuid)','EXECUTE') result")).toBe(false);
    expect(await value("select has_function_privilege('anon','kiosk_checkout_target(uuid,text,uuid)','EXECUTE') result")).toBe(false);
  });
  it("normalizes names and reveals no existence, duplicate or resident data", async () => {
    for (const q of ["Private", "Unknown", "  Ｐrivate   Person  "]) expect(await value("select kioskd_checkout_name('active',$1) result", [q])).toEqual({ state: "staff_required" });
    for (const q of ["", "ab", "a".repeat(61), "Pr%", "___"]) expect(await value("select kioskd_checkout_name('active',$1) result", [q])).toEqual({ state: "invalid_input" });
  });
  it("cross-site and invalid codes never reveal identity", async () => {
    expect(await value("select kioskd_checkout_lookup('other-site',$1) result", [CODE])).toEqual({ state: "no_match" });
    expect(await value("select kioskd_checkout_lookup('active','XXXXXXXXXXXX') result")).toEqual({ state: "no_match" });
    expect(await value("select kioskd_checkout_lookup('active','ABC%') result")).toEqual({ state: "invalid_input" });
  });
  it("valid card response contains only scoped pseudonymous parties, no PII or QR", async () => {
    const r = await value("select kioskd_checkout_lookup('active',$1) result", [` ${CODE.toLowerCase()} `]);
    expect(r.state).toBe("ready"); expect(r.parties).toHaveLength(2);
    expect(r.parties.map((p: any) => p.label)).toEqual(["You", "Companion 1"]);
    expect(Object.keys(r).sort()).toEqual(["open_keys", "parties", "state", "visit_id", "visitor_id", "visitor_type"]);
    expect(JSON.stringify(r)).not.toMatch(/Private|Person|COMPANION123|ABC123DEF456|qr_code|surname|address|host|room/);
  });
  it("companion card cannot select the primary or other people", async () => {
    const r = await value("select kioskd_checkout_lookup('active','COMPANION123') result");
    expect(r.parties).toEqual([{ id: OTHER, label: "You", primary: true }]);
    await expect(value("select kioskd_checkout_submit('active','COMPANION123',$1,$2::uuid[]) result", [VISIT, [SELF]])).rejects.toThrow("invalid_departure");
  });
  it("refuses duplicates, foreign IDs and wrong-site departure", async () => {
    for (const ids of [[SELF, SELF], [FOREIGN], [], [SELF, FOREIGN]]) await expect(value("select kioskd_checkout_submit('active',$1,$2,$3::uuid[]) result", [CODE, VISIT, ids])).rejects.toThrow("invalid_departure");
    await expect(value("select kioskd_checkout_submit('other-site',$1,$2,$3::uuid[]) result", [CODE, VISIT, [SELF]])).rejects.toThrow("invalid_departure");
    expect(await value("select count(*)::int result from visit_parties where check_out_time is null")).toBe(2);
  });
  it("public UUID-only checkout cannot close visitors", async () => {
    await expect(value("select kioskd_check_out('active',$1,now()) result", [V])).rejects.toThrow("use_verified_visitor_departure");
  });
  it("keeps unselected companion open, mirrors and audits partial departure, retries idempotently", async () => {
    expect(await value("select kioskd_checkout_submit('active',$1,$2,$3::uuid[]) result", [CODE, VISIT, [SELF]])).toEqual({ saved: true, departed: 1, remaining: 1 });
    expect(await value("select status result from visitors where id=$1", [V])).toBe("checked-in");
    expect(await value("select check_out_time is null result from visit_parties where id=$1", [OTHER])).toBe(true);
    expect(await value("select kioskd_checkout_submit('active',$1,$2,$3::uuid[]) result", [CODE, VISIT, [SELF]])).toEqual({ saved: true, departed: 0, remaining: 1 });
    expect(await value("select count(*)::int result from audit_log")).toBe(1);
    expect(await value("select details->>'delivery_state' result from audit_log")).toBe("not_configured");
  });
  it("closes only when the final selected party departs", async () => {
    expect(await value("select kioskd_checkout_submit('active',$1,$2,$3::uuid[]) result", [CODE, VISIT, [OTHER]])).toEqual({ saved: true, departed: 1, remaining: 0 });
    expect(await value("select status result from visitors where id=$1", [V])).toBe("checked-out");
    expect(await value("select companion_details->0->>'checkedOutAt' is not null result from visitors where id=$1", [V])).toBe(true);
  });
  it("resident compatibility list returns no ordinary visitors", async () => expect((await db.query("select * from kioskd_presence_list('active')")).rows).toEqual([]));
  it("resident QR compatibility reveals only its verified reference and no cross-site identity", async () => {
    await db.exec(`INSERT INTO visitors(id,branch_id,type,status,first_name,surname,qr_code,check_in_time) VALUES('${FOREIGN}','${B}','resident','checked-in','Private','Resident','RESIDENT1234',now());`);
    expect(await value("select kioskd_resident_code('active','RESIDENT1234') result")).toEqual({ state: "resident", id: FOREIGN });
    expect(await value("select kioskd_resident_code('other-site','RESIDENT1234') result")).toEqual({ state: "no_match" });
    await db.exec(`DELETE FROM visitors WHERE id='${FOREIGN}'`);
  });
  it("ambiguous duplicate codes require staff without identifying either person", async () => {
    await db.exec(`UPDATE visits SET status='checked-in'; INSERT INTO visit_parties VALUES('${FOREIGN}','${VISIT}',NULL,true,0,NULL,'checked-in',now());`);
    expect(await value("select kioskd_checkout_lookup('active',$1) result", [CODE])).toEqual({ state: "staff_required" });
    await db.exec(`DELETE FROM visit_parties WHERE id='${FOREIGN}';`);
  });
  it("caps lookup at 50 without returning oversized parties", async () => {
    await db.exec(`UPDATE visit_parties SET check_out_time=NULL; INSERT INTO visit_parties SELECT ('77777777-7777-7777-7777-'||lpad(i::text,12,'0'))::uuid,'${VISIT}',NULL,false,i,NULL,'checked-in',now() FROM generate_series(2,51) i;`);
    expect(await value("select kioskd_checkout_lookup('active',$1) result", [CODE])).toEqual({ state: "staff_required" });
    await db.exec("DELETE FROM visit_parties WHERE companion_index>=2");
  });
  it("audit failure rolls back all selected departures", async () => {
    await db.exec(`CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit_unavailable'; END$$; CREATE TRIGGER fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_audit();`);
    await expect(value("select kioskd_checkout_submit('active',$1,$2,$3::uuid[]) result", [CODE, VISIT, [SELF, OTHER]])).rejects.toThrow("audit_unavailable");
    expect(await value("select count(*)::int result from visit_parties where check_out_time is null")).toBe(2);
  });
});