<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useProjectStore } from '@/stores/project'

const props = defineProps<{
  videoWidth: number
  videoHeight: number
}>()

const emit = defineEmits<{
  (e: 'update', roi: { x: number; y: number; width: number; height: number }): void
}>()

const projectStore = useProjectStore()

const containerRef = ref<HTMLElement | null>(null)
const isSelecting = ref(false)
const startPos = ref({ x: 0, y: 0 })
const currentPos = ref({ x: 0, y: 0 })

const selection = computed(() => {
  if (!isSelecting.value) return null
  
  const x = Math.min(startPos.value.x, currentPos.value.x)
  const y = Math.min(startPos.value.y, currentPos.value.y)
  const width = Math.abs(currentPos.value.x - startPos.value.x)
  const height = Math.abs(currentPos.value.y - startPos.value.y)
  
  // Convert to percentage
  return {
    x: (x / props.videoWidth) * 100,
    y: (y / props.videoHeight) * 100,
    width: (width / props.videoWidth) * 100,
    height: (height / props.videoHeight) * 100
  }
})

function handleMouseDown(e: MouseEvent) {
  if (!containerRef.value) return
  
  const rect = containerRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  isSelecting.value = true
  startPos.value = { x, y }
  currentPos.value = { x, y }
}

function handleMouseMove(e: MouseEvent) {
  if (!isSelecting.value || !containerRef.value) return
  
  const rect = containerRef.value.getBoundingClientRect()
  currentPos.value = {
    x: Math.max(0, Math.min(e.clientX - rect.left, props.videoWidth)),
    y: Math.max(0, Math.min(e.clientY - rect.top, props.videoHeight))
  }
}

function handleMouseUp() {
  if (!isSelecting.value || !selection.value) return
  
  // Emit selection
  emit('update', selection.value)
  
  // Update project store
  projectStore.updateROI({
    x: selection.value.x,
    y: selection.value.y,
    width: selection.value.width,
    height: selection.value.height,
    type: 'custom'
  })
  
  isSelecting.value = false
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    isSelecting.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div 
    ref="containerRef"
    class="roi-selector"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <!-- ROI Overlay -->
    <div 
      v-if="selection"
      class="roi-overlay"
      :style="{
        left: `${selection.x}%`,
        top: `${selection.y}%`,
        width: `${selection.width}%`,
        height: `${selection.height}%`
      }"
    >
      <div class="roi-handle top-left"></div>
      <div class="roi-handle top-right"></div>
      <div class="roi-handle bottom-left"></div>
      <div class="roi-handle bottom-right"></div>
    </div>
    
    <!-- Preset ROIs -->
    <div 
      v-if="projectStore.selectedROI"
      class="roi-display"
      :style="{
        left: `${projectStore.selectedROI.x}%`,
        top: `${projectStore.selectedROI.y}%`,
        width: `${projectStore.selectedROI.width}%`,
        height: `${projectStore.selectedROI.height}%`
      }"
    >
      <span class="roi-label">{{ projectStore.selectedROI.name }}</span>
    </div>
    
    <!-- Instructions -->
    <div v-if="!selection && !projectStore.selectedROI" class="roi-hint">
      拖拽选择字幕区域
    </div>
  </div>
</template>

<style lang="scss" scoped>
.roi-selector {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  
  &:hover {
    background: rgba($primary, 0.02);
  }
}

.roi-overlay {
  position: absolute;
  border: 2px solid $primary;
  background: rgba($primary, 0.15);
  box-shadow: 0 0 20px rgba($primary, 0.3);
  pointer-events: none;
}

.roi-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: $primary;
  border-radius: 50%;
  
  &.top-left {
    top: -5px;
    left: -5px;
  }
  
  &.top-right {
    top: -5px;
    right: -5px;
  }
  
  &.bottom-left {
    bottom: -5px;
    left: -5px;
  }
  
  &.bottom-right {
    bottom: -5px;
    right: -5px;
  }
}

.roi-display {
  position: absolute;
  border: 1px dashed rgba($secondary, 0.6);
  background: rgba($secondary, 0.08);
  pointer-events: none;
}

.roi-label {
  position: absolute;
  top: -20px;
  left: 0;
  font-size: $text-xs;
  color: $secondary;
  background: rgba($bg-base, 0.8);
  padding: 2px 6px;
  border-radius: $radius-sm;
}

.roi-hint {
  position: absolute;
  inset: 0;
  @include flex-center;
  font-size: $text-sm;
  color: $text-muted;
  pointer-events: none;
}
</style>
