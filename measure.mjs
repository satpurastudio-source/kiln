import puppeteer from 'puppeteer-core'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 3 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' })
await sleep(4500)

const m = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.nav-item')].find((n) =>
    n.textContent.includes('Getting')
  )
  const label = item.querySelector('span:nth-of-type(2)')
  const dot = item.querySelector('.project-dot')
  const cs = getComputedStyle(label)

  // ink metrics of the visible glyphs via canvas
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const tm = ctx.measureText(label.textContent)

  const lr = label.getBoundingClientRect()
  const dr = dot.getBoundingClientRect()

  // where is the baseline inside the label box?
  // line box centers the font's (fontAscent+fontDescent) block
  const fa = tm.fontBoundingBoxAscent
  const fd = tm.fontBoundingBoxDescent
  const boxH = lr.height
  const baselineY = lr.top + (boxH - (fa + fd)) / 2 + fa
  // ink center of the actual string
  const inkTop = baselineY - tm.actualBoundingBoxAscent
  const inkBottom = baselineY + tm.actualBoundingBoxDescent
  const inkCenter = (inkTop + inkBottom) / 2
  // x-height center (what the eye reads as "middle of the word")
  const xCenter = baselineY - tm.actualBoundingBoxAscent * 0 - (ctx.measureText('x').actualBoundingBoxAscent / 2)

  const dotCenter = (dr.top + dr.bottom) / 2
  return {
    labelBoxCenter: +(lr.top + boxH / 2).toFixed(2),
    baselineY: +baselineY.toFixed(2),
    inkCenter: +inkCenter.toFixed(2),
    xHeightCenter: +xCenter.toFixed(2),
    dotCenter: +dotCenter.toFixed(2),
    dotVsInk: +(dotCenter - inkCenter).toFixed(2),
    dotVsXHeight: +(dotCenter - xCenter).toFixed(2),
    fontUsed: ctx.font,
  }
})
console.log(JSON.stringify(m, null, 1))
await browser.close()
