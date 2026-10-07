import { toPng } from "html-to-image"

// Saves a chart exactly as it looks on screen - bars/lines/pie, colors,
// legend and all - as a .png someone can drop straight into a presentation
// or document.
//
// Captures the chart's whole container element, not just its inner <svg>.
// A recharts legend is laid out as a separate HTML element next to the SVG
// (not inside it), so an earlier attempt that only grabbed the <svg> just
// silently dropped the legend - and any chart that leaned on the legend to
// carry its labels (every "by status" pie, the multi-series line chart)
// came out broken. html-to-image walks the real DOM subtree, computed
// styles and all, so both parts come through together.
export async function downloadChartAsImage(container: HTMLElement | null, filename: string) {
  if (!container) return
  try {
    const dataUrl = await toPng(container, {
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      pixelRatio: 2, // crisper than a 1:1 raster of an on-screen chart
    })
    const a = document.createElement("a")
    a.href = dataUrl
    a.download = `${filename}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (error) {
    console.error("Chart image export failed:", error)
  }
}
