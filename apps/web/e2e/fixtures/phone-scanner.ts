import type {Page} from "@playwright/test";
// Scans run only in the phone scanner-only screen (touch device at phone width).
export const PHONE={viewport:{width:390,height:844},hasTouch:true,isMobile:true};
export async function openBankScanner(page:Page,direction?:"Inbound"|"Outbound"){
 await page.goto("/");const scanner=page.getByRole("main",{name:"Mobile blood unit scanner",exact:true});
 if(direction)await scanner.getByRole("button",{name:direction,exact:true}).click();
 return scanner;
}
export async function openReceiptScanner(page:Page){await page.goto("/");return page.getByRole("main",{name:"Mobile receipt scanner",exact:true});}
export const signOut=(page:Page)=>page.getByRole("button",{name:"Sign out",exact:true});
