<template>
  <div class="quantum-phase-indicator">
    <!-- 量子相位指示器 -->
    <div class="indicator-container">
      <h4>量子相位</h4>
      <div class="phase-display">
        <div 
          v-for="phase in phases" 
          :key="phase.id"
          :class="['phase-item', { active: currentPhase === phase.id }]"
          @click="selectPhase(phase.id)"
        >
          {{ phase.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 量子相位指示器组件
 * 用于显示和选择量子围棋的相位状态
 */
import { ref, computed } from 'vue';

// 量子相位定义
const phases = ref([
  { id: 'classical', name: '经典态' },
  { id: 'quantum', name: '量子态' },
  { id: 'superposition', name: '叠加态' }
]);

// 当前相位
const currentPhase = ref('classical');

/**
 * 选择量子相位
 * @param phaseId 相位ID
 */
const selectPhase = (phaseId: string) => {
  currentPhase.value = phaseId;
  // TODO: 实现相位切换逻辑
};

// 暴露给父组件的方法
defineExpose({
  currentPhase,
  selectPhase
});
</script>

<style scoped lang="scss">
.quantum-phase-indicator {
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  
  .indicator-container {
    h4 {
      margin-bottom: 10px;
      color: #333;
      font-size: 14px;
    }
    
    .phase-display {
      display: flex;
      gap: 8px;
      
      .phase-item {
        padding: 6px 12px;
        background: #e9ecef;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
        
        &:hover {
          background: #dee2e6;
        }
        
        &.active {
          background: #007bff;
          color: white;
        }
      }
    }
  }
}
</style>
