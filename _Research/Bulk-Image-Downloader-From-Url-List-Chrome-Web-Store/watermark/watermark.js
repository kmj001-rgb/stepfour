// watermark.js
document.addEventListener('DOMContentLoaded', function () {
  // DOM Elements
  const backgroundInput = document.getElementById('backgroundImage')
  const watermarkInput = document.getElementById('watermarkImage')
  const backgroundPreview = document.getElementById('backgroundPreview')
  const watermarkPreview = document.getElementById('watermarkPreview')
  const previewBtn = document.getElementById('previewWatermark')
  const downloadBtn = document.getElementById('downloadWatermark')
  const resetBtn = document.getElementById('resetSettings')
  const opacitySlider = document.getElementById('opacity')
  const opacityValue = document.getElementById('opacityValue')
  const gravitySelect = document.getElementById('gravity')
  const marginInput = document.getElementById('margin')
  const maxSizeInput = document.getElementById('maxWatermarkSize')
  const mainTitle = document.getElementById('mainPreviewTitle')

  // Default settings
  const defaultSettings = {
    opacity: 50,
    gravity: 'center',
    margin: 10,
    maxWatermarkSize: 30,
    backgroundImage: null,
    watermarkImage: null
  }

  // App state
  let state = {
    backgroundImageUrl: null,
    watermarkImageUrl: null,
    resultImageUrl: null,
    watermarkElement: null
  }

  // Load saved settings/images from localStorage
  function loadState () {
    const saved =
      JSON.parse(localStorage.getItem('watermarkAppState')) || defaultSettings

    // Apply controls
    opacitySlider.value = saved.opacity
    opacityValue.textContent = `${saved.opacity}%`
    gravitySelect.value = saved.gravity
    marginInput.value = saved.margin
    maxSizeInput.value = saved.maxWatermarkSize

    // Background preview
    if (saved.backgroundImage) {
      state.backgroundImageUrl = saved.backgroundImage
      const img = new Image()
      img.onload = () => {
        img.style.maxHeight = '200px'
        backgroundPreview.innerHTML = ''
        backgroundPreview.appendChild(img)
      }
      img.src = saved.backgroundImage
    }

    // Watermark preview
    if (saved.watermarkImage) {
      state.watermarkImageUrl = saved.watermarkImage
      const img = new Image()
      img.onload = () => {
        img.style.maxHeight = '200px'
        watermarkPreview.innerHTML = ''
        watermarkPreview.appendChild(img)
        state.watermarkElement = img
        applyOpacityToWatermarkPreview()
      }
      img.src = saved.watermarkImage
    }
  }

  // Save current settings to localStorage
  function saveState () {
    const s = {
      opacity: opacitySlider.value,
      gravity: gravitySelect.value,
      margin: marginInput.value,
      maxWatermarkSize: maxSizeInput.value,
      backgroundImage: state.backgroundImageUrl,
      watermarkImage: state.watermarkImageUrl
    }
    localStorage.setItem('watermarkAppState', JSON.stringify(s))
  }

  // Apply opacity on watermark preview
  function applyOpacityToWatermarkPreview () {
    if (!state.watermarkElement) return
    state.watermarkElement.style.opacity = opacitySlider.value / 100
  }

  // Reset everything
  function resetAllSettings () {
    localStorage.removeItem('watermarkAppState')
    state = {
      backgroundImageUrl: null,
      watermarkImageUrl: null,
      resultImageUrl: null,
      watermarkElement: null
    }
    loadState()
    backgroundPreview.innerHTML = '<span>No image selected</span>'
    watermarkPreview.innerHTML = '<span>No image selected</span>'
    mainTitle.textContent = 'Main Image Preview'
    downloadBtn.disabled = true
    backgroundInput.value = ''
    watermarkInput.value = ''
  }

  // Helper to resize watermark proportionally
  function resizeWatermarkIfNeeded (wm, bg) {
    const maxPct = parseInt(maxSizeInput.value, 10) || 30
    const maxW = bg.width * (maxPct / 100)
    const maxH = bg.height * (maxPct / 100)
    if (wm.width <= maxW && wm.height <= maxH) return wm

    let newW,
      newH,
      ratio = wm.width / wm.height
    if (wm.width > maxW) {
      newW = maxW
      newH = newW / ratio
    } else {
      newH = maxH
      newW = newH * ratio
    }
    if (newH > maxH) {
      newH = maxH
      newW = newH * ratio
    }

    const canvas = document.createElement('canvas')
    canvas.width = newW
    canvas.height = newH
    const ctx = canvas.getContext('2d')
    ctx.drawImage(wm, 0, 0, newW, newH)

    const resized = new Image()
    resized.src = canvas.toDataURL('image/png')
    return resized
  }

  // Calculate watermark position
  function calculateWatermarkPosition (bg, wm, position, margin) {
    const bw = bg.width,
      bh = bg.height
    const ww = wm.width,
      wh = wm.height
    let x = 0,
      y = 0
    switch (position) {
      case 'northwest':
        x = margin
        y = margin
        break
      case 'north':
        x = (bw - ww) / 2
        y = margin
        break
      case 'northeast':
        x = bw - ww - margin
        y = margin
        break
      case 'west':
        x = margin
        y = (bh - wh) / 2
        break
      case 'center':
        x = (bw - ww) / 2
        y = (bh - wh) / 2
        break
      case 'east':
        x = bw - ww - margin
        y = (bh - wh) / 2
        break
      case 'southwest':
        x = margin
        y = bh - wh - margin
        break
      case 'south':
        x = (bw - ww) / 2
        y = bh - wh - margin
        break
      case 'southeast':
        x = bw - ww - margin
        y = bh - wh - margin
        break
    }
    return { x, y }
  }

  // INITIALIZE
  loadState()

  // LISTENERS

  // Opacity live update
  opacitySlider.addEventListener('input', () => {
    opacityValue.textContent = `${opacitySlider.value}%`
    applyOpacityToWatermarkPreview()
    saveState()
  })

  // Save other controls
  ;[gravitySelect, marginInput, maxSizeInput].forEach(el =>
    el.addEventListener('change', saveState)
  )

  // Reset button
  resetBtn.addEventListener('click', resetAllSettings)

  // Background upload
  backgroundInput.addEventListener('change', e => {
    if (!e.target.files[0]) return
    const reader = new FileReader()
    reader.onload = evt => {
      state.backgroundImageUrl = evt.target.result
      const img = new Image()
      img.onload = () => {
        img.style.maxHeight = '200px'
        backgroundPreview.innerHTML = ''
        backgroundPreview.appendChild(img)
        saveState()
      }
      img.src = state.backgroundImageUrl
    }
    reader.readAsDataURL(e.target.files[0])
  })

  // Watermark upload
  watermarkInput.addEventListener('change', e => {
    if (!e.target.files[0]) return
    const reader = new FileReader()
    reader.onload = evt => {
      state.watermarkImageUrl = evt.target.result
      const img = new Image()
      img.onload = () => {
        img.style.maxHeight = '200px'
        watermarkPreview.innerHTML = ''
        watermarkPreview.appendChild(img)
        state.watermarkElement = img
        applyOpacityToWatermarkPreview()
        saveState()
      }
      img.src = state.watermarkImageUrl
    }
    reader.readAsDataURL(e.target.files[0])
  })

  // Preview button
  previewBtn.addEventListener('click', () => {
    if (!state.backgroundImageUrl || !state.watermarkImageUrl) {
      return alert('Please upload both background and watermark images first.')
    }
    mainTitle.textContent = 'Watermarked Preview'
    backgroundPreview.innerHTML = 'Processing…'

    const bgImg = new Image()
    bgImg.onload = () => {
      const wmImg = new Image()
      wmImg.onload = async () => {
        try {
          const resizedWm = await new Promise(res => {
            const r = resizeWatermarkIfNeeded(wmImg, bgImg)
            if (r === wmImg) return res(wmImg)
            r.onload = () => res(r)
          })

          const opacity = parseInt(opacitySlider.value, 10) / 100
          const margin = parseInt(marginInput.value, 10) || 0
          const { x, y } = calculateWatermarkPosition(
            bgImg,
            resizedWm,
            gravitySelect.value,
            margin
          )

          const canvas = document.createElement('canvas')
          canvas.width = bgImg.width
          canvas.height = bgImg.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(bgImg, 0, 0)
          ctx.globalAlpha = opacity
          ctx.drawImage(resizedWm, x, y)

          state.resultImageUrl = canvas.toDataURL('image/png')
          const resultImg = new Image()
          resultImg.onload = () => {
            resultImg.style.maxWidth = '100%'
            resultImg.style.maxHeight = '400px'
            backgroundPreview.innerHTML = ''
            backgroundPreview.appendChild(resultImg)
            downloadBtn.disabled = false
          }
          resultImg.src = state.resultImageUrl
        } catch (err) {
          console.error(err)
          backgroundPreview.innerHTML = 'Error processing images.'
        }
      }
      wmImg.src = state.watermarkImageUrl
    }
    bgImg.src = state.backgroundImageUrl
  })

  // Download button
  downloadBtn.addEventListener('click', () => {
    if (!state.resultImageUrl) return
    const a = document.createElement('a')
    a.href = state.resultImageUrl
    a.download = 'watermarked-image.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  })
})
