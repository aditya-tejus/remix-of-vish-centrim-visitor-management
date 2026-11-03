/** Print through a hidden frame: no pop-up blocker, and staff stay on the page. Returns false if blocked. */
export function printHtml(html: string): boolean {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { frame.contentWindow!.focus(); frame.contentWindow!.print(); } catch { /* blocked */ } setTimeout(() => frame.remove(), 1000); }, 250);
    return true;
  } catch { frame.remove(); return false; }
}
