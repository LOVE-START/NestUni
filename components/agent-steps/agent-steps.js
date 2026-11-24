/**
 * Agent 工具调用步骤条
 * @description 展示本对话中 Agent 依次执行的工具动作，供 chat 与 adminChat 复用
 */
Component({
  properties: {
    // 步骤列表，元素结构：{ status: string, label: string }
    // status 取值：success / confirm_required / denied / error
    steps: {
      type: Array,
      value: []
    },
    // 当前主题渐变，作为步骤胶囊的淡化底色来源
    gradient: {
      type: String,
      value: ''
    }
  }
});
