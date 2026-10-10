export interface TableReport {title:string;scope:string;filters:string;headers:string[];rows:(string|number|null|undefined)[][];filename:string}
// Export only the supplied authorized snapshot. No rereads or mutation requests.
export async function exportTablePdf(report:TableReport) {
  if(!report.rows.length)throw new Error("No records in this view to export.");
  const [{jsPDF},{autoTable}]=await Promise.all([import("jspdf"),import("jspdf-autotable")]);
  const doc=new jsPDF({orientation:"landscape",unit:"pt",format:"a4"});
  const width=doc.internal.pageSize.getWidth(),height=doc.internal.pageSize.getHeight();
  doc.setProperties({title:report.title,author:"BloodLedger",subject:"Recorded snapshot"});
  doc.setFillColor(154,27,27);doc.roundedRect(36,28,28,28,5,5,"F");doc.setTextColor(255);doc.setFont("helvetica","bold");doc.setFontSize(16);doc.text("B",45,48);
  doc.setTextColor(14,18,24);doc.text("BloodLedger",76,46);doc.setFontSize(18);doc.text(report.title,36,86);
  doc.setFont("helvetica","normal");doc.setFontSize(9);
  doc.text(doc.splitTextToSize("Scope: "+report.scope,width-72),36,106);
  const filterLines=doc.splitTextToSize("Filters: "+report.filters,width-72);doc.text(filterLines,36,123);
  const metadataY=137+(filterLines.length-1)*11;
  doc.text("Generated: "+new Date().toISOString()+" | Records: "+report.rows.length,36,metadataY);
  doc.setTextColor(105,113,129);doc.text("Snapshot of loaded records. This PDF does not approve a request or confirm a pending command.",36,metadataY+15);
  autoTable(doc,{startY:metadataY+30,head:[report.headers],body:report.rows.map(row=>row.map(value=>value==null||value===""?"Not available":String(value))),theme:"grid",rowPageBreak:"avoid",margin:{top:36,left:36,right:36,bottom:40},styles:{font:"helvetica",fontSize:8,cellPadding:5,overflow:"linebreak"},headStyles:{fillColor:[15,22,32],textColor:[255,255,255]},alternateRowStyles:{fillColor:[250,248,243]},didDrawPage:()=>{doc.setFontSize(8);doc.setTextColor(105,113,129);doc.text("BloodLedger | "+doc.getNumberOfPages(),36,height-22);}});
  doc.save(report.filename+".pdf");
}
