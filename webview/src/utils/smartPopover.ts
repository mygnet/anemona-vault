type SmartPopoverParams = {
  open?: boolean
  padding?: number
  gap?: number
  minHeight?: number
  onClose?: () => void
}

type MaybeScrollable = HTMLElement | Window

function isScrollable(element: HTMLElement): boolean {
  const { overflowY, overflowX } = window.getComputedStyle(element)
  return [overflowY, overflowX].some((value) => value === 'auto' || value === 'scroll' || value === 'overlay')
}

function getScrollParents(node: HTMLElement): MaybeScrollable[] {
  const parents: MaybeScrollable[] = [window]
  let current = node.parentElement

  while (current) {
    if (isScrollable(current)) {
      parents.push(current)
    }
    current = current.parentElement
  }

  return parents
}

export function smartPopover(node: HTMLElement, initialParams: SmartPopoverParams = {}) {
  let params = initialParams
  let frame = 0
  let scrollParents = getScrollParents(node)

  function handlePointerDown(event: PointerEvent) {
    if (!params.open) return

    const wrapper = node.parentElement
    const target = event.target

    if (!(target instanceof Node)) return
    if (wrapper?.contains(target)) return

    params.onClose?.()
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!params.open || event.key !== 'Escape') return
    params.onClose?.()
  }

  function applyPosition() {
    if (!params.open || !node.isConnected) return

    const padding = params.padding ?? 8
    const gap = params.gap ?? 8
    const minHeight = params.minHeight ?? 120
    const triggerRect = node.parentElement?.getBoundingClientRect() ?? node.getBoundingClientRect()

    node.dataset.vertical = 'down'
    node.dataset.horizontal = 'right'
    node.style.removeProperty('--popover-max-height')
    node.style.removeProperty('--popover-max-width')

    const rect = node.getBoundingClientRect()
    const spaceBelow = window.innerHeight - triggerRect.bottom - padding - gap
    const spaceAbove = triggerRect.top - padding - gap
    const shouldOpenUp = rect.bottom > window.innerHeight - padding && spaceAbove > spaceBelow
    const availableHeight = Math.max(minHeight, shouldOpenUp ? spaceAbove : spaceBelow)

    if (shouldOpenUp) {
      node.dataset.vertical = 'up'
    }

    node.style.setProperty('--popover-max-height', `${availableHeight}px`)
    node.style.setProperty('--popover-max-width', `${Math.max(160, window.innerWidth - padding * 2)}px`)

    const nextRect = node.getBoundingClientRect()
    if (nextRect.left < padding) {
      node.dataset.horizontal = 'left'
    }
  }

  function schedulePosition() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(applyPosition)
  }

  function bindListeners() {
    scrollParents = getScrollParents(node)
    for (const parent of scrollParents) {
      parent.addEventListener('scroll', schedulePosition, { passive: true })
    }
    window.addEventListener('resize', schedulePosition)
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
  }

  function unbindListeners() {
    for (const parent of scrollParents) {
      parent.removeEventListener('scroll', schedulePosition)
    }
    window.removeEventListener('resize', schedulePosition)
    document.removeEventListener('pointerdown', handlePointerDown, true)
    document.removeEventListener('keydown', handleKeyDown)
  }

  bindListeners()
  schedulePosition()

  return {
    update(nextParams: SmartPopoverParams = {}) {
      params = nextParams
      schedulePosition()
    },
    destroy() {
      cancelAnimationFrame(frame)
      unbindListeners()
    },
  }
}
