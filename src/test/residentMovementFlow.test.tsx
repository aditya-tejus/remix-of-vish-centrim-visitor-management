import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { useResidentMovement } from "@/hooks/useResidentMovement";
import { ResidentOutingDialog } from "@/components/ResidentOutingDialog";
import { CheckInReturnDialog } from "@/components/CheckInReturnDialog";
import { useResidents } from "@/hooks/useResidents";
import KioskResidentLeave from "@/pages/kiosk/KioskResidentLeave";
import { MemoryRouter } from "react-router-dom";
const f=vi.hoisted(()=>({site:"site-a" as string|null, allowed:true,pack:"au_rv",rpc:vi.fn(),from:vi.fn()}));
vi.mock("@/contexts/SiteContext",()=>({useSite:()=>({currentSiteId:f.site,currentSite:{timezone:"Australia/Sydney"},isLegacySite:false})}));
vi.mock("@/hooks/usePermissions",()=>({usePermissions:()=>({can:()=>f.allowed,loading:false})}));
vi.mock("@/contexts/OperatingContext",()=>({useOperatingContext:()=>({packId:f.pack,jurisdiction:"AU",modules:{selfReportedAway:f.pack==="au_rv"}})}));
vi.mock("@/hooks/useStaffMembers",()=>({useStaffMembers:()=>({staff:[]})}));
vi.mock("@/hooks/useLeaveTypes",()=>({useActiveLeaveTypes:()=>({data:[]})}));
vi.mock("@/hooks/useFormFields",()=>({useCompanionFields:()=>({data:[]})}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{rpc:f.rpc,from:f.from}}));
beforeEach(()=>{
 f.site="site-a";f.allowed=true;f.pack="au_rv";f.rpc.mockReset();f.from.mockReset();
 f.from.mockImplementation(()=>{const q:any={};for(const key of ["select","eq","or","order"])q[key]=()=>q;q.then=(cb:any)=>Promise.resolve(cb({data:[],error:null}));return q;});
});
afterEach(cleanup);
const resident={visitorId:"resident-a",savedStatus:"checked-in"};
const saved={saved:true,resident_id:"resident-a",branch_id:"site-a",movement:"leave",status:"checked-out",recorded_time:"2026-10-27T02:00Z"};
describe("resident movement guarded interactions",()=>{
 it("does not download public directory or records without a site",async()=>{
  renderHook(()=>useResidents({publicMode:true}));await act(async()=>{});expect(f.from).not.toHaveBeenCalled();
  f.site=null;renderHook(()=>useResidents());await act(async()=>{});expect(f.from).not.toHaveBeenCalled();
 });
 it("public resident screen offers assistance without directory or write calls",()=>{
  render(<MemoryRouter><KioskResidentLeave/></MemoryRouter>);expect(screen.getByRole("button",{name:"Back to home"})).toBeEnabled();expect(f.from).not.toHaveBeenCalled();expect(f.rpc).not.toHaveBeenCalled();
 });
 it("refuses missing site and permission before submission",async()=>{
  f.site=null;const {result,rerender}=renderHook(()=>useResidentMovement(vi.fn()));await expect(result.current.save(resident,"leave",{})).rejects.toThrow();
  f.site="site-a";f.allowed=false;rerender();await expect(result.current.save(resident,"leave",{})).rejects.toThrow();expect(f.rpc).not.toHaveBeenCalled();
 });
 it("waits for save, rejects double click and reads back only confirmed outcome",async()=>{
  let finish:((v:any)=>void)|undefined;f.rpc.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const read=vi.fn();const {result}=renderHook(()=>useResidentMovement(read));
  let pending:Promise<unknown>|undefined;act(()=>{pending=result.current.save(resident,"leave",{});});await expect(result.current.save(resident,"leave",{})).rejects.toThrow("already");expect(read).not.toHaveBeenCalled();
  await act(async()=>{finish?.({data:saved,error:null});await pending;});expect(read).toHaveBeenCalledTimes(1);expect(f.rpc).toHaveBeenCalledTimes(1);
 });
 it("failed retry retains exact request and false results never trigger readback",async()=>{
  f.rpc.mockResolvedValueOnce({data:null,error:{message:"failed"}}).mockResolvedValueOnce({data:{...saved,saved:false},error:null}).mockResolvedValueOnce({data:saved,error:null});
  const read=vi.fn();const {result}=renderHook(()=>useResidentMovement(read));
  await act(async()=>{await expect(result.current.save(resident,"leave",{reason:"Family visit"})).rejects.toThrow();});
  await act(async()=>{await expect(result.current.save(resident,"leave",{reason:"Family visit"})).rejects.toThrow();});expect(read).not.toHaveBeenCalled();
  await act(async()=>{await result.current.save(resident,"leave",{reason:"Family visit"});});expect(f.rpc.mock.calls[0][1]).toEqual(f.rpc.mock.calls[2][1]);
 });
 it("rejects changed site response and never refreshes new site as success",async()=>{
  let finish:((v:any)=>void)|undefined;f.rpc.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const read=vi.fn();const {result,rerender}=renderHook(()=>useResidentMovement(read));
  let pending:Promise<unknown>|undefined;act(()=>{pending=result.current.save(resident,"leave",{});});f.site="site-b";rerender();
  await act(async()=>{finish?.({data:saved,error:null});await expect(pending).rejects.toThrow("site changed");});expect(read).not.toHaveBeenCalled();
 });
 const preselected={id:"resident-a",name:"Rose Lee",room:"Villa 1",wing:"East"};
 it("independent sheet allows empty optional fields and retains them after failure",async()=>{
  const submit=vi.fn().mockRejectedValueOnce(new Error("Not saved")).mockResolvedValueOnce(undefined);const close=vi.fn();
  render(<ResidentOutingDialog open onOpenChange={close} preselectedResident={preselected} onMarkAway={submit}/>);
  const button=screen.getByRole("button",{name:"Record absence"});expect(button).toBeEnabled();fireEvent.click(button);await screen.findByRole("alert");expect(close).not.toHaveBeenCalled();
  expect(submit.mock.calls[0][1]).toMatchObject({expectedReturnDate:undefined,checkoutReason:undefined,accompaniedBy:undefined});
  fireEvent.click(button);await waitFor(()=>expect(close).toHaveBeenCalledWith(false));expect(submit.mock.calls[0]).toEqual(submit.mock.calls[1]);
 });
 it("RAC form still requires reason and escort",()=>{
  f.pack="au_rac";render(<ResidentOutingDialog open onOpenChange={vi.fn()} preselectedResident={preselected} onMarkAway={vi.fn()}/>);expect(screen.getByRole("button",{name:"Record departure"})).toBeDisabled();
 });
 it("return failure retains notes and allows retry without false dismissal",async()=>{
  const submit=vi.fn().mockRejectedValueOnce(new Error("Not saved")).mockResolvedValueOnce(undefined);const close=vi.fn();render(<CheckInReturnDialog open onOpenChange={close} visitorName="Rose Lee" onConfirm={submit}/>);
  fireEvent.change(screen.getByLabelText("Return Notes (optional)"),{target:{value:"Resident reported return"}});fireEvent.click(screen.getByRole("button",{name:"Confirm Return"}));await screen.findByRole("alert");expect(close).not.toHaveBeenCalled();expect(screen.getByLabelText("Return Notes (optional)")).toHaveValue("Resident reported return");
  fireEvent.click(screen.getByRole("button",{name:"Confirm Return"}));await waitFor(()=>expect(close).toHaveBeenCalledWith(false));expect(submit.mock.calls[1][0]).toBe("Resident reported return");
 });
});