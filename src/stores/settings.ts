import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'dark' | 'light'
export type Language = 'zh-CN' | 'en-US'

export interface Settings {
  theme: Theme
  language: Language
  autoSave: boolean
  autoSaveInterval: number // seconds
  showThumbnails: boolean
  confirmDelete: boolean
  maxHistory: number
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'zh-CN',
  autoSave: true,
  autoSaveInterval: 60,
  showThumbnails: true,
  confirmDelete: true,
  maxHistory: 50
}

export const useSettingsStore = defineStore('settings', () => {
  // Load from localStorage
  function loadSettings(): Settings {
    try {
      const saved = localStorage.getItem('visionsub-settings')
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      }
    } catch (e) {
      console.warn('[Settings] Failed to load settings:', e)
    }
    return { ...DEFAULT_SETTINGS }
  }
  
  const settings = ref<Settings>(loadSettings())
  
  // Persist on change
  watch(settings, (newSettings) => {
    try {
      localStorage.setItem('visionsub-settings', JSON.stringify(newSettings))
    } catch (e) {
      console.warn('[Settings] Failed to save settings:', e)
    }
  }, { deep: true })
  
  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    settings.value[key] = value
  }
  
  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
  }
  
  function toggleTheme() {
    settings.value.theme = settings.value.theme === 'dark' ? 'light' : 'dark'
  }
  
  return {
    settings,
    updateSetting,
    resetSettings,
    toggleTheme
  }
})
